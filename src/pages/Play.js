/* eslint-disable no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useContext, useState } from "react";
import { AppContext } from "../components/context";
import { Button, Box, Flex, Alert, AlertIcon, Text, Icon } from "@chakra-ui/react";
import PlayingBoard from "../components/boards/PlayingBoard";
import HitIcon from "../icons/fire.png";
import MissIcon from "../icons/sea.png";
import { FaEthereum } from "react-icons/fa";

// Game class for better organization of game data
class Game {
  constructor(game) {
    this.gameId = game.gameId;
    this.challenger = game.challenger;
    this.opponent = game.opponent;
    this.betAmount = game.betAmount;
    this.board = game.board;
    this.boardSeeds = game.boardSeeds;
    this.shipsPositions = game.shipsPositions;
    this.shipsPositionsSeed = game.shipsPositionsSeed;
    this.hashedBoard = game.hashedBoard;
    this.merkleTree = game.merkleTree;
  }
}

const Play = ({ gameId }) => {
  const { MerkleTree } = require("merkletreejs");
  const { contractFunctions, privateKey, publicKey, web3, contractInstance } =
    useContext(AppContext);

  //Game state
  const [game, setGame] = useState(null);
  const [gameMerkleTree, setGameMerkleTree] = useState(null);

  //Event inducted data
  const [challengerMoves, setChallengerMoves] = useState([]);
  const [opponentMoves, setOpponentMoves] = useState([]);
  const [moves, setMoves] = useState([]);
  const [status, setStatus] = useState("");
  const [challengerBoard, setChallengerBoard] = useState(Array(64).fill("sea")); //left one will be the one to represent challenger's board (clickable if publicKey === game.challenger)
  const [opponentBoard, setOpponentBoard] = useState(Array(64).fill("sea")); //right one will be the one to represent opponent's board (clickable if publicKey === game.challenger)

  //Turn system
  const [challOrOppon, setChallOrOpp] = useState(null); //True -> opponent o/w challnger
  const [isFirstTurn, setIsFirstTurn] = useState(false);
  const [isInTurn, setIsInTurn] = useState(false);
  const [opponentLastMove, setOpponentLastMove] = useState(null);

  //Logger/Chronicle
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    const initGame = async () => {
      // Find the game with the matching gameId in the localstorage
      const storedGames = localStorage.getItem("games");
      const gamesArray = JSON.parse(storedGames);
      let gameFound;
      for (let i = 0; i < gamesArray.length; i++) {
        if (gamesArray[i].gameId === String(gameId)) {
          gameFound = gamesArray[i];
          break;
        }
      }
      // The data is lost
      if (gameFound == null) window.location.href = "/discovery"; // Redirect to discovery

      //Recompute merkleTree
      const merkleTree = new MerkleTree(
        gameFound.hashedBoard,
        web3.utils.keccak256,
        {
          sortLeaves: true,
          sortPairs: true,
        }
      );

      // Retrieve all the events
      const gameRelatedEvents = await contractInstance.getPastEvents(
        "allEvents",
        { filter: { gameId: gameId }, fromBlock: 0, toBlock: "latest" }
      );

      const joinedGameEvent = gameRelatedEvents.find(
        (event) => event.event === "GameJoined"
      );
      const endGameEvent = gameRelatedEvents.find(
        (event) => event.event === "GameFinished"
      );
      const paidGameEvent = gameRelatedEvents.find(
        (event) => event.event === "GamePaid"
      );

      // 1st check - The user that is trying to access the game but does not belong to it
      if (!joinedGameEvent) window.location.href = "/discovery"; // Both players have not joined yet

      ////////// DATA VALID ///////////////
      //time to reconstruct the game history

      //Who is the player
      const chalOrOpp = gameFound.challenger === publicKey;

      const shipsPositions = gameFound.shipsPositions;

      // Parse the shipsPositions string into individual ship positions
      const shipPositions = [];
      for (let i = 0; i < shipsPositions.length; i += 4) {
        const direction = shipsPositions[i];
        const occupiedRowOrColumn = Number(shipsPositions[i + 1]);
        const startingColumnOrRow = Number(shipsPositions[i + 2]);
        const shipLength = Number(shipsPositions[i + 3]);

        shipPositions.push({
          direction,
          occupiedRowOrColumn,
          startingColumnOrRow,
          shipLength,
        });
      }

      // Fill the playerBoard with ships based on shipPositions
      const updateToStoredBoard = (board, shipPositions) => {
        const updatedBoard = [...board];

        shipPositions.forEach((ship, i) => {
          const {
            direction,
            occupiedRowOrColumn,
            startingColumnOrRow,
            shipLength,
          } = ship;

          if (direction === "H") {
            // Horizontal ship
            const occupiedRow = Number(occupiedRowOrColumn);
            const startingColumn = Number(startingColumnOrRow);

            for (let j = startingColumn; j < startingColumn + shipLength; j++) {
              updatedBoard[occupiedRow * 8 + j] = "ship" + i;
            }
          } else if (direction === "V") {
            // Vertical ship
            const occupiedColumn = Number(occupiedRowOrColumn);
            const startingRow = Number(startingColumnOrRow);

            for (let j = startingRow; j < startingRow + shipLength; j++) {
              updatedBoard[occupiedColumn + j * 8] = "ship" + i;
            }
          }
        });

        return updatedBoard;
      };

      if (chalOrOpp === true) {
        // The current player is the challenger (so in the Localstorage there is its data).
        setChallengerBoard(updateToStoredBoard(challengerBoard, shipPositions));
      } else {
        setOpponentBoard(updateToStoredBoard(opponentBoard, shipPositions));
      }

      // Extract history of moves through TorpedoLaunches events, sorting them
      const torpedoLaunchEvents = gameRelatedEvents
        .filter((event) => event.event === "TorpedoLaunched")
        .sort((a, b) => {
          return a.nMove - b.nMove;
        });

      //// ----- Extracting moves
      let attacker;
      let defender;
      let row;
      let column;
      let cellIndex;
      let nMove;

      let challengerMovesArray = [];
      let opponentMovesArray = [];
      let movesArray = [];

      if (torpedoLaunchEvents.length === 0) {
        // If no torpedo has been launched, the first move is the opponent's one

        if (chalOrOpp) {
          //If the current player is the challenger
          setIsInTurn(false);
          setStatus("ready");
          setIsFirstTurn(false); // it's used by the first move of the opponent
          // (as the first part of parameters of the contract call "launchTorpedo" it's just mock data | no previous move to validate).
        } else {
          setIsInTurn(true);
          setStatus("ready");
          setIsFirstTurn(true); // it's used by the first move of the opponent
          // (as the first part of parameters of the contract call "launchTorpedo" it's just mock data | no previous move to validate).
        }
      } else {
        setStatus("playing");
        // Extract moves of both players and their results (reconstruct the state until this moment).
        // Accumulating the updated moves in separate arrays

        const challengerMovesArray = [];
        const opponentMovesArray = [];

        torpedoLaunchEvents.forEach((torpedoLaunched) => {
          attacker = torpedoLaunched.returnValues.attacker;
          defender = torpedoLaunched.returnValues.defender;
          row = Number(torpedoLaunched.returnValues.row);
          column = Number(torpedoLaunched.returnValues.column);
          nMove = Number(torpedoLaunched.returnValues.nMove);

          // The events are paired, we can get result but also warns us that the game
          // is still playing if the last has not TorpedoResult or ended if a GameFinished
          // event has been triggered. (it will checked later).
          const torpedoResult = gameRelatedEvents.find(
            (event) =>
              event.event === "TorpedoResult" &&
              event.returnValues.attacker === attacker &&
              event.returnValues.defender === defender &&
              Number(event.returnValues.row) === row &&
              Number(event.returnValues.column) === column
          );

          cellIndex = row * 8 + column;

          if (!torpedoResult) return; // The game stopped with this move.

          let result = Number(torpedoResult.returnValues.result);

          if (attacker === gameFound.challenger) {
            challengerMovesArray.push({ nMove, row, column, result });
          } else {
            opponentMovesArray.push({ nMove, row, column, result });
          }
          movesArray.push({ attacker, defender, row, column, nMove, result });
        });

        // Apply challenger's moves on opponent board
        setOpponentBoard((prevOpponentBoard) => {
          const updatedOpponentBoard = [...prevOpponentBoard];
          challengerMovesArray.forEach((move) => {
            const { row, column, result } = move;
            const cellIndex = row * 8 + column;
            updatedOpponentBoard[cellIndex] =
              Number(result) === 1 ? "hit" : "miss";
          });
          return updatedOpponentBoard;
        });

        //and viceversa
        setChallengerBoard((prevPlayerBoard) => {
          const updatedPlayerBoard = [...prevPlayerBoard];
          opponentMovesArray.forEach((move) => {
            const { row, column, result } = move;
            const cellIndex = row * 8 + column;
            updatedPlayerBoard[cellIndex] =
              Number(result) === 1 ? "hit" : "miss";
          });
          return updatedPlayerBoard;
        });

        //Check if the game is finished
        if (endGameEvent) {
          console.log("GameEnded");
          setStatus("finished");
          setIsInTurn(false);
          let { winner, winning_cond } = endGameEvent.returnValues; 
          if (winning_cond === "TO_CHECK_WIN" && winner === publicKey) setStatus("tovalidate");

          if (paidGameEvent) setStatus("paid");
        } else {
          //Use last move to choose the InTurn and set opponent last move
          //to be convalidated.
          setIsInTurn(defender === publicKey); //The one who is defending has to attack
          setOpponentLastMove(cellIndex);
        }
      }

      //Set the state
      setGame(gameFound);
      setGameMerkleTree(merkleTree);
      setChallengerMoves(challengerMovesArray);
      setOpponentMoves(opponentMovesArray);
      setMoves(movesArray);
      setChallOrOpp(chalOrOpp);

      //// ----- Subscribe to keep game updated (Turn system)

      if (!endGameEvent) {
        // Subscribe to the "TorpedoResult" event (confirms the previous turn move)
        // Both player listen to it, as it is the info needed to update both boards.
        contractInstance.events.TorpedoResult(
          { filter: { gameId: gameId } },
          (error, resultEvent) => {
            if (!error) {
              var res = resultEvent.returnValues;
              let move = Number(res.row) * 8 + Number(res.column);

              if (res.defender === gameFound.challenger) {
                //the result refers to a torpedo launched by opponent
                //Update the other board
                setChallengerBoard((prevPlayerBoard) => {
                  const updatedBoard = [...prevPlayerBoard];
                  updatedBoard[move] =
                    Number(res.result) === 1 ? "hit" : "miss";
                  return updatedBoard;
                });

                if (chalOrOpp) {
                  //the torpedo is hitting the challenger, the current player

                  if (Number(res.result) === 1) {
                    //It's a hit!

                    let ship_id = challengerBoard[move];
                    // if in the board has not another cell of the same id -> sunk
                    let isSunk = !challengerBoard.some(
                      (element) => element === ship_id
                    );

                    if (isSunk)
                      setMessages((prevMessages) => [
                        ...prevMessages,
                        `-- The enemy torpedo hitted your ship... and it SUNK!`,
                      ]);
                    else
                      setMessages((prevMessages) => [
                        ...prevMessages,
                        `-- The enemy torpedo hitted your ship!`,
                      ]);
                  } else {
                    setMessages((prevMessages) => [
                      ...prevMessages,
                      `-- The previous enemy torpedo fell in the sea, with fishes.. glu glu glu`,
                    ]);
                  }
                } else {
                  //the torpedo is hitting the challenger, the other guy

                  if (Number(res.result) === 1) {
                    //It's a hit!
                    setMessages((prevMessages) => [
                      ...prevMessages,
                      `-- Your previous torpedo hitted a ship!`,
                    ]);
                  } else {
                    setMessages((prevMessages) => [
                      ...prevMessages,
                      `-- Your previous torpedo fell in the sea, with fishes.. glu glu glu`,
                    ]);
                  }
                }
              } else {
                //the result refers to a torpedo launched to the opponent

                //Update the other board
                setOpponentBoard((prevPlayerBoard) => {
                  const updatedBoard = [...prevPlayerBoard];
                  updatedBoard[move] =
                    Number(res.result) === 1 ? "hit" : "miss";
                  return updatedBoard;
                });

                if (!chalOrOpp) {
                  //the torpedo is hitting the opponent, the current player

                  if (Number(res.result) === 1) {
                    //It's a hit!

                    let ship_id = opponentBoard[move];
                    // if in the board has not another cell of the same id -> sunk
                    let isSunk = !opponentBoard.some(
                      (element) => element === ship_id
                    );

                    if (isSunk)
                      setMessages((prevMessages) => [
                        ...prevMessages,
                        `-- The previous enemy torpedo hitted your ship... and it SUNK!`,
                      ]);
                    else
                      setMessages((prevMessages) => [
                        ...prevMessages,
                        `-- The previous enemy torpedo hitted your ship!`,
                      ]);
                  } else {
                    setMessages((prevMessages) => [
                      ...prevMessages,
                      `-- The previous enemy torpedo fell in the sea, with fishes.. glu glu glu`,
                    ]);
                  }
                } else {
                  //the torpedo is hitting the challenger, the other guy

                  if (Number(res.result) === 1) {
                    //It's a hit!
                    setMessages((prevMessages) => [
                      ...prevMessages,
                      `-- Your previous torpedo hitted a ship!`,
                    ]);
                  } else {
                    setMessages((prevMessages) => [
                      ...prevMessages,
                      `-- Your previous torpedo fell in the sea, with fishes.. glu glu glu`,
                    ]);
                  }
                }
              }

              //Add new move to moves
              setMoves((prevMoves) => {
                const updatedMoves = [...prevMoves];
                let nMove = res.nMove;
                let row = res.row;
                let column = res.column;
                let result = res.result;
                updatedMoves.push({ nMove, row, column, result });
                return updatedMoves;
              });
            }
          }
        );

        // Subscribe to the "TorpedoLaunched" event
        contractInstance.events.TorpedoLaunched(
          { filter: { gameId: gameId, defender: publicKey } }, // The player is interested only in opponent generated TorpedoLaunches (as in it there is the last not verif. move)
          (error, launchEvent) => {
            if (!error) {
              setStatus("playing");

              //Add the new move to be validated
              let launch = launchEvent.returnValues;
              let opponentMove = Number(launch.row) * 8 + Number(launch.column);
              setOpponentLastMove(opponentMove);

              setMessages((prevMessages) => [
                ...prevMessages,
                `-- An enemy torpedo is coming, aiming cell [${launch.row},${launch.column}]....`,
              ]);

              setIsInTurn(true); // It's your turn, count losses of enemy torpedo and counterattack
              setIsFirstTurn(false); // You received a TorpedoLaunched -> it's not anymore the first turn
            }
          }
        );

        //Watch out if the GameFinished is arrived
        contractInstance.events.GameFinished(
          { filter: { gameId: gameId } },
          async (finishEv) => {
            //The event is triggered, i tried in many ways but seems to be a bug, because the previous listeners work
            //that's strange cause the the callback is triggered but finishEv == null, however we have a solution....
            const finishEvent = await contractInstance.getPastEvents(
              "GameFinished",
              { filter: { gameId: gameId }, fromBlock: 0, toBlock: "latest" }
            );

            console.log(finishEvent);
            setIsInTurn(false);
            setStatus("finished");

            let { winner, winning_cond } = finishEvent[0].returnValues;

            if (winning_cond === "PLAYER_QUIT_BEFORE_START") {
              setMessages((prevMessages) => [
                ...prevMessages,
                `-- Tie game. reason:[${winning_cond}]`,
              ]);
            }

            if (winning_cond === "TO_CHECK_WIN") {
              setMessages((prevMessages) => [
                ...prevMessages,
                `-- [${winner}] is gonna win, has to validate to confirm the victory. reason:[${winning_cond}]`,
              ]);
              if (winner === publicKey) setStatus("tovalidate");
            }

            if (winning_cond === "OPPONENT_MOVE_CHEAT") {
              if (winner === publicKey) {
                setMessages((prevMessages) => [
                  ...prevMessages,
                  `-- [${winner}] won the game, enemy cheated in the previous move. reason:[${winning_cond}]`,
                ]);
              }
            }

            if (winning_cond === "TIME_EXPIRED_CLAIMED") {
              if (winner === publicKey) {
                setMessages((prevMessages) => [
                  ...prevMessages,
                  `-- [${winner}] won the game as he claimed the inactivity of the enemy. reason:[${winning_cond}]`,
                ]);
              }
            }

            if (winning_cond === "PLAYER_FORFEIT") {
              setMessages((prevMessages) => [
                ...prevMessages,
                `-- [${winner}] won the game, the other player quitted. reason:[${winning_cond}]`,
              ]);
            }

            //Some finishing phases pay both players (more than 1 event).
            contractInstance.events.GamePaid(
              { filter: { gameId: gameId } },
              async (paidEv) => {
                const paidEvent = await contractInstance.getPastEvents(
                  "GamePaid",
                  {
                    filter: { gameId: gameId },
                    fromBlock: 0,
                    toBlock: "latest",
                  }
                );
                let { receiver, cond, amount } = paidEvent[0].returnValues;
                setMessages((prevMessages) => [
                  ...prevMessages,
                  `-- The player [${receiver}] has been paid [${amount}]. reason:[${cond}]`,
                ]);
                setStatus("paid");
              }
            );
          }
        );
      }
    };

    initGame();
  }, []); // Empty dependency array ensures it runs once

  const handleOpponentBoardClick = async (index) => {
    if (isInTurn === true) {
      if (isFirstTurn === true) {
        try {
          //It's first turn (MOCK DATA)
          var proof = Array(32).fill("0xff");
          var leaf = 0;
          var leafSeed = 0;

          const result = await contractFunctions.launchTorpedo(
            privateKey,
            gameId,
            proof,
            leaf,
            leafSeed,
            Math.floor(index / 8),
            index % 8
          );

          console.log(result);

          setMessages((prevMessages) => [
            ...prevMessages,
            `-- The torpedo has been launched, it is on the way...ffffsss [${Math.floor(
              index / 8
            )},${index % 8}]`,
          ]);

          //Not anymore inTurn.
          setIsInTurn(false);
        } catch (error) {
          setMessages((prevMessages) => [
            ...prevMessages,
            `- Error launching the torpedo [${Math.floor(index / 8)},${
              index % 8
            }] : ${error.message}]`,
          ]);
        }
      } else {
        try {
          //It's not first turn
          proof = gameMerkleTree.getHexProof(
            game.hashedBoard[opponentLastMove]
          );
          leaf = game.board[opponentLastMove];
          leafSeed = game.boardSeeds[opponentLastMove];

          await contractFunctions.launchTorpedo(
            privateKey,
            gameId,
            proof,
            leaf,
            leafSeed,
            Math.floor(index / 8),
            index % 8
          );

          setMessages((prevMessages) => [
            ...prevMessages,
            `-- Your torpedo has been launched, it is on the way...ffffsss [${Math.floor(
              index / 8
            )},${index % 8}]`,
          ]);

          //Not anymore inTurn.
          setIsInTurn(false);
        } catch (error) {
          setMessages((prevMessages) => [
            ...prevMessages,
            `- Error launching the torpedo [${Math.floor(index / 8)},${
              index % 8
            }] : ${error.message}]`,
          ]);
        }
      }
      setStatus("playing");
    }
  };

  const handleConfirmLegitWin = async () => {
    try {
      const res = await contractFunctions.confirmLegitWin(
        privateKey,
        game.gameId,
        game.board,
        game.boardSeeds,
        game.shipsPositions,
        game.shipsPositionsSeed
      );
    } catch (error) {
      setMessages((prevMessages) => [
        ...prevMessages,
        `- Error confirming victory: ${error.message}]`,
      ]);
      
    }
  };

  // Render Things

  const whoDidMove = (nMove) => {
    if (nMove % 2 === 0) {
      //The opponent has even nMoves
      if (challOrOppon === true) {
        return "ENEMY";
      } else {
        return "YOU";
      }
    } else {
      if (challOrOppon === true) {
        return "YOU";
      } else {
        return "ENEMY";
      }
    }
  };

  const itsOwnSide = (leftOrRight) => {
    // The side coincide with the current player
    // (left - imchallenger, right, imopponent)
    if (leftOrRight === true) {
      if (challOrOppon) {
        return true;
      } else {
        return false;
      }
    } else {
      if (challOrOppon === true) {
        return false;
      } else {
        return true;
      }
    }
  };

  const boardClickInTurn = (leftOrRight) => {
    if (leftOrRight === true) {
      if (challOrOppon === true) {
        if (isInTurn === true) return true;
        else return false;
      } else return false;
    } else {
      if (challOrOppon === true) return false;
      else if (isInTurn === true) return true;
      else return false;
    }
  };

  const movesBar = (
    <Box
      overflowX="auto"
      maxWidth="1200px"
      height="200px"
      mb={3}
      mx="auto"
      css={{ scrollPaddingLeft: "10px" }}
    >
      <Flex>
        {moves.map((move, index) => (
          <Box
            key={index}
            borderWidth="1px"
            p={4}
            mr={4}
            mb={4}
            borderRadius="10%"
            backgroundColor="blue.800"
          >
            <Text>Move n.{move.nMove}</Text>
            <Text>{whoDidMove(move.nMove)}</Text>
            <Text>
              [{move.row},{move.column}]
            </Text>
            {move.result === 1 && (
              <img
                src={HitIcon}
                alt="hit icon :)"
                style={{
                  width: "20%",
                  height: "20%",
                  objectFit: "contain",
                }}
              />
            )}
            {move.result === 0 && (
              <img
                src={MissIcon}
                alt="miss icon :("
                style={{
                  width: "20%",
                  height: "20%",
                  objectFit: "contain",
                }}
              />
            )}
          </Box>
        ))}
      </Flex>
    </Box>
  );

  const Player = ({ game, leftOrRight }) => {
    if (!game) return null;
    const { challenger, opponent } = game;

    return (
      <Flex direction="column" align="center" mb={4}>
        {status && status !== "finished" && status !== "paid" && (
          <Box flexShrink={0} mt={2}>
            <Text fontWeight="bold" fontSize="lg">
              {boardClickInTurn(leftOrRight) && "[IN_TURN]"}
            </Text>
          </Box>
        )}
        <Box position="relative" width={100} height={100}>
          <Text
            position="absolute"
            top={0}
            left={0}
            width="100%"
            height="100%"
            display="flex"
            justifyContent="center"
            alignItems="center"
            backgroundColor="rgba(0, 0, 0, 0.5)"
            color="white"
            fontWeight="bold"
            fontSize="lg"
            zIndex={1}
          >
            {itsOwnSide(leftOrRight) ? "YOU" : "ENEMY"}
          </Text>
          <img
            src={
              leftOrRight
                ? "https://w7.pngwing.com/pngs/622/1022/png-transparent-milk-caps-looney-tunes-wile-e-coyote-and-the-road-runner-animated-cartoon-others-miscellaneous-television-cartoon.png"
                : "https://e7.pngegg.com/pngimages/249/589/png-clipart-wile-e-coyote-and-the-road-runner-wile-e-coyote-and-the-road-runner-looney-tunes-others-miscellaneous-galliformes-thumbnail.png"
            }
            alt="avatar"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              position: "absolute",
              top: 0,
              left: 0,
              zIndex: 0,
            }}
          />
        </Box>

        <Box flexShrink={0} mt={2}>
          <Text fontWeight="bold" fontSize="lg">
            {itsOwnSide(leftOrRight) ? challenger : opponent}
          </Text>
        </Box>
        <Box flexGrow={1} mt={2}>
          {opponentBoard && challengerBoard && (
            <PlayingBoard
              board={leftOrRight ? challengerBoard : opponentBoard}
              canBeTorpedoed={boardClickInTurn(leftOrRight)}
              handleOpponentBoardClick={handleOpponentBoardClick}
              isInTurn={isInTurn}
            />
          )}
        </Box>
      </Flex>
    );
  };

  const ControlBar = () => {
    return (
      <Box mr={4} width={300}>
        {game && web3 && (
          <>
            <Flex direction="column" alignItems="center">
              {status && status !== "finished" && status !== "paid" && status !== "tovalidate" && (
                <Button
                  mb={2}
                  onClick={() => {
                    try {
                      contractFunctions.quitGame(privateKey, gameId);
                    } catch (error) {
                      setMessages((prevMessages) => [
                        ...prevMessages,
                        `- Error quitting game : ${error.message}]`,
                      ]);
                    }

                  }
                  }
                >
                  {"QUIT " + (status === "ready" ? "(TIE)" : "(ENEMY WINS)")}
                </Button>
              )}
              {status && status === "tovalidate" && (
                <Button mb={2} mt={2} onClick={() => handleConfirmLegitWin()}>
                  CONFIRM WIN
                </Button>
              )}
            </Flex>
          </>
        )}
        {messages && messages.length > 0 && (
          <Box mt={4} maxHeight="500px" overflowY="auto">
            <Text fontWeight="bold" mb={5}>
              <Text as="span" fontWeight="bold">
                Chronicle
              </Text>
            </Text>
            {messages.map((message, index) => (
              <Alert
                key={index}
                status={
                  !message.includes("Error") && message.includes("--")
                    ? "success"
                    : "error"
                }
                mb={2}
              >
                <AlertIcon
                  color={
                    message.includes("enemy")
                      ? "orange.500"
                      : !message.includes("Error") && message.includes("--")
                      ? "green.500"
                      : "red.500"
                  }
                />
                {message}
              </Alert>
            ))}
          </Box>
        )}
      </Box>
    );
  };

  return (
    <Flex direction="column">
      {moves.length > 0 && movesBar}
      <Flex justifyContent="center" mb={4}>
        <Box>
          <Player game={game} leftOrRight={true} />
        </Box>
        <Box>
          <ControlBar />
        </Box>
        <Box>
          <Player game={game} leftOrRight={false} />
        </Box>
      </Flex>
    </Flex>
  );
}

export { Play, Game };
