import type { GatewayBrowserClient } from "../gateway.js";
import type { WizardStep } from "../views/setup.js";

export type SetupState = {
  client: GatewayBrowserClient | null;
  connected: boolean;
  setupLoading: boolean;
  setupWizardSessionId: string | null;
  setupWizardStatus: "idle" | "running" | "done" | "cancelled" | "error";
  setupCurrentStep: WizardStep | null;
  setupStepProgress: number | null;
  setupError: string | null;
};

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

/**
 * Parse a wizard step from the RPC result.
 */
function parseWizardStep(data: unknown): WizardStep | null {
  if (!data || typeof data !== "object") return null;
  const obj = data as Record<string, unknown>;
  const step = obj.step as Record<string, unknown> | undefined;
  if (!step) return null;

  return {
    id: String(step.id ?? ""),
    type: (step.type as WizardStep["type"]) ?? "note",
    title: step.title as string | undefined,
    description: step.description as string | undefined,
    options: step.options as WizardStep["options"],
    placeholder: step.placeholder as string | undefined,
    defaultValue: step.defaultValue,
  };
}

/**
 * Start the wizard session.
 */
export async function startSetupWizard(
  state: SetupState,
  mode?: "local" | "remote",
): Promise<void> {
  if (!state.client || !state.connected) return;
  if (state.setupLoading) return;

  state.setupLoading = true;
  state.setupError = null;
  state.setupWizardStatus = "running";

  try {
    const result = (await state.client.request("wizard.start", {
      mode: mode ?? "local",
    })) as {
      sessionId?: string;
      done?: boolean;
      step?: unknown;
    };

    if (result.sessionId) {
      state.setupWizardSessionId = result.sessionId;
    }

    if (result.done) {
      state.setupWizardStatus = "done";
      state.setupCurrentStep = null;
    } else {
      state.setupCurrentStep = parseWizardStep(result);
    }
  } catch (err) {
    state.setupError = getErrorMessage(err);
    state.setupWizardStatus = "error";
  } finally {
    state.setupLoading = false;
  }
}

/**
 * Advance to the next wizard step.
 */
export async function nextSetupStep(
  state: SetupState,
  stepId: string,
  value: unknown,
): Promise<void> {
  if (!state.client || !state.connected) return;
  if (!state.setupWizardSessionId) return;
  if (state.setupLoading) return;

  state.setupLoading = true;
  state.setupError = null;

  try {
    const result = (await state.client.request("wizard.next", {
      sessionId: state.setupWizardSessionId,
      answer: { stepId, value },
    })) as {
      done?: boolean;
      step?: unknown;
    };

    if (result.done) {
      state.setupWizardStatus = "done";
      state.setupCurrentStep = null;
      state.setupWizardSessionId = null;
    } else {
      state.setupCurrentStep = parseWizardStep(result);
    }
  } catch (err) {
    state.setupError = getErrorMessage(err);
  } finally {
    state.setupLoading = false;
  }
}

/**
 * Cancel the wizard session.
 */
export async function cancelSetupWizard(state: SetupState): Promise<void> {
  if (!state.client || !state.connected) return;
  if (!state.setupWizardSessionId) return;

  state.setupLoading = true;
  state.setupError = null;

  try {
    await state.client.request("wizard.cancel", {
      sessionId: state.setupWizardSessionId,
    });

    state.setupWizardStatus = "cancelled";
    state.setupCurrentStep = null;
    state.setupWizardSessionId = null;
  } catch (err) {
    state.setupError = getErrorMessage(err);
  } finally {
    state.setupLoading = false;
  }
}

/**
 * Get the current wizard status.
 */
export async function getSetupWizardStatus(state: SetupState): Promise<void> {
  if (!state.client || !state.connected) return;
  if (!state.setupWizardSessionId) return;

  try {
    const result = (await state.client.request("wizard.status", {
      sessionId: state.setupWizardSessionId,
    })) as {
      status?: string;
      error?: string;
    };

    if (result.status === "done") {
      state.setupWizardStatus = "done";
    } else if (result.status === "cancelled") {
      state.setupWizardStatus = "cancelled";
    } else if (result.status === "error") {
      state.setupWizardStatus = "error";
      state.setupError = result.error ?? "Unknown error";
    }
  } catch (err) {
    state.setupError = getErrorMessage(err);
  }
}

/**
 * Reset the setup state to start fresh.
 */
export function resetSetupState(state: SetupState): void {
  state.setupLoading = false;
  state.setupWizardSessionId = null;
  state.setupWizardStatus = "idle";
  state.setupCurrentStep = null;
  state.setupStepProgress = null;
  state.setupError = null;
}
