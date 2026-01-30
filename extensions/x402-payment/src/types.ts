/**
 * x402 Payment Plugin Types
 */

export interface X402PaymentConfig {
  enabled: boolean;
  network: string; // CAIP-2 format: eip155:8453 (Base Mainnet) or eip155:84532 (Base Sepolia)
  payTo: string; // 0x... wallet address
  pricePerMessage: string; // e.g., "$0.01"
  facilitatorUrl: string;
  privateKey?: string; // For client-side signing (testing)
  freeMessagesPerSession: number;
  telegramPaymentBotUrl: string;
}

export interface PaymentSession {
  sessionKey: string;
  channelId: string;
  userId: string;
  messageCount: number;
  paidMessageCount: number;
  lastPaymentTxHash?: string;
  lastPaymentTimestamp?: number;
  pendingPaymentId?: string;
  walletAddress?: string; // User's connected wallet
}

export interface PaymentRequest {
  id: string;
  sessionKey: string;
  amount: string; // "$0.01"
  network: string;
  payTo: string;
  status: "pending" | "paid" | "expired" | "failed";
  createdAt: number;
  expiresAt: number;
  txHash?: string;
}

export interface PaymentResult {
  success: boolean;
  txHash?: string;
  network?: string;
  payer?: string;
  error?: string;
}

export interface TelegramPaymentButton {
  text: string;
  url?: string;
  callback_data?: string;
}

export interface PaymentRequiredResponse {
  x402Version: number;
  accepts: PaymentAccept[];
  resource: Record<string, unknown>;
  extensions?: Record<string, unknown>;
}

export interface PaymentAccept {
  scheme: "exact";
  network: string;
  payTo: string;
  price: string;
}

// Network constants
export const NETWORKS = {
  BASE_MAINNET: "eip155:8453",
  BASE_SEPOLIA: "eip155:84532",
} as const;

export const NETWORK_NAMES: Record<string, string> = {
  "eip155:8453": "Base Mainnet",
  "eip155:84532": "Base Sepolia (Testnet)",
};

// Default facilitator URLs
export const FACILITATORS = {
  TESTNET: "https://x402.org/facilitator",
  MAINNET: "https://api.cdp.coinbase.com/platform/v2/x402",
} as const;
