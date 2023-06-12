// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

contract Battleship {
    using SafeMath for uint8;
    using SafeMath for uint256;

    // Config //

    uint8 constant GRID_DIM = 8; //Board dimension
    uint constant MIN_BET = 0.01 ether; 
    uint256 constant INACTIVITY_TIME_GAP = 3; // Blocks gap (IT'S FOR TESTING, CHANGE THE VALUE TO 40 (≈10 min))

    //(Dimention) -> (Number of ships allowed with that dimention)
    mapping (uint8 => uint8) shipsDimensions;
    // Sum of all ship lengths
    uint8 defaultHitboxes;
    // Number of ships
    uint8 shipsNum;

    constructor(){
        shipsDimensions[2] = 1; // Destroyer
        shipsDimensions[3] = 2; // Submarine / Cruiser
        shipsDimensions[4] = 1; // Battleship
        shipsDimensions[5] = 1; // Carrier

        for (uint8 i = 2; i <= 5; i++) {
            if (shipsDimensions[i] > 0) {
                defaultHitboxes += shipsDimensions[i]*i; 
                shipsNum += shipsDimensions[i];
            }
        }

        defaultHitboxes = 17;
    }

    // Data structures //

    enum GameStatus {
        OPEN,
        READY,
        STARTED,
        FINISHED,
        PAID
    }

    struct Move {
        address player;
        uint8 row;
        uint8 column;
        uint8 result;
    }

    struct Player {
        address addr;
        bytes32 merkleRoot;
        uint8 remHitboxes;
        bytes32 shipsPositionsHash; // Keccak256 (string representing concatened tuples 
                                     // < direction("H/V"), occupied row/column, starting column/row, shiplenght) >
                                     // concat a random seed in the end)
    }

    struct Game {
        uint256 gameId;
        GameStatus status;
        address challenger;
        address opponent;
        address winner;
        address inTurn;
        mapping(address => Player) players;
        Move[] movesHistory;
        uint256 lastMoveBlockNumber;
        uint256 rewardAmount;
    }

    mapping(uint256 => Game) games;
    mapping(address => uint[]) private playerGames;
    uint256 gamesCount;


    // Modifiers //

    modifier canJoin(uint gameId) {
        Game storage game = games[gameId];
        require(game.challenger != msg.sender,"You are already the challenger");
        require(game.status == GameStatus.OPEN, "Game is not open");
        require(msg.value == game.rewardAmount, "Invalid bet amount");
        _;
    }

    modifier canMove(uint gameId) {
        Game storage game = games[gameId];
        require(game.status == GameStatus.READY || game.status == GameStatus.STARTED,"Game has already finished");
        require(msg.sender == game.inTurn, "It's not your turn");
        require(game.movesHistory.length == 0 || block.number <= game.lastMoveBlockNumber.add(INACTIVITY_TIME_GAP),"You can't move, the abandon timer expired");
        _;
    }

    modifier canConfirm(uint gameId, uint8[] memory board, uint8[] memory boardSeeds, string memory shipsPositions, string memory shipsPositionSeed) {
        Game storage game = games[gameId];
        require(game.status == GameStatus.FINISHED, "Game is not finished or it's already paid");
        require(game.winner == msg.sender, "Only the winner can call this function");
        require(board.length == (GRID_DIM*GRID_DIM) && boardSeeds.length == board.length ,"Board and Seeds arrays must have the same length (64)");
        require(bytes(shipsPositions).length == shipsNum * 4,"The ship position coded string should be number of ships * 4 chars length");

        //Check board and boardseeds structure
        for (uint8 i = 0; i < board.length; i++) {
            require((board[i]==0 || board[i]==1) && boardSeeds[i] < 255,"Board or Seeds are not valid");
        }
        _;
    }

    modifier isValidMove(uint gameId, uint8 nextRow, uint8 nextColumn) {
        require(nextRow < GRID_DIM, "Invalid row");
        require(nextColumn < GRID_DIM, "Invalid column");

        //Check if the move has not been already done
        Game storage game = games[gameId];
        for (uint i = 0; i < game.movesHistory.length; i++) {
            Move memory move = game.movesHistory[i];
            if(move.player == ((msg.sender == game.challenger) ? game.challenger : game.opponent))
            require(!(move.row == nextRow && move.column == nextColumn),"Move already made");
        }
        _;
    }

    // Events //

    event GameCreated(
        uint indexed gameId,
        address indexed challenger,
        uint betAmount
    );

    event GameJoined(
        uint indexed gameId,
        address indexed challenger,
        address indexed opponent,
        uint betAmount
    );

    event TorpedoLaunched(
        uint indexed gameId,
        address indexed attacker,
        address indexed defender,
        uint8 row,
        uint8 column,
        uint256 nMove
    );

    event TorpedoResult(
        uint indexed gameId,
        address indexed attacker,
        address indexed defender,
        uint8 row,
        uint8 column,
        uint256 nMove,
        uint8 result
    );

    event GameFinished(
        uint indexed gameId,
        address indexed winner,
        address indexed loser,
        string winning_cond
    );

    event GamePaid(
        uint indexed gameId,
        address indexed receiver,
        string cond,
        uint256 amount
    );

    // Core Logic //

    function createGame(bytes32 merkleRoot, bytes32 shipsPositionsHash) external payable {
        require(msg.value >= MIN_BET, "Insufficient bet amount");

        Game storage game = games[gamesCount];
        game.gameId = gamesCount;
        game.challenger = msg.sender;

        //Initialize the challenger
        Player memory challenger;
        challenger.addr = msg.sender;
        challenger.merkleRoot = merkleRoot;
        challenger.remHitboxes = defaultHitboxes;
        challenger.shipsPositionsHash = shipsPositionsHash;
        game.players[game.challenger] = challenger;

        game.rewardAmount = msg.value;
        game.status = GameStatus.OPEN;
        game.inTurn = msg.sender;

        playerGames[msg.sender].push(gamesCount);
        
        require(gamesCount < type(uint256).max, "Maximum number of games reached.");
        gamesCount++;

        emit GameCreated(game.gameId, msg.sender, msg.value);
    }

    //If the game still not joined -> the challenger can close the game and get its money back.
    function closeGame(uint gameId) public {
        Game storage game = games[gameId];
        require(msg.sender == game.challenger, "Only the challenger can close the game");
        require(game.status == GameStatus.OPEN, "The game is already started");
        require(address(this).balance.sub(game.rewardAmount) >= 0,"Insufficient contract balance");

        game.status = GameStatus.FINISHED;
        game.winner = address(0x0);
        emit GameFinished(game.gameId, address(0x0), address(0x0), "GAME_CLOSED");
        payReward(game.gameId,  game.challenger, address(0x0), "CHALLENGER_REFUND", game.rewardAmount, 0);
    }

    
    function joinGame(uint gameId, bytes32 merkleRoot, bytes32 shipsPositionsHash) external payable canJoin(gameId) {
        Game storage game = games[gameId];
        game.opponent = msg.sender;

        //Initialize the ooponent
        Player memory opponent;
        opponent.addr = msg.sender;
        opponent.merkleRoot = merkleRoot;
        opponent.remHitboxes = defaultHitboxes;
        opponent.shipsPositionsHash = shipsPositionsHash;

        game.players[game.opponent] = opponent;

        game.inTurn = game.opponent; // The one who joins will be the first one who move
        game.lastMoveBlockNumber = block.number; // The inactivity timer starts when both join.

        game.status = GameStatus.READY;

        playerGames[msg.sender].push(game.gameId);

        emit GameJoined(gameId,game.challenger,game.opponent,game.rewardAmount);
    }

    function launchTorpedo(uint gameId, bytes32[] memory prevMoveProof, uint8 prevMoveResult, uint8 prevMoveSeed, uint8 nextRow, uint8 nextColumn) external canMove(gameId) isValidMove(gameId, nextRow, nextColumn) {
        require(prevMoveProof.length > 0, "Invalid proof");
        require(prevMoveResult == 0 || prevMoveResult == 1 , "Invalid previous move result");

        Game storage game = games[gameId];

        Player storage prevMoveDefender;
        Player storage prevMoveAttacker;

        // Asymmetric view
        if (msg.sender == game.challenger){
            prevMoveDefender = game.players[game.challenger];
            prevMoveAttacker = game.players[game.opponent];
        } else {
            prevMoveDefender = game.players[game.opponent];
            prevMoveAttacker = game.players[game.challenger];
        }

        if (game.movesHistory.length > 0) { // If it's not the first move -> use merkle proof + hit result to prove that previous move was a cheating one
            bytes32 merkleLeaf =  keccak256(abi.encodePacked(prevMoveResult.add(prevMoveSeed)));
            
            //OpenZeppelin docu : verify(bytes32[] memory proof, bytes32 root, bytes32 leaf)
            if (MerkleProof.verify(prevMoveProof,prevMoveDefender.merkleRoot,merkleLeaf)) { // The opponent did not cheat
                Move storage prevMove = game.movesHistory[game.movesHistory.length - 1];

                //If it is an hit decrement remHitBox of the defender
                if (prevMoveResult == 1) prevMoveDefender.remHitboxes-=1;

                //Add the move to the game moves history
                prevMove.result = prevMoveResult;

                emit TorpedoResult(game.gameId, prevMoveAttacker.addr, prevMoveDefender.addr,prevMove.row, prevMove.column, game.movesHistory.length - 1, prevMove.result);

                // Previous move was a lasthit -> the playing phase ends to let the winner convalidate the win
                if (prevMoveDefender.remHitboxes == 0) {
                    game.status = GameStatus.FINISHED;
                    game.winner = prevMoveAttacker.addr;
                    emit GameFinished(game.gameId, prevMoveAttacker.addr, prevMoveDefender.addr,"TO_CHECK_WIN");
                    return;
                }

            } else {// Previous move was a cheating one -> PUNISH THE ATTACKER!
                game.status = GameStatus.FINISHED;
                game.winner = prevMoveDefender.addr;
                emit GameFinished(game.gameId, prevMoveDefender.addr, prevMoveAttacker.addr,"OPPONENT_MOVE_CHEAT");
                payReward(game.gameId,  prevMoveDefender.addr, address(0x0), "OPPONENT_CHEATED", game.rewardAmount.mul(2), 0);
            }
        }
        else{
            game.status = GameStatus.STARTED;
        }


        //previous move was valid + not a lasthit -> the game can go on
        // by this moment prevMoveDefender the attacker and viceversa.

        //so let's put the new move in the movesHistory
        Move memory m;
        m.player = prevMoveDefender.addr;
        m.row = nextRow;
        m.column = nextColumn;
        game.movesHistory.push(m);

        //lastly update turn variables to avoid reentrancy
        game.inTurn = prevMoveAttacker.addr;  // Next turn he will defend himslelf
        game.lastMoveBlockNumber = block.number; // The inactivity timer restarts at each move
        game.status = GameStatus.STARTED;

        emit TorpedoLaunched(game.gameId, prevMoveDefender.addr, prevMoveAttacker.addr, m.row, m.column, game.movesHistory.length);
    }

    // Allowing players to take action against opponent inactivity, including forfeit and quitting before the game starts
    // There are 4 possible cases to consider based on player's turn condition (inTurn / not inTurn) and game status (READY / STARTED):
    // 1. Game is ready and player is inTurn: Player wants to quit, refund both players the amount.
    // 2. Game is ready and player is not inTurn: Player wants to quit, refund both players the amount.
    // 3. Game is started and player is inTurn: Player wants to quit giving a forfeit, the opponent wins.
    // 4. Game is started and player is not inTurn: Player wants to quit due to opponent inactivity or volutary (to split the two cases check msg.block).

    function quitGame(uint gameId) public {
    Game storage game = games[gameId];

    require(msg.sender == game.challenger || msg.sender == game.opponent, "The caller is not playing this game");
    require(game.status == GameStatus.READY || game.status == GameStatus.STARTED, "The game should be ready or started");

    if (game.status == GameStatus.READY) {

        game.status = GameStatus.FINISHED;
        emit GameFinished(gameId, address(0x0), address(0x0), "PLAYER_QUIT_BEFORE_START");
        payReward(game.gameId, game.challenger, game.opponent, "TIE_GAME_NOT_STARTED", game.rewardAmount, game.rewardAmount);

    } else if (game.status == GameStatus.STARTED) {

        game.status = GameStatus.FINISHED;
        address quitter;
        address otherPlayer;

        if (msg.sender == game.challenger) {
            quitter = game.challenger;
            otherPlayer = game.opponent;
        } else {
            quitter = game.opponent;
            otherPlayer = game.challenger;
        }

        if (game.inTurn != quitter && block.number > game.lastMoveBlockNumber.add(INACTIVITY_TIME_GAP)) {
            // The msg.sender is claiming that opponent's time expired
            emit GameFinished(gameId, quitter, otherPlayer, "TIME_EXPIRED_CLAIMED");
            payReward(game.gameId, quitter, address(0x0), "OPPONENT_ABANDON", game.rewardAmount.mul(2), 0);
        } else {
            // Voluntary quit
            emit GameFinished(gameId, otherPlayer, quitter, "PLAYER_FORFEIT");
            payReward(game.gameId, otherPlayer, address(0x0), "FORFEIT_PAY", game.rewardAmount.mul(2), 0);
        }

    }
}

    function confirmLegitWin(uint gameId, uint8[] memory board, uint8[] memory boardSeeds, string memory shipsPositions, string memory shipsPositionSeed) external canConfirm(gameId, board, boardSeeds, shipsPositions, shipsPositionSeed) {

        Game storage game = games[gameId];

        // Check board root hash -> if the revealed board is the same continue
        bytes32[] memory leaves = new bytes32[](board.length);
        for (uint i = 0; i < board.length; i++) {
            uint256 leaf = board[i].add(boardSeeds[i]);
            leaves[i] = keccak256(abi.encodePacked(leaf));
        }

        bool boardNotValidCheat = _isValidBoard(board, bytes(shipsPositions)); // the initial board the winner was an invalid board

        Player memory winner;
        Player memory loser;

        if (msg.sender == game.challenger) {
            winner = game.players[game.challenger];
            loser = game.players[game.opponent];
        } else {
            winner = game.players[game.opponent];
            loser = game.players[game.challenger];
        }

        bool boardMerkleRootCheat = winner.merkleRoot != computeMerkleRoot(leaves);// the winner is giving back another board, different from the original
        bool shipPositionCheat = winner.shipsPositionsHash != keccak256(abi.encodePacked(shipsPositions, shipsPositionSeed)); // the winner is giving back another shipsposition, different from the original

        if(boardNotValidCheat || boardMerkleRootCheat || shipPositionCheat){
            string memory cond;
            if(boardMerkleRootCheat) cond = "OPPONENT_LIED_ON_BOARD";
            if(boardNotValidCheat) cond = "OPPONENT_GAVE_NOT_VALID_BOARD";
            if(shipPositionCheat) cond = "OPPONENT_LIED_ON_SHIPS";
            payReward(game.gameId, loser.addr, address(0x0), cond, game.rewardAmount.mul(2), 0);
        }else{
            payReward(game.gameId, winner.addr, address(0x0), "LEGIT_WIN", game.rewardAmount.mul(2),0);
        }
    }

   function payReward(uint gameId, address receiver1, address receiver2, string memory cond, uint256 amount1, uint256 amount2) internal {
        Game storage game = games[gameId];
        require(address(this).balance >= (game.rewardAmount.mul(2)).sub(amount1).sub(amount2), "Insufficient contract balance");

        game.rewardAmount = 0; // Set reward amount to zero before transferring to prevent reentrancy
        game.status = GameStatus.PAID;

        require(amount1 > 0, "Invalid reward amount");
        require(amount2 >= 0, "Invalid reward amount");

        payable(receiver1).transfer(amount1);
        emit GamePaid(gameId, receiver1, cond, amount1);

        if (receiver2 != address(0x0) && amount2 > 0) {
            payable(receiver2).transfer(amount2);
            emit GamePaid(gameId, receiver2, cond, amount2);
        }
   }

    /////////////// Auxiliary functions ////////////////

    //Tree is always complete (being leaves a power of 2)
    function computeMerkleRoot(bytes32[] memory leaves) public pure returns (bytes32) {
        sortLeaves(leaves);

        uint256 levelSize = leaves.length;

        while (levelSize > 1) {
            uint256 parentLevelSize = (levelSize + 1) / 2;
            bytes32[] memory parentLevel = new bytes32[](parentLevelSize);

            for (uint256 i = 0; i < levelSize; i += 2) {
                bytes32 left = leaves[i];
                bytes32 right = leaves[i + 1];

                if (left > right) {
                    bytes32 temp = left;
                    left = right;
                    right = temp;
                }

                bytes32 node = keccak256(abi.encodePacked(left, right));
                parentLevel[i / 2] = node;
            }

            leaves = parentLevel;
            levelSize = parentLevelSize;
        }

        return leaves[0];
    }

    function sortLeaves(bytes32[] memory leaves) internal pure {
        // It follows the same order of JS library (merkletreejs) -> ascendent
        // implementing bubble-sort (it sucks but its easy to implement)
        uint256 n = leaves.length;
        for (uint256 i = 0; i < n - 1; i++) {
            for (uint256 j = 0; j < n - i - 1; j++) {
                if (leaves[j] > leaves[j + 1]) {
                    bytes32 temp = leaves[j];
                    leaves[j] = leaves[j + 1];
                    leaves[j + 1] = temp;
                }
            }
        }
    }

    // Check board validity
    function _isValidBoard(uint8[] memory board, bytes memory shipsposition) internal view returns (bool) {
        uint8[6] memory currShipsDimensions; // this is used to check that ships number/lenght is correct

        // Check if the declared ships are really in the board and occupy the declared positions
        for (uint8 i = 0; i < shipsNum; i++) {
            bytes1 direction = shipsposition[i * 4];

            if (direction == "H") { // It's horizontal
                uint8 occupiedRow = uint8(shipsposition[i * 4 + 1]);
                uint8 startingColumn = uint8(shipsposition[i * 4 + 2]);
                uint8 shipLength = uint8(shipsposition[i * 4 + 3]);

                if (startingColumn + shipLength > GRID_DIM) {
                    return false; // Invalid ship position
                }

                for (uint8 j = startingColumn; j < startingColumn + shipLength; j++) {
                    if (board[occupiedRow * GRID_DIM + j] != 1) {
                        return false; // Declared ship is not in the cell
                    }
                }
                currShipsDimensions[shipLength]++;
            } else if (direction == "V") { // It's vertical
                uint8 occupiedColumn = uint8(shipsposition[i * 4 + 1]);
                uint8 startingRow = uint8(shipsposition[i * 4 + 2]);
                uint8 shipLength = uint8(shipsposition[i * 4 + 3]);

                if (startingRow + shipLength > GRID_DIM) {
                    return false; // Invalid ship position
                }

                for (uint8 j = startingRow; j < startingRow + shipLength; j++) {
                    if (board[occupiedColumn + j * GRID_DIM] != 1) {
                        return false; //Declared ship is not in the cell
                    }
                }
                currShipsDimensions[shipLength]++;
            } else {
                return false; //Invalid ship direction
            }
        }

        // Check if the number of occupied cells = lasthits => no overlap
        uint8 occupiedCount = 0;
        for (uint256 i = 0; i < board.length; i++) {
            if(board[i]==1) occupiedCount++;
        }

        if(occupiedCount != defaultHitboxes) return false;


        // Check if all ship lengths have been accounted for
        if (
            currShipsDimensions[2] != shipsDimensions[2] ||
            currShipsDimensions[3] != shipsDimensions[3] ||
            currShipsDimensions[4] != shipsDimensions[4] ||
            currShipsDimensions[5] != shipsDimensions[5]
        ) {
            return false; // Nope, punish the liar
        }

        // All conditions passed, the board is valid
        return true;
    }

}
