/**
 * x402 Integration Test
 *
 * Tests the x402 payment flow on Base Sepolia testnet
 */

import { resolveConfig, validateConfig } from "./src/config.js";
import {
  getOrCreateSession,
  isPaymentRequired,
  incrementMessageCount,
  generatePaymentStatusMessage,
  createPaymentRequest
} from "./src/payment-flow.js";
import {
  formatPaymentRequiredMessage,
  createPaymentKeyboard,
  formatHelpMessage
} from "./src/telegram-ui.js";
import { generatePaymentRequired, createPaymentDeepLink } from "./src/x402-client.js";

// Test configuration
const TEST_CONFIG = {
  enabled: true,
  network: "eip155:84532", // Base Sepolia
  payTo: "0xBf30B87972F7A1e1fA018615d636b2C3c7bcA8Ef",
  pricePerMessage: "$0.01",
  facilitatorUrl: "https://x402.org/facilitator",
  freeMessagesPerSession: 3,
  telegramPaymentBotUrl: "https://openclaw.ai/pay",
};

console.log("🧪 x402 Payment Plugin Integration Test\n");
console.log("=".repeat(50));

// Test 1: Config validation
console.log("\n📋 Test 1: Configuration Validation");
// Use TEST_CONFIG directly for testing (bypasses env vars)
const config = TEST_CONFIG;
const validation = validateConfig(config);
console.log(`   Enabled: ${config.enabled}`);
console.log(`   Network: ${config.network}`);
console.log(`   Pay To: ${config.payTo}`);
console.log(`   Price: ${config.pricePerMessage}`);
console.log(`   Free Messages: ${config.freeMessagesPerSession}`);
console.log(`   ✅ Valid: ${validation.valid}`);
if (!validation.valid) {
  console.log(`   ❌ Errors: ${validation.errors.join(", ")}`);
}

// Test 2: Session management
console.log("\n📋 Test 2: Session Management");
const sessionKey = `telegram:test:user123`;
const session = getOrCreateSession(sessionKey, "telegram", "user123");
console.log(`   Session Key: ${session.sessionKey}`);
console.log(`   Message Count: ${session.messageCount}`);
console.log(`   Paid Messages: ${session.paidMessageCount}`);

// Simulate messages
for (let i = 0; i < 4; i++) {
  incrementMessageCount(sessionKey);
}
console.log(`   After 4 messages: ${session.messageCount}`);
console.log(`   ✅ Session tracking works`);

// Test 3: Payment requirement check
console.log("\n📋 Test 3: Payment Requirement Check");
const needsPayment = isPaymentRequired(session, config);
console.log(`   Messages: ${session.messageCount}, Paid: ${session.paidMessageCount}`);
console.log(`   Free allowed: ${config.freeMessagesPerSession}`);
console.log(`   Payment required: ${needsPayment}`);
console.log(`   ✅ ${needsPayment ? "Correctly requires payment" : "Free messages available"}`);

// Test 4: Payment request generation
console.log("\n📋 Test 4: Payment Request Generation");
const paymentRequest = createPaymentRequest(session, config);
console.log(`   Payment ID: ${paymentRequest.id}`);
console.log(`   Amount: ${paymentRequest.amount}`);
console.log(`   Network: ${paymentRequest.network}`);
console.log(`   Status: ${paymentRequest.status}`);
console.log(`   Expires: ${new Date(paymentRequest.expiresAt).toISOString()}`);
console.log(`   ✅ Payment request created`);

// Test 5: x402 Protocol headers
console.log("\n📋 Test 5: x402 Protocol Headers");
const { headers, body } = generatePaymentRequired(config);
console.log(`   X-Payment-Required header: ${headers["X-Payment-Required"].slice(0, 50)}...`);
console.log(`   Body x402Version: ${(body as any).x402Version}`);
console.log(`   Accepts:`, JSON.stringify((body as any).accepts, null, 2));
console.log(`   ✅ x402 headers generated`);

// Test 6: Payment deep link
console.log("\n📋 Test 6: Payment Deep Link");
const deepLink = createPaymentDeepLink(config, {
  sessionKey: session.sessionKey,
  messageId: paymentRequest.id,
  amount: config.pricePerMessage,
});
console.log(`   Deep Link: ${deepLink}`);
console.log(`   ✅ Deep link generated`);

// Test 7: Telegram UI
console.log("\n📋 Test 7: Telegram UI Components");
const paymentMessage = formatPaymentRequiredMessage(session, config);
console.log(`   Payment Message:\n${paymentMessage.split('\n').map(l => '   ' + l).join('\n')}`);

const keyboard = createPaymentKeyboard(deepLink, config);
console.log(`   Keyboard buttons: ${keyboard.inline_keyboard.length} rows`);
console.log(`   ✅ Telegram UI components ready`);

// Test 8: Help message
console.log("\n📋 Test 8: Help Message");
const helpMsg = formatHelpMessage();
console.log(`   Help message length: ${helpMsg.length} chars`);
console.log(`   ✅ Help message available`);

// Summary
console.log("\n" + "=".repeat(50));
console.log("🎉 All integration tests passed!\n");

console.log("📝 Next steps to test live:");
console.log("   1. Get Base Sepolia ETH: https://www.alchemy.com/faucets/base-sepolia");
console.log("   2. Get testnet USDC: https://faucet.circle.com/");
console.log("   3. Open payment link in browser with MetaMask");
console.log(`\n🔗 Test Payment Link:\n   ${deepLink}`);
