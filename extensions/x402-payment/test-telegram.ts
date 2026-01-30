/**
 * Telegram Bot x402 Payment Integration Test
 *
 * Standalone test for Telegram bot with x402 payment flow
 * Usage: TELEGRAM_BOT_TOKEN=xxx bun run test-telegram.ts
 */

import { createPublicClient, http, parseAbiItem, formatUnits } from "viem";
import { baseSepolia } from "viem/chains";
import {
  getOrCreateSession,
  isPaymentRequired,
  incrementMessageCount,
  generatePaymentStatusMessage,
} from "./src/payment-flow.js";
import {
  formatPaymentRequiredMessage,
  createPaymentKeyboard,
  formatHelpMessage,
  formatFreeMessagesMessage,
} from "./src/telegram-ui.js";
import type { X402PaymentConfig } from "./src/types.js";

// Base Sepolia USDC contract
const USDC_CONTRACT = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

// Viem client for Base Sepolia
const viemClient = createPublicClient({
  chain: baseSepolia,
  transport: http("https://sepolia.base.org"),
});

// Track verified transactions to prevent double-spend
const verifiedTxHashes = new Set<string>();

// ERC20 Transfer event signature
const transferEventAbi = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)"
);

/**
 * Verify USDC payment transaction on Base Sepolia
 */
async function verifyPaymentTransaction(
  txHash: string,
  expectedTo: string,
  minAmount: bigint
): Promise<{ valid: boolean; error?: string; amount?: string; from?: string }> {
  // Check if already verified
  if (verifiedTxHashes.has(txHash.toLowerCase())) {
    return { valid: false, error: "Transaction already used" };
  }

  try {
    // Get transaction receipt
    const receipt = await viemClient.getTransactionReceipt({
      hash: txHash as `0x${string}`,
    });

    if (!receipt) {
      return { valid: false, error: "Transaction not found" };
    }

    if (receipt.status !== "success") {
      return { valid: false, error: "Transaction failed" };
    }

    // Find USDC Transfer event
    const transferLog = receipt.logs.find(
      (log) =>
        log.address.toLowerCase() === USDC_CONTRACT.toLowerCase() &&
        log.topics[0] ===
          "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef" // Transfer event signature
    );

    if (!transferLog) {
      return { valid: false, error: "No USDC transfer found in transaction" };
    }

    // Decode transfer event
    const from = `0x${transferLog.topics[1]?.slice(26)}`;
    const to = `0x${transferLog.topics[2]?.slice(26)}`;
    const value = BigInt(transferLog.data);

    // Verify recipient
    if (to.toLowerCase() !== expectedTo.toLowerCase()) {
      return {
        valid: false,
        error: `Wrong recipient: expected ${expectedTo}, got ${to}`,
      };
    }

    // Verify amount (USDC has 6 decimals)
    if (value < minAmount) {
      return {
        valid: false,
        error: `Insufficient amount: expected ${formatUnits(minAmount, 6)}, got ${formatUnits(value, 6)} USDC`,
      };
    }

    // Mark as verified
    verifiedTxHashes.add(txHash.toLowerCase());

    return {
      valid: true,
      amount: formatUnits(value, 6),
      from,
    };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Verification failed",
    };
  }
}

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!BOT_TOKEN) {
  console.error("❌ TELEGRAM_BOT_TOKEN environment variable is required");
  console.log("\nUsage: TELEGRAM_BOT_TOKEN=xxx bun run test-telegram.ts");
  process.exit(1);
}

// x402 Payment Config
const PAYMENT_CONFIG: X402PaymentConfig = {
  enabled: true,
  network: "eip155:84532", // Base Sepolia
  payTo: "0xBf30B87972F7A1e1fA018615d636b2C3c7bcA8Ef",
  pricePerMessage: "$0.01",
  facilitatorUrl: "https://x402.org/facilitator",
  freeMessagesPerSession: 3,
  telegramPaymentBotUrl: "http://localhost:8402", // Local test server
};

const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: { id: number; first_name: string; username?: string };
    chat: { id: number; type: string };
    text?: string;
    date: number;
  };
}

interface TelegramResponse {
  ok: boolean;
  result?: TelegramUpdate[];
  description?: string;
}

async function sendMessage(
  chatId: number,
  text: string,
  replyMarkup?: object
): Promise<void> {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
  };

  if (replyMarkup) {
    body.reply_markup = replyMarkup;
  }

  const response = await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const result = await response.json();
  if (!result.ok) {
    console.error("Failed to send message:", result);
  }
}

async function getUpdates(offset?: number): Promise<TelegramUpdate[]> {
  const params = new URLSearchParams({
    timeout: "30",
    allowed_updates: JSON.stringify(["message"]),
  });

  if (offset) {
    params.set("offset", String(offset));
  }

  const response = await fetch(`${TELEGRAM_API}/getUpdates?${params}`);
  const data = (await response.json()) as TelegramResponse;

  if (!data.ok) {
    console.error("Failed to get updates:", data.description);
    return [];
  }

  return data.result || [];
}

