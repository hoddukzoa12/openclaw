import { describe, it, expect, beforeEach } from "vitest";
import {
  getOrCreateSession,
  getSession,
  updateSession,
  isPaymentRequired,
  incrementMessageCount,
  createPaymentRequest,
  getPendingPayment,
  cleanupExpiredPayments,
  getSessionStats,
} from "./payment-flow.js";
import type { X402PaymentConfig } from "./types.js";

const testConfig: X402PaymentConfig = {
  enabled: true,
  network: "eip155:84532",
  payTo: "0x1234567890123456789012345678901234567890",
  pricePerMessage: "$0.01",
  facilitatorUrl: "https://x402.org/facilitator",
  freeMessagesPerSession: 3,
  telegramPaymentBotUrl: "https://openclaw.ai/pay",
};

describe("payment-flow", () => {
  describe("getOrCreateSession", () => {
    it("creates a new session if none exists", () => {
      const sessionKey = `test-session-${Date.now()}`;
      const session = getOrCreateSession(sessionKey, "telegram", "user123");

      expect(session).toBeDefined();
      expect(session.sessionKey).toBe(sessionKey);
      expect(session.channelId).toBe("telegram");
      expect(session.userId).toBe("user123");
      expect(session.messageCount).toBe(0);
      expect(session.paidMessageCount).toBe(0);
    });

    it("returns existing session", () => {
      const sessionKey = `test-session-existing-${Date.now()}`;
      const session1 = getOrCreateSession(sessionKey, "telegram", "user123");
      session1.messageCount = 5;

      const session2 = getOrCreateSession(sessionKey, "telegram", "user123");
      expect(session2.messageCount).toBe(5);
    });
  });

  describe("isPaymentRequired", () => {
    it("returns false when payments are disabled", () => {
      const session = getOrCreateSession(`test-${Date.now()}`, "telegram", "user");
      session.messageCount = 10;

      const disabledConfig = { ...testConfig, enabled: false };
      expect(isPaymentRequired(session, disabledConfig)).toBe(false);
    });

    it("returns false when free messages remaining", () => {
      const session = getOrCreateSession(`test-${Date.now()}`, "telegram", "user");
      session.messageCount = 2;
      session.paidMessageCount = 0;

      expect(isPaymentRequired(session, testConfig)).toBe(false);
    });

    it("returns true when free messages exhausted", () => {
      const session = getOrCreateSession(`test-${Date.now()}`, "telegram", "user");
      session.messageCount = 3;
      session.paidMessageCount = 0;

      expect(isPaymentRequired(session, testConfig)).toBe(true);
    });

    it("returns false when user has paid", () => {
      const session = getOrCreateSession(`test-${Date.now()}`, "telegram", "user");
      session.messageCount = 5;
      session.paidMessageCount = 2;
      // 5 - 2 = 3 unpaid, which equals freeMessagesPerSession, so payment required
      expect(isPaymentRequired(session, testConfig)).toBe(true);

      session.paidMessageCount = 3;
      // 5 - 3 = 2 unpaid, less than freeMessagesPerSession
      expect(isPaymentRequired(session, testConfig)).toBe(false);
    });
  });

  describe("incrementMessageCount", () => {
    it("increments message count", () => {
      const sessionKey = `test-inc-${Date.now()}`;
      getOrCreateSession(sessionKey, "telegram", "user");

      expect(incrementMessageCount(sessionKey)).toBe(1);
      expect(incrementMessageCount(sessionKey)).toBe(2);
      expect(incrementMessageCount(sessionKey)).toBe(3);
    });

    it("returns 0 for non-existent session", () => {
      expect(incrementMessageCount("non-existent")).toBe(0);
    });
  });

  describe("createPaymentRequest", () => {
    it("creates a pending payment request", () => {
      const session = getOrCreateSession(`test-pay-${Date.now()}`, "telegram", "user");
      const request = createPaymentRequest(session, testConfig);

      expect(request.id).toMatch(/^pay_/);
      expect(request.sessionKey).toBe(session.sessionKey);
      expect(request.amount).toBe("$0.01");
      expect(request.network).toBe("eip155:84532");
      expect(request.status).toBe("pending");
      expect(request.expiresAt).toBeGreaterThan(request.createdAt);
    });

    it("can be retrieved by ID", () => {
      const session = getOrCreateSession(`test-pay-get-${Date.now()}`, "telegram", "user");
      const request = createPaymentRequest(session, testConfig);

      const retrieved = getPendingPayment(request.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(request.id);
    });
  });

  describe("cleanupExpiredPayments", () => {
    it("marks expired payments as expired", () => {
      const session = getOrCreateSession(`test-cleanup-${Date.now()}`, "telegram", "user");
      const request = createPaymentRequest(session, testConfig);

      // Manually expire the payment
      const payment = getPendingPayment(request.id);
      if (payment) {
        payment.expiresAt = Date.now() - 1000;
      }

      const cleaned = cleanupExpiredPayments();
      expect(cleaned).toBeGreaterThanOrEqual(1);

      const expired = getPendingPayment(request.id);
      expect(expired?.status).toBe("expired");
    });
  });

  describe("getSessionStats", () => {
    it("returns null for non-existent session", () => {
      expect(getSessionStats("non-existent")).toBeNull();
    });

    it("returns correct stats", () => {
      const sessionKey = `test-stats-${Date.now()}`;
      const session = getOrCreateSession(sessionKey, "telegram", "user");
      session.messageCount = 10;
      session.paidMessageCount = 5;

      const stats = getSessionStats(sessionKey);
      expect(stats).toBeDefined();
      expect(stats?.totalMessages).toBe(10);
      expect(stats?.paidMessages).toBe(5);
      expect(stats?.unpaidMessages).toBe(5);
    });
  });
});
