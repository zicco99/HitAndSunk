import React, { useState} from "react";
import {
  Box,
  Grid,
  VStack,
  Button,
  HStack,
  Text,
  Input,
  Flex,
  InputRightElement,
  InputGroup,
} from "@chakra-ui/react";

import { useDrag, useDrop } from "react-dnd";
import { FaEthereum } from "react-icons/fa";

const DeployingBoard = ({
  isNew,
  game,
  handleCreateGame,
  handleJoinGame,
  setShow,
}) => {
  //State
  const boardSize = 8;

  const initialShips = [
    { id: 1, name: "Carrier", length: 5, orientation: "horizontal" },
    { id: 2, name: "Battleship", length: 4, orientation: "horizontal" },
    { id: 3, name: "Cruiser", length: 3, orientation: "horizontal" },
    { id: 4, name: "Submarine", length: 3, orientation: "horizontal" },
    { id: 5, name: "Destroyer", length: 2, orientation: "horizontal" },
  ];
  const [shipList, setShipList] = useState(initialShips);

  const [shipPositions, setShipPositions] = useState([]); //The positions of ships
  const [betAmount, setBetAmount] = useState(0); // The bet amount

  const initialBoard = [];
  for (let row = 0; row < boardSize; row++) {
    for (let col = 0; col < boardSize; col++) {
      initialBoard.push({ row, col, occupied: 0 });
    }
  }

  const [board, setBoard] = useState(initialBoard);

  ////////////////////////////////////////////////////////////////

  //ShipBlock is a functional component that represents visually a ship
  const ShipBlock = ({ id, length, orientation }) => {
    const [{ opacity }, drag] = useDrag(() => ({
      //i 'm using the hook to give behaviour and props to the draggable object
      type: "shipBlock",
      item: { id, length, orientation },
      collect: (monitor) => ({
        opacity: monitor.isDragging() ? 0.5 : 1, //if is currenty dragging the opacity is 0.5
      }),
    }));

    return (
      <Box
        ref={drag} //Assigns the drag ref obtained from the useDrag hook to the Box component, enabling it to be draggable.
        w={orientation === "vertical" ? "40px" : `${length * 40}px`}
        h={orientation === "vertical" ? `${length * 40}px` : "40px"}
        bg="green.500"
        opacity={opacity}
        cursor="move"
        borderRadius="md"
      />
    );
  };

  const handleShipFlip = (shipId) => {
    //Function call at flip button click
    const updatedShipList = shipList.map((ship) => {
      if (ship.id === shipId) {
        return {
          ...ship,
          orientation:
            ship.orientation === "vertical" ? "horizontal" : "vertical",
        };
      }
      return ship;
    });
    setShipList(updatedShipList);
  };

  const ShipList = () => {
    // A visual representation of the ship list
    return (
      <VStack alignItems="flex-start" spacing={2}>
        {shipList.map((ship) => (
          <HStack key={ship.id}>
            <ShipBlock
              id={ship.id}
              length={ship.length}
              orientation={ship.orientation}
            />
            <Text>{ship.name}</Text>
            <Button onClick={() => handleShipFlip(ship.id)} size="sm">
              Flip
            </Button>
          </HStack>
        ))}
      </VStack>
    );
  };

  ////////////////////////////////////////////////////////////////

  // A functional component in which drop ShipBlocks
  const DropTarget = ({ row, col }) => {
    const [{ canDrop, isOver }, drop] = useDrop(() => ({
      // Inside the DropTarget component, the useDrop hook is invoked, providing the configuration
      accept: "shipBlock",
      drop: (item) => handleDrop(item, row, col), // this is the function invoked when the draggable item is dropped in it
      collect: (monitor) => ({
        canDrop: monitor.canDrop(),
        isOver: monitor.isOver(),
      }),
    }));

    const handleDrop = (item, dropRow, dropCol) => {
      //item dropped was { id, length, orientation }
      const { id, length, orientation } = item;
      const newShipPosition = {
        id,
        row: dropRow,
        col: dropCol,
        length,
        orientation,
      };

      //Some checks before adding the ship!

      //if the initial dropping point is out of the board or the body of the ship goes out -> return
      const outOfBoard =
        dropRow < 0 ||
        dropRow >= boardSize ||
        dropCol < 0 ||
        dropCol >= boardSize ||
        drop(orientation === "vertical" && dropRow + length > boardSize) ||
        (orientation === "horizontal" && dropCol + length > boardSize);
      if (outOfBoard) return;

      //Computing all the positions the ship will occupy in the case the ship is dropped
      const bodyPositions = [];
      if (orientation === "vertical") {
        for (let i = dropRow; i < dropRow + length; i++) {
          bodyPositions.push({ row: i, col: dropCol });
        }
      } else {
        for (let i = dropCol; i < dropCol + length; i++) {
          bodyPositions.push({ row: dropRow, col: i });
        }
      }

      const hasOverlap = shipPositions.some((positionedShip) => {
        return bodyPositions.some((body) => {
          return (
            positionedShip.id !== id && //Consider other already positioned ships
            //has overlaps if they start from the same cell
            ((positionedShip.row === body.row &&
              positionedShip.col === body.col) ||
              //the positionedShip is vertical and they are in the same column the dropping ship initial row should not belong to [ positionedShip row, positionedShip row + positionedShip row]
              //obviously the cells between the extremes are occupied, as the ship is contigous
              (positionedShip.orientation === "vertical" &&
                positionedShip.col === body.col &&
                positionedShip.row <= body.row &&
                body.row <= positionedShip.row + positionedShip.length - 1) ||
              //specular reasoning if the positionedShip is horizontal
              (positionedShip.orientation === "horizontal" &&
                positionedShip.col <= body.col &&
                body.col <= positionedShip.col + positionedShip.length - 1 &&
                positionedShip.row === body.row))
          );
        });
      });

      if (hasOverlap) return;

      //add new ship to ships positions
      const updatedPositions = [...shipPositions, newShipPosition];
      setShipPositions(updatedPositions);

      //Update the board
      const updatedBoard = board.map((cell) => {
        if (
          (cell.row === dropRow && cell.col === dropCol) ||
          (orientation === "vertical" &&
            cell.row >= dropRow &&
            cell.row < dropRow + length &&
            cell.col === dropCol) ||
          (orientation === "horizontal" &&
            cell.col >= dropCol &&
            cell.col < dropCol + length &&
            cell.row === dropRow)
        ) {
          return { ...cell, occupied: 1 };
        }
        return cell;
      });

      //Update the board
      setBoard(updatedBoard);

      //Remove the ship dropped from the shipList
      const updatedShipList = shipList.filter((ship) => ship.id !== id);
      setShipList(updatedShipList);
    };

    return (
      <Box
        ref={drop}
        w="40px"
        h="40px"
        bg={
          board[row * boardSize + col].occupied === 1
            ? "blue.500"
            : canDrop
            ? isOver
              ? "yellow.300"
              : "green.200"
            : "gray.200"
        }
        cursor={canDrop ? "pointer" : "default"}
      />
    );
  };

  const handleBetChange = (event) => {
    setBetAmount(event.target.value);
  };

  const createGame = async () => {
    //The function will call the hook handleCreateGame
    //Obtain the board
    const challengerBoard = board.map((cell) => cell.occupied);

    //Obtain the shipPosition string
    const challengerShipsPosition = shipPositions
      .map((position) => {
        const { orientation, row, col, length } = position;
        if (orientation === "horizontal") return `H${row}${col}${length}`;
        else return `V${col}${row}${length}`;
      })
      .join("");

    handleCreateGame(challengerBoard, challengerShipsPosition, betAmount);

    // Reset the state
    setShipList(initialShips);
    setShipPositions([]);
    setBetAmount(0);
    setBoard(initialBoard);

    //Close board
    setShow(false);
  };

  const joinGame = async () => {
    //The function will call the hook handleJoinGame
    try {
      //Obtain the board
      const challengerBoard = board.map((cell) => cell.occupied);

      //Obtain the shipPosition string
      const challengerShipsPosition = shipPositions
        .map((position) => {
          const { orientation, row, col, length } = position;
          if (orientation === "horizontal") return `H${row}${col}${length}`;
          else return `V${col}${row}${length}`;
        })
        .join("");

      handleJoinGame(
        game.gameId,
        challengerBoard,
        challengerShipsPosition,
        game.betAmount
      );

      // Reset the state
      setShipList(initialShips);
      setShipPositions([]);
      setBoard(initialBoard);

      //Close board
      setShow(false);
    } catch (error) {
      console.log(error);
    }
  };

  return (
    <Grid
      templateColumns={
        shipList.length ? `repeat(2, 1fr)` : `repeat(${boardSize}, 1fr)`
      }
      gap={1}
    >
      {shipList.length > 0 && (
        <Box>
          <ShipList />
        </Box>
      )}
      <Grid templateColumns={`repeat(${boardSize}, 1fr)`} gap={1}>
        {board.map((cell) => (
          <DropTarget
            key={`${cell.row}-${cell.col}`}
            row={cell.row}
            col={cell.col}
          />
        ))}
      </Grid>
      {!shipList.length &&
        isNew && ( // It the ships have been positioned and the user is creating a new game
          <Box
            p={4}
            borderWidth="1px"
            borderRadius="md"
            boxShadow="md"
            bg="blue.500"
          >
            <Text fontWeight="bold">Choose Bet Amount</Text>
            <InputGroup>
              <Input
                type="number"
                placeholder={0.1}
                min={0.1}
                step={0.1}
                value={betAmount}
                onChange={handleBetChange}
                mb={4}
              />
              <InputRightElement>
                <Flex align="center">
                  <FaEthereum />
                </Flex>
              </InputRightElement>
            </InputGroup>
            <Button onClick={createGame} isDisabled={betAmount < 0.1}>
              Create Game
            </Button>
          </Box>
        )}
      {!shipList.length && !isNew && ( // It the ships have been positioned and the user is joining a game
          <Box
            p={4}
            borderWidth="1px"
            borderRadius="md"
            boxShadow="md"
            bg="blue.500"
          >
            <Button colorScheme="blue" onClick={joinGame}> 
              Join Game
            </Button>
          </Box>
        )}
    </Grid>
  );
};

export default DeployingBoard;
