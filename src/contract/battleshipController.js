const { web3, contractInstance } = require("./configFile");

/////////////// Contract controller

/**
 * Creates a game by invoking the contract's createGame function giving also the bet amount to the contract.
 *
 * @param {string} privateKey - The secret key of the player's Ethereum account.
 * @param {string} merkleRoot - The Merkle root his board.
 * @param {string} shipsPositionsHash - The hash of the ships positions in the board.
 * @returns {Promise<string>} - A Promise that resolves with the created game ID.
 */

async function createGame(privateKey, bet, merkleRoot, shipsPositionsHash) {
  const player = web3.eth.accounts.privateKeyToAccount(privateKey);
  const contract = contractInstance;

  const gas = await contract.methods
    .createGame(merkleRoot, shipsPositionsHash)
    .estimateGas({
      from: player.address,
      value: bet,
    });

  const result = await contract.methods
    .createGame(merkleRoot, shipsPositionsHash)
    .send({
      from: player.address,
      gas: gas,
      value: bet,
    });

  return result;
}

/**
 * Joins a game by invoking the contract's joinGame function, giving also the bet amount to the contract.
 *
 * @param {string} privateKey - The secret key of the player's Ethereum account that wants to join.
 * @param {string} bet - The wei amount that he wants to bet (it should be = to the challenger bet).
 * @param {string} gameId - The ID of the game in which to launch the torpedo.
 * @param {string} merkleRoot - The Merkle root his board.
 * @param {string} shipsPositionsHash - The hash of the ships positions in the board.
 * @returns {Promise<string>} - A Promise that resolves with the contract result.
 */

async function joinGame(
  privateKey,
  bet,
  gameId,
  merkleRoot,
  shipsPositionsHash
) {
  const player = web3.eth.accounts.privateKeyToAccount(privateKey);
  const contract = contractInstance;

  const gas = await contract.methods
    .joinGame(gameId, merkleRoot, shipsPositionsHash)
    .estimateGas({
      from: player.address,
      value: bet,
    });

  const result = await contract.methods
    .joinGame(gameId, merkleRoot, shipsPositionsHash)
    .send({
      from: player.address,
      gas: gas,
      value: bet,
    });

  return result;
}

/**
 * Launches a torpedo in the game by invoking the contract's `launchTorpedo` function and confirming the previous opponent move.
 *
 * @param {string} privateKey - The secret key of the player's Ethereum account that sends the torpedo.
 * @param {number} gameId - The ID of the game in which to launch the torpedo.
 * @param {string[]} proof - The Merkle proof that verifies the validity of the opponent's move (the value in board[move] 1 if hit 0 o/w).
 * @param {number} prevMoveResult - The result of the previous move made by the opponent.
 * @param {number} seed - The seed used to mask the previous aimed board cell, before hashing and constructing the Merkle tree.
 * @param {number} row - The target row for the next move's torpedo.
 * @param {number} column - The target column for the next move's torpedo.
 * @returns {Promise<string>} - A Promise that resolves with the contract result.
 */

async function launchTorpedo(
  privateKey,
  gameId,
  proof,
  prevMoveResult,
  seed,
  row,
  column
) {
  const account = web3.eth.accounts.privateKeyToAccount(privateKey);
  const contract = contractInstance;

  const gas = await contract.methods
    .launchTorpedo(gameId, proof, prevMoveResult, seed, row, column)
    .estimateGas({
      from: account.address,
    });

  const result = await contract.methods
    .launchTorpedo(gameId, proof, prevMoveResult, seed, row, column)
    .send({
      from: account.address,
      gas: gas * 2,
    });

  return result;
}

/**
 * Confirms the legitimacy of a win in the game by invoking the contract's `confirmLegitWin` function.
 *
 * @param {string} privateKey - The private key of the player's Ethereum account that won the game and wants to confirm win.
 * @param {number} gameId - The ID of the game that wants to confirm.
 * @param {number[]} board - The original game board array.
 * @param {number[]} boardSeeds - The seeds used to mask the board state before hashing and constructing the Merkle tree.
 * @param {string} shipsPositions - The string encoding of positions of the ships on the game board.
 * @param {string} shipsPositionSeed - The seed used to mask the ship positions before hashing.
 * @returns {Promise<string>} - A Promise that resolves with the contract result.
 */