async function handleMessage(
  chatId: number,
  userId: number,
  text: string,
  username?: string
): Promise<void> {
  const sessionKey = `telegram:${chatId}:${userId}`;
  const session = getOrCreateSession(sessionKey, "telegram", String(userId));

  console.log(`\n📨 Message from ${username || userId}: "${text}"`);
  console.log(`   Session: ${session.messageCount} messages, ${session.paidMessageCount} paid`);

  // Handle /x402 commands
  if (text.startsWith("/x402")) {
    const command = text.slice(5).trim().toLowerCase();

    if (command === "help" || command === "") {
      await sendMessage(chatId, formatHelpMessage());
      return;
    }

    if (command === "status") {
      const freeRemaining =
        PAYMENT_CONFIG.freeMessagesPerSession -
        (session.messageCount - session.paidMessageCount);

      const statusMsg = [
        "<b>x402 Payment Status</b>",
        "",
        `Messages used: ${session.messageCount}`,
        `Paid messages: ${session.paidMessageCount}`,
        `Free remaining: ${Math.max(0, freeRemaining)}`,
        "",
        `Price per message: ${PAYMENT_CONFIG.pricePerMessage}`,
        `Network: Base Sepolia (Testnet)`,
      ].join("\n");

      await sendMessage(chatId, statusMsg);
      return;
    }

    if (command === "reset") {
      session.messageCount = 0;
      session.paidMessageCount = 0;
      await sendMessage(chatId, "✅ Session reset! You have 3 free messages again.");
      return;
    }

    if (command.startsWith("paid")) {
      // Payment verification with transaction hash
      const txHash = command.slice(4).trim();

      if (!txHash || !txHash.startsWith("0x")) {
        await sendMessage(
          chatId,
          "❌ Please provide a transaction hash:\n<code>/x402 paid 0xYourTxHash...</code>",
        );
        return;
      }

      await sendMessage(chatId, "🔍 Verifying transaction on Base Sepolia...");

      // Parse price to USDC amount (6 decimals)
      const priceStr = PAYMENT_CONFIG.pricePerMessage.replace("$", "");
      const minAmount = BigInt(Math.round(parseFloat(priceStr) * 1_000_000));

      const result = await verifyPaymentTransaction(
        txHash,
        PAYMENT_CONFIG.payTo,
        minAmount
      );

      if (!result.valid) {
        await sendMessage(chatId, `❌ Payment verification failed:\n${result.error}`);
        return;
      }

      // Payment verified! Update session
      session.paidMessageCount += 3; // Grant 3 more messages
      const freeRemaining =
        PAYMENT_CONFIG.freeMessagesPerSession -
        (session.messageCount - session.paidMessageCount);

      await sendMessage(
        chatId,
        [
          "✅ <b>Payment Verified!</b>",
          "",
          `Amount: ${result.amount} USDC`,
          `From: <code>${result.from}</code>`,
          `Tx: <code>${txHash.slice(0, 16)}...</code>`,
          "",
          `You now have ${Math.max(0, freeRemaining)} messages available.`,
        ].join("\n")
      );
      return;
    }

    await sendMessage(
      chatId,
      "Unknown command. Try:\n/x402 help\n/x402 status\n/x402 reset\n/x402 paid 0xTxHash"
    );
    return;
  }

  // Check if payment is required
  if (isPaymentRequired(session, PAYMENT_CONFIG)) {
    console.log("   💰 Payment required!");

    const status = generatePaymentStatusMessage(session, PAYMENT_CONFIG);

    // Use text link instead of button (Telegram doesn't allow localhost in buttons)
    const paymentMsg = [
      "<b>💳 Payment Required</b>",
      "",
      `Your ${PAYMENT_CONFIG.freeMessagesPerSession} free messages have been used.`,
      `To continue, please pay <b>${PAYMENT_CONFIG.pricePerMessage} USDC</b>.`,
      "",
      "👉 <b>Pay here:</b>",
      `<a href="${status.paymentUrl}">${status.paymentUrl}</a>`,
      "",
      "Open the link in your browser with MetaMask installed.",
    ].join("\n");

    await sendMessage(chatId, paymentMsg);
    return;
  }

  // Increment message count
  incrementMessageCount(sessionKey);

  // Simulate AI response
  const freeRemaining =
    PAYMENT_CONFIG.freeMessagesPerSession -
    (session.messageCount - session.paidMessageCount);

  let response = `🤖 <b>AI Response</b>\n\nYou said: "${text}"\n\nThis is a simulated AI response for testing the x402 payment flow.`;

  if (freeRemaining > 0 && freeRemaining <= 2) {
    response += `\n\n⚠️ ${formatFreeMessagesMessage(freeRemaining)}`;
  }

  await sendMessage(chatId, response);
  console.log(`   ✅ Responded (${freeRemaining} free messages left)`);
}

async function main() {
  console.log("🤖 x402 Payment Telegram Bot Test");
  console.log("=".repeat(40));
  console.log(`Network: ${PAYMENT_CONFIG.network}`);
  console.log(`Pay To: ${PAYMENT_CONFIG.payTo}`);
  console.log(`Price: ${PAYMENT_CONFIG.pricePerMessage}`);
  console.log(`Free Messages: ${PAYMENT_CONFIG.freeMessagesPerSession}`);
  console.log("=".repeat(40));
  console.log("\n📡 Listening for messages... (Ctrl+C to stop)\n");
  console.log("Commands:");
  console.log("  /x402 help   - Show help");
  console.log("  /x402 status - Show payment status");
  console.log("  /x402 reset  - Reset session (for testing)");
  console.log("");

  let lastUpdateId = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const updates = await getUpdates(lastUpdateId + 1);

      for (const update of updates) {
        lastUpdateId = update.update_id;

        if (update.message?.text) {
          const { chat, from, text } = update.message;
          await handleMessage(chat.id, from.id, text, from.username);
        }
      }
    } catch (error) {
      console.error("Error polling updates:", error);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

main().catch(console.error);
