# @elizaos/plugin-near

NEAR Protocol integration plugin for Eliza OS that enables token management, transfers, and swaps using Ref Finance and cross-chain operations using Near Intents.

## Overview

This plugin aims to be the basis of all interactions with the NEAR ecosystem, providing seamless integration with NEAR Protocol, Ref Finance DEX, and cross-chain operations through Near Intents.

## Features

- NEAR token transfers
- Token swaps via Ref Finance
- Cross-chain token swaps via Near Intents
- Multiple network support (mainnet, testnet)
- Secure transaction signing
- Automatic storage deposit handling
- Real-time price feeds
- Portfolio tracking and management
- Smart routing for optimal swaps
- Built-in denomination handling
- Comprehensive error handling
- Support for unified tokens across chains
- Cross-chain deposit and withdrawal functionality

## Installation

```bash
pnpm install @elizaos/plugin-near
```

## Configuration

The plugin requires environment variables or runtime settings:

```env
NEAR_WALLET_SECRET_KEY=your-wallet-private-key
NEAR_WALLET_PUBLIC_KEY=your-wallet-public-key
NEAR_ADDRESS=your-account.near
NEAR_NETWORK=testnet  # mainnet or testnet
NEAR_RPC_URL=https://rpc.testnet.near.org
NEAR_SLIPPAGE=0.01  # 1% slippage tolerance
```

## Usage

### Token Transfer

```typescript
import { nearPlugin } from "@elizaos/plugin-near";

// Send NEAR
const result = await eliza.execute({
    action: "SEND_NEAR",
    content: {
        recipient: "bob.near",
        amount: "1.5",
    },
});
```

### Token Swap (On NEAR)

```typescript
const result = await eliza.execute({
    action: "EXECUTE_SWAP_NEAR",
    content: {
        inputTokenId: "wrap.near",
        outputTokenId: "token.v2.ref-finance.near",
        amount: "10",
    },
});
```

### Cross-Chain Token Swap

```typescript
// Swap NEAR for ETH on Ethereum
const result = await eliza.execute({
    action: "NEAR_CROSS_CHAIN_SWAP",
    content: {
        defuse_asset_identifier_in: "NEAR",
        defuse_asset_identifier_out: "ETH",
        exact_amount_in: "1.0",
        network: "ethereum"
    },
});
```

### Cross-Chain Swap and Withdraw

```typescript
// Swap NEAR for USDC and withdraw to Base
const result = await eliza.execute({
    action: "WITHDRAW_NEAR_CROSS_CHAIN_SWAP",
    content: {
        defuse_asset_identifier_in: "NEAR",
        defuse_asset_identifier_out: "USDC",
        exact_amount_in: "10.0",
        destination_address: "0x...", // Base address
        network: "base"
    },
});
```

## API Reference

### Actions

#### `SEND_NEAR`

Transfers NEAR tokens to another account.

```typescript
{
  action: 'SEND_NEAR',
  content: {
    recipient: string,    // Recipient's NEAR account (e.g., "bob.near")
    amount: string,       // Amount to send (in NEAR)
    tokenAddress?: string // Optional: for NEP-141 tokens
  }
}
```

#### `EXECUTE_SWAP_NEAR`

Executes a token swap using Ref Finance.

```typescript
{
  action: 'EXECUTE_SWAP_NEAR',
  content: {
    inputTokenId: string,  // Input token contract (e.g., "wrap.near")
    outputTokenId: string, // Output token contract
    amount: string,        // Amount to swap
    slippageTolerance?: number // Optional: default from config
  }
}
```

#### `NEAR_CROSS_CHAIN_SWAP`

Executes a cross-chain token swap using Defuse Protocol.

```typescript
{
  action: 'NEAR_CROSS_CHAIN_SWAP',
  content: {
    defuse_asset_identifier_in: string,  // Input token symbol (e.g., "NEAR")
    defuse_asset_identifier_out: string, // Output token symbol (e.g., "ETH")
    exact_amount_in: string,            // Amount to swap
    network?: string                    // Optional: target network (e.g., "ethereum")
  }
}
```

#### `WITHDRAW_NEAR_CROSS_CHAIN_SWAP`

Executes a cross-chain token swap and withdraws to a specified address.

