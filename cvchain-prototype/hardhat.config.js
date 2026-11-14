require("@nomicfoundation/hardhat-toolbox");
require("solidity-coverage");

/** Local in-process Hardhat only. No RPC URLs, wallets, or public network definitions. */
module.exports = {
  solidity: {
    version: "0.8.26",
    settings: { optimizer: { enabled: true, runs: 200 } }
  },
  mocha: { timeout: 40000 }
};
