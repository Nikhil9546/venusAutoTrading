// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract StrategyStore {
    mapping(bytes32 => bytes) private store;
    event StrategyStored(bytes32 indexed id, uint256 size);

    function storeStrategy(bytes32 id, bytes calldata payload) external {
        store[id] = payload;
        emit StrategyStored(id, payload.length);
    }

    function getStrategy(bytes32 id) external view returns (bytes memory) {
        return store[id];
    }
}
