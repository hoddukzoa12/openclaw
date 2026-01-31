# x402 Payment Plugin for OpenClaw

x402 payment protocol integration for OpenClaw with Permit2 auto-payments.

## Features

### Core Payment
- **Pay-per-message**: Charge USDC for AI responses
- **Free trial messages**: Configurable free tier
- **Telegram integration**: Native payment flow
- **On-chain verification**: Real USDC transaction validation
- **Double-spend protection**: Transaction hash tracking

### Permit2 Integration
- **Gasless payments**: One-time approval, then signature-only
- **Auto-billing**: Usage-based automatic charging
- **Spending limits**: User-controlled allowances

## Quick Start

### 1. Install Dependencies

```bash
cd extensions/x402-payment
pnpm install
```

### 2. Configure Environment

Required variables:
```bash
TELEGRAM_BOT_TOKEN=your_bot_token
X402_PAY_TO=0xYourWalletAddress
```

### 3. Run Telegram Bot

```bash
TELEGRAM_BOT_TOKEN=xxx pnpm telegram
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `X402_ENABLED` | Enable payments | `false` |
| `X402_NETWORK` | CAIP-2 network ID | `eip155:84532` |
| `X402_PAY_TO` | Receiving wallet address | Required |
| `X402_PRICE_PER_MESSAGE` | Price per response | `$0.01` |
| `X402_FREE_MESSAGES` | Free messages per session | `3` |
| `PERMIT2_SPENDER_ADDRESS` | Auto-payment contract | Optional |

### Networks

| Network | CAIP-2 ID | USDC Contract |
|---------|-----------|---------------|
| Base Mainnet | `eip155:8453` | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Base Sepolia | `eip155:84532` | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |

## Usage

### Telegram Commands

```
/x402 help     - Show help
/x402 status   - Show payment status
/x402 reset    - Reset session (testing)
/x402 paid TX  - Verify payment transaction
```

### Payment Flow

```
Message → Free Messages Check → [Payment Required?]
                                      │
              ┌───────────────────────┴───────────────────────┐
              │ No                                            │ Yes
              ▼                                               ▼
        AI Response                                    Payment Link
                                                             │
                                                             ▼
                                                     User Sends USDC
                                                             │
                                                             ▼
                                                  /x402 paid 0xTxHash
                                                             │
                                                             ▼
                                                    On-chain Verify
                                                             │
                                                             ▼
                                                       AI Response
```

### Permit2 Flow (Gasless)

```
1. User approves USDC to Permit2 (one-time transaction)
2. User signs Permit2 allowance for Vessel (no gas)
3. All future payments: automatic, no signatures needed
```

## Architecture

```
extensions/x402-payment/
├── src/
│   ├── x402-client.ts     # x402 protocol wrapper
│   ├── payment-flow.ts    # Session/payment management
│   ├── telegram-ui.ts     # Telegram payment messages
│   ├── config.ts          # Configuration
│   ├── hooks.ts           # OpenClaw hook registration
│   ├── types.ts           # Type definitions
│   └── permit2/           # Permit2 auto-payments
│       ├── permit2-client.ts
│       ├── approval-flow.ts
│       ├── auto-payment.ts
│       └── index.ts
├── index.ts               # Plugin entry point
├── test-telegram.ts       # Telegram bot test
└── openclaw.plugin.json   # Plugin manifest
```

## Testing

### Unit Tests

```bash
pnpm test
```

### Live Integration Test

```bash
# Get Base Sepolia USDC from faucet.circle.com
# Run Telegram bot
TELEGRAM_BOT_TOKEN=xxx pnpm telegram

# In Telegram:
# 1. Send 3 messages (free tier)
# 2. 4th message triggers payment
# 3. Send USDC to payment address
# 4. /x402 paid 0xYourTxHash
```

## Related: Vessel Platform

For LLM proxy, onboarding, UI, and infrastructure features, see the **Vessel** app at `apps/vessel/`.

Vessel uses this plugin for payment processing and adds:
- OpenRouter LLM proxy with usage tracking
- OAuth-based LLM provider onboarding
- Control UI for settings and dashboard
- Phala Cloud + Hetzner deployment

## Resources

- [x402 Protocol](https://x402.org)
- [Permit2 Documentation](https://docs.uniswap.org/contracts/permit2/overview)
- [Base Network](https://base.org)

## License

MIT
