const Web3 = require("web3");
const { MerkleTree } = require("merkletreejs");
const abi = require("./deploy/build/contracts/Battleship.json").abi;

// Provider configuration and Web3 instance initialization
const providerUrl = "ws://127.0.0.1:7545";
const web3 = new Web3(providerUrl);
const keccak256 = web3.utils.keccak256;

// Defining the actors
const account1SK =
  "0x0134872d97443b582d7d631dd51360e05a8423d18076ebb0829a6aa400e9af1a";
const account2SK =
  "0x11c6f3060f71735e13bef3e4311dc21757501ea41f065421d55358bcd93880cc";
const account3SK =
  "0x4c83c755bb2d36d1062adebe20c2e98496230cc3d0aed2f729be04fe0c7fe57f";
const account4SK =
  "0x89d82cab2dfd146af8a35f9cab746905a225c655d1ecd3bfa4e5afa69ad555a2";

// Initialize contract instance
const contractAddress = "0xf3eD3Ece5fE6B90c85Be75c24e3963a37f1c5692";
const contractInstance = new web3.eth.Contract(abi, contractAddress);

// Contains an in-memory wallet with multiple accounts, so these accounts can be used when using web3.eth.sendTransaction().
const wallet = web3.eth.accounts.wallet;
wallet.add(account1SK);
wallet.add(account2SK);
wallet.add(account3SK);
wallet.add(account4SK);

module.exports = {
  web3,
  contractInstance,
  account1SK,
  account2SK,
  account3SK,
  contractAddress,
  keccak256,
  MerkleTree,
};
