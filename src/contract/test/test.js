// Accessing constants
const {
  web3,
  account1SK,
  account2SK,
  contractAddress,
  keccak256,
  MerkleTree,
} = require("../configFile");

//Accessing controller functions
const {
  createGame,
  joinGame,
  launchTorpedo,
  confirmLegitWin,
  closeGame,
  quitGame,
} = require("../battleshipController");

/**
 * Constructs a game board based on the opponent's ship positions.
 *
 * @param {string} opponentShipsPosition - The string representation of the opponent's ship positions.
 * @returns {number[]} - An array representing the constructed game board, where 1 indicates the presence of a ship and 0 indicates an empty position.
 */

function constructBoard(opponentShipsPosition) {
  const GRID_DIM = 8;

  const shipsposition = opponentShipsPosition.match(/.{1,4}/g);
  const board = Array(GRID_DIM * GRID_DIM).fill(0);

  for (let i = 0; i < 5; i++) {
    const direction = shipsposition[i][0];

    if (direction === "H") {
      // It's horizontal
      const occupiedRow = parseInt(shipsposition[i][1]);
      const startingColumn = parseInt(shipsposition[i][2]);
      const shipLength = parseInt(shipsposition[i][3]);

      // Set the positions of the ship on the board to 1
      for (let j = startingColumn; j < startingColumn + shipLength; j++) {
        board[occupiedRow * GRID_DIM + j] = 1;
      }
    } else if (direction === "V") {
      // It's vertical
      const occupiedColumn = parseInt(shipsposition[i][1]);
      const startingRow = parseInt(shipsposition[i][2]);
      const shipLength = parseInt(shipsposition[i][3]);

      // Set the positions of the ship on the board to 1
      for (let j = startingRow; j < startingRow + shipLength; j++) {
        board[occupiedColumn + j * GRID_DIM] = 1;
      }
    }
  }

  // Return the constructed game board
  return board;
}

