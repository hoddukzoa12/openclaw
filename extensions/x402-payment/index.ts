/**
 * x402 Payment Plugin for OpenClaw
 *
 * Enables USDC payments for AI agent interactions using the x402 protocol.
 * Supports Base Mainnet and Base Sepolia networks.
 *
 * @see https://x402.org
 * @see https://github.com/coinbase/x402
 */

import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import type { X402PaymentConfig } from "./src/types.js";
import { registerPaymentHooks } from "./src/hooks.js";
import { resolveConfig, validateConfig, getNetworkDisplayName } from "./src/config.js";
import { cleanupExpiredPayments, getSessionStats } from "./src/payment-flow.js";

const plugin = {
  id: "x402-payment",
  name: "x402 Payment",
  description: "x402 payment protocol integration for AI agent monetization via USDC",
  version: "0.1.0",

  register(api: OpenClawPluginApi) {
    const pluginConfig = api.pluginConfig as Partial<X402PaymentConfig> | undefined;
    const config = resolveConfig(pluginConfig);

    // Validate configuration on startup
    const validation = validateConfig(config);
    if (config.enabled && !validation.valid) {
      api.logger.error(`[x402] Configuration errors: ${validation.errors.join(", ")}`);
      return;
    }

    // Register payment hooks
    registerPaymentHooks(api, pluginConfig);

    // Register CLI commands
    api.registerCli(
      ({ program }) => {
        const x402 = program.command("x402").description("x402 payment management");

        x402
          .command("status")
          .description("Show x402 payment configuration status")
          .action(() => {
            if (!config.enabled) {
              console.log("x402 payments: disabled");
              return;
            }

            console.log("x402 Payment Status");
            console.log("-------------------");
            console.log(`Enabled: ${config.enabled}`);
            console.log(`Network: ${getNetworkDisplayName(config.network)}`);
            console.log(`Pay To: ${config.payTo}`);
            console.log(`Price: ${config.pricePerMessage}`);
            console.log(`Free Messages: ${config.freeMessagesPerSession}`);
            console.log(`Facilitator: ${config.facilitatorUrl}`);
          });

        x402
          .command("session <sessionKey>")
          .description("Show payment stats for a session")
          .action((sessionKey: string) => {
            const stats = getSessionStats(sessionKey);
            if (!stats) {
              console.log(`No session found: ${sessionKey}`);
              return;
            }

            console.log("Session Stats");
            console.log("-------------");
            console.log(`Total Messages: ${stats.totalMessages}`);
            console.log(`Paid Messages: ${stats.paidMessages}`);
            console.log(`Unpaid Messages: ${stats.unpaidMessages}`);
            console.log(`Total Spent: ${stats.totalSpent}`);
          });

        x402
          .command("cleanup")
          .description("Clean up expired payment requests")
          .action(() => {
            const cleaned = cleanupExpiredPayments();
            console.log(`Cleaned up ${cleaned} expired payment(s)`);
          });
      },
      { commands: ["x402"] },
    );

    // Set up periodic cleanup
    if (config.enabled) {
      setInterval(
        () => {
          cleanupExpiredPayments();
        },
        5 * 60 * 1000,
      ); // Every 5 minutes

      api.logger.info(
        `[x402] Payment plugin initialized for ${getNetworkDisplayName(config.network)}`,
      );
    }
  },
};

export default plugin;

// Re-export types and utilities for external use
export type { X402PaymentConfig, PaymentSession, PaymentRequest, PaymentResult } from "./src/types.js";
export { NETWORKS, NETWORK_NAMES, FACILITATORS } from "./src/types.js";
export { createX402Client, createPaymentDeepLink } from "./src/x402-client.js";
export { resolveConfig, validateConfig } from "./src/config.js";
