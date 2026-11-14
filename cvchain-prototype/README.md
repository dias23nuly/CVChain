Educational project for the course Introduction to Finance. Not a real product, service or investment offer. Do not use with real funds.

# cvchain-prototype

A **local-only** Solidity/Hardhat simulation of an issuer-controlled, salted-commitment credential status registry. A 2-of-3 Governor approves or suspends synthetic issuers. An approved issuer can register and revoke opaque bytes32 commitments; an employer reads the current status. This system **does not prove the truth or signature of an actual diploma**.

## Local-only setup

Requirements: Node.js LTS and npm. Open this folder in a terminal and run:

```bash
npm install
npm run compile
npm test
npm run coverage
npm run demo
npm run gas
npm run deploy:local
```

Windows PowerShell that blocks `npm.ps1`: use `npm.cmd install`, `npm.cmd test`, etc. No separate blockchain node is needed. Hardhat uses its built-in in-process accounts. No network config, private keys, mnemonics, environment secrets, or public RPC URLs are present.

## Files

- `contracts/CredentialRegistry.sol`: issuer status, opaque commitments, expiration, revocation and registration pause.
- `contracts/Governor.sol`: 2-of-3 approvals, 7-day expiry, two-step Governor replacement.
- `contracts/test/MaliciousTarget.sol`: **test-only** mock for reentrancy behavior.
- `test/CredentialRegistry.test.js`, `test/Governor.test.js`: automated behavior/security tests.
- `test/gas.test.js`: records receipt `gasUsed` for registration and revocation (local measurements only).
- `scripts/demo.js`: narrated end-to-end synthetic flow.
- `scripts/deploy-local.js`: bootstrap registry and Governor locally and transfer control immediately.
- `docs/sequence.md`: Mermaid use-case sequence diagram.
- `docs/THREATS.md`: threat table, controls, residual risks and limitations.

## Test and coverage summary

The test suite covers issuer authorization, registration, expiry, state precedence, suspension/reapproval, revocation, pause, 2-of-3 proposal lifecycle, governor replacement and reentrancy. **No pass count, gas number, or coverage percentage is pre-certified in this README.** Run `npm test`, `npm run gas` and `npm run coverage` locally and paste the actual results into the final university report only after observing them. If a dependency version is unavailable, inspect the npm error rather than claiming results.

## Links

Demo video: https://drive.google.com/file/d/1ykDrnmt9qLdZ-WPcVA29CAjtzhhK0iHI/view

Repository: github.com/dias23nuly/CVChain

## Privacy and governance limitations

Only salted bytes32 commitment hashes, issuer addresses, status/expiry metadata, and events are stored on-chain. Public synthetic labels are used only for local testing. An implementation handling real qualifications would require signature verification, issuer identity checks, user consent, private off-chain storage, legal review, independent validator governance and external security auditing. `pause()` prevents *new registrations only*; the owner can still revoke a record even while the system is paused.

## NOT implemented

No real credential authentication, off-chain consent, user login, frontend, verification of actual academic records, independent organizations, multi-validator Besu network, public deployment, testnet, mainnet, tokenomics, NFT/token, payments, payable endpoints, wallets, ETH transfers, or custody.

## Licensing and credits

Project license: MIT (`LICENSE`). This project imports **OpenZeppelin Contracts**, specifically `Pausable` and `ReentrancyGuard`, distributed under the **MIT License**. See https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/LICENSE. Hardhat and other dependencies are third-party projects and retain their respective licenses.

## Academic disclosure

The project may have been developed with AI assistance. The students must state which tools/models actually helped write or revise code and explain the final implementation, the assumptions, and test output themselves. No real student identity is embedded in these synthetic contract/test datasets.
