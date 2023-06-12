import React, { createContext, useState } from "react";
import {
  createGame,
  joinGame,
  launchTorpedo,
  confirmLegitWin,
  closeGame,
  quitGame,
  sendFunds,
} from "../contract/battleshipController";
import {
  web3,
  contractInstance,
  contractAddress,
  contractABI,
  account1SK,
} from "../contract/configFile";

const AppContext = createContext();

const AppContextProvider = ({ children }) => {
  const [sidebarOpened, setSidebarOpened] = useState(false);

  const toggleSidebar = () => {
    setSidebarOpened(!sidebarOpened);
  };

  //The context create or load a new identity
  const storedPublicKey = localStorage.getItem("publicKey");
  const storedprivateKey = localStorage.getItem("privateKey");

  let publicKey = null;
  let privateKey = null;
  if (!storedPublicKey || !storedprivateKey) {
    const newAccount = web3.eth.accounts.create();
    publicKey = newAccount.address;
    privateKey = newAccount.privateKey;
    localStorage.setItem("publicKey", newAccount.address);
    localStorage.setItem("privateKey", newAccount.privateKey);
    sendFunds(account1SK, publicKey, web3.utils.toWei("20", "ether"));
    
  } else {
    publicKey = storedPublicKey;
    privateKey = storedprivateKey;
  }
  web3.eth.accounts.wallet.add(privateKey);

  //Specialized functions (for this front-end)

  const userFunctions = {
    sendFunds,
  };

  const contractFunctions = {
    createGame,
    joinGame,
    launchTorpedo,
    confirmLegitWin,
    closeGame,
    quitGame,
  };

  return (
    <AppContext.Provider
      value={{
        sidebarOpened,
        toggleSidebar,
        publicKey,
        privateKey,
        contractAddress,
        contractInstance,
        contractFunctions,
        userFunctions,
        web3,
        contractABI,
        account1SK,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export { AppContext, AppContextProvider };
export default AppContext;
