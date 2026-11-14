// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/// @title CredentialRegistry — synthetic credential commitments and issuer status
/// @notice Local educational simulation. Never store names, documents, or personal identifiers.
contract CredentialRegistry is Pausable {
    enum Status { Unknown, Active, Revoked, Suspended, Expired }
    enum IssuerState { None, Approved, Suspended }

    struct Credential {
        address issuer;
        uint64 expiry;
        bool revoked;
        bool exists;
    }

    mapping(bytes32 => Credential) public credentials;
    mapping(address => IssuerState) public issuers;
    address public governor;
    address public pendingGovernor;

    error ZeroAddress();
    error OnlyGovernor();
    error OnlyPendingGovernor();
    error IssuerNotApproved();
    error IssuerNotSuspended();
    error IssuerAlreadyRegistered();
    error CredentialAlreadyExists();
    error CredentialDoesNotExist();
    error InvalidExpiry();
    error NotCredentialIssuer();
    error AlreadyRevoked();
    error EmptyCommitment();
    error GovernorAlreadySet();

    event IssuerApproved(address indexed issuer);
    event IssuerSuspended(address indexed issuer);
    event IssuerReapproved(address indexed issuer);
    event CredentialRegistered(bytes32 indexed commitment, address indexed issuer, uint64 expiry);
    event CredentialRevoked(bytes32 indexed commitment, address indexed issuer);
    event GovernorProposed(address indexed currentGovernor, address indexed pendingGovernor);
    event GovernorChanged(address indexed previousGovernor, address indexed newGovernor);

    modifier onlyGovernor() {
        if (msg.sender != governor) revert OnlyGovernor();
        _;
    }

    /// @notice Initialize the first governor (a temporary deployment account until governance accepts).
    constructor(address initialGovernor) {
        if (initialGovernor == address(0)) revert ZeroAddress();
        governor = initialGovernor;
    }

    /// @notice Approve an address to issue synthetic commitments; only the current Governor contract.
    function approveIssuer(address issuer) external onlyGovernor {
        if (issuer == address(0)) revert ZeroAddress();
        if (issuers[issuer] != IssuerState.None) revert IssuerAlreadyRegistered();
        issuers[issuer] = IssuerState.Approved;
        emit IssuerApproved(issuer);
    }

    /// @notice Suspend a currently approved issuer, invalidating its otherwise-active records.
    function suspendIssuer(address issuer) external onlyGovernor {
        if (issuers[issuer] != IssuerState.Approved) revert IssuerNotApproved();
        issuers[issuer] = IssuerState.Suspended;
        emit IssuerSuspended(issuer);
    }

    /// @notice Restore a suspended issuer; revoked and expired records do not become active.
    function reapproveIssuer(address issuer) external onlyGovernor {
        if (issuers[issuer] != IssuerState.Suspended) revert IssuerNotSuspended();
        issuers[issuer] = IssuerState.Approved;
        emit IssuerReapproved(issuer);
    }

    /// @notice Register a salted, opaque bytes32 commitment; use zero expiry for no expiration.
    /// @dev Caller must be approved; do not hash predictable personal details without a secret salt.
    function registerCommitment(bytes32 commitment, uint64 expiry) external whenNotPaused {
        if (issuers[msg.sender] != IssuerState.Approved) revert IssuerNotApproved();
        if (commitment == bytes32(0)) revert EmptyCommitment();
        if (credentials[commitment].exists) revert CredentialAlreadyExists();
        if (expiry != 0 && expiry <= block.timestamp) revert InvalidExpiry();
        credentials[commitment] = Credential(msg.sender, expiry, false, true);
        emit CredentialRegistered(commitment, msg.sender, expiry);
    }

    /// @notice Revoke one's own commitment, even if that issuer is suspended or registration is paused.
    function revoke(bytes32 commitment) external {
        Credential storage c = credentials[commitment];
        if (!c.exists) revert CredentialDoesNotExist();
        if (msg.sender != c.issuer) revert NotCredentialIssuer();
        if (c.revoked) revert AlreadyRevoked();
        c.revoked = true;
        emit CredentialRevoked(commitment, msg.sender);
    }

    /// @notice Read issuer and status: Unknown, then Revoked > Expired > Suspended > Active.
    function getCredential(bytes32 commitment) external view returns (address issuer, Status status) {
        Credential storage c = credentials[commitment];
        if (!c.exists) return (address(0), Status.Unknown);
        issuer = c.issuer;
        if (c.revoked) return (issuer, Status.Revoked);
        if (c.expiry != 0 && block.timestamp >= c.expiry) return (issuer, Status.Expired);
        if (issuers[issuer] != IssuerState.Approved) return (issuer, Status.Suspended);
        return (issuer, Status.Active);
    }

    /// @notice Emergency pause of *new registrations only*; existing reads/revocations remain available.
    function pause() external onlyGovernor { _pause(); }

    /// @notice Resume registrations after a governor-authorized emergency pause.
    function unpause() external onlyGovernor { _unpause(); }

    /// @notice Propose transfer of registry control to a new Governor contract/address.
    function proposeGovernor(address nextGovernor) external onlyGovernor {
        if (nextGovernor == address(0)) revert ZeroAddress();
        if (nextGovernor == governor) revert GovernorAlreadySet();
        pendingGovernor = nextGovernor;
        emit GovernorProposed(governor, nextGovernor);
    }

    /// @notice Complete transfer; must be called from the nominated new governor address.
    function acceptGovernor() external {
        if (msg.sender != pendingGovernor || pendingGovernor == address(0)) revert OnlyPendingGovernor();
        address old = governor;
        governor = msg.sender;
        pendingGovernor = address(0);
        emit GovernorChanged(old, msg.sender);
    }
}
