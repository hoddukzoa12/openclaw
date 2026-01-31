/**
 * Permit2 Auto-Payment System
 *
 * Handles automatic payment processing using Permit2 signatures:
 * - Track user allowances and signatures
 * - Process payments automatically when user has pre-approved
 * - Manage payment batching for efficiency
 */

import { formatUnits, parseUnits } from "viem";
import { createPermit2Client, Permit2Client } from "./permit2-client.js";
import type { SignatureTransfer, Permit2Config } from "./types.js";

export interface UserPaymentAuthorization {
  userAddress: `0x${string}`;
  // Pre-signed permit for automatic payments
  permitSignature?: `0x${string}`;
  permit?: SignatureTransfer;
  // Maximum amount authorized (from Permit2 allowance)
  authorizedAmount: bigint;
  // Amount already spent from this authorization
  spentAmount: bigint;
  // Expiration timestamp
  expiresAt: number;
  // Created timestamp
  createdAt: number;
}

export interface PaymentRequest {
  userId: string;
  userAddress: `0x${string}`;
  amount: bigint;
  reason: string;
  metadata?: Record<string, unknown>;
}

export interface PaymentResult {
  success: boolean;
  txHash?: string;
  error?: string;
  remainingBalance?: bigint;
}

export interface AutoPaymentConfig {
  chainId: number;
  spenderAddress: `0x${string}`;
  recipientAddress: `0x${string}`;
  // Minimum balance to maintain before requiring new approval
  minBalanceThreshold?: bigint;
  // Maximum payment per transaction
  maxPaymentAmount?: bigint;
}

// In-memory storage for user authorizations
// In production, this should be persisted to a database
const userAuthorizations = new Map<string, UserPaymentAuthorization>();

// Pending payments queue
const pendingPayments: PaymentRequest[] = [];

export class AutoPaymentProcessor {
  private client: Permit2Client;
  private config: AutoPaymentConfig;

  constructor(config: AutoPaymentConfig) {
    this.config = {
      ...config,
      minBalanceThreshold: config.minBalanceThreshold ?? parseUnits("1", 6), // 1 USDC
      maxPaymentAmount: config.maxPaymentAmount ?? parseUnits("100", 6), // 100 USDC
    };
    this.client = createPermit2Client(config.chainId, {
      spenderAddress: config.spenderAddress,
    });
  }

  /**
   * Register a user's payment authorization
   */
  async registerAuthorization(
    userId: string,
    userAddress: `0x${string}`,
    authorizedAmount: bigint,
    expiresAt: number,
    permitSignature?: `0x${string}`,
    permit?: SignatureTransfer
  ): Promise<void> {
    const key = this.getUserKey(userId, userAddress);

    const authorization: UserPaymentAuthorization = {
      userAddress,
      permitSignature,
      permit,
      authorizedAmount,
      spentAmount: BigInt(0),
      expiresAt,
      createdAt: Date.now(),
    };

    userAuthorizations.set(key, authorization);
  }

  /**
   * Check if user has sufficient authorization for a payment
   */
  async checkAuthorization(
    userId: string,
    userAddress: `0x${string}`,
    amount: bigint
  ): Promise<{
    authorized: boolean;
    remainingBalance: bigint;
    needsReauthorization: boolean;
    message: string;
  }> {
    const key = this.getUserKey(userId, userAddress);
    const auth = userAuthorizations.get(key);

    // No authorization found
    if (!auth) {
      return {
        authorized: false,
        remainingBalance: BigInt(0),
        needsReauthorization: true,
        message: "No payment authorization found. Please set up automatic payments.",
      };
    }

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (auth.expiresAt <= now) {
      return {
        authorized: false,
        remainingBalance: BigInt(0),
        needsReauthorization: true,
        message: "Your payment authorization has expired. Please reauthorize.",
      };
    }

    // Check remaining balance
    const remainingBalance = auth.authorizedAmount - auth.spentAmount;
    if (remainingBalance < amount) {
      return {
        authorized: false,
        remainingBalance,
        needsReauthorization: true,
        message: `Insufficient authorized balance. Remaining: ${formatUnits(remainingBalance, 6)} USDC`,
      };
    }

    // Check on-chain allowance
    const onChainStatus = await this.client.checkApprovalStatus(
      userAddress,
      this.config.spenderAddress,
      amount
    );

    if (onChainStatus.needsApproval || onChainStatus.needsPermit2Allowance) {
      return {
        authorized: false,
        remainingBalance,
        needsReauthorization: true,
        message: "On-chain authorization expired. Please reauthorize.",
      };
    }

    // All checks passed
    return {
      authorized: true,
      remainingBalance,
      needsReauthorization: remainingBalance < (this.config.minBalanceThreshold ?? BigInt(0)),
      message: `Authorization valid. Balance: ${formatUnits(remainingBalance, 6)} USDC`,
    };
  }

