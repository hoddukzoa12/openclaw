import { html, nothing } from "lit";

/**
 * Server represents a cloud server instance.
 */
export type Server = {
  id: number;
  name: string;
  status: "creating" | "running" | "stopping" | "off" | "rebuilding" | "starting" | "unknown";
  ip: string | null;
  ipv6: string | null;
  location: string;
  type: string;
  createdAt: string;
  labels?: Record<string, string>;
};

/**
 * ServerRegion represents an available deployment region.
 */
export type ServerRegion = {
  id: string;
  name: string;
  country: string;
  city?: string;
};

/**
 * ServerType represents an available server type.
 */
export type ServerType = {
  id: string;
  name: string;
  description: string;
  cores: number;
  memory: number;
  disk: number;
  priceHourly?: number;
  priceMonthly?: number;
};

export type ServersProps = {
  connected: boolean;
  loading: boolean;
  deploying: boolean;
  servers: Server[];
  regions: ServerRegion[];
  serverTypes: ServerType[];
  error: string | null;
  selectedRegion: string;
  selectedType: string;
  onRefresh: () => void;
  onDeploy: (region: string, serverType: string) => void;
  onDelete: (serverId: number) => void;
  onConnect: (serverUrl: string) => void;
  onRegionChange: (region: string) => void;
  onTypeChange: (type: string) => void;
};

export function renderServers(props: ServersProps) {
  if (!props.connected) {
    return html`
      <section class="card">
        <div class="card-title">Servers</div>
        <div class="card-sub">Connect to the gateway to manage servers.</div>
        <div class="callout warning" style="margin-top: 12px;">
          Not connected to gateway
        </div>
      </section>
    `;
  }

  return html`
    <section class="card">
      <div class="row" style="justify-content: space-between;">
        <div>
          <div class="card-title">Servers</div>
          <div class="card-sub">Deploy and manage cloud server instances.</div>
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

      <!-- Server List -->
      <div class="list" style="margin-top: 16px;">
        ${props.servers.length === 0
          ? html`<div class="muted">No servers deployed yet.</div>`
          : props.servers.map((server) => renderServerCard(server, props))}
      </div>
    </section>

    <!-- Deploy New Server -->
    <section class="card" style="margin-top: 16px;">
      <div class="card-title">Deploy New Server</div>
      <div class="card-sub">Launch a new OpenClaw instance in the cloud.</div>

      <div style="margin-top: 16px; display: flex; flex-direction: column; gap: 12px;">
        <div class="field">
          <label>Region</label>
          <select
            class="select"
            .value=${props.selectedRegion}
            @change=${(e: Event) =>
              props.onRegionChange((e.target as HTMLSelectElement).value)}
            ?disabled=${props.deploying || props.regions.length === 0}
          >
            ${props.regions.length === 0
              ? html`<option value="">Loading regions...</option>`
              : props.regions.map(
                  (r) => html`
                    <option value=${r.id}>
                      ${r.name} (${r.city ?? r.country})
                    </option>
                  `,
                )}
          </select>
        </div>

        <div class="field">
          <label>Server Type</label>
          <select
            class="select"
            .value=${props.selectedType}
            @change=${(e: Event) =>
              props.onTypeChange((e.target as HTMLSelectElement).value)}
            ?disabled=${props.deploying || props.serverTypes.length === 0}
          >
            ${props.serverTypes.length === 0
              ? html`<option value="">Loading types...</option>`
              : props.serverTypes.map(
                  (t) => html`
                    <option value=${t.id}>
                      ${t.name} - ${t.description}
                      ${t.priceMonthly != null ? `($${t.priceMonthly}/mo)` : ""}
                    </option>
                  `,
                )}
          </select>
        </div>

        <button
          class="btn primary"
          ?disabled=${props.deploying || !props.selectedRegion || !props.selectedType}
          @click=${() => props.onDeploy(props.selectedRegion, props.selectedType)}
        >
          ${props.deploying ? "Deploying..." : "Deploy Server"}
        </button>

        ${props.deploying
          ? html`
              <div class="callout" style="margin-top: 8px;">
                Deploying your server... This usually takes 40-60 seconds.
              </div>
            `
          : nothing}
      </div>
    </section>

    <!-- Help Section -->
    <section class="card" style="margin-top: 16px;">
      <div class="card-title">About Server Deployment</div>
      <div class="card-sub">
        Servers are deployed to Hetzner Cloud with OpenClaw pre-installed. Each server runs
        a dedicated gateway instance that you can manage from this dashboard.
      </div>

      <div class="callout" style="margin-top: 12px;">
        <strong>What's included:</strong>
        <ul style="margin: 8px 0 0 16px; padding: 0;">
          <li>Ubuntu 22.04 LTS base image</li>
          <li>Node.js 22 runtime</li>
          <li>OpenClaw gateway pre-installed</li>
          <li>Automatic startup on boot</li>
        </ul>
      </div>
    </section>
  `;
}

function renderServerCard(server: Server, props: ServersProps) {
  const statusClass = {
    creating: "chip-warn",
    running: "chip-ok",
    stopping: "chip-warn",
    off: "",
    rebuilding: "chip-warn",
    starting: "chip-warn",
    unknown: "",
  }[server.status];

  const canConnect = server.status === "running" && server.ip;
  const serverUrl = server.ip ? `http://${server.ip}:18789` : null;

  return html`
    <div class="list-item">
      <div class="list-main">
        <div class="list-title">${server.name}</div>
        <div class="list-sub">
          ${server.location} • ${server.type}
          ${server.ip ? html` • <code>${server.ip}</code>` : nothing}
        </div>
        <div class="chip-row" style="margin-top: 6px;">
          <span class="chip ${statusClass}">${server.status}</span>
          ${server.labels?.["vessel.app"]
            ? html`<span class="chip">${server.labels["vessel.app"]}</span>`
            : nothing}
        </div>
        <div class="muted" style="margin-top: 4px; font-size: 0.85em;">
          Created: ${formatDate(server.createdAt)}
        </div>
      </div>
      <div class="list-meta">
        <div class="row" style="justify-content: flex-end; flex-wrap: wrap; gap: 8px;">
          ${canConnect && serverUrl
            ? html`
                <button
                  class="btn small primary"
                  @click=${() => props.onConnect(serverUrl)}
                >
                  Connect
                </button>
              `
            : nothing}
          <button
            class="btn small danger"
            @click=${() => {
              if (confirm(`Delete server "${server.name}"? This action cannot be undone.`)) {
                props.onDelete(server.id);
              }
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  `;
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
