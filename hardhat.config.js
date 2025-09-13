require("dotenv").config();
require("@nomicfoundation/hardhat-toolbox");        // or hardhat-toolbox-mocha-ethers if you're on HH3
require("@nomicfoundation/hardhat-verify");

module.exports = {
  solidity: {
    compilers: [
      // Make sure 0.8.28 is first, since your files use ^0.8.28
      { version: "0.8.28", settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: "paris" } },
      // Keep any other versions you need for other files:
      { version: "0.8.24", settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: "paris" } },
      { version: "0.8.20", settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: "paris" } },
    ],
    // Optional: if any file stubbornly needs a different version, use overrides:
    // overrides: {
    //   "contracts/SomeOldFile.sol": {
    //     version: "0.8.20",
    //     settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: "paris" }
    //   }
    // }
  },

  networks: {
    fuji: {
      url: process.env.RPC_FUJI || "https://api.avax-test.network/ext/bc/C/rpc",
      chainId: 43113,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
    avalanche: {
      url: process.env.RPC_AVALANCHE || "https://api.avax.network/ext/bc/C/rpc",
      chainId: 43114,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },

  verify: {
    etherscan: {
      apiKey: process.env.SNOWTRACE_API_KEY || "",
      customChains: [
        {
          network: "avalancheFujiTestnet",
          chainId: 43113,
          urls: {
            apiURL: "https://api-testnet.snowtrace.io/api",
            browserURL: "https://testnet.snowtrace.io",
          },
        },
        {
          network: "avalanche",
          chainId: 43114,
          urls: {
            apiURL: "https://api.snowtrace.io/api",
            browserURL: "https://snowtrace.io",
          },
        },
      ],
    },
  },
};

