# x402 Payment Plugin for OpenClaw

Enable USDC payments for AI agent interactions using the [x402 protocol](https://x402.org).

## Overview

This plugin integrates the x402 payment protocol with OpenClaw, allowing you to monetize AI agent responses via instant, low-fee USDC payments on the Base network.

### Features

- **Pay-per-message**: Charge users USDC for AI responses
- **Free trial messages**: Configurable number of free messages before requiring payment
- **Telegram integration**: Native inline keyboard buttons for payment
- **Base network support**: Both Base Mainnet and Base Sepolia (testnet)
- **Instant settlement**: Payments settle in seconds via x402 facilitator

## Installation

The plugin is included in the OpenClaw extensions directory. To enable it:

1. Install dependencies in the plugin directory:
```bash
cd extensions/x402-payment
npm install
```

2. Configure the plugin in your OpenClaw config:
```yaml
plugins:
  x402-payment:
    enabled: true
    network: "eip155:8453"  # Base Mainnet
    payTo: "0xYourWalletAddress"
    pricePerMessage: "$0.01"
    freeMessagesPerSession: 3
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `X402_ENABLED` | Enable payments | `false` |
| `X402_NETWORK` | CAIP-2 network ID | `eip155:84532` (Base Sepolia) |
| `X402_PAY_TO` | Your receiving wallet address | Required |
| `X402_PRICE_PER_MESSAGE` | Price per AI response | `$0.01` |
| `X402_FACILITATOR_URL` | Facilitator for payment verification | Auto-selected |
| `X402_FREE_MESSAGES` | Free messages before payment required | `3` |
| `X402_PRIVATE_KEY` | Private key for testing (optional) | - |

### Plugin Config

```json
{
  "enabled": true,
  "network": "eip155:8453",
  "payTo": "0x...",
  "pricePerMessage": "$0.01",
  "freeMessagesPerSession": 3,
  "telegramPaymentBotUrl": "https://openclaw.ai/pay"
}
```

### Networks

| Network | CAIP-2 ID | Use Case |
|---------|-----------|----------|
| Base Mainnet | `eip155:8453` | Production |
| Base Sepolia | `eip155:84532` | Testing |

## Usage

### Telegram Commands

Users can interact with the payment system via these commands:

- `/x402` or `/x402 help` - Show help information
- `/x402 status` - Show payment status and remaining free messages
- `/x402 pay` - Generate a payment link

### CLI Commands

```bash
# Check configuration status
openclaw x402 status

# View session stats
openclaw x402 session <sessionKey>

# Clean up expired payments
openclaw x402 cleanup
```

## How It Works

1. User sends message to AI via Telegram
2. Plugin checks if user has free messages remaining
3. If payment required:
   - Plugin blocks message
   - Sends payment prompt with inline button
   - User clicks button to open payment webapp
   - User pays with crypto wallet (MetaMask, Coinbase Wallet, etc.)
   - Payment verified via x402 facilitator
   - Message unblocked and AI responds
4. If free messages available:
   - Message passes through to AI
   - Counter incremented

## Payment Flow

```
User Message → Check Free Messages → [Payment Required?]
                                           │
                    ┌──────────────────────┴──────────────────────┐
                    │ No                                          │ Yes
                    ▼                                             ▼
              AI Response                                   Payment Prompt
                                                                  │
                                                                  ▼
                                                           User Pays USDC
                                                                  │
                                                                  ▼
                                                         Verify via x402
                                                                  │
                                                                  ▼
                                                            AI Response
```

## Testing

### Local Development

1. Use Base Sepolia testnet:
```bash
export X402_NETWORK=eip155:84532
export X402_PAY_TO=0xYourTestWallet
export X402_ENABLED=true
```

2. Get testnet USDC from [Base Sepolia Faucet](https://www.alchemy.com/faucets/base-sepolia)

3. Test the flow with a small amount

### Production

1. Switch to Base Mainnet:
```bash
export X402_NETWORK=eip155:8453
```

2. Ensure your receiving wallet is ready for real USDC

## Security

- Never commit private keys
- Use environment variables for sensitive config
- Test thoroughly on testnet before mainnet
- Monitor payment callbacks for anomalies

## Resources

- [x402 Protocol Documentation](https://x402.org)
- [x402 GitHub](https://github.com/coinbase/x402)
- [Base Network](https://base.org)
- [USDC on Base](https://www.circle.com/usdc)

## License

MIT
