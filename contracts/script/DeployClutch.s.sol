// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {Clutch} from "../src/Clutch.sol";

/// @notice Deploys Clutch and optionally opens a seeded demo market in the same run,
///         so the room can start trading the moment the address is live.
///
/// Env:
///   PRIVATE_KEY   deployer key (owner / resolver / market seeder)
///   SEED_MARKET   optional, "true" to open a first market
///   SEED_AMOUNT   optional, wei to seed with (default 0.5 MON)
///   SEED_QUESTION optional, market question text
contract DeployClutchScript is Script {
    function run() external returns (Clutch clutch) {
        uint256 pk = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(pk);
        clutch = new Clutch();

        if (vm.envOr("SEED_MARKET", false)) {
            uint256 amount = vm.envOr("SEED_AMOUNT", uint256(0.5 ether));
            string memory q = vm.envOr("SEED_QUESTION", string("Will this demo win the room?"));
            clutch.createMarket{value: amount}(q, 0);
        }
        vm.stopBroadcast();

        console.log("Clutch deployed:", address(clutch));
        console.log("Explorer: https://testnet.monadscan.com/address/%s", address(clutch));
    }
}
