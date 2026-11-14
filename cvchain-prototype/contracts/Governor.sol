// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface ICredentialRegistry {
    function approveIssuer(address issuer) external;
    function suspendIssuer(address issuer) external;
    function reapproveIssuer(address issuer) external;
    function pause() external;
    function unpause() external;
    function proposeGovernor(address nextGovernor) external;
    function acceptGovernor() external;
}

/// @title Governor — 2-of-3 multisignature decisions for a local credential registry
/// @notice This is governance approval, not a wallet: it cannot hold or transfer assets.
contract Governor is ReentrancyGuard {
    enum Action { ApproveIssuer, SuspendIssuer, ReapproveIssuer, Pause, Unpause, ProposeNewGovernor }
    struct Proposal {
        uint256 id;
        Action action;
        address target;
        uint64 createdAt;
        bool executed;
        bool cancelled;
        uint8 approvals;
    }

    uint256 public constant EXPIRY = 7 days;
    uint8 public constant THRESHOLD = 2;
    address public immutable registry;
    address[3] public signers;
    mapping(address => bool) public isSigner;
    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => bool)) public hasApproved;
    uint256 public nextProposalId = 1;

    error ZeroAddress();
    error InvalidSigners();
    error OnlySigner();
    error InvalidTarget();
    error ProposalNotFound();
    error ProposalClosed();
    error ProposalExpired();
    error AlreadyApproved();
    error InsufficientApprovals();

    event ProposalCreated(uint256 indexed id, address indexed proposer, Action action, address target);
    event ProposalApproved(uint256 indexed id, address indexed signer, uint8 approvals);
    event ProposalExecuted(uint256 indexed id, Action action, address target);
    event ProposalCancelled(uint256 indexed id, address indexed signer);

    modifier onlySigner() {
        if (!isSigner[msg.sender]) revert OnlySigner();
        _;
    }

    /// @notice Set exactly three different nonzero signers and the local registry address.
    constructor(address registry_, address[3] memory signers_) {
        if (registry_ == address(0)) revert ZeroAddress();
        registry = registry_;
        for (uint256 i = 0; i < 3; ++i) {
            if (signers_[i] == address(0)) revert InvalidSigners();
            for (uint256 j = 0; j < i; ++j) {
                if (signers_[i] == signers_[j]) revert InvalidSigners();
            }
            isSigner[signers_[i]] = true;
            signers[i] = signers_[i];
        }
    }

    /// @notice Create a proposal with one automatic approval by its signer-proposer.
    function propose(Action action, address target) external onlySigner returns (uint256 id) {
        bool needsTarget = action == Action.ApproveIssuer || action == Action.SuspendIssuer ||
            action == Action.ReapproveIssuer || action == Action.ProposeNewGovernor;
        if (needsTarget ? target == address(0) : target != address(0)) revert InvalidTarget();
        id = nextProposalId++;
        proposals[id] = Proposal(id, action, target, uint64(block.timestamp), false, false, 1);
        hasApproved[id][msg.sender] = true;
        emit ProposalCreated(id, msg.sender, action, target);
        emit ProposalApproved(id, msg.sender, 1);
    }

    /// @notice Add a different signer's approval before expiry or execution/cancellation.
    function approve(uint256 id) external onlySigner {
        Proposal storage p = _open(id);
        if (hasApproved[id][msg.sender]) revert AlreadyApproved();
        hasApproved[id][msg.sender] = true;
        p.approvals += 1;
        emit ProposalApproved(id, msg.sender, p.approvals);
    }

    /// @notice Execute a proposal with at least two approvals, at most once.
    /// @dev Effects before interaction plus a reentrancy guard prevent double execution.
    function execute(uint256 id) external onlySigner nonReentrant {
        Proposal storage p = _open(id);
        if (p.approvals < THRESHOLD) revert InsufficientApprovals();
        p.executed = true;
        ICredentialRegistry r = ICredentialRegistry(registry);
        if (p.action == Action.ApproveIssuer) r.approveIssuer(p.target);
        else if (p.action == Action.SuspendIssuer) r.suspendIssuer(p.target);
        else if (p.action == Action.ReapproveIssuer) r.reapproveIssuer(p.target);
        else if (p.action == Action.Pause) r.pause();
        else if (p.action == Action.Unpause) r.unpause();
        else r.proposeGovernor(p.target);
        emit ProposalExecuted(id, p.action, p.target);
    }

    /// @notice Cancel a pending unexecuted proposal; cancellation is permanent.
    function cancel(uint256 id) external onlySigner {
        Proposal storage p = _open(id);
        p.cancelled = true;
        emit ProposalCancelled(id, msg.sender);
    }

    /// @notice Accept registry governance after the current governor nominates this contract.
    /// @dev One signer may complete acceptance, but only after registry nomination.
    function acceptRegistryGovernance() external onlySigner {
        ICredentialRegistry(registry).acceptGovernor();
    }

    function _open(uint256 id) internal view returns (Proposal storage p) {
        p = proposals[id];
        if (p.id == 0) revert ProposalNotFound();
        if (p.executed || p.cancelled) revert ProposalClosed();
        if (block.timestamp >= uint256(p.createdAt) + EXPIRY) revert ProposalExpired();
    }
}
