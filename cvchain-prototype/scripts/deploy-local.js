const { ethers } = require("hardhat");

async function main() {
  const [bootstrap, signerA, signerB, signerC] = await ethers.getSigners();
  const Registry = await ethers.getContractFactory("CredentialRegistry");
  const registry = await Registry.deploy(bootstrap.address);
  await registry.waitForDeployment();
  const Governor = await ethers.getContractFactory("Governor");
  const governor = await Governor.deploy(await registry.getAddress(), [signerA.address, signerB.address, signerC.address]);
  await governor.waitForDeployment();
  await (await registry.proposeGovernor(await governor.getAddress())).wait();
  await (await governor.connect(signerA).acceptRegistryGovernance()).wait();
  if ((await registry.governor()) !== (await governor.getAddress())) throw new Error("Governance setup failed");
  console.log("Local-only Registry:", await registry.getAddress());
  console.log("Local-only Governor:", await governor.getAddress());
  console.log("Active governance: 2 of 3 synthetic Hardhat signers. Network disappears at process exit.");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
