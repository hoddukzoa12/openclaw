/**
 * Permit2 Types
 *
 * Type definitions for Permit2 integration
 * Based on Uniswap Permit2: https://github.com/Uniswap/permit2
 */

export interface Permit2Config {
  // Chain-specific Permit2 contract addresses
  permit2Address: `0x${string}`;
  // USDC contract address
  usdcAddress: `0x${string}`;
  // Spender address (our payment contract/facilitator)
  spenderAddress: `0x${string}`;
  // Chain ID
  chainId: number;
  // RPC URL
  rpcUrl: string;
}

export interface PermitSingle {
  details: PermitDetails;
  spender: `0x${string}`;
  sigDeadline: bigint;
}

export interface PermitDetails {
  token: `0x${string}`;
  amount: bigint;
  expiration: number;
  nonce: number;
}

export interface PermitBatch {
  details: PermitDetails[];
  spender: `0x${string}`;
  sigDeadline: bigint;
}

export interface SignatureTransfer {
  permitted: TokenPermissions;
  spender: `0x${string}`;
  nonce: bigint;
  deadline: bigint;
}

export interface TokenPermissions {
  token: `0x${string}`;
  amount: bigint;
}

export interface AllowanceData {
  amount: bigint;
  expiration: number;
  nonce: number;
}

export interface Permit2ApprovalStatus {
  hasTokenApproval: boolean;
  hasPermit2Allowance: boolean;
  allowanceAmount: bigint;
  allowanceExpiration: number;
  needsApproval: boolean;
  needsPermit2Allowance: boolean;
}

export interface Permit2TransferParams {
  from: `0x${string}`;
  to: `0x${string}`;
  amount: bigint;
  signature: `0x${string}`;
  permit: SignatureTransfer;
}

// Permit2 canonical addresses (same on all EVM chains)
export const PERMIT2_ADDRESS = "0x000000000022D473030F116dDEE9F6B43aC78BA3" as const;

// USDC addresses by chain
export const USDC_ADDRESSES = {
  // Base Mainnet
  8453: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  // Base Sepolia
  84532: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
} as const;

// Default configurations by chain
export const PERMIT2_CONFIGS: Record<number, Permit2Config> = {
  // Base Sepolia
  84532: {
    permit2Address: PERMIT2_ADDRESS,
    usdcAddress: USDC_ADDRESSES[84532] as `0x${string}`,
    spenderAddress: "0x0000000000000000000000000000000000000000" as `0x${string}`, // Set by config
    chainId: 84532,
    rpcUrl: "https://sepolia.base.org",
  },
  // Base Mainnet
  8453: {
    permit2Address: PERMIT2_ADDRESS,
    usdcAddress: USDC_ADDRESSES[8453] as `0x${string}`,
    spenderAddress: "0x0000000000000000000000000000000000000000" as `0x${string}`, // Set by config
    chainId: 8453,
    rpcUrl: "https://mainnet.base.org",
  },
};
