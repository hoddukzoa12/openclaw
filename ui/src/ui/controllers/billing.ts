import type { GatewayBrowserClient } from "../gateway.js";
import type { BillingStatus, BillingUsage } from "../views/billing.js";

export type BillingState = {
  client: GatewayBrowserClient | null;
  connected: boolean;
  billingLoading: boolean;
  billingStatus: BillingStatus | null;
  billingUsage: BillingUsage | null;
  billingApiMode: "x402" | "apiKey";
  billingApiKeyConfigured: boolean;
  billingError: string | null;
};

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

/**
 * Load billing status and usage from the gateway.
 */
export async function loadBilling(state: BillingState): Promise<void> {
  if (!state.client || !state.connected) return;
  if (state.billingLoading) return;

  state.billingLoading = true;
  state.billingError = null;

  try {
    // Load status and usage in parallel
    const [statusResult, usageResult] = await Promise.all([
      state.client.request("billing.status", {}) as Promise<{
        status?: BillingStatus;
        apiMode?: "x402" | "apiKey";
        apiKeyConfigured?: boolean;
      }>,
      state.client.request("billing.usage", {}) as Promise<{
        usage?: BillingUsage;
      }>,
    ]);

    if (statusResult.status) {
      state.billingStatus = statusResult.status;
    }
    if (statusResult.apiMode) {
      state.billingApiMode = statusResult.apiMode;
    }
    if (statusResult.apiKeyConfigured !== undefined) {
      state.billingApiKeyConfigured = statusResult.apiKeyConfigured;
    }

    if (usageResult.usage) {
      state.billingUsage = usageResult.usage;
    }
  } catch (err) {
    state.billingError = getErrorMessage(err);
  } finally {
    state.billingLoading = false;
  }
}

/**
 * Switch the API payment mode.
 */
export async function setBillingMode(
  state: BillingState,
  mode: "x402" | "apiKey",
): Promise<void> {
  if (!state.client || !state.connected) return;

  state.billingLoading = true;
  state.billingError = null;

  try {
    await state.client.request("billing.setMode", { mode });
    state.billingApiMode = mode;
  } catch (err) {
    state.billingError = getErrorMessage(err);
  } finally {
    state.billingLoading = false;
  }
}

/**
 * Initiate shutdown of the instance.
 */
export async function shutdownInstance(state: BillingState): Promise<void> {
  if (!state.client || !state.connected) return;

  state.billingLoading = true;
  state.billingError = null;

  try {
    await state.client.request("billing.shutdown", {});
    // The connection will be lost after shutdown
  } catch (err) {
    state.billingError = getErrorMessage(err);
  } finally {
    state.billingLoading = false;
  }
}

/**
 * Get the x402 payment status only.
 */
export async function getPaymentStatus(state: BillingState): Promise<BillingStatus | null> {
  if (!state.client || !state.connected) return null;

  try {
    const result = (await state.client.request("billing.status", {})) as {
      status?: BillingStatus;
    };
    return result.status ?? null;
  } catch (err) {
    state.billingError = getErrorMessage(err);
    return null;
  }
}

/**
 * Get the usage statistics only.
 */
export async function getUsageStats(state: BillingState): Promise<BillingUsage | null> {
  if (!state.client || !state.connected) return null;

  try {
    const result = (await state.client.request("billing.usage", {})) as {
      usage?: BillingUsage;
    };
    return result.usage ?? null;
  } catch (err) {
    state.billingError = getErrorMessage(err);
    return null;
  }
}
