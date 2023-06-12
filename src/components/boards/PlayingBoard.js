import React, { useState, useEffect } from "react";
import { Box, Grid } from "@chakra-ui/react";

import HitIcon from "../../icons/fire.png";
import MissIcon from "../../icons/sea.png";

const PlayableBoard = ({ board, canBeTorpedoed, handleOpponentBoardClick, isInTurn }) => {
  const [currentBoard, setCurrentBoard] = useState([...board]);

  const handleCellClick = (index) => {
    if (canBeTorpedoed || board[index] !== "sea" || !isInTurn) return;
    handleOpponentBoardClick(index);
  };

  useEffect(() => {
    setCurrentBoard([...board]);
  }, [board]);

  const shipColors = [
    "#2b2d42",
    "#708d81",
    "#FDF0D5",
    "#003049",
    "#669BBC",
    "#f77f00",
  ];

  const getShipColor = (shipIndex) => {
    const color = shipColors[shipIndex % shipColors.length];
    const lighterColor = color + "33"; // Add transparency to the color (e.g., 33 for 20% transparency)
    return lighterColor;
  };

  return (
    <Box width="400px" borderWidth="1px" borderRadius="md" p={4}>
      <Grid
        templateRows="repeat(8, 1fr)"
        templateColumns="repeat(8, 1fr)"
        gap={1}
      >
        {currentBoard.map((cell, index) => {
          const cellColor =
            cell.startsWith("ship") && getShipColor(parseInt(cell.slice(4)));

          return (
            <Box
              key={index}
              width="40px"
              height="40px"
              bg={
                cell === "hit"
                  ? "red.500"
                  : cell === "miss"
                  ? "gray.500"
                  : cellColor || "gray.200"
              }
              cursor={!canBeTorpedoed && cell === "sea" && isInTurn ? "pointer" : "default"}
              onClick={() => handleCellClick(index)}
              display="flex"
              alignItems="center"
              justifyContent="center"
            >
              {cell === "hit" && (
                <img
                  src={HitIcon}
                  alt="hit icon :)"
                  style={{
                    width: "70%",
                    height: "70%",
                    objectFit: "contain",
                  }}
                />
              )}
              {cell === "miss" && (
                <img
                  src={MissIcon}
                  alt="miss icon :("
                  style={{
                    width: "70%",
                    height: "70%",
                    objectFit: "contain",
                  }}
                />
              )}
            </Box>
          );
        })}
      </Grid>
    </Box>
  );
};

export default PlayableBoard;
