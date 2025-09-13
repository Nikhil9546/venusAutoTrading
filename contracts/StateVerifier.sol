// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract StateVerifier {
    function verifyState(
        bytes32 root,
        bytes32[] calldata proof,
        bytes32 leaf
    ) external pure returns (bool) {
        bytes32 hash = leaf;
        for (uint i = 0; i < proof.length; i++) {
            bytes32 p = proof[i];
            (bytes32 a, bytes32 b) = hash < p ? (hash, p) : (p, hash);
            hash = keccak256(abi.encodePacked(a, b));
        }
        return hash == root;
    }
}
