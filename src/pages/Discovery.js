import React, { useContext, useEffect, useState } from "react";
import { AppContext } from "../components/context";
import { Button, Alert, AlertIcon } from "@chakra-ui/react";
import { FaPlus } from "react-icons/fa";
import DeployingBoard from "../components/boards/DeployingBoard";
import { Game } from "./Play";

const Discovery = () => {
  const { contractInstance } = useContext(AppContext);
  const [games, setGames] = useState([]); //The list of games
  const [selectedGameId, setSelectedGameId] = useState(null);
  const [showDeployingBoard, setShowDeployingBoard] = useState(false);
  const [message, setMessage] = useState(null); //Needed to show thew Alert
  const { MerkleTree } = require("merkletreejs");

  const { contractFunctions, privateKey, publicKey, web3 } =
    useContext(AppContext);

  useEffect(() => {
    loadGames();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadGames = async () => {
    try {
      var gameCreatedEvents = await contractInstance.getPastEvents(
        "GameCreated",
        {
          fromBlock: 0,
          toBlock: "latest",
        }
      );

      var gameJoinedEvents = await contractInstance.getPastEvents(
        "GameJoined",
        {
          fromBlock: 0,
          toBlock: "latest",
        }
      );

      // Filter out events where `challenger` is equal to `publicKey`
      gameCreatedEvents = gameCreatedEvents.filter(
        (event) => event.returnValues.challenger !== publicKey
      );

      gameJoinedEvents = gameJoinedEvents.filter(
        (event) => event.returnValues.challenger !== publicKey
      );

      // Create a map that contains the ids of the already joined games
      const joinedGames = new Map();
      gameJoinedEvents.forEach((event) => {
        const gameId = event.returnValues.gameId;
        joinedGames.set(gameId, true);
      });

      // Now we can filter open games
      const openGamesEvents = gameCreatedEvents.filter((event) => {
        const gameId = event.returnValues.gameId;
        return !joinedGames.has(gameId);
      });

      //Extract games fron the events
      const games = openGamesEvents.map((event) => {
        const gameId = event.returnValues.gameId;
        const challenger = event.returnValues.challenger;
        const betAmount = event.returnValues.betAmount;
        return { gameId, challenger, betAmount };
      });

      setGames(games);

      // Subscribe to GameCreated events (if a GameCreated event happens -> add the game)
      contractInstance.events.GameCreated({}, (error, event) => {
        if (error) {
          console.error("Error subscribing to GameCreated event:", error);
        } else {
          const challenger = event.returnValues.challenger;
          if (challenger !== publicKey) {
            const gameId = event.returnValues.gameId;
            const betAmount = event.returnValues.betAmount;
            const newGame = { gameId, challenger, betAmount };
            setGames((prevGames) => [...prevGames, newGame]);
          }
        }
      });

      // Subscribe to GameJoined events (if a GameJoined event happens -> remove the game)
      contractInstance.events.GameJoined({}, (error, event) => {
        if (error) {
          console.error("Error subscribing to GameJoined event:", error);
        } else {
          const gameId = event.returnValues.gameId;
          let games = localStorage.getItem("games");

          //Add opponent to the game saved in localStorage game
          if (games) {
            games = JSON.parse(games);
            var toUpdateGameIndex = games.findIndex(
              (game) => game.gameId === gameId
            );

            if (toUpdateGameIndex !== -1) {
              games[toUpdateGameIndex].opponent = event.returnValues.opponent;
              localStorage.setItem("games", JSON.stringify(games));
            }
          }

          //Remove from game list
          setGames((prevGames) =>
            prevGames.filter((game) => game.gameId !== gameId)
          );
        }
      });
    } catch (error) {
      setMessage(error.message);
    }
  };

  // Logic
  const handleCreateGame = async (
    challengerBoard,
    challengerShipsPosition,
    betAmount
  ) => {
    try {
      // --- Board mask seeds
      let boardSeeds = [];
      for (let i = 0; i < 64; i++) {
        const seed = Math.floor(Math.random() * 255); // random numbers from 0 to 254
        boardSeeds.push(seed);
      }

      //--- ShipPosition seed
      const characters =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
      let shipsPositionsSeed = "";
      for (let i = 0; i < 32; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        shipsPositionsSeed += characters.charAt(randomIndex);
      }

      //Concatenate the seed to shipsPositions and hash
      let challengerShipsPositionHashed = web3.utils.keccak256(
        web3.utils.encodePacked(String(challengerShipsPosition), String(shipsPositionsSeed))
      );

      console.log(challengerShipsPositionHashed);

      let challengerSeededBoard = challengerBoard.map(
        (elem, index) => elem + boardSeeds[index]
      );

      let challengerHashedBoard = challengerSeededBoard.map((seeded_elem) =>
        web3.utils.keccak256(web3.utils.encodePacked(seeded_elem))
      );

      // Compute the Merkle Tree using the hashed leaves
      let challengerMerkleTree = new MerkleTree(
        challengerHashedBoard,
        web3.utils.keccak256,
        {
          sortLeaves: true,
          sortPairs: true,
        }
      );

      //Call the contract
      let result = await contractFunctions.createGame(
        privateKey,
        web3.utils.toWei(betAmount, "ether"),
        challengerMerkleTree.getHexRoot(),
        challengerShipsPositionHashed
      );

      //The game has been created, save in localStorage all infos
      let gameInfo = new Game({
        gameId: result.events.GameCreated.returnValues.gameId,
        challenger: result.events.GameCreated.returnValues.challenger,
        betAmount: betAmount,
        board: challengerBoard,
        boardSeeds: boardSeeds,
        shipsPositions: challengerShipsPosition,
        shipsPositionsSeed: shipsPositionsSeed,
        hashedBoard: challengerHashedBoard, //MerkleTree leaves
        merkleTree: challengerMerkleTree,
      });

      let localGames = localStorage.getItem("games");
      if (!localGames) {
        localGames = [gameInfo];
      } else {
        localGames = JSON.parse(localGames);

        // Check if the game already exists
        let existingGameIndex = localGames.findIndex(
          (localGames) => localGames.gameId === gameInfo.gameId
        );
        if (existingGameIndex !== -1) {
          // Remove the existing game
          localGames.splice(existingGameIndex, 1);
        }

        localGames.push(gameInfo);
      }

      localStorage.setItem("games", JSON.stringify(localGames));

      setMessage("Game Created");
    } catch (error) {
      setMessage("Error :" + error.message);
    }
    // Remove message after 5 seconds
    setTimeout(() => {
      setMessage(null);
    }, 5000);
  };

  const handleJoinGame = async (
    gameId,
    opponentBoard,
    opponentShipsPosition,
    betAmount
  ) => {
    try {
      // --- Board mask seeds
      let boardSeeds = [];
      for (let i = 0; i < 64; i++) {
        const seed = Math.floor(Math.random() * 255); // random numbers from 0 to 254
        boardSeeds.push(seed);
      }

      //--- ShipPosition seed
      const characters =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
      let shipsPositionsSeed = "";
      for (let i = 0; i < 32; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        shipsPositionsSeed += characters.charAt(randomIndex);
      }

      //Concatenate the seed to shipsPositions and hash
      let opponentShipsPositionHashed = web3.utils.keccak256(
        web3.utils.encodePacked(opponentShipsPosition,shipsPositionsSeed)
      );

      console.log(opponentShipsPositionHashed);

      let opponentSeededBoard = opponentBoard.map(
        (elem, index) => elem + boardSeeds[index]
      );

      let opponentHashedBoard = opponentSeededBoard.map((seeded_elem) =>
        web3.utils.keccak256(web3.utils.encodePacked(seeded_elem))
      );

      // Compute the Merkle Tree using the hashed leaves
      let opponentMerkleTree = new MerkleTree(
        opponentHashedBoard,
        web3.utils.keccak256,
        {
          sortLeaves: true,
          sortPairs: true,
        }
      );

      //Send transaction
      let result = await contractFunctions.joinGame(
        privateKey,
        betAmount,
        gameId,
        opponentMerkleTree.getHexRoot(),
        opponentShipsPositionHashed
      );

      //The game has been joined, save in localStorage all infos
      let gameInfo = new Game({
        gameId: gameId,
        challenger: result.events.GameJoined.returnValues.challenger,
        opponent: result.events.GameJoined.returnValues.opponent,
        betAmount: betAmount,
        board: opponentBoard,
        boardSeeds: boardSeeds,
        shipsPositions: opponentShipsPosition,
        shipsPositionsSeed: shipsPositionsSeed,
        hashedBoard: opponentHashedBoard, //MerkleTree leaves
        merkleTree: opponentMerkleTree,
      });

      let games = localStorage.getItem("games");
      if (!games) {
        games = [gameInfo];
        localStorage.setItem("games", JSON.stringify(games));
      } else {
        games = JSON.parse(games);
        games = [...games, gameInfo];
        localStorage.setItem("games", JSON.stringify(games));
      }

      setMessage("Game Joined ...redirecting");
      setTimeout(() => {
        setMessage(null);
      }, 2000);
      //window.location.href = "/play/"+ gameId;
    } catch (error) {
      setMessage("Error :" + error.message);
    }
    // Remove message after 5 seconds
    setTimeout(() => {
      setMessage(null);
    }, 5000);
  };

  const handleJoinButton = (game) => {
    setSelectedGameId(game.gameId);
  };

  return (
    <div>
      {message && (
        <Alert status={message.includes("Error") ? "error" : "success"} mb={4}>
          <AlertIcon
            color={message.includes("Error") ? "red.500" : "green.500"}
          />
          {message}
        </Alert>
      )}

      <div
        style={{ minHeight: "100vh", padding: "20px", boxSizing: "border-box" }}
      >
        {games.map((game, index) => (
          <div
            style={{
              backgroundColor: "#274C77",
              borderRadius: "8px",
              boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
              padding: "20px",
              margin: "10px",
              width: "100%",
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              alignItems: "center",
              gap: "40px",
            }}
            key={index}
          >
            <div>
              <h3
                style={{
                  fontSize: "25px",
                  fontWeight: "bold",
                  marginBottom: "5px",
                }}
              >
                Game [ID: {game.gameId}]
              </h3>
              <h3
                style={{
                  fontSize: "10px",
                  fontWeight: "bold",
                  marginBottom: "5px",
                }}
              >
                Challenger: {game.challenger}
              </h3>
              <div
                className="player-details"
                style={{ fontSize: "10px", lineHeight: "1.4" }}
              >
                <p>
                  Bet Amount:{" "}
                  {(game.betAmount * Math.pow(10, -18)).toFixed(2) + ""}
                </p>
              </div>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <h2
                style={{
                  fontSize: "24px",
                  fontWeight: "bold",
                  margin: "0 20px",
                }}
              >
                VS
              </h2>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                alignItems: "center",
              }}
            >
              {selectedGameId === game.gameId ? (
                <DeployingBoard
                  isNew={false}
                  game={game}
                  handleCreateGame={handleCreateGame}
                  handleJoinGame={handleJoinGame}
                  setShow={setShowDeployingBoard}
                />
              ) : (
                <Button onClick={() => handleJoinButton(game)}>Join</Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {showDeployingBoard && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            zIndex: 9999,
          }}
        >
          <div
            style={{
              backgroundColor: "blue.500",
              borderRadius: "8px",
              padding: "20px",
              minWidth: "300px",
              maxWidth: "80%",
            }}
          >
            <DeployingBoard
              isNew={true}
              handleCreateGame={handleCreateGame}
              handleJoinGame={handleJoinGame}
              setShow={setShowDeployingBoard}
            />
          </div>
        </div>
      )}

      <div
        style={{
          position: "fixed",
          bottom: "30px",
          right: "30px",
          zIndex: 9999,
        }}
      >
        <Button
          onClick={() => {
            setSelectedGameId(null);
            setShowDeployingBoard(true);
          }}
        >
          <FaPlus />
        </Button>
      </div>
    </div>
  );
};

export default Discovery;
