const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");
const { fixture, approvedFixture, registeredFixture, govern, syntheticCommitment, A } = require("./helpers");

const ZERO = ethers.ZeroAddress;

describe("Governor / 2-of-3 local approval", function () {
  it("non-signer cannot propose", async () => {
    const { governor, outsider, issuer1 } = await loadFixture(fixture);
    await expect(governor.connect(outsider).propose(A.ApproveIssuer, issuer1.address))
      .to.be.revertedWithCustomError(governor, "OnlySigner");
  });
  it("non-signer cannot approve", async () => {
    const { governor, signer1, outsider, issuer1 } = await loadFixture(fixture);
    await governor.connect(signer1).propose(A.ApproveIssuer, issuer1.address);
    await expect(governor.connect(outsider).approve(1)).to.be.revertedWithCustomError(governor, "OnlySigner");
  });
  it("signer cannot approve a proposal twice", async () => {
    const { governor, signer1, issuer1 } = await loadFixture(fixture);
    await governor.connect(signer1).propose(A.ApproveIssuer, issuer1.address);
    await expect(governor.connect(signer1).approve(1)).to.be.revertedWithCustomError(governor, "AlreadyApproved");
  });
  it("one approval cannot execute", async () => {
    const { governor, signer1, issuer1 } = await loadFixture(fixture);
    await governor.connect(signer1).propose(A.ApproveIssuer, issuer1.address);
    await expect(governor.connect(signer1).execute(1)).to.be.revertedWithCustomError(governor, "InsufficientApprovals");
  });
  it("two approvals execute ApproveIssuer", async () => {
    const { registry, governor, signer1, signer2, issuer1 } = await loadFixture(fixture);
    await expect(govern(governor, signer1, signer2, A.ApproveIssuer, issuer1.address)).not.to.be.reverted;
    expect(await registry.issuers(issuer1.address)).to.equal(1n);
  });
  it("a proposal cannot execute twice", async () => {
    const { governor, signer1, signer2, issuer1 } = await loadFixture(fixture);
    const id = await govern(governor, signer1, signer2, A.ApproveIssuer, issuer1.address);
    await expect(governor.connect(signer1).execute(id)).to.be.revertedWithCustomError(governor, "ProposalClosed");
  });
  it("expired proposal cannot be approved", async () => {
    const { governor, signer1, signer2, issuer1 } = await loadFixture(fixture);
    await governor.connect(signer1).propose(A.ApproveIssuer, issuer1.address);
    await time.increase(7 * 24 * 60 * 60);
    await expect(governor.connect(signer2).approve(1)).to.be.revertedWithCustomError(governor, "ProposalExpired");
  });
  it("expired proposal cannot be executed", async () => {
    const { governor, signer1, signer2, issuer1 } = await loadFixture(fixture);
    await governor.connect(signer1).propose(A.ApproveIssuer, issuer1.address);
    await governor.connect(signer2).approve(1);
    await time.increase(7 * 24 * 60 * 60);
    await expect(governor.connect(signer1).execute(1)).to.be.revertedWithCustomError(governor, "ProposalExpired");
  });
  it("cancelled proposal cannot execute", async () => {
    const { governor, signer1, signer2, issuer1 } = await loadFixture(fixture);
    await governor.connect(signer1).propose(A.ApproveIssuer, issuer1.address);
    await governor.connect(signer2).approve(1);
    await governor.connect(signer1).cancel(1);
    await expect(governor.connect(signer1).execute(1)).to.be.revertedWithCustomError(governor, "ProposalClosed");
  });
  it("constructor rejects duplicate signers", async () => {
    const { registry, signer1, signer2 } = await loadFixture(fixture);
    const Gov = await ethers.getContractFactory("Governor");
    await expect(Gov.deploy(await registry.getAddress(), [signer1.address, signer1.address, signer2.address]))
      .to.be.revertedWithCustomError(Gov, "InvalidSigners");
  });
  it("constructor rejects zero signers", async () => {
    const { registry, signer1, signer2 } = await loadFixture(fixture);
    const Gov = await ethers.getContractFactory("Governor");
    await expect(Gov.deploy(await registry.getAddress(), [signer1.address, ZERO, signer2.address]))
      .to.be.revertedWithCustomError(Gov, "InvalidSigners");
  });
  it("rejects nonexistent proposal IDs", async () => {
    const { governor, signer1 } = await loadFixture(fixture);
    await expect(governor.connect(signer1).execute(999)).to.be.revertedWithCustomError(governor, "ProposalNotFound");
  });
  it("does not allow a non-signer to cancel", async () => {
    const { governor, signer1, outsider, issuer1 } = await loadFixture(fixture);
    await governor.connect(signer1).propose(A.ApproveIssuer, issuer1.address);
    await expect(governor.connect(outsider).cancel(1)).to.be.revertedWithCustomError(governor, "OnlySigner");
  });
  it("requires a zero target for Pause", async () => {
    const { governor, signer1, issuer1 } = await loadFixture(fixture);
    await expect(governor.connect(signer1).propose(A.Pause, issuer1.address))
      .to.be.revertedWithCustomError(governor, "InvalidTarget");
  });
});

