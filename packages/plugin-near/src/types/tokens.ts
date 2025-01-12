export interface TokenAddress {
    address: string;
    defuse_asset_id: string;
    type?: 'native';
}

export interface TokenAddresses {
    [chain: string]: TokenAddress | undefined;
}

export interface SingleChainToken {
    defuseAssetId: string;
    type?: string;
    address: string;
    decimals: number;
    icon: string;
    chainIcon: string;
    chainName: string;
    symbol: string;
    name: string;
}

export interface UnifiedToken {
    unifiedAssetId: string;
    decimals: number;
    symbol: string;
    name: string;
    icon: string;
    addresses: TokenAddresses;
}

export interface TokenConfig {
    tokens: {
        unified_tokens: UnifiedToken[];
        single_chain_tokens: SingleChainToken[];
    }
}

// Import token configuration
const tokenConfig = {
    tokens: require('../config/tokens.json').tokens
} as TokenConfig;

/**
 * Type guard to check if a token is a UnifiedToken
 */
export function isUnifiedToken(token: UnifiedToken | SingleChainToken): token is UnifiedToken {
    return 'addresses' in token && 'unifiedAssetId' in token;
}

/**
 * Type guard to check if a token is a SingleChainToken
 */
export function isSingleChainToken(token: UnifiedToken | SingleChainToken): token is SingleChainToken {
    return 'defuseAssetId' in token && 'chainName' in token;
}

/**
 * Gets the defuse asset ID for a token
 */
export function getDefuseAssetId(token: UnifiedToken | SingleChainToken, chain?: string): string {
    if (isUnifiedToken(token)) {
        if (!chain) throw new Error('Chain parameter is required for unified tokens');
        const chainToken = token.addresses[chain];
        if (!chainToken) throw new Error(`Chain ${chain} not supported for token ${token.symbol}`);
        return chainToken.defuse_asset_id;
    }
    return token.defuseAssetId;
}

/**
 * Checks if a token is supported based on its symbol
 */
export function isTokenSupported(symbol: string): boolean {
    const upperSymbol = symbol.toUpperCase();
    return Boolean(getTokenBySymbol(upperSymbol));
}

/**
 * Gets the token details for a given symbol
 */
export function getTokenBySymbol(symbol: string): UnifiedToken | SingleChainToken | undefined {
    const upperSymbol = symbol.toUpperCase();

    // Check unified tokens first
    const unifiedToken = tokenConfig.tokens.unified_tokens.find(
        token => token.symbol.toUpperCase() === upperSymbol
    );
    if (unifiedToken) {
        return unifiedToken;
    }

    // Then check single chain tokens
    return tokenConfig.tokens.single_chain_tokens.find(
        token => token.symbol.toUpperCase() === upperSymbol
    );
}

/**
 * Gets the token details for a given Defuse asset ID
 */
export function getTokenByDefuseId(defuseId: string): UnifiedToken | SingleChainToken | undefined {
    // Check unified tokens
    for (const token of tokenConfig.tokens.unified_tokens) {
        for (const chainToken of Object.values(token.addresses)) {
            if (chainToken?.defuse_asset_id === defuseId) {
                return token;
            }
        }
    }

    // Check single chain tokens
    return tokenConfig.tokens.single_chain_tokens.find(token => token.defuseAssetId === defuseId);
}

/**
 * Gets all supported token symbols
 */
export function getAllSupportedTokens(): string[] {
    const tokens = new Set<string>();
    tokenConfig.tokens.unified_tokens.forEach(token => tokens.add(token.symbol));
    tokenConfig.tokens.single_chain_tokens.forEach(token => tokens.add(token.symbol));
    return Array.from(tokens);
}

/**
 * Gets all supported chain names
 */
export function getAllSupportedChains(): string[] {
    const chains = new Set<string>();
    tokenConfig.tokens.unified_tokens.forEach(token => {
        Object.keys(token.addresses).forEach(chain => chains.add(chain));
    });
    tokenConfig.tokens.single_chain_tokens.forEach(token => {
        chains.add(token.chainName);
    });
    return Array.from(chains);
}

/**
 * Gets the token address for a specific chain
 */
export function getTokenAddressForChain(token: UnifiedToken, chain: string): TokenAddress | undefined {
    if (!isUnifiedToken(token)) {
        throw new Error('Token is not a unified token');
    }
    return token.addresses[chain];
}
