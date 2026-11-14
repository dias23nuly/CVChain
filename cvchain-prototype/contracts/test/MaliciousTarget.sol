// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @notice TEST-ONLY fake registry. It attempts to re-enter Governor.execute.
/// @dev Not connected to CredentialRegistry; exists only to exercise the governor's guard.
interface IGovernorExecutor { function execute(uint256 id) external; }

contract MaliciousTarget {
    address public governor;
    uint256 public proposalId;
    uint256 public callCount;
    bool public reentrySucceeded;

    function configure(address governor_, uint256 id) external {
        governor = governor_;
        proposalId = id;
    }

    function approveIssuer(address) external {
        callCount++;
        (bool ok, ) = governor.call(abi.encodeCall(IGovernorExecutor.execute, (proposalId)));
        reentrySucceeded = ok;
    }
}
