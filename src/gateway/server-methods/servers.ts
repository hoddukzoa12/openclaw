import { ErrorCodes, errorShape } from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";

/**
 * Server represents a cloud server instance.
 */
export type ServerInfo = {
  id: number;
  name: string;
  status: string;
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

// Default regions available for deployment
const DEFAULT_REGIONS: ServerRegion[] = [
  { id: "fsn1", name: "Falkenstein", country: "DE", city: "Falkenstein" },
  { id: "nbg1", name: "Nuremberg", country: "DE", city: "Nuremberg" },
  { id: "hel1", name: "Helsinki", country: "FI", city: "Helsinki" },
  { id: "ash", name: "Ashburn", country: "US", city: "Ashburn, VA" },
  { id: "hil", name: "Hillsboro", country: "US", city: "Hillsboro, OR" },
];

// Default server types available for deployment
const DEFAULT_SERVER_TYPES: ServerType[] = [
  {
    id: "cx22",
    name: "CX22",
    description: "2 vCPU, 4 GB RAM",
    cores: 2,
    memory: 4,
    disk: 40,
    priceMonthly: 5.39,
  },
  {
    id: "cx32",
    name: "CX32",
    description: "4 vCPU, 8 GB RAM",
    cores: 4,
    memory: 8,
    disk: 80,
    priceMonthly: 10.59,
  },
  {
    id: "cx42",
    name: "CX42",
    description: "8 vCPU, 16 GB RAM",
    cores: 8,
    memory: 16,
    disk: 160,
    priceMonthly: 19.99,
  },
];

export const serversHandlers: GatewayRequestHandlers = {
  /**
   * List all servers and available deployment options.
   */
  "servers.list": async ({ respond, context: _context }) => {
    // Check if Hetzner client is available
    const hetznerToken = process.env.HETZNER_API_TOKEN;
    if (!hetznerToken) {
      // Return empty list with default options if no Hetzner token configured
      respond(true, {
        servers: [],
        regions: DEFAULT_REGIONS,
        serverTypes: DEFAULT_SERVER_TYPES,
        configured: false,
      });
      return;
    }

    try {
      const servers = await listHetznerServers(hetznerToken);
      respond(true, {
        servers,
        regions: DEFAULT_REGIONS,
        serverTypes: DEFAULT_SERVER_TYPES,
        configured: true,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      respond(true, {
        servers: [],
        regions: DEFAULT_REGIONS,
        serverTypes: DEFAULT_SERVER_TYPES,
        configured: true,
        error: message,
      });
    }
  },

  /**
   * Create a new server.
   */
  "servers.create": async ({ params, respond }) => {
    const { region, serverType } = params as { region?: string; serverType?: string };

    const hetznerToken = process.env.HETZNER_API_TOKEN;
    const snapshotId = process.env.HETZNER_SNAPSHOT_ID;

    if (!hetznerToken) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.UNAVAILABLE,
          "Hetzner API token not configured. Set HETZNER_API_TOKEN environment variable.",
        ),
      );
      return;
    }

    if (!snapshotId) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.UNAVAILABLE,
          "Hetzner snapshot ID not configured. Set HETZNER_SNAPSHOT_ID environment variable.",
        ),
      );
      return;
    }

    if (!region || !serverType) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, "region and serverType are required"),
      );
      return;
    }

    try {
      const server = await createHetznerServer(hetznerToken, {
        name: `openclaw-${Date.now()}`,
        serverType,
        location: region,
        snapshotId,
      });

      respond(true, { server });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, message));
    }
  },

  /**
   * Delete a server.
   */
  "servers.delete": async ({ params, respond }) => {
    const { serverId } = params as { serverId?: number };

    const hetznerToken = process.env.HETZNER_API_TOKEN;
    if (!hetznerToken) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.UNAVAILABLE, "Hetzner API token not configured"),
      );
      return;
    }

    if (!serverId) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "serverId is required"));
      return;
    }

    try {
      await deleteHetznerServer(hetznerToken, serverId);
      respond(true, { deleted: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, message));
    }
  },

  /**
   * Get the status of a specific server.
   */
  "servers.status": async ({ params, respond }) => {
    const { serverId } = params as { serverId?: number };

    const hetznerToken = process.env.HETZNER_API_TOKEN;
    if (!hetznerToken) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.UNAVAILABLE, "Hetzner API token not configured"),
      );
      return;
    }

    if (!serverId) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "serverId is required"));
      return;
    }

    try {
      const server = await getHetznerServer(hetznerToken, serverId);
      respond(true, { server });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, message));
    }
  },
};

// Hetzner API helpers

const HETZNER_API = "https://api.hetzner.cloud/v1";

interface HetznerServerResponse {
  id: number;
  name: string;
  status: string;
  public_net: {
    ipv4?: { ip: string };
    ipv6?: { ip: string };
  };
  created: string;
  server_type: { name: string };
  datacenter: { location: { name: string; country: string } };
  labels?: Record<string, string>;
}

function mapHetznerServer(server: HetznerServerResponse): ServerInfo {
  return {
    id: server.id,
    name: server.name,
    status: server.status,
    ip: server.public_net?.ipv4?.ip ?? null,
    ipv6: server.public_net?.ipv6?.ip ?? null,
    location: `${server.datacenter.location.name} (${server.datacenter.location.country})`,
    type: server.server_type.name,
    createdAt: server.created,
    labels: server.labels,
  };
}

async function listHetznerServers(apiToken: string): Promise<ServerInfo[]> {
  const res = await fetch(`${HETZNER_API}/servers?label_selector=app%3Dopenclaw`, {
    headers: { Authorization: `Bearer ${apiToken}` },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(`Hetzner API error: ${error.error?.message ?? res.statusText}`);
  }

  const data = (await res.json()) as { servers: HetznerServerResponse[] };
  return data.servers.map(mapHetznerServer);
}

async function getHetznerServer(apiToken: string, serverId: number): Promise<ServerInfo> {
  const res = await fetch(`${HETZNER_API}/servers/${serverId}`, {
    headers: { Authorization: `Bearer ${apiToken}` },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(`Hetzner API error: ${error.error?.message ?? res.statusText}`);
  }

  const data = (await res.json()) as { server: HetznerServerResponse };
  return mapHetznerServer(data.server);
}

async function createHetznerServer(
  apiToken: string,
  options: {
    name: string;
    serverType: string;
    location: string;
    snapshotId: string;
  },
): Promise<ServerInfo> {
  // Cloud-init script to start OpenClaw gateway
  const userData = `#cloud-config
runcmd:
  - systemctl start openclaw-gateway || true
`;

  const res = await fetch(`${HETZNER_API}/servers`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: options.name,
      server_type: options.serverType,
      image: options.snapshotId,
      location: options.location,
      user_data: userData,
      labels: { app: "openclaw" },
      start_after_create: true,
    }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(`Hetzner API error: ${error.error?.message ?? res.statusText}`);
  }

  const data = (await res.json()) as { server: HetznerServerResponse };
  return mapHetznerServer(data.server);
}

async function deleteHetznerServer(apiToken: string, serverId: number): Promise<void> {
  const res = await fetch(`${HETZNER_API}/servers/${serverId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${apiToken}` },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(`Hetzner API error: ${error.error?.message ?? res.statusText}`);
  }
}
