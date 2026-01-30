/**
 * Payment Flow Logic
 *
 * Manages the payment flow for AI interactions:
 * - Session tracking and message counting
 * - Payment requirement detection
 * - Payment verification and state updates
 */

import type {
  X402PaymentConfig,
  PaymentSession,
  PaymentRequest,
  PaymentResult,
} from "./types.js";
import { verifyPayment, createPaymentDeepLink } from "./x402-client.js";

// In-memory session store (replace with persistent storage in production)
const paymentSessions = new Map<string, PaymentSession>();
const pendingPayments = new Map<string, PaymentRequest>();

/**
 * Get or create a payment session
 */
export function getOrCreateSession(
  sessionKey: string,
  channelId: string,
  userId: string,
): PaymentSession {
  let session = paymentSessions.get(sessionKey);

  if (!session) {
    session = {
      sessionKey,
      channelId,
      userId,
      messageCount: 0,
      paidMessageCount: 0,
    };
    paymentSessions.set(sessionKey, session);
  }

  return session;
}

/**
 * Get a payment session by key
 */
export function getSession(sessionKey: string): PaymentSession | undefined {
  return paymentSessions.get(sessionKey);
}

/**
 * Update a payment session
 */
export function updateSession(sessionKey: string, updates: Partial<PaymentSession>): void {
  const session = paymentSessions.get(sessionKey);
  if (session) {
    Object.assign(session, updates);
  }
}

/**
 * Check if payment is required for the current message
 */
export function isPaymentRequired(session: PaymentSession, config: X402PaymentConfig): boolean {
  if (!config.enabled) {
    return false;
  }

  // Check if user has free messages remaining
  const freeMessages = config.freeMessagesPerSession || 3;
  const unpaidMessages = session.messageCount - session.paidMessageCount;

  return unpaidMessages >= freeMessages;
}

/**
 * Increment message count for a session
 */
export function incrementMessageCount(sessionKey: string): number {
  const session = paymentSessions.get(sessionKey);
  if (session) {
    session.messageCount += 1;
    return session.messageCount;
  }
  return 0;
}

/**
 * Create a pending payment request
 */
export function createPaymentRequest(
  session: PaymentSession,
  config: X402PaymentConfig,
): PaymentRequest {
  const id = generatePaymentId();
  const now = Date.now();

  const request: PaymentRequest = {
    id,
    sessionKey: session.sessionKey,
    amount: config.pricePerMessage,
    network: config.network,
    payTo: config.payTo,
    status: "pending",
    createdAt: now,
    expiresAt: now + 30 * 60 * 1000, // 30 minutes expiry
  };

  pendingPayments.set(id, request);
  updateSession(session.sessionKey, { pendingPaymentId: id });

  return request;
}

/**
 * Get a pending payment by ID
 */
export function getPendingPayment(paymentId: string): PaymentRequest | undefined {
  return pendingPayments.get(paymentId);
}

/**
 * Process a payment callback/verification
 */
export async function processPaymentCallback(
  paymentId: string,
  paymentSignature: string,
  config: X402PaymentConfig,
): Promise<PaymentResult> {
  const payment = pendingPayments.get(paymentId);

  if (!payment) {
    return { success: false, error: "Payment not found" };
  }

  if (payment.status !== "pending") {
    return { success: false, error: `Payment already ${payment.status}` };
  }

  if (Date.now() > payment.expiresAt) {
    payment.status = "expired";
    return { success: false, error: "Payment expired" };
  }

  // Verify payment with facilitator
  const result = await verifyPayment(paymentSignature, config);

  if (result.success) {
    payment.status = "paid";
    payment.txHash = result.txHash;

    // Update session
    const session = paymentSessions.get(payment.sessionKey);
    if (session) {
      session.paidMessageCount += 1;
      session.lastPaymentTxHash = result.txHash;
      session.lastPaymentTimestamp = Date.now();
      session.pendingPaymentId = undefined;
    }
  } else {
    payment.status = "failed";
  }

  return result;
}

/**
 * Generate payment status message for Telegram
 */
export function generatePaymentStatusMessage(
  session: PaymentSession,
  config: X402PaymentConfig,
): {
  requiresPayment: boolean;
  message: string;
  paymentUrl?: string;
  paymentId?: string;
} {
  if (!isPaymentRequired(session, config)) {
    const remaining =
      config.freeMessagesPerSession - (session.messageCount - session.paidMessageCount);
    return {
      requiresPayment: false,
      message:
        remaining > 0
          ? `You have ${remaining} free message${remaining === 1 ? "" : "s"} remaining.`
          : "",
    };
  }

  // Create payment request
  const paymentRequest = createPaymentRequest(session, config);

  const paymentUrl = createPaymentDeepLink(config, {
    sessionKey: session.sessionKey,
    messageId: paymentRequest.id,
    amount: config.pricePerMessage,
  });

  return {
    requiresPayment: true,
    message: `Payment required: ${config.pricePerMessage} USDC to continue.\n\nTap the button below to pay with your crypto wallet.`,
    paymentUrl,
    paymentId: paymentRequest.id,
  };
}

/**
 * Generate a unique payment ID
 */
function generatePaymentId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `pay_${timestamp}_${random}`;
}

/**
 * Clean up expired payments (call periodically)
 */
export function cleanupExpiredPayments(): number {
  const now = Date.now();
  let cleaned = 0;

  for (const [id, payment] of Array.from(pendingPayments.entries())) {
    if (payment.status === "pending" && now > payment.expiresAt) {
      payment.status = "expired";
      cleaned++;
    }

    // Remove old completed/expired payments after 24 hours
    if (
      payment.status !== "pending" &&
      now - payment.createdAt > 24 * 60 * 60 * 1000
    ) {
      pendingPayments.delete(id);
    }
  }

  return cleaned;
}

/**
 * Get payment statistics for a session
 */
export function getSessionStats(sessionKey: string): {
  totalMessages: number;
  paidMessages: number;
  unpaidMessages: number;
  totalSpent: string;
} | null {
  const session = paymentSessions.get(sessionKey);
  if (!session) return null;

  return {
    totalMessages: session.messageCount,
    paidMessages: session.paidMessageCount,
    unpaidMessages: session.messageCount - session.paidMessageCount,
    totalSpent: `$${(session.paidMessageCount * 0.01).toFixed(2)}`, // Assuming $0.01 per message
  };
}
