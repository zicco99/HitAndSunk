# Hit and Sunk! (Battleship on Ethereum)
**University of Pisa - P2P Systems and Blockchains**
**Final Project - Academic year 2022/2023**

As final project a decentralized implementation of the popular board game Battleship on the Ethereum blockchain has been developed. Traditional Battleship games are typically hosted on centralized servers, which introduce a level of dependency and potential trust issues. By migrating the game to a blockchain platform, **we eliminate the need for a trusted intermediary** and enable players to engage in the game with confidence, knowing that the rules are enforced by smart contracts and the outcome is transparently recorded on the public ledger. 

# Game Overview
 The following graph shows a visual representation of the functions used by players or the game contract itself. It illustrates how actions taken by players affect the game state. Each action is represented by an arrow labeled with the first letter of the player's name (e.g., "B" for Bob). The edges without any letter instead represent state transitions performed by the game contract.

![game overview](https://i.imgur.com/cgbT6AT.jpeg)

## Deployment Phase
Let's consider a game involving two players, Alice and Bob. Alice is the challenger who initiates the game by creating it, and Bob is the opponent who joins the game.
In this phase, both players go through the following steps:

1.  **Deployment of Ships**: each player strategically deploys its ships onto the game board, considering their tactics and game strategy. The game board is represented as an NxN matrix (where N is a power of 2), where each cell represents a potential location for a ship. The players place their ships by marking the cells as either occupied [1] or empty [0], based on their desired ship placement.
    
2.  **Linearization of the Board and Seeds**: the board is then linearized into a one-dimensional array. This process converts the two-dimensional structure of the board into a linear sequence of cells, simplifying subsequent operations. Additionally, an array of the same length is generated, containing random number seeds (0-255) . These seed array will be used as an entropy mask for the next step, ensuring added security.
    
3.  **Hashing and Merkle Tree Computation**: a new array is generated by taking the summation of values at the same index from the linearized board array and the seed array. This new array is then hashed, and the resulting hash values are used as leaves to construct a Merkle Tree (by chosing N as a power of 2, the tree is complete). The Merkle tree is constructed by recursively hashing the intermediate nodes until a single root value, known as the `merkleRoot`, is obtained. Basically will serve as a cryptographic proof of the entire state of the game board, providing a means to verify the integrity of the board.
    
**"But what if one player wants to cheat on the structure of the board in some way?"**

Alice could construct the Merkle tree using an invalid board, even the empty one (filled of zeroes), where ships dimensions, counts, or directions are not valid. That's why the contract through its constructor and constants establish the rules related to ships allowed. These rules serve as a reference for players to construct their boards correctly, making also to decouple the front-end or interface used to interact with the contract. 

![coded game rules](https://imgur.com/jVCrRIR.jpeg)

Each player condense its ship placement information into a string called `shipsPosition`, which consists of concatenated substrings, each representing a tuple that describes the core info of a ship positioning: 

**<`ship orientation ("H" or "V")`,` occupied row/column`, `starting column/row`, `ship length`>** 

To enhance security, the `shipsPosition` string is further combined with an entropy mask or seed value before being hashed, resulting in the `shipsPositionHashed` value. Basically this process follow a commit-reveal approach, ensuring ensures that the original board remains hidden until it needs to be verified. By storing the commitment and later comparing it with the revealed board, the contract can verify the integrity and authenticity of the board without revealing the board prematurely.

By storing both the `merkleRoot` and `shipsPositionHashed`, the contract can validate the correctness move-by-move during the Play Phase and will be able to verify the legitimacy of the winning player's board in the Validation Phase.

Back to the game, Alice, as the challenger, choose a bet and calls the contract function **`CreateGame(betAmount, merkleRoot of her board, shipsPositionHashed of her board)`** . Bob, the opponent, can then join the game by calling the function **`JoinGame(gameId, merkleRoot of his board, shipsPositionHashed of his board)`**. Bob is required to pay the same bet amount to participate.

Once the game is created by Alice and Bob successfully joins it, the Play Phase is triggered when Bob, the opponent, launches the first torpedo.

#### — Other reachable ending states :

The **`closeGame(gameId)`** function allows the challenger to terminate the game if no other player has joined yet. This results in the withdrawal of the bet and prevents any further actions from taking place.

The **`quitGame(gameId)`** function allows one of the players to voluntarily quit the game if no moves have been made yet. In this case, it leads to a tie, and both players receive a refund of their bets. 

In the v2 Battleship, it could still be beneficial to consider additional consequences for the player who quits, such as a penalty or deduction from their bet. This penalty amount could be used to cover the game creation costs and mitigate potential frustrations for the remaining player.

## Playing Phase
![torpedoLaunch](https://imgur.com/oXKfZBi.jpeg)

During the Play Phase, players take turns making moves by calling the `launchTorpedo` function. This function takes the following parameters:

- `gameId`: The unique identifier of the game in which the move is being made.
-  `prevMoveProof`: The merkle proof of the previous move made by the opponent.
- `prevMoveResult`: The result of the previous move made by the opponent.
-  `prevMoveSeed`: The seed value used in the previous move.
-  `nextRow`: The row coordinate of the target cell for the current move.
-  `nextColumn`: The column coordinate of the target cell for the current move.

However, let's focus on describing Alice's move during this phase, as Bob's move follows a symmetrical pattern, it consists of three steps:

1.  **Verification of the previous move (if its not the first move)** : Alice submitted as parameter the result of previous opponent move, so the contract rebuilds the leaf, and uses it along with Alice's stored `merkleRoot` and the supplied `prevMoveProof` to verify the accuracy of Alice's claim. If Alice is lying, it would be able to detect the discrepancy.

2.   **Game state update (if its not the first move)** :  If the verification is successful, indicating that the previous move result is valid, the contract updates the game state accordingly and checks if it is last Alice's hitbox. If so, it emits a **`GameFinished`** event to declare the game as finished and provides the necessary information such as the winning player's address (Bob's one) and a reason code (TO_CHEC_WIN). Otherwise the contract proceeds to emit a **`TorpedoResult`**, event that provides information about Bob's previous move, enriched with the confirmed result.

3.   **Writing the next move**: the contract proceeds to write Alice's move in the game's state and emits a **`TorpedoLaunched`** event, which includes details about Alice's move. Bob will stay prepared to count the losses and counterattack as now it's his turn.

These three steps ensure that the game progresses smoothly, but notice that **a player may choose to stop playing if their next **`launchTorpedo`** would validate their opponent's winning move**, therefore a timer is implemented in the game tracking the duration since the last move and serves as an inactivity timer.

#### — Other reachable ending states :

When a player detects their opponent's inactivity, they can invoke the **`quitGame(gameId)`** function. This action allows the active player to claim victory due to their opponent's inactivity, only if the timer has expired. By doing so, the game is concluded, and the player invoking the function is declared the winner.

However, if the inactivity timer has not yet expired the function call will be considered as a voluntarily quit and the win will be awarded to the opponent.

## Validation Phase

This is the last crucial step in the game that determines the legitimacy of the win. During the Validation Phase, the winning player must execute the `confirmLegitWin` function, which performs a series of checks in order to do it.

The `confirmLegitWin` function requires the following parameters:

-   `gameId`: The unique identifier of the finished game that needs validation.
-   `board`: An array containing the revealed board, where each element represents a cell on the board.
-   `boardSeeds`: An array containing the seeds corresponding to each cell in the revealed board. These seeds are used to calculate the board root hash.
-   `shipsPositions`: A string representing the revealed ship positions on the board.
-   `shipsPositionSeed`: A string representing the seed associated with the revealed ship positions.

Here's an overview of the steps performed in the `confirmLegitWin` function:

1.  **Board Verification**: The function verifies if the ships on the `board` are placed within the game grid boundaries, occupy the specified positions without any overlap, and have correct ship dimensions. If everything meets the game rules, the board is considered valid, and the validation process continues.
    
2.  **Merkle Root Verification**: The contract recalculates the merkle root using the `board` and `boardSeeds`. If the recalculated merkle root matches the one initially submitted by the winning player, it indicates that the board is same it committed in the beginning so the validation process continues.
    
3.  **Ship Positions Verification**: The contract recalculates the hash using the `shipsPositions` and `shipsPositionSeed` and if it matches the one initially submitted by the winning player, it indicates that the ships are the same he deployed initially on the board, further validating the commit-reveal mechanism.
    

If all verification steps pass successfully, the function declares the win as legitimate, awards the win to the winning player, and updates the game status accordingly. However, if any of the verification steps fail, it indicates that the win is not legitimate. In such a case, the other player is declared as the winner.

# Battleship DAPP


![Infrastructure ](https://i.imgur.com/ydrhe89.jpg)
### Compilation Process (1-2)
To prepare the `Battleship.sol` contract for deployment and execution on Ganache blockchain emulator, the contract source code needs to be compiled into EVM bytecode. The compilation process has been performed using the Truffle development environment which includes a solidity compiler in it, `solc`, responsible for converting the contract into the EVM bytecode. The output of the compilation process is the bytecode representation of the `Battleship.sol` contract and the `Application Binary Interface (ABI)`.

### Ganache Deployment (3-4)
The `Battleship.sol` contract is then deployed using Truffle and Ganache. Truffle's deploy script creates a deployment transaction, inserting the contract bytecode into the DATA field and the transactor into the FROM's one. The transaction is then sent to Ganache RPC-JSON port and inserted into the local mempool. After being mined, Truffle extracts the new public key associated with the contract. Now we are ready to interact with it.

### ConfigFile.js
**`[battleship/src/contract/configFile.js]`**

In `ConfigFile.js`, the initial step has been to initialize the web3 provider by connecting to the local Ganache network using the WebSocket protocol. This WebSocket connection provides a full-duplex, persistent, and stateful connection between the application and Ganache, crucial to enable event subscription rather than relying on frequent polling.

Once the web3 provider is initialized, the next step is to create a contract instance. This is achieved by utilizing the `Battleship.sol`'s ABI, which contains contract's functions signature and events definition. So, along with the contract's public key, the ABI is provided to web3.js to generate the contract instance, which will act as a bridge between the JavaScript application and the deployed `Battleship.sol` contract, facilitating interaction with its functions and events.

### Battleship Controller
**`[battleship/src/contract/battleshipController.js]`**

The `Battleship Controller` plays a central role in the architecture of the Battleship, as it imports both web3 and contract instances in order to use them to define the contract interface. A key advantage of the `Battleship Controller` is its modular design, which encourages code reuse and simplifies the implementation of diverse client types. This modularity empowers the application to adapt to various user requirements and preferences with ease.

An excellent example of code reusability ,within the Battleship React application, is the mix of the React context with the `Battleship Controller` interface. This promotes code reuse let the entire app components to share the same interface.

## How to initialize the environment:
Just run the python script **`[ battleship/init_env.py ]`** and follow terminal instructions.

## Contract
**`[ battleship/src/contract/deploy/contracts/battleship.sol ]`**
The provided code presents an implementation of the Battleship game on the Ethereum blockchain using Solidity. It enables two players to create and join games, strategically position their ships on the game board, and engage in turn-based attacks. The implementation aligns with the Game Overview described earlier and is accompanied by comprehensive comments that elucidate each step of the process.

### Possible vulnerabilities and solutions
1.  **Lack of Access Control** : the issue of lack of access control has been resolved through the implementation of access control measures. Modifiers such as `canJoin`, `canMove`, and `canValidate` have been added to restrict access to function calling to specific roles but also to validate user inputs. These modifiers act as preconditions for executing certain functions, ensuring that only authorized players with the required roles can access sensitive functionality.

2.  **Reentrancy Attacks** : The reentrancy vulnerability arises when a contract allows an external contract to recursively invoke its own code. To address this vulnerability,  `a defense mechanism has been implemented using a combination of game.status and modifiers`. Prior to any modifications being made to the game data, the `game.status` value is altered, preventing the function from being called again. The modifiers effectively block reentrant calls, leveraging the change in `game.status`, thereby enhancing the overall protection.
This behavior resembles that of a lock, ensuring that recursive invocations are prevented while critical operations are underway.

4. **Integer Overflow/Underflow**: Solidity does not automatically check for integer overflows and underflows, which can lead to unexpected behavior. `The code uses the SafeMath library to prevent such issues by performing checks for arithmetic operations that depends on user-provided inputs`, ensuring that the calculations do not result in overflows or underflows.

5. **Front-running attack** a protection to front-running attack consists in linking subsequential `launchTorpedo` moves, as the validation of the previous move's first phase depends on previous one. To further enhance the security against front-running attacks, a new parameter will of `launchTorpedo`, namely the `toConfirmIndex`, will be introduced in Battleship v2. This parameter ensures that moves from the same player are confirmed in the intended order. By including `toConfirmIndex` as a parameter, the contract safeguards against potential manipulation by miners who might try to invert the order of move confirmations.

6.  **Denial of Service (DoS) Attacks** : DoS attacks aim to disrupt the normal functioning of a smart contract by consuming excessive resources or causing it to enter an infinite loop. The code does not contain any loops that can be easily exploited for DoS attacks.
    
###  Costs analysis

An analysis of the gas costs associated with the deployment and execution of contract functions was conducted, yielding the following key findings:

-  **Initial deployment**: The contract's initial deployment resulted in a gas cost of 4,853,081.
   
-  **`createGame`**: The gas cost for executing the `createGame` function was 228,176, encompassing code execution and state changes. This cost may increase as more games are added.
    
-  **`joinGame`**: Executing the `joinGame` function resulted in a gas cost of 194,919, covering code execution and associated state changes. This cost may also increase with additional games.
    
- **`launchTorpedo`**: The gas cost for the `launchTorpedo` function ranged from 109,803 to 958,198, reflecting its computational complexity and resource requirements.
    
- **`confirmWin`**: The gas cost for the `confirmWin` function was 2,710,604, accounting for execution expenses and state changes required to confirm a win.
    
Based on the provided gas costs, the total gas cost for a game would be 5,530,039 gas, calculated by summing the deployment gas cost (4,853,081) and the game gas cost (676,958).

Considering the current Ethereum Average Gas Price of 27.11 gwei as of 10/06/2023:
Cost of the deploy ≈ 0.1316 ETH
Cost of a single game ≈ 0.01834 ETH

## Testing script
**`[ battleship/src/contract/test/test.js]`**

The `test.js` script provides comprehensive testing coverage for the Battleship game implementation. It aims to test all possible scenarios, formalized by considering the game flow graph formalized above, such as:

1.  **Normal Game**: This scenario represents a typical game where both players make valid moves, targeting each other's ships. The script verifies that the game progresses correctly, updating the game state and determining the winner when appropriate.
    
2.  **Challenger closes the game**: In this scenario, the challenger closes the game before the opponent has a chance to join. The script ensures that the challenger is refunded their bet.
 
3.  **A player quits before game starts**: If a player quits before game before any moves are made, it results in a tie. The script tests this scenario and verifies that both players are refunded their bets.
    
4.  **A player finds out that the opponent cheated**: This scenario addresses a situation where the contract finds out that the player is cheating on opponent previous move result. The script determines that the cheater loses the game.
    
5.  **A player voluntary quits the game**: If a player decides to voluntarily quit the game after it has started, the opponent is declared the winner. 
    
6.  **A player claims the other player inactivity**: When a player realizes that their opponent has become inactive and the abandon timer expires, the active player can quit the game and be declared the winner. 
    
7.  **A player lied on board, boardpositions or gave invalid board**: If the player who wins the game is found to have lied about their board or ships' positions, or if the board is determined to be invalid, the other player is declared the winner.

To easily switch between different test scenarios and observe the behavior and outcome of the Battleship game contract, you can modify the `scenario` variable in line 158 with above item numbers. 

## React Dapp

This frontend app optimizes contract interactions by leveraging events for state updates and minimizing contract invocations to only writing operations. The formalization of the problem and the inclusion of necessary information within events brought several advantages:

1.  **Real-time updates**: event subscription enables the app to `receive immediate notifications when relevant events are emitted` by the smart contract. Instead of relying on manual or periodic polling, the app is notified in real-time whenever important events occur.

2.   **Efficiency**: event scanning and subscription improves efficiency and scalability by `reducing the number of transactions, optimizing gas usage, and avoiding network congestion`, resulting in a more streamlined and scalable application architecture.
    
3.  **Historical data**: events stored on the blockchain and the design of contract event structures enable the retrieval of historical information and `reconstruction of the game's data at any given point`. This feature facilitates functionalities such as auditing, verification, and data analysis, contributing to a more robust and versatile game application.
    
4.  **Decoupling frontend and backend**: by relying on events, `we can separate concerns between frontend and backend` implementation. The frontend app listens to events emitted by the smart contract, while the backend focuses on executing the game logic and emitting events accordingly.

However, there are some cons associated with this approach, many of them can be mitigated or are not significant issues due to the nature of the game's state machine design, such as:

1.  **Complexity**: implementing event scanning/subscription in a frontend app introduces complexity that needs to be carefully managed. This includes setting up event listeners, handling event filtering and processing.
    
3.  **Event Ordering [SOLVED]**:  by `implementing the battleship game as a cycle-less state machine` with clear event ordering and one-direction game phase shifts, `the challenges associated with event ordering can be overcome`. This approach ensures the accurate reconstruction of the game state, providing also a reliable and accurate representation of the game's progression.
    
4.  **Events indexed argument limitation [SOLVED]**: (from **doc. [link](https://docs.soliditylang.org/en/v0.4.21/contracts.html#events)**) The limitation of events in Solidity, where only three parameters can be marked as "indexed," can be addressed effectively. `By selectively indexing the challenger, opponent, and match ID, it is possible to overcome this limitation` and enable efficient searching and retrieval of game-related data based on these indexed fields. However, it's important to note that if the game involves more than two players, this limitation could become a potential problem.

5. **Events scanning can be resource-intensive [CAN BE SOLVED]**: Retrieving events by scanning the entire blockchain can be a resource-intensive process, requiring significant time and computational resources. It becomes more challenging as the size of the blockchain and the number of blocks to scan increases. However, in v.2 battleship `the block number will be included in the GameCreated and GameJoined to allow both clients to set a lower bound for event retrieval`.


### **Getting Started with the App**
The app follows an initialization process that involves creating a new account, funding it with Ether from a rich account, and saving the account's public and private keys in local storage. This ensures that the new account has an initial balance to participate in the game. By utilizing a rich account for funding, users can start playing without needing their own Ether from the start.

To ensure the security and isolation of each user's account, the app utilizes the browser's local storage. The publicKey and privateKey generated for the account are stored locally, preventing the sharing of this information across different users or browsers. By storing the account details in local storage, each user can have their own separate account for interacting with the game and managing their funds.

To maintain the privacy and integrity of user accounts, it is recommended to use different browsers or utilize other solutions that provide isolated local storage spaces for each user. This prevents any overlap or sharing of account information and ensures that each user's funds and interactions are kept separate and secure.

**`To create a game`**`, follow these step-by-step instructions:`

1.  **Access the App**: Open your web browser and enter the URL `http://localhost:3000/discovery` to access the app's discovery page.
    
2.  **Create a Game**: On the discovery page, locate the bottom right corner of the screen. You will find a "+" button. Click on this button to create a new game.
    
    ![Create Game](https://imgur.com/0SF45g1.jpg)
    
3.  **Position Ships**: to position your ships, use the drag and drop functionality. Select a ship and drag it to the desired location on the board.

4.  **Choose the Bet**: After positioning all the ships, you will have the option to choose a bet amount. Look for the bet selection area or input field. Enter an appropriate bet value based on the minimum bet requirement (e.g., the minimum bet is 0.1).

  
Once the game has been created, the game contract will emit a "GameCreated" event. Other clients will listen for this event and display the new challenge on their respective interfaces. However, before setting up the event listener, the page will scan the blockchain for any "GameCreated" events, this ensures that no game will be hidden from other players.

**`To join a game`**`, follow these step-by-step instructions on the other browser:`

1.  **Access the App**: Open your web browser and enter the URL `http://localhost:3000/discovery` to access the app's discovery page.
    
2.  **Join a Game**: On the discovery page, choose the game to join and click on the "Join" button to join the game.

    ![Create Game](https://i.imgur.com/CiE2U7c.jpg)
    
3.  **Position Ships**: to position your ships, use the drag and drop functionality. Select a ship and drag it to the desired location on the board.

Once both players have joined, the game starts.

**`To play`**`, follow these step-by-step instructions on the other browser:`

1.  **Access the game**: `http://localhost:3000/play/<gameId>` to access the game page.
    
2.  **PLAY**: Good luck!![Create Game](https://i.imgur.com/Ltv6kei.png)



