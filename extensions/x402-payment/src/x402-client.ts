/**
 * x402 Client Wrapper
 *
 * Handles x402 payment protocol operations including:
 * - Client initialization with EVM signer
 * - Payment payload creation
 * - Payment verification via facilitator
 */

import type { X402PaymentConfig, PaymentResult, PaymentAccept } from "./types.js";

// Type definitions for x402 SDK (dynamically loaded)
type X402ClientClass = new () => {
  register: (networkPattern: string, scheme: unknown) => void;
};
type WrapFetchFn = (fetch: typeof globalThis.fetch, client: unknown) => typeof globalThis.fetch;
type SignerAccount = { address: string };

// Cached module references
let cachedModules: {
  x402Client: X402ClientClass;
  registerExactEvmScheme: (client: unknown, opts: { signer: SignerAccount }) => void;
  privateKeyToAccount: (key: `0x${string}`) => SignerAccount;
  wrapFetchWithPayment: WrapFetchFn;
} | null = null;

async function loadDependencies() {
  if (cachedModules) return cachedModules;

  try {
    const [coreClient, evmScheme, viemAccounts, fetchWrapper] = await Promise.all([
      import("@x402/core/client"),
      import("@x402/evm/exact/client"),
      import("viem/accounts"),
      import("@x402/fetch"),
    ]);

    cachedModules = {
      x402Client: coreClient.x402Client as X402ClientClass,
      registerExactEvmScheme: evmScheme.registerExactEvmScheme as (
        client: unknown,
        opts: { signer: SignerAccount },
      ) => void,
      privateKeyToAccount: viemAccounts.privateKeyToAccount as (key: `0x${string}`) => SignerAccount,
      wrapFetchWithPayment: fetchWrapper.wrapFetchWithPayment as WrapFetchFn,
    };

    return cachedModules;
  } catch (error) {
    console.error("[x402] Failed to load dependencies:", error);
    return null;
  }
}

export interface X402ClientInstance {
  client: unknown;
  fetchWithPayment: typeof globalThis.fetch;
  signerAddress: string;
}

/**
 * Create an x402 client instance with EVM signer
 */
export async function createX402Client(
  config: X402PaymentConfig,
): Promise<X402ClientInstance | null> {
  const modules = await loadDependencies();

  if (!modules) {
    console.error("[x402] Failed to load required dependencies");
    return null;
  }

  const privateKey = config.privateKey || process.env.X402_PRIVATE_KEY;
  if (!privateKey) {
    console.error("[x402] No private key configured");
    return null;
  }

  try {
    // Create signer from private key
    const signer = modules.privateKeyToAccount(privateKey as `0x${string}`);

    // Create x402 client and register EVM scheme
    const client = new modules.x402Client();
    modules.registerExactEvmScheme(client, { signer });

    // Create payment-wrapped fetch
    const fetchWithPayment = modules.wrapFetchWithPayment(fetch, client);

    return {
      client,
      fetchWithPayment,
      signerAddress: signer.address,
    };
  } catch (error) {
    console.error("[x402] Failed to create client:", error);
    return null;
  }
}

/**
 * Generate payment requirement headers for a 402 response
 */
export function generatePaymentRequired(config: X402PaymentConfig): {
  headers: Record<string, string>;
  body: object;
} {
  const accepts: PaymentAccept[] = [
    {
      scheme: "exact",
      network: config.network,
      payTo: config.payTo,
      price: config.pricePerMessage,
    },
  ];

  const paymentRequired = {
    x402Version: 2,
    accepts,
    resource: {
      description: "AI response from OpenClaw",
    },
  };

  // Encode as base64 for header
  const headerValue = Buffer.from(JSON.stringify(paymentRequired)).toString("base64");

  return {
    headers: {
      "X-Payment-Required": headerValue,
      "Content-Type": "application/json",
    },
    body: paymentRequired,
  };
}

/**
 * Verify a payment signature via the facilitator
 */
export async function verifyPayment(
  paymentSignature: string,
  config: X402PaymentConfig,
): Promise<PaymentResult> {
  try {
    const response = await fetch(`${config.facilitatorUrl}/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        signature: paymentSignature,
        network: config.network,
        payTo: config.payTo,
        price: config.pricePerMessage,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error };
    }

    const result = (await response.json()) as {
      transaction?: string;
      network?: string;
      payer?: string;
    };
    return {
      success: true,
      txHash: result.transaction,
      network: result.network,
      payer: result.payer,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Create a payment deep link for Telegram
 * This generates a URL that opens a payment webapp
 */
export function createPaymentDeepLink(
  config: X402PaymentConfig,
  params: {
    sessionKey: string;
    messageId: string;
    amount: string;
  },
): string {
  const baseUrl = config.telegramPaymentBotUrl || "https://openclaw.ai/pay";
  const queryParams = new URLSearchParams({
    session: params.sessionKey,
    msg: params.messageId,
    amount: params.amount,
    network: config.network,
    payTo: config.payTo,
  });

  return `${baseUrl}?${queryParams.toString()}`;
}

/**
 * Parse price string to amount in USDC (6 decimals)
 */
export function parsePriceToUsdc(price: string): bigint {
  // Remove $ prefix if present
  const cleanPrice = price.replace(/^\$/, "");
  const amount = parseFloat(cleanPrice);

  // USDC has 6 decimals
  return BigInt(Math.round(amount * 1_000_000));
}

/**
 * Format USDC amount (6 decimals) to display string
 */
export function formatUsdcAmount(amount: bigint): string {
  const value = Number(amount) / 1_000_000;
  return `$${value.toFixed(2)}`;
}