```typescript
{
  action: 'WITHDRAW_NEAR_CROSS_CHAIN_SWAP',
  content: {
    defuse_asset_identifier_in: string,  // Input token symbol
    defuse_asset_identifier_out: string, // Output token symbol
    exact_amount_in: string,            // Amount to swap
    destination_address: string,        // Address to withdraw to
    network: string                     // Target network
  }
}
```

### Supported Tokens

#### Unified Tokens (Cross-Chain)
- USDC (Ethereum, NEAR, Turbochain, Aurora, Base, Arbitrum, Solana)
- ETH (Ethereum, NEAR, Turbochain, Aurora, Base, Arbitrum)
- AURORA (NEAR, Turbochain, Aurora, Ethereum)
- TURBO (Ethereum, Turbochain, NEAR)

#### Single Chain Tokens
- NEAR (NEAR native)
- BTC (Bitcoin)
- SOL (Solana)
- DOGE (Dogecoin)
- XRP (XRP Ledger)
- Various ERC20 tokens (PEPE, SHIB, LINK, UNI, etc.)

### Providers

#### Wallet Provider

Provides wallet information and portfolio tracking.

```typescript
const walletInfo = await eliza.getProvider("wallet");
// Returns formatted portfolio including:
// - Account balance
// - Token balances
// - USD values
// - Market prices
// - Cross-chain balances
```

## Troubleshooting

### Common Issues

1. **Transaction Failures**
    - Check account balance
    - Verify storage deposits
    - Ensure sufficient gas
    - Confirm slippage tolerance
    - Verify cross-chain bridge status

2. **Connection Problems**
    - Verify RPC endpoint
    - Check network selection
    - Ensure valid credentials
    - Monitor API rate limits
    - Check Near Intents status

3. **Swap Issues**
    - Verify token pairs exist
    - Check liquidity pools
    - Confirm price impact
    - Monitor slippage settings
    - Verify cross-chain token support

4. **Cross-Chain Issues**
    - Check destination chain status
    - Verify token bridge support
    - Ensure correct address format
    - Monitor intent settlement status
    - Check storage balance requirements

## Security Best Practices

1. **Key Management**
    - Store private keys securely
    - Use environment variables
    - Implement key rotation
    - Monitor account activity

2. **Transaction Safety**
    - Validate all inputs
    - Implement amount limits
    - Double-check recipients
    - Monitor transaction status
    - Verify cross-chain addresses

3. **Network Security**
    - Use secure RPC endpoints
    - Implement retry mechanisms
    - Monitor for suspicious activity
    - Keep dependencies updated
    - Verify bridge contracts

4. **Error Handling**
    - Log all transaction attempts
    - Handle timeouts gracefully
    - Validate all user inputs
    - Provide clear error messages
    - Track cross-chain status

## Testing

Run the test suite:

```bash
pnpm test
```

Watch mode for development:

```bash
pnpm test:watch
```

## Dependencies

- near-api-js: ^5.0.1
- @ref-finance/ref-sdk: ^1.4.6
- bignumber.js: ^9.1.2
- node-cache: ^5.1.2
- @dao-xyz/borsh: ^5.2.1
- zod: ^3.22.4
- viem: For EVM chain interactions

## Contributing

Contributions are welcome! Please see the [CONTRIBUTING.md](CONTRIBUTING.md) file for more information.

## Credits

This plugin integrates with:

- [NEAR Protocol](https://near.org/)
- [Ref Finance](https://ref.finance/)
- [Near Intents](https://near.org/intents)
- Official NEAR JavaScript API and SDKs

Special thanks to:

- The NEAR Protocol team for developing the NEAR blockchain
- The Ref Finance team for developing the Ref Finance DEX
- The Defuse Protocol team for enabling cross-chain functionality
- The Eliza community for their contributions and feedback.

For more information about NEAR blockchain capabilities:

- [NEAR Documentation](https://docs.near.org/)
- [NEAR Developer Portal](https://near.org/developers)
- [NEAR Network Dashboard](https://nearscan.io/)
- [NEAR GitHub Repository](https://github.com/nearprotocol/near-api-js)
- [Defuse Protocol Documentation](https://docs.near-intents.org/defuse-protocol/)

## License

This plugin is part of the Eliza project. See the main project repository for license information.
