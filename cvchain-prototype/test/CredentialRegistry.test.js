const { ethers } = require("hardhat");
const ZERO = ethers.ZeroAddress;
const { expect } = require("chai");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");
const { fixture, approvedFixture, registeredFixture, govern, syntheticCommitment, A } = require("./helpers");

describe("CredentialRegistry / local-only synthetic records", function () {
  describe("registration", function () {
    it("approved issuer registers a commitment that reads Active", async () => {
      const { registry, issuer1 } = await loadFixture(approvedFixture);
      const id = syntheticCommitment("SYNTHETIC-DIPLOMA-101");
      await registry.connect(issuer1).registerCommitment(id, 0);
      expect((await registry.getCredential(id))[1]).to.equal(1n);
    });
    it("rejects an unapproved issuer", async () => {
      const { registry, outsider } = await loadFixture(fixture);
      await expect(registry.connect(outsider).registerCommitment(syntheticCommitment("SYNTHETIC-DIPLOMA-102"), 0))
        .to.be.revertedWithCustomError(registry, "IssuerNotApproved");
    });
    it("rejects duplicate commitments", async () => {
      const { registry, issuer1, commitment } = await loadFixture(registeredFixture);
      await expect(registry.connect(issuer1).registerCommitment(commitment, 0))
        .to.be.revertedWithCustomError(registry, "CredentialAlreadyExists");
    });
    it("rejects expiry timestamps in the past", async () => {
      const { registry, issuer1 } = await loadFixture(approvedFixture);
      await expect(registry.connect(issuer1).registerCommitment(syntheticCommitment("SYNTHETIC-DIPLOMA-103"), 1))
        .to.be.revertedWithCustomError(registry, "InvalidExpiry");
    });
    it("emits CredentialRegistered with an opaque commitment", async () => {
      const { registry, issuer1 } = await loadFixture(approvedFixture);
      const id = syntheticCommitment("SYNTHETIC-DIPLOMA-104");
      await expect(registry.connect(issuer1).registerCommitment(id, 0))
        .to.emit(registry, "CredentialRegistered").withArgs(id, issuer1.address, 0);
    });
    it("rejects a zero commitment", async () => {
      const { registry, issuer1 } = await loadFixture(approvedFixture);
      await expect(registry.connect(issuer1).registerCommitment(ethers.ZeroHash, 0))
        .to.be.revertedWithCustomError(registry, "EmptyCommitment");
    });
  });

  describe("read and status precedence", function () {
    it("returns Unknown and zero address when absent", async () => {
      const { registry } = await loadFixture(fixture);
      const out = await registry.getCredential(syntheticCommitment("SYNTHETIC-MISSING"));
      expect(out[0]).to.equal(ZERO); expect(out[1]).to.equal(0n);
    });
    it("returns the original issuer", async () => {
      const { registry, issuer1, commitment } = await loadFixture(registeredFixture);
      expect((await registry.getCredential(commitment))[0]).to.equal(issuer1.address);
    });
    it("returns Expired after time increases", async () => {
      const { registry, issuer1 } = await loadFixture(approvedFixture);
      const id = syntheticCommitment("SYNTHETIC-DIPLOMA-EXPIRY");
      const expiry = (await time.latest()) + 100;
      await registry.connect(issuer1).registerCommitment(id, expiry);
      await time.increase(101);
      expect((await registry.getCredential(id))[1]).to.equal(4n);
    });
    it("Revoked overrides Expired", async () => {
      const { registry, issuer1 } = await loadFixture(approvedFixture);
      const id = syntheticCommitment("SYNTHETIC-DIPLOMA-REVOKED-EXPIRY");
      await registry.connect(issuer1).registerCommitment(id, (await time.latest()) + 100);
      await registry.connect(issuer1).revoke(id);
      await time.increase(120);
      expect((await registry.getCredential(id))[1]).to.equal(2n);
    });
    it("Expired overrides Suspended", async () => {
      const { registry, governor, signer1, signer2, issuer1 } = await loadFixture(approvedFixture);
      const id = syntheticCommitment("SYNTHETIC-EXPIRY-VS-SUSPENSION");
      await registry.connect(issuer1).registerCommitment(id, (await time.latest()) + 100);
      await govern(governor, signer1, signer2, A.SuspendIssuer, issuer1.address);
      await time.increase(110);
      expect((await registry.getCredential(id))[1]).to.equal(4n);
    });
  });

  describe("revocation", function () {
    it("issuer revokes and reports Revoked", async () => {
      const { registry, issuer1, commitment } = await loadFixture(registeredFixture);
      await expect(registry.connect(issuer1).revoke(commitment)).to.emit(registry, "CredentialRevoked");
      expect((await registry.getCredential(commitment))[1]).to.equal(2n);
    });
    it("another issuer cannot revoke", async () => {
      const { registry, issuer2, commitment } = await loadFixture(registeredFixture);
      await expect(registry.connect(issuer2).revoke(commitment))
        .to.be.revertedWithCustomError(registry, "NotCredentialIssuer");
    });
    it("unknown commitments cannot be revoked", async () => {
      const { registry, issuer1 } = await loadFixture(approvedFixture);
      await expect(registry.connect(issuer1).revoke(syntheticCommitment("SYNTHETIC-NOT-ISSUED")))
        .to.be.revertedWithCustomError(registry, "CredentialDoesNotExist");
    });
    it("a suspended issuer can still revoke", async () => {
      const { registry, governor, signer1, signer2, issuer1, commitment } = await loadFixture(registeredFixture);
      await govern(governor, signer1, signer2, A.SuspendIssuer, issuer1.address);
      await registry.connect(issuer1).revoke(commitment);
      expect((await registry.getCredential(commitment))[1]).to.equal(2n);
    });
    it("rejects a second revocation", async () => {
      const { registry, issuer1, commitment } = await loadFixture(registeredFixture);
      await registry.connect(issuer1).revoke(commitment);
      await expect(registry.connect(issuer1).revoke(commitment)).to.be.revertedWithCustomError(registry, "AlreadyRevoked");
    });
  });

  describe("issuer suspension", function () {
    it("suspended issuer cannot register", async () => {
      const { registry, governor, signer1, signer2, issuer1 } = await loadFixture(approvedFixture);
      await govern(governor, signer1, signer2, A.SuspendIssuer, issuer1.address);
      await expect(registry.connect(issuer1).registerCommitment(syntheticCommitment("SYNTHETIC-DIPLOMA-105"), 0))
        .to.be.revertedWithCustomError(registry, "IssuerNotApproved");
    });
    it("existing otherwise-valid records show Suspended", async () => {
      const { registry, governor, signer1, signer2, issuer1, commitment } = await loadFixture(registeredFixture);
      await govern(governor, signer1, signer2, A.SuspendIssuer, issuer1.address);
      expect((await registry.getCredential(commitment))[1]).to.equal(3n);
    });
    it("reapproval restores still-valid records", async () => {
      const { registry, governor, signer1, signer2, issuer1, commitment } = await loadFixture(registeredFixture);
      await govern(governor, signer1, signer2, A.SuspendIssuer, issuer1.address);
      await govern(governor, signer1, signer2, A.ReapproveIssuer, issuer1.address);
      expect((await registry.getCredential(commitment))[1]).to.equal(1n);
    });
    it("revoked records stay Revoked after reapproval", async () => {
      const { registry, governor, signer1, signer2, issuer1, commitment } = await loadFixture(registeredFixture);
      await registry.connect(issuer1).revoke(commitment);
      await govern(governor, signer1, signer2, A.SuspendIssuer, issuer1.address);
      await govern(governor, signer1, signer2, A.ReapproveIssuer, issuer1.address);
      expect((await registry.getCredential(commitment))[1]).to.equal(2n);
    });
    it("rejects reapproving an issuer that was never suspended", async () => {
      const { registry, governor, signer1, signer2, issuer1 } = await loadFixture(approvedFixture);
      const id = await governor.nextProposalId();
      await governor.connect(signer1).propose(A.ReapproveIssuer, issuer1.address);
      await governor.connect(signer2).approve(id);
      await expect(governor.connect(signer1).execute(id)).to.be.revertedWithCustomError(registry, "IssuerNotSuspended");
    });
  });

  describe("emergency pause", function () {
    it("paused registry blocks new registrations", async () => {
      const { registry, governor, signer1, signer2, issuer1 } = await loadFixture(approvedFixture);
      await govern(governor, signer1, signer2, A.Pause);
      await expect(registry.connect(issuer1).registerCommitment(syntheticCommitment("SYNTHETIC-DIPLOMA-106"), 0))
        .to.be.revertedWithCustomError(registry, "EnforcedPause");
    });
    it("unpause restores new registrations", async () => {
      const { registry, governor, signer1, signer2, issuer1 } = await loadFixture(approvedFixture);
      await govern(governor, signer1, signer2, A.Pause);
      await govern(governor, signer1, signer2, A.Unpause);
      const id = syntheticCommitment("SYNTHETIC-DIPLOMA-107");
      await registry.connect(issuer1).registerCommitment(id, 0);
      expect((await registry.getCredential(id))[1]).to.equal(1n);
    });
    it("revocation remains possible during pause", async () => {
      const { registry, governor, signer1, signer2, issuer1, commitment } = await loadFixture(registeredFixture);
      await govern(governor, signer1, signer2, A.Pause);
      await registry.connect(issuer1).revoke(commitment);
      expect((await registry.getCredential(commitment))[1]).to.equal(2n);
    });
  });
});

