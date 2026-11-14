const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

const A = { ApproveIssuer: 0, SuspendIssuer: 1, ReapproveIssuer: 2, Pause: 3, Unpause: 4, ProposeNewGovernor: 5 };
const ZERO = ethers.ZeroAddress;

function syntheticCommitment(label) {
  return ethers.solidityPackedKeccak256(
    ["string", "bytes32"], [label, ethers.id("SYNTHETIC-SECRET-SALT-FOR-LOCAL-TESTS")]
  );
}

async function fixture() {
  const [deployer, signer1, signer2, signer3, issuer1, issuer2, outsider, employer, replacement] = await ethers.getSigners();
  const Registry = await ethers.getContractFactory("CredentialRegistry");
  const registry = await Registry.deploy(deployer.address);
  await registry.waitForDeployment();
  const Governor = await ethers.getContractFactory("Governor");
  const governor = await Governor.deploy(await registry.getAddress(), [signer1.address, signer2.address, signer3.address]);
  await governor.waitForDeployment();
  await registry.proposeGovernor(await governor.getAddress());
  await governor.connect(signer1).acceptRegistryGovernance();
  return { deployer, signer1, signer2, signer3, issuer1, issuer2, outsider, employer, replacement, registry, governor };
}

async function govern(governor, signer1, signer2, action, target = ZERO) {
  const id = await governor.nextProposalId();
  await governor.connect(signer1).propose(action, target);
  await governor.connect(signer2).approve(id);
  await governor.connect(signer1).execute(id);
  return id;
}

async function approvedFixture() {
  const ctx = await fixture();
  await govern(ctx.governor, ctx.signer1, ctx.signer2, A.ApproveIssuer, ctx.issuer1.address);
  return ctx;
}

async function registeredFixture() {
  const ctx = await approvedFixture();
  const commitment = syntheticCommitment("SYNTHETIC-DIPLOMA-001");
  await ctx.registry.connect(ctx.issuer1).registerCommitment(commitment, 0);
  return { ...ctx, commitment };
}

module.exports = {
  fixture,
  approvedFixture,
  registeredFixture,
  govern,
  syntheticCommitment,
  A,
};