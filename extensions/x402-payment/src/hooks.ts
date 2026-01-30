/**
 * x402 Payment Hooks
 *
 * Integrates with OpenClaw's hook system to:
 * - Intercept incoming messages and check payment status
 * - Modify outgoing messages to include payment prompts
 * - Track message counts and payment sessions
 */

import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import type { X402PaymentConfig, PaymentSession } from "./types.js";
import {
  getOrCreateSession,
  isPaymentRequired,
  incrementMessageCount,
  generatePaymentStatusMessage,
  processPaymentCallback,
} from "./payment-flow.js";
import {
  formatPaymentRequiredMessage,
  formatPaymentSuccessMessage,
  formatHelpMessage,
  createPaymentKeyboard,
  createConfirmationKeyboard,
} from "./telegram-ui.js";
import { resolveConfig, validateConfig } from "./config.js";

/**
 * Register all payment-related hooks
 */
export function registerPaymentHooks(
  api: OpenClawPluginApi,
  pluginConfig?: Partial<X402PaymentConfig>,
) {
  const config = resolveConfig(pluginConfig);

  // Validate configuration
  const validation = validateConfig(config);
  if (!validation.valid) {
    api.logger.warn(`[x402] Configuration issues: ${validation.errors.join(", ")}`);
  }

  if (!config.enabled) {
    api.logger.info("[x402] Payment plugin loaded but disabled");
    return;
  }

  api.logger.info(`[x402] Payment plugin enabled on ${config.network}`);

  // Hook: Before message is sent to agent
  api.registerHook(
    "message_received",
    async (event, ctx) => {
      const { from, content } = event;
      const channelId = ctx.channelId || "unknown";
      const sessionKey = ctx.conversationId || `${channelId}:${from}`;

      // Handle x402 commands
      if (content.startsWith("/x402")) {
        const command = content.slice(5).trim().toLowerCase();
        return handleX402Command(command, sessionKey, channelId, from, config);
      }

      // Get or create session
      const session = getOrCreateSession(sessionKey, channelId, from);

      // Check if payment is required
      if (isPaymentRequired(session, config)) {
        const status = generatePaymentStatusMessage(session, config);

        // Return payment required - this will block the message from reaching the agent
        return {
          block: true,
          blockReason: "payment_required",
          metadata: {
            paymentRequired: true,
            paymentUrl: status.paymentUrl,
            paymentId: status.paymentId,
            message: status.message,
          },
        };
      }

      // Increment message count
      incrementMessageCount(sessionKey);

      return {};
    },
    { priority: 100 }, // High priority to check payment first
  );

  // Hook: Before sending response back to user
  api.registerHook(
    "message_sending",
    async (event, ctx) => {
      const { to, content, metadata } = event;
      const channelId = ctx.channelId || "unknown";
      const sessionKey = ctx.conversationId || `${channelId}:${to}`;

      // Check if this is a payment required response
      if (metadata?.paymentRequired) {
        const paymentMessage = formatPaymentRequiredMessage(
          metadata.session as PaymentSession,
          config,
        );

        // Return modified content with payment prompt
        return {
          content: paymentMessage,
          metadata: {
            ...metadata,
            keyboard: createPaymentKeyboard(metadata.paymentUrl as string, config),
          },
        };
      }

      // Normal response - optionally add payment info footer
      const session = getOrCreateSession(sessionKey, channelId, to);
      const freeRemaining =
        config.freeMessagesPerSession - (session.messageCount - session.paidMessageCount);

      if (freeRemaining > 0 && freeRemaining <= 2) {
        // Warn user about remaining free messages
        const footer = `\n\n---\n${freeRemaining} free message${freeRemaining === 1 ? "" : "s"} remaining`;
        return { content: content + footer };
      }

      return {};
    },
    { priority: 50 },
  );

  // Register callback handler for payment verification
  api.registerGatewayMethod("POST /x402/callback", async (req, res) => {
    try {
      const { paymentId, signature } = req.body as {
        paymentId: string;
        signature: string;
      };

      if (!paymentId || !signature) {
        res.status(400).json({ error: "Missing paymentId or signature" });
        return;
      }

      const result = await processPaymentCallback(paymentId, signature, config);

      if (result.success) {
        res.json({
          success: true,
          txHash: result.txHash,
          network: result.network,
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Register status endpoint
  api.registerGatewayMethod("GET /x402/status", async (req, res) => {
    res.json({
      enabled: config.enabled,
      network: config.network,
      pricePerMessage: config.pricePerMessage,
      freeMessagesPerSession: config.freeMessagesPerSession,
    });
  });
}

/**
 * Handle /x402 commands
 */
async function handleX402Command(
  command: string,
  sessionKey: string,
  channelId: string,
  userId: string,
  config: X402PaymentConfig,
): Promise<{
  block?: boolean;
  content?: string;
  metadata?: Record<string, unknown>;
}> {
  switch (command) {
    case "help":
    case "": {
      return {
        block: true,
        content: formatHelpMessage(),
      };
    }

    case "status": {
      const session = getOrCreateSession(sessionKey, channelId, userId);
      const freeRemaining =
        config.freeMessagesPerSession - (session.messageCount - session.paidMessageCount);

      const statusMessage = [
        "x402 Payment Status",
        "",
        `Messages used: ${session.messageCount}`,
        `Paid messages: ${session.paidMessageCount}`,
        `Free remaining: ${Math.max(0, freeRemaining)}`,
        "",
        `Price per message: ${config.pricePerMessage}`,
        `Network: ${config.network}`,
      ].join("\n");

      return {
        block: true,
        content: statusMessage,
      };
    }

    case "pay": {
      const session = getOrCreateSession(sessionKey, channelId, userId);
      const status = generatePaymentStatusMessage(session, config);

      if (!status.requiresPayment) {
        return {
          block: true,
          content: "No payment required at this time.",
        };
      }

      return {
        block: true,
        content: status.message,
        metadata: {
          keyboard: createPaymentKeyboard(status.paymentUrl!, config),
        },
      };
    }

    default: {
      return {
        block: true,
        content: `Unknown command: ${command}\n\nAvailable commands:\n/x402 help - Show help\n/x402 status - Show payment status\n/x402 pay - Generate payment link`,
      };
    }
  }
}
