const { ethers } = require("hardhat");

const ACTION = { ApproveIssuer: 0, SuspendIssuer: 1, ReapproveIssuer: 2 };
const statuses = ["Unknown", "Active", "Revoked", "Suspended", "Expired"];

async function approveAction(governor, s1, s2, action, target) {
  const id = await governor.nextProposalId();
  await (await governor.connect(s1).propose(action, target)).wait();
  await (await governor.connect(s2).approve(id)).wait();
  await (await governor.connect(s1).execute(id)).wait();
  return id;
}

async function main() {
  console.log("=== CVChain educational local-network demo ===");
  const [deployer, s1, s2, s3, issuer, employer] = await ethers.getSigners();
  const Registry = await ethers.getContractFactory("CredentialRegistry");
  const registry = await Registry.deploy(deployer.address);
  await registry.waitForDeployment();
  const Governor = await ethers.getContractFactory("Governor");
  const governor = await Governor.deploy(await registry.getAddress(), [s1.address, s2.address, s3.address]);
  await governor.waitForDeployment();
  console.log("1. Deployed Registry on ephemeral local Hardhat network:", await registry.getAddress());
  console.log("   Deployed 2-of-3 Governor:", await governor.getAddress());
  await (await registry.proposeGovernor(await governor.getAddress())).wait();
  await (await governor.connect(s1).acceptRegistryGovernance()).wait();
  console.log("2. Registry governor handed over to multisig contract.");
  await approveAction(governor, s1, s2, ACTION.ApproveIssuer, issuer.address);
  console.log("3. Two distinct signers approved a synthetic issuer.");
  const credentialLabel = "SYNTHETIC-DIPLOMA-001";
  const commitment = ethers.solidityPackedKeccak256(
    ["string", "bytes32"], [credentialLabel, ethers.id("SYNTHETIC-SECRET-SALT-FOR-DEMO")]
  );
  await (await registry.connect(issuer).registerCommitment(commitment, 0)).wait();
  console.log("4. Issuer registered opaque salted commitment:", commitment);
  let result = await registry.connect(employer).getCredential(commitment);
  console.log("5. Employer checks status:", statuses[Number(result.status)]);
  await approveAction(governor, s1, s2, ACTION.SuspendIssuer, issuer.address);
  result = await registry.connect(employer).getCredential(commitment);
  console.log("6. Issuer suspended by two signers; employer status:", statuses[Number(result.status)]);
  await approveAction(governor, s1, s2, ACTION.ReapproveIssuer, issuer.address);
  result = await registry.connect(employer).getCredential(commitment);
  console.log("7. Issuer reapproved; employer status:", statuses[Number(result.status)]);
  await (await registry.connect(issuer).revoke(commitment)).wait();
  result = await registry.connect(employer).getCredential(commitment);
  console.log("8. Issuer revoked synthetic credential; employer status:", statuses[Number(result.status)]);
  console.log("9. Finished — no real identities, networks, wallets, or assets involved.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
