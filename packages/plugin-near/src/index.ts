import { Plugin } from "@ai16z/eliza/src/types";
import { walletProvider } from "./providers/wallet";
import { executeSwap } from "./actions/swap";
import { executeTransfer } from './actions/transfer';
import { executeCrossChainSwap } from './actions/crossChainSwap';

export const nearPlugin: Plugin = {
    name: "NEAR",
    description: "Near Protocol Plugin for Eliza",
    providers: [walletProvider],
    actions: [executeSwap, executeTransfer, executeCrossChainSwap],
    evaluators: [],
};

export default nearPlugin;
