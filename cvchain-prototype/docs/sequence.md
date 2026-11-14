# Main use case — synthetic credential status

```mermaid
sequenceDiagram
    autonumber
    participant Issuer as Synthetic Issuer
    participant Governor as Governor (2-of-3)
    participant Registry as CredentialRegistry
    participant Employer as Employer (reader)
    Note over Governor,Registry: Local Hardhat in-process network only
    Issuer->>Governor: Request issuer onboarding (off-chain simulation)
    Governor->>Governor: Signer A proposes; signer B approves
    Governor->>Registry: approveIssuer(issuer)
    Issuer->>Registry: registerCommitment(saltedHash, expiry)
    Registry-->>Issuer: CredentialRegistered event
    Employer->>Registry: getCredential(saltedHash)
    Registry-->>Employer: issuer, Active
    Governor->>Governor: Two signer approvals
    Governor->>Registry: suspendIssuer(issuer)
    Employer->>Registry: getCredential(saltedHash)
    Registry-->>Employer: issuer, Suspended
    Governor->>Registry: reapproveIssuer(issuer) after 2 approvals
    Employer->>Registry: getCredential(saltedHash)
    Registry-->>Employer: issuer, Active
    Issuer->>Registry: revoke(saltedHash)
    Employer->>Registry: getCredential(saltedHash)
    Registry-->>Employer: issuer, Revoked
```

No real identity, signature validation, candidate consent, document contents or external network is involved.
