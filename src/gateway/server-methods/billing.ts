import { ErrorCodes, errorShape } from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";

/**
 * BillingStatus represents the current x402 payment status.
 */
export type BillingStatus = {
  x402Enabled: boolean;
  balance: string;
  spent: string;
  limit: string;
  walletAddress: string | null;
  network: string | null;
  permitExpiry: string | null;
};

/**
 * BillingUsage represents API usage statistics.
 */
export type BillingUsage = {
  totalRequests: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  costToday: string;
  costThisMonth: string;
  lastRequestAt: string | null;
};

export const billingHandlers: GatewayRequestHandlers = {
  /**
   * Get the current billing status.
   */
  "billing.status": async ({ respond, context: _context }) => {
    // Check if x402 is enabled
    const x402Enabled = process.env.X402_ENABLED === "true";

    // Get wallet info from environment
    const walletAddress = process.env.X402_WALLET_ADDRESS ?? null;
    const network = process.env.X402_NETWORK ?? null;

    // Check if own API keys are configured
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;
    const apiKeyConfigured = Boolean(anthropicKey || openaiKey);

    // Determine API mode
    const apiMode = x402Enabled ? "x402" : "apiKey";

    // TODO: Fetch actual balance and usage from x402 facilitator or local tracking
    const status: BillingStatus = {
      x402Enabled,
      balance: "0.00",
      spent: "0.00",
      limit: "0.00",
      walletAddress,
      network,
      permitExpiry: null,
    };

    respond(true, {
      status,
      apiMode,
      apiKeyConfigured,
    });
  },

  /**
   * Get usage statistics.
   */
  "billing.usage": async ({ respond, context: _context }) => {
    // TODO: Implement actual usage tracking
    // For now, return placeholder data
    const usage: BillingUsage = {
      totalRequests: 0,
      totalTokens: 0,
      inputTokens: 0,
      outputTokens: 0,
      costToday: "0.00",
      costThisMonth: "0.00",
      lastRequestAt: null,
    };

    respond(true, { usage });
  },

  /**
   * Set the API payment mode.
   */
  "billing.setMode": async ({ params, respond, context: _context }) => {
    const { mode } = params as { mode?: "x402" | "apiKey" };

    if (!mode || (mode !== "x402" && mode !== "apiKey")) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, "mode must be 'x402' or 'apiKey'"),
      );
      return;
    }

    // TODO: Persist the mode preference
    // For now, just acknowledge the request
    // The actual switch would need to update config and restart providers

    if (mode === "x402") {
      const x402Enabled = process.env.X402_ENABLED === "true";
      if (!x402Enabled) {
        respond(
          false,
          undefined,
          errorShape(
            ErrorCodes.UNAVAILABLE,
            "x402 is not configured. Set X402_ENABLED=true and configure Permit2.",
          ),
        );
        return;
      }
    }

    if (mode === "apiKey") {
      const anthropicKey = process.env.ANTHROPIC_API_KEY;
      const openaiKey = process.env.OPENAI_API_KEY;
      if (!anthropicKey && !openaiKey) {
        respond(
          false,
          undefined,
          errorShape(
            ErrorCodes.UNAVAILABLE,
            "No API key configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY.",
          ),
        );
        return;
      }
    }

    respond(true, { mode });
  },

  /**
   * Shutdown the instance.
   */
  "billing.shutdown": async ({ respond, context }) => {
    // Acknowledge the shutdown request
    respond(true, { shutdownInitiated: true });

    // Give time for the response to be sent
    setTimeout(() => {
      context.logGateway.info("Shutdown requested via billing.shutdown RPC");
      // Broadcast shutdown event
      context.broadcast("shutdown", { reason: "user-requested" });
      // Exit the process
      process.exit(0);
    }, 500);
  },
};
