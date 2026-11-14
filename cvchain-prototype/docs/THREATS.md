# Threat assessment — educational local prototype

| Threat | Attack path | Implemented mitigation | Residual risk |
|---|---|---|---|
| Reentrancy on Governor.execute | A malicious target contract calls execute recursively during a registry action | `nonReentrant`, set `executed=true` before external call; controlled test-only fake registry | Other contracts and future integrations are not audited; an external review would be needed |
| Broken access control | Outsider approves issuers, registers or revokes someone else's commitments | `onlyGovernor`, approved issuer gate, ownership checked on revoke, 2-of-3 governance, negative tests | Two colluding signers can still approve an unwanted issuer; approved issuers may issue false data |
| Loss or compromise of governor signer key | One signer disappears or a key is stolen | 2-of-3 decisions allow continued operation with two honest signers; no raw keys in repository | Losing two signers prevents governance; two compromised signers control decisions |
| Credential correlation or guessing | Someone derives sensitive facts from predictable hashes or on-chain metadata | Store only opaque salted bytes32 commitments; use synthetic test data | Blockchain events and issuer addresses remain visible; production privacy needs further work |
| Incorrect or revoked records | Issuer signs a false claim or forgets to revoke | Status, revocation, issuer suspension and expiry mechanics | The contract does not authenticate real credentials, employment history or external issuers |

## Known limitations

- No independent smart-contract security audit has been performed.
- No off-chain consent capture, candidate account management or document retention/deletion workflow.
- No cryptographic signature verification of credentials or actual issuer identity vetting.
- No validator consortium: Hardhat's ephemeral local test network is not the proposed multi-organization deployment.
- Governor signers are a fixed array; replacing lost signers requires a planned governance upgrade, not provided here.
- No token issuance, payments, ETH transfers, live funds, real personal data, RPC endpoints, or deployment to any public network.
- Example salts in demo/test code are public and ONLY suitable for artificial test identifiers.
