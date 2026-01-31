import { html, nothing } from "lit";

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

export type BillingProps = {
  connected: boolean;
  loading: boolean;
  status: BillingStatus | null;
  usage: BillingUsage | null;
  apiMode: "x402" | "apiKey";
  apiKeyConfigured: boolean;
  error: string | null;
  onRefresh: () => void;
  onSwitchMode: (mode: "x402" | "apiKey") => void;
  onShutdown: () => void;
};

export function renderBilling(props: BillingProps) {
  if (!props.connected) {
    return html`
      <section class="card">
        <div class="card-title">Billing</div>
        <div class="card-sub">Connect to the gateway to view billing status.</div>
        <div class="callout warning" style="margin-top: 12px;">
          Not connected to gateway
        </div>
      </section>
    `;
  }

  return html`
    <!-- Payment Status Card -->
    <section class="card">
      <div class="row" style="justify-content: space-between;">
        <div>
          <div class="card-title">Payment Status</div>
          <div class="card-sub">x402 automatic payment via Permit2</div>
        </div>
        <button
          class="btn"
          ?disabled=${props.loading}
          @click=${props.onRefresh}
        >
          ${props.loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      ${props.error
        ? html`<div class="callout danger" style="margin-top: 12px;">${props.error}</div>`
        : nothing}

      ${props.status
        ? html`
            <div class="stats-grid" style="margin-top: 16px; display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 16px;">
              <div class="stat-card">
                <div class="stat-label">Balance</div>
                <div class="stat-value">${props.status.balance} USDC</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Spent</div>
                <div class="stat-value">${props.status.spent} USDC</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Limit</div>
                <div class="stat-value">${props.status.limit} USDC</div>
              </div>
            </div>

            ${props.status.walletAddress
              ? html`
                  <div class="callout" style="margin-top: 16px;">
                    <div><strong>Wallet:</strong> <code>${truncateAddress(props.status.walletAddress)}</code></div>
                    ${props.status.network
                      ? html`<div><strong>Network:</strong> ${props.status.network}</div>`
                      : nothing}
                    ${props.status.permitExpiry
                      ? html`<div><strong>Permit Expiry:</strong> ${formatDate(props.status.permitExpiry)}</div>`
                      : nothing}
                  </div>
                `
              : html`
                  <div class="callout warning" style="margin-top: 16px;">
                    No wallet connected. Set up Permit2 to enable automatic payments.
                  </div>
                `}
          `
        : html`
            <div class="muted" style="margin-top: 16px;">
              Loading payment status...
            </div>
          `}
    </section>

    <!-- API Mode Card -->
    <section class="card" style="margin-top: 16px;">
      <div class="card-title">API Mode</div>
      <div class="card-sub">Choose how to pay for AI API usage</div>

      <div style="margin-top: 16px; display: flex; flex-direction: column; gap: 12px;">
        <button
          class="btn option ${props.apiMode === "x402" ? "active primary" : ""}"
          style="text-align: left; padding: 16px;"
          @click=${() => props.onSwitchMode("x402")}
        >
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <strong>x402 Auto-Pay</strong>
              <div class="muted" style="margin-top: 4px;">
                Pay with USDC automatically via Permit2
              </div>
            </div>
            ${props.apiMode === "x402"
              ? html`<span class="chip chip-ok">Active</span>`
              : nothing}
          </div>
        </button>

        <button
          class="btn option ${props.apiMode === "apiKey" ? "active primary" : ""}"
          style="text-align: left; padding: 16px;"
          @click=${() => props.onSwitchMode("apiKey")}
        >
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <strong>Own API Key</strong>
              <div class="muted" style="margin-top: 4px;">
                Use your own Anthropic/OpenAI API key
              </div>
            </div>
            ${props.apiMode === "apiKey"
              ? html`<span class="chip chip-ok">Active</span>`
              : nothing}
          </div>
        </button>
      </div>

      ${props.apiMode === "apiKey" && !props.apiKeyConfigured
        ? html`
            <div class="callout warning" style="margin-top: 12px;">
              No API key configured. Go to Config tab to set your API keys.
            </div>
          `
        : nothing}
    </section>

    <!-- Usage Stats Card -->
    <section class="card" style="margin-top: 16px;">
      <div class="card-title">Usage Statistics</div>
      <div class="card-sub">API usage for the current period</div>

      ${props.usage
        ? html`
            <div class="stats-grid" style="margin-top: 16px; display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 16px;">
              <div class="stat-card">
                <div class="stat-label">Total Requests</div>
                <div class="stat-value">${props.usage.totalRequests.toLocaleString()}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Total Tokens</div>
                <div class="stat-value">${props.usage.totalTokens.toLocaleString()}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Cost Today</div>
                <div class="stat-value">$${props.usage.costToday}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Cost This Month</div>
                <div class="stat-value">$${props.usage.costThisMonth}</div>
              </div>
            </div>

            <div class="callout" style="margin-top: 16px;">
              <div style="display: flex; justify-content: space-between;">
                <span>Input Tokens:</span>
                <span>${props.usage.inputTokens.toLocaleString()}</span>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span>Output Tokens:</span>
                <span>${props.usage.outputTokens.toLocaleString()}</span>
              </div>
              ${props.usage.lastRequestAt
                ? html`
                    <div style="margin-top: 8px; font-size: 0.9em;" class="muted">
                      Last request: ${formatDate(props.usage.lastRequestAt)}
                    </div>
                  `
                : nothing}
            </div>
          `
        : html`
            <div class="muted" style="margin-top: 16px;">
              Loading usage statistics...
            </div>
          `}
    </section>

    <!-- Danger Zone -->
    <section class="card" style="margin-top: 16px; border-color: var(--danger-color, #d14343);">
      <div class="card-title" style="color: var(--danger-color, #d14343);">Danger Zone</div>
      <div class="card-sub">Actions that cannot be undone</div>

      <div style="margin-top: 16px;">
        <button
          class="btn danger"
          @click=${() => {
            if (confirm("Are you sure you want to shut down this instance? This will stop all services and cannot be undone.")) {
              props.onShutdown();
            }
          }}
        >
          Shutdown Instance
        </button>
        <div class="muted" style="margin-top: 8px; font-size: 0.9em;">
          Permanently shut down this OpenClaw instance and terminate all connections.
        </div>
      </div>
    </section>
  `;
}

function truncateAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatDate(isoDate: string): string {
  try {
    const date = new Date(isoDate);
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return isoDate;
  }
}
