import { html, nothing } from "lit";

/**
 * WizardStep represents a step in the setup wizard.
 */
export type WizardStep = {
  id: string;
  type: "note" | "select" | "text" | "confirm" | "multiselect" | "progress" | "action";
  title?: string;
  description?: string;
  options?: Array<{ value: string; label: string; description?: string }>;
  placeholder?: string;
  defaultValue?: unknown;
};

export type SetupProps = {
  connected: boolean;
  loading: boolean;
  wizardSessionId: string | null;
  wizardStatus: "idle" | "running" | "done" | "cancelled" | "error";
  currentStep: WizardStep | null;
  stepProgress: number | null;
  error: string | null;
  onStart: (mode?: "local" | "remote") => void;
  onNext: (stepId: string, value: unknown) => void;
  onCancel: () => void;
  onRefresh: () => void;
};

export function renderSetup(props: SetupProps) {
  if (!props.connected) {
    return html`
      <section class="card">
        <div class="card-title">Setup Wizard</div>
        <div class="card-sub">Connect to the gateway to start the setup wizard.</div>
        <div class="callout warning" style="margin-top: 12px;">
          Not connected to gateway
        </div>
      </section>
    `;
  }

  // Not started - show start options
  if (!props.wizardSessionId && props.wizardStatus === "idle") {
    return html`
      <section class="card">
        <div class="card-title">Setup Wizard</div>
        <div class="card-sub">
          Configure authentication, channels, and API keys for your OpenClaw instance.
        </div>

        <div style="margin-top: 20px; display: flex; gap: 12px; flex-wrap: wrap;">
          <button
            class="btn primary"
            ?disabled=${props.loading}
            @click=${() => props.onStart("local")}
          >
            ${props.loading ? "Starting..." : "Start Setup"}
          </button>
        </div>

        ${props.error
          ? html`<div class="callout danger" style="margin-top: 12px;">${props.error}</div>`
          : nothing}

        <div class="callout" style="margin-top: 20px;">
          <strong>What the wizard will configure:</strong>
          <ul style="margin: 8px 0 0 16px; padding: 0;">
            <li>AI provider authentication (Anthropic, OpenAI, etc.)</li>
            <li>Messaging channels (Telegram, Discord, WhatsApp, etc.)</li>
            <li>OAuth connections (Google, GitHub, Notion)</li>
          </ul>
        </div>
      </section>
    `;
  }

  // Error state
  if (props.wizardStatus === "error") {
    return html`
      <section class="card">
        <div class="card-title">Setup Wizard</div>
        <div class="callout danger" style="margin-top: 12px;">
          ${props.error ?? "An error occurred during setup."}
        </div>
        <button class="btn" style="margin-top: 12px;" @click=${() => props.onStart()}>
          Restart Setup
        </button>
      </section>
    `;
  }

  // Completed state
  if (props.wizardStatus === "done") {
    return html`
      <section class="card">
        <div class="card-title">Setup Complete</div>
        <div class="card-sub">Your OpenClaw instance is ready to use!</div>

        <div class="callout success" style="margin-top: 12px;">
          All configuration steps have been completed successfully.
        </div>

        <div style="margin-top: 16px; display: flex; gap: 12px;">
          <button class="btn primary" @click=${() => props.onStart()}>
            Run Setup Again
          </button>
        </div>
      </section>
    `;
  }

  // Cancelled state
  if (props.wizardStatus === "cancelled") {
    return html`
      <section class="card">
        <div class="card-title">Setup Cancelled</div>
        <div class="card-sub">The setup wizard was cancelled.</div>

        <button class="btn primary" style="margin-top: 12px;" @click=${() => props.onStart()}>
          Start Again
        </button>
      </section>
    `;
  }

  // Loading state
  if (props.loading && !props.currentStep) {
    return html`
      <section class="card">
        <div class="card-title">Setup Wizard</div>
        <div class="muted" style="margin-top: 12px;">Loading...</div>
      </section>
    `;
  }

  // Active wizard step
  const step = props.currentStep;
  if (!step) {
    return html`
      <section class="card">
        <div class="card-title">Setup Wizard</div>
        <div class="muted" style="margin-top: 12px;">Waiting for next step...</div>
      </section>
    `;
  }

  return html`
    <section class="card">
      <div class="row" style="justify-content: space-between; align-items: flex-start;">
        <div>
          <div class="card-title">${step.title ?? "Setup"}</div>
          ${step.description
            ? html`<div class="card-sub">${step.description}</div>`
            : nothing}
        </div>
        <button
          class="btn small"
          ?disabled=${props.loading}
          @click=${props.onCancel}
        >
          Cancel
        </button>
      </div>

      ${props.error
        ? html`<div class="callout danger" style="margin-top: 12px;">${props.error}</div>`
        : nothing}

      <div style="margin-top: 16px;">
        ${renderWizardStep(step, props)}
      </div>
    </section>
  `;
}