async function test() {
  try {
    // --- Ship position Seeds
    const shipsPositionsSeed = "provaprovola";

    let stringBuilder;

    // The ships position tuples all concatenated
    stringBuilder = [];
    stringBuilder.push("H005");
    stringBuilder.push("H104");
    stringBuilder.push("H203");
    stringBuilder.push("H303");
    stringBuilder.push("H402");

    const challengerShipsPosition = stringBuilder.join("");

    // The ships position tuples all concatenated
    stringBuilder = [];
    stringBuilder.push("H005");
    stringBuilder.push("H104");
    stringBuilder.push("H203");
    stringBuilder.push("H303");
    stringBuilder.push("H402");

    const opponentShipsPosition = stringBuilder.join("");

    const challengerBoard = constructBoard(challengerShipsPosition);

    const opponentBoard = constructBoard(opponentShipsPosition);

    //Concatenate the seed to shipsPositions and hash
    const challengerShipsPositionHashed = keccak256(
      web3.utils.encodePacked(challengerShipsPosition + shipsPositionsSeed)
    );

    //Concatenate the seed to shipsPositions, the result will be hashed
    const opponentShipsPositionHashed = keccak256(
      web3.utils.encodePacked(challengerShipsPosition + shipsPositionsSeed)
    );

    // --- Board mask seeds
    const boardSeeds = [];
    for (let i = 0; i < 64; i++) {
      const seed = Math.floor(Math.random() * 255); // random numbers from 0 to 254
      boardSeeds.push(seed);
    }

    const challengerSeededBoard = challengerBoard.map(
      (elem, index) => elem + boardSeeds[index]
    );

    const challengerHashedBoard = challengerSeededBoard.map((seeded_elem) =>
      keccak256(web3.utils.encodePacked(seeded_elem))
    );

    // Compute the Merkle Tree using the hashed leaves
    const challengerMerkleTree = new MerkleTree(
      challengerHashedBoard,
      keccak256,
      {
        sortLeaves: true,
        sortPairs: true,
      }
    );

    const opponentSeededBoard = opponentBoard.map(
      (elem, index) => elem + boardSeeds[index]
    );
    const opponentHashedBoard = opponentSeededBoard.map((seeded_elem) =>
      keccak256(web3.utils.encodePacked(seeded_elem))
    );

    // Compute the Merkle Tree using the hashed board as leaves
    const opponentMerkleTree = new MerkleTree(opponentHashedBoard, keccak256, {
      sortLeaves: true,
      sortPairs: true,
    });

    ///////////////////////// Game Simulation starts

    // Testing configuration
    const betAmount = web3.utils.toWei("0.1", "ether");
    const inactivityTimeGap = 3;

    // Possible scenarios:
    // 1 - Normal game
    // 2 - Challenger closes the game without the opponent joining -> refund the challenger
    // 3 - Either player closes the game before any moves are made -> it's a tie, refund both players
    // 4 - Player finds out that opponent cheated in previous move -> the player inTurn wins
    // 5 - Player voluntarily quits the game after it has started -> the opponent wins
    // 6 - Player finds out that opponent became inactive and the abandon timer expires, he quits -> the quitting player wins
    // 7 - Winning player lied about the board or ships' positions, or the board is invalid -> the other player wins

    const scenario = 1;

    var result;
    const challenger = account1SK;
    const opponent = account2SK;

    // Create game and print result
    result = await createGame(
      challenger,
      betAmount,
      challengerMerkleTree.getHexRoot(),
      challengerShipsPositionHashed
    );

    const GCevent = result.events.GameCreated;
    if (GCevent && GCevent.returnValues) {
      const GCeventValues = GCevent.returnValues;
      console.log(
        `Game created by [${GCeventValues.challenger}]. Game ID: [${GCeventValues.gameId}]`
      );
      console.log(
        `   [${GCeventValues.challenger}] ---[${web3.utils.fromWei(
          GCeventValues.betAmount,
          "ether"
        )} ETH]---> [${contractAddress}] (Contract)\n`
      );
    } else {
      console.log("No GameCreated event found.");
    }

    const gameId = GCevent.returnValues.gameId;

    // Scenario 2: Challenger closes the game
    if (scenario === 2) {
      result = await closeGame(challenger, gameId);

      if (result.events.GameFinished) {
        const GFeventValues = result.events.GameFinished.returnValues;
        console.log(
          `Game finished. Game ID: [${GFeventValues.gameId}] Reason: [${GFeventValues.winning_cond}]`
        );
      } else {
        console.log("GameFinished event not found.");
      }

      if (result.events.GamePaid) {
        const GPevents = Array.isArray(result.events.GamePaid)
          ? result.events.GamePaid
          : [result.events.GamePaid];
        for (let i = 0; i < GPevents.length; i++) {
          const e = GPevents[i].returnValues;
          console.log(
            `   [${contractAddress}] (Contract) ---[${web3.utils.fromWei(
              e.amount,
              "ether"
            )} ETH]---> [${e.receiver}] Cond: [${e.cond}]\n`
          );
        }
      } else {
        console.log("GamePaid event not found.");
      }
      return;
    }

    // Join game and print result
    result = await joinGame(
      opponent,
      betAmount,
      gameId,
      opponentMerkleTree.getHexRoot(),
      opponentShipsPositionHashed
    );
    if (result.events.GameJoined) {
      const GJeventValues = result.events.GameJoined.returnValues;
      console.log(
        `Game joined by [${GJeventValues.opponent}]. Game ID: [${
          GJeventValues.gameId
        }] Challenger: [${
          GJeventValues.challenger
        }] Total Bet: [${web3.utils.fromWei(
          GJeventValues.betAmount,
          "ether"
        )} ETH]`
      );
      console.log(
        `   [${GJeventValues.opponent}] ---[${web3.utils.fromWei(
          betAmount,
          "ether"
        )} ETH]---> [${contractAddress}] (Contract) \n`
      );
    } else {
      console.log("GameFinished event not found.");
    }

    // Scenario 3: One of the players quits
    if (scenario === 3) {
      result = await quitGame(opponent, gameId);

      if (result.events.GameFinished) {
        const GFeventValues = result.events.GameFinished.returnValues;
        console.log(
          `Game finished. Game ID: [${GFeventValues.gameId}] Reason: [${GFeventValues.winning_cond}]`
        );
      } else {
        console.log("GameFinished event not found.");
      }

      if (result.events.GamePaid) {
        const GPevents = Array.isArray(result.events.GamePaid)
          ? result.events.GamePaid
          : [result.events.GamePaid];
        for (let i = 0; i < GPevents.length; i++) {
          const e = GPevents[i].returnValues;
          console.log(
            `   [${contractAddress}] (Contract) ---[${web3.utils.fromWei(
              e.amount,
              "ether"
            )} ETH]---> [${e.receiver}] Cond: [${e.cond}]`
          );
        }
      } else {
        console.log("GamePaid event not found.");
      }
      return;
    }

    console.log("GAME STARTS:");

    // -- SIMULATE MOVES
    const challenger_moves = new Set();
    const opponent_moves = new Set();
    var lastMoveBlock;

    for (let i = 0; i <= 128; i++) {
      await sleep(200);

      const currentPlayer = i % 2 === 0 ? account2SK : account1SK;
      const currentBoard = i % 2 === 0 ? challengerBoard : opponentBoard;
      const currentHashedBoard =
        i % 2 === 0 ? challengerHashedBoard : opponentHashedBoard;
      const currentMerkleTree =
        i % 2 === 0 ? challengerMerkleTree : opponentMerkleTree;

      let move;
      do {
        move = Math.floor(Math.random() * 64);
      } while (
        (i % 2 === 0 && challenger_moves.has(move)) ||
        (i % 2 === 1 && opponent_moves.has(move))
      );

      const proof = currentMerkleTree.getHexProof(currentHashedBoard[move]);

      if (i !== 3) {
        //Legit tornedo results
        result = await launchTorpedo(
          currentPlayer,
          gameId,
          proof,
          currentBoard[move],
          boardSeeds[move],
          Math.floor(move / 8),
          move % 8
        );
      } else {
        if (scenario === 4) {
          // Lie
          result = await launchTorpedo(
            currentPlayer,
            gameId,
            proof,
            currentBoard[move] === 1 ? 0 : 1,
            boardSeeds[move],
            Math.floor(move / 8),
            move % 8
          );
        } else if (scenario === 5) {
          // Voluntary quits
          result = await quitGame(currentPlayer, gameId);
        } else if (scenario === 6) {
          // Wait abandon timer expiring
          console.log(
            "Waiting for the inactivity timer to expire : at least Block ",
            lastMoveBlock + inactivityTimeGap + 1
          );
          var blockNum = await web3.eth.getBlockNumber();
          while (blockNum <= lastMoveBlock + inactivityTimeGap) {
            await sleep(10000);
            console.log(blockNum);
            blockNum = await web3.eth.getBlockNumber();
          }
          result = await quitGame(
            i % 2 === 0 ? account1SK : account2SK,
            gameId
          ); // The other player quits and claim the inactivity
        } else {
          result = await launchTorpedo(
            currentPlayer,
            gameId,
            proof,
            currentBoard[move],
            boardSeeds[move],
            Math.floor(move / 8),
            move % 8
          );
        }
      }

      lastMoveBlock = result.blockNumber; // Save the lastMoveBlock for the scenario 6

      if (
        result.events &&
        result.events.TorpedoLaunched &&
        result.events.TorpedoLaunched.returnValues
      ) {
        const eventValues = result.events.TorpedoLaunched.returnValues;
        console.log(
          `[MOVE ${i}] Torpedo Launched, straight to the cell [${eventValues.row},${eventValues.column}]. Game ID: [${eventValues.gameId}]`
        );
        console.log(
          `   [${eventValues.attacker}] ---[TORPEDO]---> [${eventValues.defender}]\n`
        );
      }

      if (
        (result.events &&
          result.events.GameFinished &&
          result.events.GameFinished.returnValues) ||
        (result.events.GamePaid && result.events.GamePaid.returnValues)
      ) {
        const eventValues = result.events.GameFinished.returnValues;

        if (eventValues.winning_cond === "TO_CHECK_WIN") {
          console.log(
            `The player [${eventValues.winner} sunk the last ship of ${eventValues.loser}]. Game ID: [${eventValues.gameId}]`
          );
          console.log(
            `Btw he has to validate his win in order to withdraw the reward\n`
          );
        }

        if (eventValues.winning_cond === "OPPONENT_MOVE_CHEAT") {
          console.log(
            `The player [${eventValues.loser} cheated on the result of previous [${eventValues.winner}]'s torpedo. Game ID: [${eventValues.gameId}]`
          );
          console.log(`The win goes to  [${eventValues.winner}]\n`);

          if (result.events.GamePaid) {
            const GPevents = Array.isArray(result.events.GamePaid)
              ? result.events.GamePaid
              : [result.events.GamePaid];
            for (let i = 0; i < GPevents.length; i++) {
              const e = GPevents[i].returnValues;
              console.log(
                `   [${contractAddress}] (Contract) ---[${web3.utils.fromWei(
                  e.amount,
                  "ether"
                )} ETH]---> [${e.receiver}] Cond: [${e.cond}]`
              );
            }
          } else {
            console.log("GamePaid event not found.");
          }
          return;
        }

        if (eventValues.winning_cond === "PLAYER_FORFEIT") {
          console.log(
            `The player [${eventValues.loser}] quitted the game. Game ID: [${eventValues.gameId}]`
          );
          console.log(`The win goes to  [${eventValues.winner}]\n`);

          if (result.events.GamePaid) {
            const GPevents = Array.isArray(result.events.GamePaid)
              ? result.events.GamePaid
              : [result.events.GamePaid];
            for (let i = 0; i < GPevents.length; i++) {
              const e = GPevents[i].returnValues;
              console.log(
                `   [${contractAddress}] (Contract) ---[${web3.utils.fromWei(
                  e.amount,
                  "ether"
                )} ETH]---> [${e.receiver}] Cond: [${e.cond}]`
              );
            }
          } else {
            console.log("GamePaid event not found.");
          }
          return;
        }

        if (eventValues.winning_cond === "TIME_EXPIRED_CLAIMED") {
          console.log(
            `The player [${eventValues.winner}] quitted the game claiming the inactivity of the opponent [${eventValues.loser}]. Game ID: [${eventValues.gameId}]`
          );
          console.log(
            `Opponent inactivity confirmed by the contract, the win goes to  [${eventValues.winner}]\n`
          );

          if (result.events.GamePaid) {
            const GPevents = Array.isArray(result.events.GamePaid)
              ? result.events.GamePaid
              : [result.events.GamePaid];
            for (let i = 0; i < GPevents.length; i++) {
              const e = GPevents[i].returnValues;
              console.log(
                `   [${contractAddress}] (Contract) ---[${web3.utils.fromWei(
                  e.amount,
                  "ether"
                )} ETH]---> [${e.receiver}] Cond: [${e.cond}]`
              );
            }
          } else {
            console.log("GamePaid event not found.");
          }
          return;
        }

        break; // Game finished
      }

      if (currentBoard[move] === 1) console.log("   [That's a hit!]");

      i % 2 === 0 ? challenger_moves.add(move) : opponent_moves.add(move);
    }

    // -- A PLAYER WON -> CHECK THE WIN

    const challengerWon =
      result.events.GameFinished.returnValues.winner ===
      web3.eth.accounts.privateKeyToAccount(challenger).address;

    const currentPlayer = challengerWon ? account1SK : account2SK;
    const currentBoard = challengerWon ? challengerBoard : opponentBoard;
    const currentShipsPosition = challengerWon
      ? challengerShipsPosition
      : opponentShipsPosition;

    if (scenario === 7) {
      //currentBoard = Array(GRID_DIM * GRID_DIM).fill(0);
      //boardSeeds = Array(GRID_DIM * GRID_DIM).fill(0);
      //...
      result = await confirmLegitWin(
        currentPlayer,
        gameId,
        currentBoard,
        boardSeeds,
        currentShipsPosition,
        "notprovaprovola"
      );
    } else {
      result = await confirmLegitWin(
        currentPlayer,
        gameId,
        currentBoard,
        boardSeeds,
        currentShipsPosition,
        shipsPositionsSeed
      );
    }

    if (result.events.GamePaid) {
      const GPevents = Array.isArray(result.events.GamePaid)
        ? result.events.GamePaid
        : [result.events.GamePaid];
      for (let i = 0; i < GPevents.length; i++) {
        const e = GPevents[i].returnValues;
        if (e.cond === "LEGIT_WIN")
          console.log(`Victory confirmed by [${e.receiver}`);
        else if (e.cond.startsWith("OPPONENT"))
          console.log(
            `The winner lied on the board or ship position [${e.cond}] -> the win goes to [${e.receiver}`
          );
        console.log(
          `   [${contractAddress}] (Contract) ---[${web3.utils.fromWei(
            e.amount,
            "ether"
          )} ETH]---> [${e.receiver}] Cond: [${e.cond}]`
        );
      }
    } else {
      console.log("GamePaid event not found.");
    }
  } catch (error) {
    console.error("Error running test:", error);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test();
