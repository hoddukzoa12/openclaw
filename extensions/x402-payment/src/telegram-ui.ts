/**
 * Telegram Payment UI Components
 *
 * Provides Telegram-specific UI elements for the payment flow:
 * - Inline keyboard buttons for payment
 * - Payment status messages
 * - Transaction confirmation messages
 */

import type { X402PaymentConfig, PaymentSession, PaymentRequest } from "./types.js";
import { NETWORK_NAMES } from "./types.js";

export interface TelegramInlineButton {
  text: string;
  url?: string;
  callback_data?: string;
}

export interface TelegramKeyboard {
  inline_keyboard: TelegramInlineButton[][];
}

/**
 * Create a payment request keyboard with pay button
 */
export function createPaymentKeyboard(
  paymentUrl: string,
  config: X402PaymentConfig,
): TelegramKeyboard {
  const networkName = NETWORK_NAMES[config.network] || config.network;

  return {
    inline_keyboard: [
      [
        {
          text: `Pay ${config.pricePerMessage} USDC`,
          url: paymentUrl,
        },
      ],
      [
        {
          text: `Network: ${networkName}`,
          callback_data: "x402_network_info",
        },
      ],
    ],
  };
}

/**
 * Create a payment confirmation keyboard
 */
export function createConfirmationKeyboard(txHash: string, network: string): TelegramKeyboard {
  const explorerUrl = getExplorerUrl(txHash, network);

  return {
    inline_keyboard: [
      [
        {
          text: "View Transaction",
          url: explorerUrl,
        },
      ],
    ],
  };
}

/**
 * Get block explorer URL for a transaction
 */
export function getExplorerUrl(txHash: string, network: string): string {
  const explorers: Record<string, string> = {
    "eip155:8453": "https://basescan.org/tx/",
    "eip155:84532": "https://sepolia.basescan.org/tx/",
  };

  const baseUrl = explorers[network] || "https://basescan.org/tx/";
  return `${baseUrl}${txHash}`;
}

/**
 * Format payment required message
 */
export function formatPaymentRequiredMessage(
  session: PaymentSession,
  config: X402PaymentConfig,
): string {
  const networkName = NETWORK_NAMES[config.network] || config.network;
  const freeRemaining =
    config.freeMessagesPerSession - (session.messageCount - session.paidMessageCount);

  if (freeRemaining > 0) {
    return "";
  }

  return [
    "Payment Required",
    "",
    `Your free messages have been used.`,
    `To continue chatting with AI, please pay ${config.pricePerMessage} USDC.`,
    "",
    `Network: ${networkName}`,
    `Token: USDC`,
    "",
    "Tap the button below to pay securely with your crypto wallet.",
  ].join("\n");
}

/**
 * Format payment success message
 */
export function formatPaymentSuccessMessage(
  txHash: string,
  amount: string,
  network: string,
): string {
  const networkName = NETWORK_NAMES[network] || network;
  const shortTxHash = `${txHash.slice(0, 10)}...${txHash.slice(-8)}`;

  return [
    "Payment Successful!",
    "",
    `Amount: ${amount} USDC`,
    `Network: ${networkName}`,
    `TX: ${shortTxHash}`,
    "",
    "You can now continue your conversation.",
  ].join("\n");
}

/**
 * Format payment pending message
 */
export function formatPaymentPendingMessage(paymentRequest: PaymentRequest): string {
  const expiresIn = Math.max(0, Math.floor((paymentRequest.expiresAt - Date.now()) / 60000));

  return [
    "Payment Pending",
    "",
    `Amount: ${paymentRequest.amount} USDC`,
    `Expires in: ${expiresIn} minutes`,
    "",
    "Complete the payment to continue.",
  ].join("\n");
}

/**
 * Format payment expired message
 */
export function formatPaymentExpiredMessage(): string {
  return [
    "Payment Expired",
    "",
    "Your payment request has expired.",
    "Send a new message to generate a new payment link.",
  ].join("\n");
}

/**
 * Format payment failed message
 */
export function formatPaymentFailedMessage(error: string): string {
  return [
    "Payment Failed",
    "",
    `Error: ${error}`,
    "",
    "Please try again or contact support if the issue persists.",
  ].join("\n");
}

/**
 * Format free messages remaining message
 */
export function formatFreeMessagesMessage(remaining: number): string {
  if (remaining <= 0) {
    return "";
  }

  if (remaining === 1) {
    return "You have 1 free message remaining.";
  }

  return `You have ${remaining} free messages remaining.`;
}

/**
 * Format session stats message
 */
export function formatSessionStatsMessage(stats: {
  totalMessages: number;
  paidMessages: number;
  unpaidMessages: number;
  totalSpent: string;
}): string {
  return [
    "Session Statistics",
    "",
    `Total messages: ${stats.totalMessages}`,
    `Paid messages: ${stats.paidMessages}`,
    `Total spent: ${stats.totalSpent}`,
  ].join("\n");
}

/**
 * Create a wallet connection prompt keyboard
 */
export function createWalletConnectKeyboard(connectUrl: string): TelegramKeyboard {
  return {
    inline_keyboard: [
      [
        {
          text: "Connect Wallet",
          url: connectUrl,
        },
      ],
      [
        {
          text: "What is this?",
          callback_data: "x402_help",
        },
      ],
    ],
  };
}

/**
 * Format help message explaining x402 payments
 */
export function formatHelpMessage(): string {
  return [
    "About x402 Payments",
    "",
    "This AI uses x402, an open payment protocol that enables instant, low-fee USDC payments.",
    "",
    "How it works:",
    "1. You get a few free messages to try",
    "2. After that, each AI response costs a small fee",
    "3. Pay directly from your crypto wallet",
    "4. Payments settle instantly on Base network",
    "",
    "Supported wallets:",
    "- MetaMask",
    "- Coinbase Wallet",
    "- Rainbow",
    "- Any WalletConnect-compatible wallet",
    "",
    "Learn more: x402.org",
  ].join("\n");
}
