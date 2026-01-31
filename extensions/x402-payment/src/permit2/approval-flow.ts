/**
 * Permit2 Approval Flow
 *
 * Handles the user approval flow for Permit2:
 * 1. Check if USDC is approved to Permit2
 * 2. If not, prompt user to approve USDC to Permit2 (one-time)
 * 3. Check/set Permit2 allowance for our spender
 * 4. Generate approval UI messages for Telegram
 */

import { formatUnits, parseUnits } from "viem";
import { createPermit2Client, Permit2Client } from "./permit2-client.js";
import type { Permit2ApprovalStatus } from "./types.js";
import { PERMIT2_ADDRESS } from "./types.js";

export interface ApprovalFlowConfig {
  chainId: number;
  spenderAddress: `0x${string}`;
  // Default approval amount (max uint256 for unlimited)
  defaultApprovalAmount?: bigint;
  // Minimum allowance before prompting for re-approval
  minAllowanceThreshold?: bigint;
}

export interface ApprovalCheckResult {
  needsTokenApproval: boolean;
  needsPermit2Approval: boolean;
  currentAllowance: bigint;
  allowanceExpiration: number;
  approvalUrl?: string;
  message: string;
}

export interface ApprovalStep {
  type: "token_approval" | "permit2_signature";
  title: string;
  description: string;
  actionUrl?: string;
  transactionData?: {
    to: `0x${string}`;
    data: `0x${string}`;
    value?: bigint;
  };
}

const DEFAULT_APPROVAL_AMOUNT = BigInt(2) ** BigInt(256) - BigInt(1); // Max uint256
const MIN_ALLOWANCE_THRESHOLD = parseUnits("100", 6); // 100 USDC

export class Permit2ApprovalFlow {
  private client: Permit2Client;
  private config: ApprovalFlowConfig;

  constructor(config: ApprovalFlowConfig) {
    this.config = {
      ...config,
      defaultApprovalAmount: config.defaultApprovalAmount ?? DEFAULT_APPROVAL_AMOUNT,
      minAllowanceThreshold: config.minAllowanceThreshold ?? MIN_ALLOWANCE_THRESHOLD,
    };
    this.client = createPermit2Client(config.chainId, {
      spenderAddress: config.spenderAddress,
    });
  }

  /**
   * Check if a user needs to perform any approvals
   */
  async checkApprovalNeeded(
    userAddress: `0x${string}`,
    requiredAmount: bigint
  ): Promise<ApprovalCheckResult> {
    const status = await this.client.checkApprovalStatus(
      userAddress,
      this.config.spenderAddress,
      requiredAmount
    );

    // Determine what approvals are needed
    if (status.needsApproval) {
      return {
        needsTokenApproval: true,
        needsPermit2Approval: true, // Will need this after token approval
        currentAllowance: BigInt(0),
        allowanceExpiration: 0,
        message: this.formatTokenApprovalMessage(),
      };
    }

    if (status.needsPermit2Allowance) {
      return {
        needsTokenApproval: false,
        needsPermit2Approval: true,
        currentAllowance: status.allowanceAmount,
        allowanceExpiration: status.allowanceExpiration,
        message: this.formatPermit2ApprovalMessage(requiredAmount),
      };
    }

    return {
      needsTokenApproval: false,
      needsPermit2Approval: false,
      currentAllowance: status.allowanceAmount,
      allowanceExpiration: status.allowanceExpiration,
      message: "Approval already granted. Payments will be processed automatically.",
    };
  }

