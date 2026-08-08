// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {MidrollEscrow} from "../src/MidrollEscrow.sol";

contract DeployMidrollEscrowScript is Script {
    function run() external returns (MidrollEscrow escrow) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);
        escrow = new MidrollEscrow();
        vm.stopBroadcast();
    }
}