async function confirmLegitWin(
  privateKey,
  gameId,
  board,
  boardSeeds,
  shipsPositions,
  shipsPositionSeed
) {
  const account = web3.eth.accounts.privateKeyToAccount(privateKey);
  const contract = contractInstance;

  const gas = await contract.methods
    .confirmLegitWin(
      gameId,
      board,
      boardSeeds,
      shipsPositions,
      shipsPositionSeed
    )
    .estimateGas({
      from: account.address,
    });

  const result = await contract.methods
    .confirmLegitWin(
      gameId,
      board,
      boardSeeds,
      shipsPositions,
      shipsPositionSeed
    )
    .send({
      from: account.address,
      gas: gas,
    });

  return result;
}

/**
 * Closes a game by invoking the contract's `closeGame` function.
 *
 * @param {string} privateKey - The private key of the player's Ethereum account.
 * @param {number} gameId - The ID of the game of hes to be closed.
 * @returns {Promise<string>} - A Promise that resolves with the contract result.
 */

async function closeGame(privateKey, gameId) {
  const account = web3.eth.accounts.privateKeyToAccount(privateKey);
  const contract = contractInstance;

  const gas = await contract.methods.closeGame(gameId).estimateGas({
    from: account.address,
  });

  const result = await contract.methods.closeGame(gameId).send({
    from: account.address,
    gas: gas,
  });

  return result;
}

/**
 * Quits a game by invoking the contract's `quitGame` function.
 *
 * @param {string} privateKey - The private key of the player's Ethereum account that want to quit.
 * @param {number} gameId - The ID of the game to be quit.
 * @returns {Promise<string>} - A Promise that resolves with the events object from the contract result.
 */

async function quitGame(privateKey, gameId) {
  const account = web3.eth.accounts.privateKeyToAccount(privateKey);
  const contract = contractInstance;

  const gas = await contract.methods.quitGame(gameId).estimateGas({
    from: account.address,
  });

  const result = await contract.methods.quitGame(gameId).send({
    from: account.address,
    gas: gas,
  });

  return result;
}

/////////////// Utility functions

/**
 * Sends funds from one Ethereum account to another.
 *
 * @param {string} privateKey - The secret key of the sender's Ethereum account.
 * @param {string} toAddress - The recipient's Ethereum address.
 * @param {number} amount - The amount of funds to send.
 * @returns {Promise<void>} - A Promise that resolves once the funds are successfully transferred.
 */
async function sendFunds(privateKey, toAddress, amount) {
  const sender = web3.eth.accounts.privateKeyToAccount(privateKey);

  const gas = await web3.eth.estimateGas({
    to: toAddress,
    from: sender.address,
    value: amount,
  });

  const signedTx = await sender.signTransaction({
    to: toAddress,
    from: sender.address,
    value: amount,
    gas: gas,
  });

  const result = await web3.eth.sendSignedTransaction(
    signedTx.rawTransaction
  );
  const amountInEth = web3.utils.fromWei(amount, "ether");
  const roundedAmount = Number(amountInEth).toFixed(4);

  console.log("Funds transferred successfully.");
  console.log(
    `   [${sender.address}] ---[${roundedAmount} ETH]---> [${toAddress}]\n`
  );

  return result;
}

/**
 * Sends funds from one Ethereum account to another.
 *
 * @param {string} privateKey - The secret key of the sender's Ethereum account.
 * @param {string[]} accountsSKs - The Ethereum addresses of recipients.
 * @param {number} amount - The amount of funds to send to each account.
 * @returns {Promise<void>} - A Promise that resolves once the funds all the transfers have been done.
 */
async function fundAccounts(privateKey, accountsSKs, amount, show) {
  for (const recipientSK of accountsSKs) {
    const recipient = web3.eth.accounts.privateKeyToAccount(recipientSK);
    await sendFunds(privateKey, recipient.address, amount);
  }
}

module.exports = {
  sendFunds,
  fundAccounts,
  createGame,
  joinGame,
  launchTorpedo,
  confirmLegitWin,
  closeGame,
  quitGame,
};
