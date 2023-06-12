import React, { Component } from "react";
import { Box, Flex, Text, Avatar, Icon } from "@chakra-ui/react";
import { FaEthereum } from "react-icons/fa";
import "./Sidebar.css";
import AppContext from "../context";

class Sidebar extends Component {
  constructor(props) {
    super(props);
    const pathParts = window.location.pathname.split("/");
    this.state = {
      activeButton: pathParts[1],
      balance: null,
      publicKey: "",
      gameID: "",
    };
  }

  componentDidMount() {
    const { web3, publicKey } = this.context; 

    // Get the user's balance in wei
    web3.eth.getBalance(publicKey, (error, balanceWei) => {
      if (error) {
        console.error("Error:", error);
      } else {
        // Convert the balance from wei to Ether
        const balance = web3.utils.fromWei(balanceWei, "ether");
        this.setState({ balance, publicKey }); // Update the state with the balance
      }
    });
  }

  handleButtonClick = (buttonName) => {
    this.setState({ activeButton: buttonName });
  };

  handleInputChange = (event) => {
    this.setState({ gameID: event.target.value });
  };

  render() {
    const { balance, publicKey } = this.state;

    return (
      <AppContext.Consumer>
        {({ sidebarOpened }) => (
          <Flex className={`sidebar_wrapper${sidebarOpened ? " open" : ""}`}>
            <Box className="sidebar" bg="blue.800">

              <Box display="flex" alignItems="center" mb="4">
                <Avatar size="md" src={"https://i.redd.it/nhre2ney3z211.jpg"} />
                <Box ml="3">
                  <Text fontWeight="bold" fontSize="9px">
                    {publicKey}
                  </Text>
                  <Text fontSize="sm" color="yellow.500">
                    Online
                  </Text>
                </Box>
              </Box>

              {balance && (
                <Box
                  bg="blue.200"
                  p="3"
                  mb="4"
                  display="flex"
                  alignItems="center"
                >
                  <Icon as={FaEthereum} boxSize={5} color="white" mr="2" />
                  <Text color="white" fontWeight="bold">
                    {balance}
                  </Text>
                </Box>
              )}
            </Box>
          </Flex>
        )}
      </AppContext.Consumer>
    );
  }
}

Sidebar.contextType = AppContext;

export default Sidebar;