  /**
   * Process a payment using pre-authorized signature
   * Note: In a real implementation, this would submit the transaction on-chain
   */
  async processPayment(request: PaymentRequest): Promise<PaymentResult> {
    const { userId, userAddress, amount, reason } = request;

    // Validate amount
    if (amount > (this.config.maxPaymentAmount ?? BigInt(0))) {
      return {
        success: false,
        error: `Amount exceeds maximum: ${formatUnits(this.config.maxPaymentAmount ?? BigInt(0), 6)} USDC`,
      };
    }

    // Check authorization
    const authCheck = await this.checkAuthorization(userId, userAddress, amount);
    if (!authCheck.authorized) {
      return {
        success: false,
        error: authCheck.message,
      };
    }

    const key = this.getUserKey(userId, userAddress);
    const auth = userAuthorizations.get(key);

    if (!auth) {
      return {
        success: false,
        error: "Authorization not found",
      };
    }

    // In production, this would:
    // 1. Build the permitTransferFrom transaction
    // 2. Submit it to the blockchain
    // 3. Wait for confirmation
    // For now, we simulate success and update local state

    // Update spent amount
    auth.spentAmount += amount;
    userAuthorizations.set(key, auth);

    const remainingBalance = auth.authorizedAmount - auth.spentAmount;

    // Log payment
    console.log(
      `[AutoPayment] Processed ${formatUnits(amount, 6)} USDC from ${userAddress} for: ${reason}`
    );

    return {
      success: true,
      txHash: `0x${Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("hex")}`, // Simulated
      remainingBalance,
    };
  }

  /**
   * Queue a payment for batch processing
   */
  queuePayment(request: PaymentRequest): void {
    pendingPayments.push(request);
  }

  /**
   * Process all pending payments
   */
  async processPendingPayments(): Promise<PaymentResult[]> {
    const results: PaymentResult[] = [];

    while (pendingPayments.length > 0) {
      const request = pendingPayments.shift();
      if (request) {
        const result = await this.processPayment(request);
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Get user's current authorization status
   */
  getAuthorizationStatus(
    userId: string,
    userAddress: `0x${string}`
  ): UserPaymentAuthorization | null {
    const key = this.getUserKey(userId, userAddress);
    return userAuthorizations.get(key) ?? null;
  }

  /**
   * Revoke a user's authorization
   */
  revokeAuthorization(userId: string, userAddress: `0x${string}`): boolean {
    const key = this.getUserKey(userId, userAddress);
    return userAuthorizations.delete(key);
  }

  /**
   * Get usage statistics for a user
   */
  getUsageStats(userId: string, userAddress: `0x${string}`): {
    totalAuthorized: string;
    totalSpent: string;
    remainingBalance: string;
    expiresAt: Date | null;
  } | null {
    const auth = this.getAuthorizationStatus(userId, userAddress);
    if (!auth) return null;

    return {
      totalAuthorized: formatUnits(auth.authorizedAmount, 6),
      totalSpent: formatUnits(auth.spentAmount, 6),
      remainingBalance: formatUnits(auth.authorizedAmount - auth.spentAmount, 6),
      expiresAt: auth.expiresAt > 0 ? new Date(auth.expiresAt * 1000) : null,
    };
  }

  /**
   * Generate unique key for user authorization
   */
  private getUserKey(userId: string, userAddress: `0x${string}`): string {
    return `${userId}:${userAddress.toLowerCase()}`;
  }

  /**
   * Get client
   */
  getClient(): Permit2Client {
    return this.client;
  }
}

/**
 * Create auto-payment processor instance
 */
export function createAutoPaymentProcessor(
  config: AutoPaymentConfig
): AutoPaymentProcessor {
  return new AutoPaymentProcessor(config);
}

/**
 * Calculate payment amount from usage
 */
export function calculatePaymentAmount(
  usage: {
    promptTokens: number;
    completionTokens: number;
  },
  pricing: {
    promptPricePerMillion: number;
    completionPricePerMillion: number;
  }
): bigint {
  const promptCost = (usage.promptTokens / 1_000_000) * pricing.promptPricePerMillion;
  const completionCost =
    (usage.completionTokens / 1_000_000) * pricing.completionPricePerMillion;
  const totalCost = promptCost + completionCost;

  // Convert to USDC (6 decimals)
  return parseUnits(totalCost.toFixed(6), 6);
}
