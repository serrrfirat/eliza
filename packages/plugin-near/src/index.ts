import { Plugin } from "@elizaos/core/src/types";
import { walletProvider } from "./providers/wallet";
// import { executeCreateToken } from "./actions/createToken";
import { executeSwap } from "./actions/swap";
import { executeTransfer } from "./actions/transfer";
import { executeCrossChainSwap, executeCrossChainSwapAndWithdraw } from "./actions/crossChainSwap";

export const nearPlugin: Plugin = {
    name: "NEAR",
    description: "Near Protocol Plugin for Eliza",
    providers: [walletProvider],
    actions: [executeSwap, executeTransfer, executeCrossChainSwap, executeCrossChainSwapAndWithdraw],
    evaluators: [],
};

export default nearPlugin;
