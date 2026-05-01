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
import {MockERC20} from "../test/mocks/MockERC20.sol";
import {MockFunctionsRouter} from "../test/mocks/MockFunctionsRouter.sol";

/// @notice Deploy full stack for local Anvil (mock ERC20 + mock Functions router).
contract DeployLocal is ScriptPk {
    function run() external {
        uint256 pk = envPrivateKeyOr(
            "PRIVATE_KEY",
            uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80)
        );
        address deployer = vm.addr(pk);
        vm.startBroadcast(pk);

        MockERC20 asset = new MockERC20();
        ReceivableNFT receivable = new ReceivableNFT(deployer);
        Pricing.Params memory p = Pricing.Params({baseDiscountBps: 200, maxDiscountBps: 1500, slopeBps: 800});
        FactoringVault vault =
            new FactoringVault(IERC20(address(asset)), receivable, deployer, p, 9500);
        OperatorOracle operatorOracle = new OperatorOracle(address(vault), deployer);
        vault.grantRole(vault.ORACLE_ROLE(), address(operatorOracle));
        operatorOracle.grantRole(operatorOracle.OPERATOR_ROLE(), deployer);

        MockFunctionsRouter router = new MockFunctionsRouter();
        FunctionsSettlement functions = new FunctionsSettlement(address(router), address(vault), deployer);
        vault.grantRole(vault.ORACLE_ROLE(), address(functions));

        FactoringAutomation _automation = new FactoringAutomation(address(vault));

        asset.mint(deployer, 10_000_000e18);

        vm.stopBroadcast();

        console2.log("MockERC20:", address(asset));
        console2.log("ReceivableNFT:", address(receivable));
        console2.log("FactoringVault:", address(vault));
        console2.log("OperatorOracle:", address(operatorOracle));
        console2.log("MockFunctionsRouter:", address(router));
        console2.log("FunctionsSettlement:", address(functions));
        console2.log("FactoringAutomation:", address(_automation));
    }
}
