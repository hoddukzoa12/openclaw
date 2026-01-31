import type { GatewayBrowserClient } from "../gateway.js";
import type { Server, ServerRegion, ServerType } from "../views/servers.js";

export type ServersState = {
  client: GatewayBrowserClient | null;
  connected: boolean;
  serversLoading: boolean;
  serversDeploying: boolean;
  serversList: Server[];
  serversRegions: ServerRegion[];
  serversTypes: ServerType[];
  serversError: string | null;
  serversSelectedRegion: string;
  serversSelectedType: string;
};

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

/**
 * Load the list of servers from the gateway.
 */
export async function loadServers(state: ServersState): Promise<void> {
  if (!state.client || !state.connected) return;
  if (state.serversLoading) return;

  state.serversLoading = true;
  state.serversError = null;

  try {
    const result = (await state.client.request("servers.list", {})) as {
      servers?: Server[];
      regions?: ServerRegion[];
      serverTypes?: ServerType[];
    };

    if (result.servers) {
      state.serversList = result.servers;
    }

    if (result.regions) {
      state.serversRegions = result.regions;
      if (!state.serversSelectedRegion && result.regions.length > 0) {
        state.serversSelectedRegion = result.regions[0].id;
      }
    }

    if (result.serverTypes) {
      state.serversTypes = result.serverTypes;
      if (!state.serversSelectedType && result.serverTypes.length > 0) {
        state.serversSelectedType = result.serverTypes[0].id;
      }
    }
  } catch (err) {
    state.serversError = getErrorMessage(err);
  } finally {
    state.serversLoading = false;
  }
}

/**
 * Deploy a new server.
 */
export async function deployServer(
  state: ServersState,
  region: string,
  serverType: string,
): Promise<void> {
  if (!state.client || !state.connected) return;
  if (state.serversDeploying) return;

  state.serversDeploying = true;
  state.serversError = null;

  try {
    const result = (await state.client.request("servers.create", {
      region,
      serverType,
    })) as {
      server?: Server;
      error?: string;
    };

    if (result.error) {
      state.serversError = result.error;
    } else if (result.server) {
      // Add the new server to the list
      state.serversList = [...state.serversList, result.server];
    }
  } catch (err) {
    state.serversError = getErrorMessage(err);
  } finally {
    state.serversDeploying = false;
  }
}

/**
 * Delete a server.
 */
export async function deleteServer(state: ServersState, serverId: number): Promise<void> {
  if (!state.client || !state.connected) return;

  state.serversLoading = true;
  state.serversError = null;

  try {
    await state.client.request("servers.delete", { serverId });

    // Remove the server from the list
    state.serversList = state.serversList.filter((s) => s.id !== serverId);
  } catch (err) {
    state.serversError = getErrorMessage(err);
  } finally {
    state.serversLoading = false;
  }
}

/**
 * Get the status of a specific server.
 */
export async function getServerStatus(state: ServersState, serverId: number): Promise<Server | null> {
  if (!state.client || !state.connected) return null;

  try {
    const result = (await state.client.request("servers.status", { serverId })) as {
      server?: Server;
    };

    if (result.server) {
      // Update the server in the list
      state.serversList = state.serversList.map((s) =>
        s.id === serverId ? result.server! : s,
      );
      return result.server;
    }
  } catch (err) {
    state.serversError = getErrorMessage(err);
  }

  return null;
}

/**
 * Poll a server until it's running.
 */
export async function pollServerUntilRunning(
  state: ServersState,
  serverId: number,
  maxAttempts = 30,
  intervalMs = 5000,
): Promise<Server | null> {
  for (let i = 0; i < maxAttempts; i++) {
    const server = await getServerStatus(state, serverId);
    if (server?.status === "running") {
      return server;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return null;
}

/**
 * Connect to a server's control UI.
 */
export function connectToServer(serverUrl: string): void {
  window.open(serverUrl, "_blank");
}

/**
 * Update the selected region.
 */
export function setSelectedRegion(state: ServersState, region: string): void {
  state.serversSelectedRegion = region;
}

/**
 * Update the selected server type.
 */
export function setSelectedType(state: ServersState, type: string): void {
  state.serversSelectedType = type;
}
