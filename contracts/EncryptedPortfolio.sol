// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract EncryptedPortfolio {
    struct EncState { bytes data; bytes12 iv; }
    mapping(bytes32 => EncState) public encryptedStates;

    function storeState(bytes32 id, bytes calldata data, bytes12 iv) external {
        encryptedStates[id] = EncState({ data: data, iv: iv });
    }
}
