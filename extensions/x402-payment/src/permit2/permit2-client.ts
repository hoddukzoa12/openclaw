/**
 * Permit2 Client
 *
 * Client for interacting with Uniswap Permit2 contract
 * Enables gasless token approvals and transfers via signatures
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  type PublicClient,
  type WalletClient,
  type Chain,
  encodeFunctionData,
  keccak256,
  encodeAbiParameters,
  parseAbiParameters,
} from "viem";
import { baseSepolia, base } from "viem/chains";
import type {
  Permit2Config,
  AllowanceData,
  Permit2ApprovalStatus,
  SignatureTransfer,
  TokenPermissions,
} from "./types.js";
import { PERMIT2_ADDRESS, PERMIT2_CONFIGS, USDC_ADDRESSES } from "./types.js";

// Permit2 ABI fragments
const PERMIT2_ABI = [
  {
    inputs: [
      { name: "owner", type: "address" },
      { name: "token", type: "address" },
      { name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [
      { name: "amount", type: "uint160" },
      { name: "expiration", type: "uint48" },
      { name: "nonce", type: "uint48" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "owner", type: "address" },
      {
        components: [
          {
            components: [
              { name: "token", type: "address" },
              { name: "amount", type: "uint160" },
              { name: "expiration", type: "uint48" },
              { name: "nonce", type: "uint48" },
            ],
            name: "details",
            type: "tuple",
          },
          { name: "spender", type: "address" },
          { name: "sigDeadline", type: "uint256" },
        ],
        name: "permitSingle",
        type: "tuple",
      },
      { name: "signature", type: "bytes" },
    ],
    name: "permit",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          {
            components: [
              { name: "token", type: "address" },
              { name: "amount", type: "uint256" },
            ],
            name: "permitted",
            type: "tuple",
          },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
        name: "permit",
        type: "tuple",
      },
      {
        components: [
          { name: "to", type: "address" },
          { name: "requestedAmount", type: "uint256" },
        ],
        name: "transferDetails",
        type: "tuple",
      },
      { name: "owner", type: "address" },
      { name: "signature", type: "bytes" },
    ],
    name: "permitTransferFrom",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

// ERC20 ABI fragments
const ERC20_ABI = [
  {
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

// EIP-712 type hashes for Permit2
const PERMIT_TRANSFER_FROM_TYPEHASH = keccak256(
  encodeAbiParameters(parseAbiParameters("string"), [
    "PermitTransferFrom(TokenPermissions permitted,address spender,uint256 nonce,uint256 deadline)TokenPermissions(address token,uint256 amount)",
  ])
);

export class Permit2Client {
  private publicClient: PublicClient;
  private config: Permit2Config;
  private chain: Chain;

  constructor(chainId: number = 84532, customConfig?: Partial<Permit2Config>) {
    this.chain = chainId === 8453 ? base : baseSepolia;
    this.config = {
      ...PERMIT2_CONFIGS[chainId],
      ...customConfig,
    } as Permit2Config;

    this.publicClient = createPublicClient({
      chain: this.chain,
      transport: http(this.config.rpcUrl),
    });
  }

  /**
   * Get the Permit2 allowance for a token/spender pair
   */
  async getAllowance(
    owner: `0x${string}`,
    token: `0x${string}`,
    spender: `0x${string}`
  ): Promise<AllowanceData> {
    const result = await this.publicClient.readContract({
      address: PERMIT2_ADDRESS,
      abi: PERMIT2_ABI,
      functionName: "allowance",
      args: [owner, token, spender],
    });

    const [amount, expiration, nonce] = result as [bigint, number, number];

    return {
      amount,
      expiration,
      nonce,
    };
  }

  /**
   * Check if token has been approved to Permit2
   */
  async getTokenAllowance(
    owner: `0x${string}`,
    token: `0x${string}`
  ): Promise<bigint> {
    const result = await this.publicClient.readContract({
      address: token,
      abi: ERC20_ABI,
      functionName: "allowance",
      args: [owner, PERMIT2_ADDRESS],
    });

    return result as bigint;
  }

  /**
   * Check full approval status for a user
   */
  async checkApprovalStatus(
    owner: `0x${string}`,
    spender: `0x${string}`,
    requiredAmount: bigint
  ): Promise<Permit2ApprovalStatus> {
    const [tokenAllowance, permit2Allowance] = await Promise.all([
      this.getTokenAllowance(owner, this.config.usdcAddress),
      this.getAllowance(owner, this.config.usdcAddress, spender),
    ]);

    const now = Math.floor(Date.now() / 1000);
    const isAllowanceValid =
      permit2Allowance.amount >= requiredAmount &&
      permit2Allowance.expiration > now;

    return {
      hasTokenApproval: tokenAllowance >= requiredAmount,
      hasPermit2Allowance: isAllowanceValid,
      allowanceAmount: permit2Allowance.amount,
      allowanceExpiration: permit2Allowance.expiration,
      needsApproval: tokenAllowance < requiredAmount,
      needsPermit2Allowance: !isAllowanceValid,
    };
  }

  /**
   * Generate EIP-712 typed data for PermitTransferFrom
   */
  generatePermitTransferFromTypedData(
    token: `0x${string}`,
    amount: bigint,
    spender: `0x${string}`,
    nonce: bigint,
    deadline: bigint
  ) {
    return {
      domain: {
        name: "Permit2",
        chainId: this.config.chainId,
        verifyingContract: PERMIT2_ADDRESS,
      },
      types: {
        PermitTransferFrom: [
          { name: "permitted", type: "TokenPermissions" },
          { name: "spender", type: "address" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
        TokenPermissions: [
          { name: "token", type: "address" },
          { name: "amount", type: "uint256" },
        ],
      },
      primaryType: "PermitTransferFrom" as const,
      message: {
        permitted: {
          token,
          amount,
        },
        spender,
        nonce,
        deadline,
      },
    };
  }

  /**
   * Generate EIP-712 typed data for PermitSingle (approval)
   */
  generatePermitSingleTypedData(
    token: `0x${string}`,
    amount: bigint,
    spender: `0x${string}`,
    expiration: number,
    nonce: number,
    sigDeadline: bigint
  ) {
    return {
      domain: {
        name: "Permit2",
        chainId: this.config.chainId,
        verifyingContract: PERMIT2_ADDRESS,
      },
      types: {
        PermitSingle: [
          { name: "details", type: "PermitDetails" },
          { name: "spender", type: "address" },
          { name: "sigDeadline", type: "uint256" },
        ],
        PermitDetails: [
          { name: "token", type: "address" },
          { name: "amount", type: "uint160" },
          { name: "expiration", type: "uint48" },
          { name: "nonce", type: "uint48" },
        ],
      },
      primaryType: "PermitSingle" as const,
      message: {
        details: {
          token,
          amount,
          expiration,
          nonce,
        },
        spender,
        sigDeadline,
      },
    };
  }

  /**
   * Build approve transaction data for USDC to Permit2
   */
  buildApproveTransaction(amount: bigint = BigInt(2) ** BigInt(256) - BigInt(1)) {
    return {
      to: this.config.usdcAddress,
      data: encodeFunctionData({
        abi: ERC20_ABI,
        functionName: "approve",
        args: [PERMIT2_ADDRESS, amount],
      }),
    };
  }

  /**
   * Build permitTransferFrom transaction data
   */
  buildPermitTransferFromTransaction(
    permit: SignatureTransfer,
    to: `0x${string}`,
    amount: bigint,
    owner: `0x${string}`,
    signature: `0x${string}`
  ) {
    return {
      to: PERMIT2_ADDRESS,
      data: encodeFunctionData({
        abi: PERMIT2_ABI,
        functionName: "permitTransferFrom",
        args: [
          {
            permitted: permit.permitted,
            nonce: permit.nonce,
            deadline: permit.deadline,
          },
          {
            to,
            requestedAmount: amount,
          },
          owner,
          signature,
        ],
      }),
    };
  }

  /**
   * Get a unique nonce for signature-based transfers
   * Uses a random nonce in the allowed range
   */
  generateNonce(): bigint {
    // Permit2 uses word-based nonces for SignatureTransfer
    // Each word has 256 bits, we use random values
    const randomBytes = crypto.getRandomValues(new Uint8Array(8));
    let nonce = BigInt(0);
    for (const byte of randomBytes) {
      nonce = (nonce << BigInt(8)) | BigInt(byte);
    }
    return nonce;
  }

  /**
   * Get config
   */
  getConfig(): Permit2Config {
    return this.config;
  }

  /**
   * Get USDC address for current chain
   */
  getUsdcAddress(): `0x${string}` {
    return this.config.usdcAddress;
  }

  /**
   * Get Permit2 address
   */
  getPermit2Address(): `0x${string}` {
    return PERMIT2_ADDRESS;
  }
}

/**
 * Create a Permit2 client instance
 */
export function createPermit2Client(
  chainId: number = 84532,
  customConfig?: Partial<Permit2Config>
): Permit2Client {
  return new Permit2Client(chainId, customConfig);
}
