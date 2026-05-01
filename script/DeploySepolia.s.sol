// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {console2} from "forge-std/console2.sol";
import {ScriptPk} from "./ScriptPk.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReceivableNFT} from "../src/ReceivableNFT.sol";
import {FactoringVault} from "../src/FactoringVault.sol";
import {OperatorOracle} from "../src/adapters/OperatorOracle.sol";
import {FunctionsSettlement} from "../src/chainlink/FunctionsSettlement.sol";
import {FactoringAutomation} from "../src/chainlink/FactoringAutomation.sol";
import {Pricing} from "../src/lib/Pricing.sol";

/// @notice Deploy on Sepolia using an existing ERC20 (e.g. USDC) and live Functions router from env.
contract DeploySepolia is ScriptPk {
    function run() external {
        uint256 pk = envPrivateKey("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        address asset = vm.envAddress("ASSET_TOKEN");
        address functionsRouter = vm.envAddress("FUNCTIONS_ROUTER");

        vm.startBroadcast(pk);

        ReceivableNFT receivable = new ReceivableNFT(deployer);
        Pricing.Params memory p = Pricing.Params({baseDiscountBps: 200, maxDiscountBps: 1500, slopeBps: 800});
        FactoringVault vault =
            new FactoringVault(IERC20(asset), receivable, deployer, p, 9500);
        OperatorOracle operatorOracle = new OperatorOracle(address(vault), deployer);
        vault.grantRole(vault.ORACLE_ROLE(), address(operatorOracle));
        operatorOracle.grantRole(operatorOracle.OPERATOR_ROLE(), deployer);

        FunctionsSettlement functions = new FunctionsSettlement(functionsRouter, address(vault), deployer);
        vault.grantRole(vault.ORACLE_ROLE(), address(functions));

        FactoringAutomation _automation = new FactoringAutomation(address(vault));

        vm.stopBroadcast();

        console2.log("=== Sepolia deployment ===");
        console2.log("Chain: Sepolia (11155111)");
        console2.log("ASSET_TOKEN (vault asset):", asset);
        console2.log("FUNCTIONS_ROUTER:", functionsRouter);
        console2.log("ReceivableNFT:", address(receivable));
        console2.log("FactoringVault:", address(vault));
        console2.log("OperatorOracle:", address(operatorOracle));
        console2.log("FunctionsSettlement:", address(functions));
        console2.log("FactoringAutomation:", address(_automation));
    }
}
