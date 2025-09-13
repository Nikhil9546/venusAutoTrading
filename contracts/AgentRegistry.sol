// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";

contract AgentRegistry is AccessControl {
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    struct Agent { address owner; string metadataURI; }
    mapping(bytes32 => Agent) public agents;

    event AgentCreated(bytes32 indexed agentID, address indexed owner, string metadataURI);
    event AgentUpdated(bytes32 indexed agentID, string metadataURI);

    constructor(address admin) {
        // Grant admin roles without deprecated _setupRole
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MANAGER_ROLE, admin);
    }

    function createAgent(bytes32 agentID, string calldata uri) external onlyRole(MANAGER_ROLE) {
        require(agents[agentID].owner == address(0), "exists");
        agents[agentID] = Agent(msg.sender, uri);
        emit AgentCreated(agentID, msg.sender, uri);
    }

    function updateAgent(bytes32 agentID, string calldata uri) external {
        require(agents[agentID].owner == msg.sender, "not owner");
        agents[agentID].metadataURI = uri;
        emit AgentUpdated(agentID, uri);
    }
}
