// eslint-disable-next-line no-undef
const Battleship = artifacts.require("Battleship");

module.exports = async function (deployer) {

  await deployer.deploy(Battleship);

  const battleshipInstance = await Battleship.deployed();

  console.log("Here it is the contract address to put in the configFile:", battleshipInstance.address);

};
