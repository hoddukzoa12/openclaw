/**
 * x402 Payment Configuration
 *
 * Default configuration and environment variable handling
 */

import type { X402PaymentConfig } from "./types.js";
import { NETWORKS, FACILITATORS } from "./types.js";

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: X402PaymentConfig = {
  enabled: false,
  network: NETWORKS.BASE_SEPOLIA,
  payTo: "",
  pricePerMessage: "$0.01",
  facilitatorUrl: FACILITATORS.TESTNET,
  freeMessagesPerSession: 3,
  telegramPaymentBotUrl: "https://openclaw.ai/pay",
};

/**
 * Load configuration from environment variables
 */
export function loadConfigFromEnv(): Partial<X402PaymentConfig> {
  return {
    enabled: process.env.X402_ENABLED === "true",
    network: process.env.X402_NETWORK || undefined,
    payTo: process.env.X402_PAY_TO || undefined,
    pricePerMessage: process.env.X402_PRICE_PER_MESSAGE || undefined,
    facilitatorUrl: process.env.X402_FACILITATOR_URL || undefined,
    privateKey: process.env.X402_PRIVATE_KEY || undefined,
    freeMessagesPerSession: process.env.X402_FREE_MESSAGES
      ? parseInt(process.env.X402_FREE_MESSAGES, 10)
      : undefined,
    telegramPaymentBotUrl: process.env.X402_TELEGRAM_PAYMENT_URL || undefined,
  };
}

/**
 * Merge plugin config with defaults and environment
 */
export function resolveConfig(
  pluginConfig?: Partial<X402PaymentConfig>,
): X402PaymentConfig {
  const envConfig = loadConfigFromEnv();

  return {
    ...DEFAULT_CONFIG,
    ...pluginConfig,
    ...envConfig,
  };
}

/**
 * Validate configuration
 */
export function validateConfig(config: X402PaymentConfig): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (config.enabled) {
    if (!config.payTo) {
      errors.push("payTo wallet address is required when x402 payments are enabled");
    } else if (!config.payTo.startsWith("0x") || config.payTo.length !== 42) {
      errors.push("payTo must be a valid Ethereum address (0x...)");
    }

    if (!config.network) {
      errors.push("network is required (e.g., eip155:8453 for Base Mainnet)");
    }

    if (!config.pricePerMessage) {
      errors.push("pricePerMessage is required (e.g., $0.01)");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get network display name
 */
export function getNetworkDisplayName(network: string): string {
  const names: Record<string, string> = {
    [NETWORKS.BASE_MAINNET]: "Base",
    [NETWORKS.BASE_SEPOLIA]: "Base Sepolia (Testnet)",
  };

  return names[network] || network;
}

/**
 * Check if network is mainnet
 */
export function isMainnet(network: string): boolean {
  return network === NETWORKS.BASE_MAINNET;
}

/**
 * Get appropriate facilitator URL for network
 */
export function getFacilitatorUrl(network: string, customUrl?: string): string {
  if (customUrl) return customUrl;

  return isMainnet(network) ? FACILITATORS.MAINNET : FACILITATORS.TESTNET;
}