function renderWizardStep(step: WizardStep, props: SetupProps) {
  switch (step.type) {
    case "note":
      return html`
        <div class="callout" style="margin-bottom: 16px;">
          ${step.description}
        </div>
        <button
          class="btn primary"
          ?disabled=${props.loading}
          @click=${() => props.onNext(step.id, true)}
        >
          Continue
        </button>
      `;

    case "select":
      return html`
        <div class="options" style="display: flex; flex-direction: column; gap: 8px;">
          ${(step.options ?? []).map(
            (opt) => html`
              <button
                class="btn option"
                style="text-align: left; padding: 12px 16px;"
                ?disabled=${props.loading}
                @click=${() => props.onNext(step.id, opt.value)}
              >
                <strong>${opt.label}</strong>
                ${opt.description
                  ? html`<div class="muted" style="margin-top: 4px; font-size: 0.9em;">
                      ${opt.description}
                    </div>`
                  : nothing}
              </button>
            `,
          )}
        </div>
      `;

    case "text":
      return html`
        <form
          @submit=${(e: Event) => {
            e.preventDefault();
            const form = e.target as HTMLFormElement;
            const input = form.querySelector("input") as HTMLInputElement;
            props.onNext(step.id, input.value);
          }}
        >
          <div class="field">
            <input
              type="text"
              class="input"
              placeholder=${step.placeholder ?? "Enter value..."}
              .value=${(step.defaultValue as string) ?? ""}
              ?disabled=${props.loading}
            />
          </div>
          <div style="margin-top: 12px; display: flex; gap: 8px;">
            <button type="submit" class="btn primary" ?disabled=${props.loading}>
              Continue
            </button>
            ${step.defaultValue !== undefined
              ? html`
                  <button
                    type="button"
                    class="btn"
                    ?disabled=${props.loading}
                    @click=${() => props.onNext(step.id, "")}
                  >
                    Skip
                  </button>
                `
              : nothing}
          </div>
        </form>
      `;

    case "confirm":
      return html`
        <div style="display: flex; gap: 12px;">
          <button
            class="btn primary"
            ?disabled=${props.loading}
            @click=${() => props.onNext(step.id, true)}
          >
            Yes
          </button>
          <button
            class="btn"
            ?disabled=${props.loading}
            @click=${() => props.onNext(step.id, false)}
          >
            No
          </button>
        </div>
      `;

    case "multiselect":
      return html`
        <form
          @submit=${(e: Event) => {
            e.preventDefault();
            const form = e.target as HTMLFormElement;
            const checkboxes = form.querySelectorAll('input[type="checkbox"]:checked');
            const values = Array.from(checkboxes).map(
              (cb) => (cb as HTMLInputElement).value,
            );
            props.onNext(step.id, values);
          }}
        >
          <div style="display: flex; flex-direction: column; gap: 8px;">
            ${(step.options ?? []).map(
              (opt) => html`
                <label class="checkbox-option" style="display: flex; gap: 8px; cursor: pointer;">
                  <input
                    type="checkbox"
                    value=${opt.value}
                    ?disabled=${props.loading}
                  />
                  <span>${opt.label}</span>
                </label>
              `,
            )}
          </div>
          <button type="submit" class="btn primary" style="margin-top: 12px;" ?disabled=${props.loading}>
            Continue
          </button>
        </form>
      `;

    case "progress":
      return html`
        <div class="progress-container">
          <div class="progress-bar" style="width: ${props.stepProgress ?? 0}%;"></div>
        </div>
        <div class="muted" style="margin-top: 8px;">
          ${step.description ?? "Processing..."}
        </div>
      `;

    case "action":
      return html`
        <button
          class="btn primary"
          ?disabled=${props.loading}
          @click=${() => props.onNext(step.id, true)}
        >
          ${step.title ?? "Proceed"}
        </button>
      `;

    default:
      return html`<div class="muted">Unknown step type: ${step.type}</div>`;
  }
}