  /**
   * Get the approval steps needed for a user
   */
  async getApprovalSteps(
    userAddress: `0x${string}`,
    requiredAmount: bigint
  ): Promise<ApprovalStep[]> {
    const status = await this.client.checkApprovalStatus(
      userAddress,
      this.config.spenderAddress,
      requiredAmount
    );

    const steps: ApprovalStep[] = [];

    // Step 1: Token approval to Permit2 (if needed)
    if (status.needsApproval) {
      const txData = this.client.buildApproveTransaction(
        this.config.defaultApprovalAmount
      );
      steps.push({
        type: "token_approval",
        title: "Approve USDC",
        description:
          "Allow Permit2 to access your USDC. This is a one-time approval that enables gasless payments.",
        transactionData: {
          to: this.client.getUsdcAddress(),
          data: txData.data as `0x${string}`,
        },
      });
    }

    // Step 2: Permit2 signature (if needed)
    if (status.needsApproval || status.needsPermit2Allowance) {
      steps.push({
        type: "permit2_signature",
        title: "Authorize Payments",
        description:
          "Sign a message to authorize automatic USDC payments. No gas fee required.",
      });
    }

    return steps;
  }

  /**
   * Generate the EIP-712 typed data for Permit2 approval
   */
  generateApprovalTypedData(
    userAddress: `0x${string}`,
    amount: bigint,
    expirationDays: number = 30
  ) {
    const now = Math.floor(Date.now() / 1000);
    const expiration = now + expirationDays * 24 * 60 * 60;
    const sigDeadline = BigInt(now + 60 * 60); // 1 hour to sign
    const nonce = 0; // Will be fetched from contract

    return this.client.generatePermitSingleTypedData(
      this.client.getUsdcAddress(),
      amount,
      this.config.spenderAddress,
      expiration,
      nonce,
      sigDeadline
    );
  }

  /**
   * Generate the EIP-712 typed data for a single transfer
   */
  generateTransferTypedData(amount: bigint, deadlineMinutes: number = 30) {
    const deadline = BigInt(Math.floor(Date.now() / 1000) + deadlineMinutes * 60);
    const nonce = this.client.generateNonce();

    return {
      typedData: this.client.generatePermitTransferFromTypedData(
        this.client.getUsdcAddress(),
        amount,
        this.config.spenderAddress,
        nonce,
        deadline
      ),
      nonce,
      deadline,
    };
  }

  /**
   * Format message for initial token approval
   */
  private formatTokenApprovalMessage(): string {
    return [
      "One-Time Setup Required",
      "",
      "To enable automatic payments, you need to approve USDC for Permit2.",
      "",
      "This is a one-time transaction that allows gasless payments in the future.",
      "",
      "Click the button below to approve:",
    ].join("\n");
  }

  /**
   * Format message for Permit2 allowance
   */
  private formatPermit2ApprovalMessage(amount: bigint): string {
    const formattedAmount = formatUnits(amount, 6);
    return [
      "Authorize Payments",
      "",
      `Set a spending limit of ${formattedAmount} USDC for automatic payments.`,
      "",
      "This only requires a signature - no gas fee!",
      "",
      "Sign the message in your wallet to continue:",
    ].join("\n");
  }

  /**
   * Get client instance
   */
  getClient(): Permit2Client {
    return this.client;
  }
}

/**
 * Generate approval UI for Telegram
 */
export function generateApprovalUI(
  steps: ApprovalStep[],
  baseUrl: string
): {
  message: string;
  buttons: Array<{ text: string; url: string }>;
} {
  if (steps.length === 0) {
    return {
      message: "You're all set! Payments will be processed automatically.",
      buttons: [],
    };
  }

  const currentStep = steps[0];
  const message = [
    `Step ${1} of ${steps.length}: ${currentStep.title}`,
    "",
    currentStep.description,
  ].join("\n");

  const buttons = [];

  if (currentStep.type === "token_approval" && currentStep.transactionData) {
    // Generate URL for token approval transaction
    const approvalUrl = `${baseUrl}/approve?to=${currentStep.transactionData.to}&data=${currentStep.transactionData.data}`;
    buttons.push({
      text: "Approve USDC",
      url: approvalUrl,
    });
  } else if (currentStep.type === "permit2_signature") {
    buttons.push({
      text: "Sign Authorization",
      url: `${baseUrl}/sign`,
    });
  }

  return { message, buttons };
}

/**
 * Create approval flow instance
 */
export function createApprovalFlow(config: ApprovalFlowConfig): Permit2ApprovalFlow {
  return new Permit2ApprovalFlow(config);
}
