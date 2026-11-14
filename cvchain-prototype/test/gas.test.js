const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { approvedFixture, syntheticCommitment } = require("./helpers");

describe("Gas measurement / local transactions only", function () {
  it("logs actual gasUsed for registration and revocation", async function () {
    const { registry, issuer1 } = await loadFixture(approvedFixture);
    const commitment = syntheticCommitment("SYNTHETIC-GAS-TEST");
    const register = await registry.connect(issuer1).registerCommitment(commitment, 0);
    const receipt1 = await register.wait();
    const revoke = await registry.connect(issuer1).revoke(commitment);
    const receipt2 = await revoke.wait();
    console.log(`    local gas registerCommitment: ${receipt1.gasUsed.toString()}`);
    console.log(`    local gas revoke:             ${receipt2.gasUsed.toString()}`);
    if (receipt1.gasUsed <= 0n || receipt2.gasUsed <= 0n) throw new Error("Unexpected gasUsed");
  });
});