describe("Two-step governor replacement", function () {
  async function replacementFixture() {
    const ctx = await fixture();
    const Gov = await ethers.getContractFactory("Governor");
    const next = await Gov.deploy(await ctx.registry.getAddress(), [ctx.signer1.address, ctx.signer2.address, ctx.signer3.address]);
    await next.waitForDeployment();
    return { ...ctx, next };
  }
  it("new governor must explicitly accept after two-signer nomination", async () => {
    const { registry, governor, next, signer1, signer2 } = await loadFixture(replacementFixture);
    await govern(governor, signer1, signer2, A.ProposeNewGovernor, await next.getAddress());
    expect(await registry.governor()).to.equal(await governor.getAddress());
    expect(await registry.pendingGovernor()).to.equal(await next.getAddress());
    await next.connect(signer1).acceptRegistryGovernance();
    expect(await registry.governor()).to.equal(await next.getAddress());
  });
  it("old governor loses issuer management rights after acceptance", async () => {
    const { registry, governor, next, signer1, signer2, issuer1 } = await loadFixture(replacementFixture);
    await govern(governor, signer1, signer2, A.ProposeNewGovernor, await next.getAddress());
    await next.connect(signer1).acceptRegistryGovernance();
    const id = await governor.nextProposalId();
    await governor.connect(signer1).propose(A.ApproveIssuer, issuer1.address);
    await governor.connect(signer2).approve(id);
    await expect(governor.connect(signer1).execute(id)).to.be.revertedWithCustomError(registry, "OnlyGovernor");
    await govern(next, signer1, signer2, A.ApproveIssuer, issuer1.address);
    expect(await registry.issuers(issuer1.address)).to.equal(1n);
  });
  it("non-proposed address cannot accept control", async () => {
    const { registry, governor, next, signer1, signer2, outsider } = await loadFixture(replacementFixture);
    await govern(governor, signer1, signer2, A.ProposeNewGovernor, await next.getAddress());
    await expect(registry.connect(outsider).acceptGovernor()).to.be.revertedWithCustomError(registry, "OnlyPendingGovernor");
  });
  it("a different governor cannot accept without nomination", async () => {
    const { next, signer1, registry } = await loadFixture(replacementFixture);
    await expect(next.connect(signer1).acceptRegistryGovernance()).to.be.revertedWithCustomError(registry, "OnlyPendingGovernor");
  });
});

describe("Security boundaries", function () {
  it("malicious test-only target cannot execute a proposal recursively", async () => {
    const [s1, s2] = await ethers.getSigners();
    const Mock = await ethers.getContractFactory("MaliciousTarget");
    const mock = await Mock.deploy(); await mock.waitForDeployment();
    const Gov = await ethers.getContractFactory("Governor");
    // The mock itself is a signer, so reentry reaches the nonReentrant guard.
    const gov = await Gov.deploy(await mock.getAddress(), [s1.address, s2.address, await mock.getAddress()]);
    await gov.waitForDeployment();
    await gov.connect(s1).propose(A.ApproveIssuer, s2.address);
    await gov.connect(s2).approve(1);
    await mock.configure(await gov.getAddress(), 1);
    await gov.connect(s1).execute(1);
    expect(await mock.callCount()).to.equal(1n);
    expect(await mock.reentrySucceeded()).to.equal(false);
    expect((await gov.proposals(1)).executed).to.equal(true);
  });
  it("non-governor cannot call any issuer-management or emergency function", async () => {
    const { registry, outsider, issuer1 } = await loadFixture(fixture);
    const calls = [
      registry.connect(outsider).approveIssuer(issuer1.address),
      registry.connect(outsider).suspendIssuer(issuer1.address),
      registry.connect(outsider).reapproveIssuer(issuer1.address),
      registry.connect(outsider).pause(),
      registry.connect(outsider).unpause(),
      registry.connect(outsider).proposeGovernor(outsider.address)
    ];
    for (const call of calls) await expect(call).to.be.revertedWithCustomError(registry, "OnlyGovernor");
  });
  it("non-issuer cannot register or revoke another issuer's record", async () => {
    const { registry, outsider, commitment } = await loadFixture(registeredFixture);
    await expect(registry.connect(outsider).registerCommitment(syntheticCommitment("SYNTHETIC-UNAUTH"), 0))
      .to.be.revertedWithCustomError(registry, "IssuerNotApproved");
    await expect(registry.connect(outsider).revoke(commitment))
      .to.be.revertedWithCustomError(registry, "NotCredentialIssuer");
  });
  it("two remaining signers still execute when the third is absent", async () => {
    const { governor, registry, signer1, signer2, issuer1 } = await loadFixture(fixture);
    await govern(governor, signer1, signer2, A.ApproveIssuer, issuer1.address);
    expect(await registry.issuers(issuer1.address)).to.equal(1n);
  });
  it("governor cannot transfer ETH (no payable receive or fallback)", async () => {
    const { governor, signer1 } = await loadFixture(fixture);
    await expect(signer1.sendTransaction({ to: await governor.getAddress(), value: 1n })).to.be.reverted;
  });
  it("registry cannot receive ETH", async () => {
    const { registry, signer1 } = await loadFixture(fixture);
    await expect(signer1.sendTransaction({ to: await registry.getAddress(), value: 1n })).to.be.reverted;
  });
});
