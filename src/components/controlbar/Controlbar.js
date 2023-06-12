import React from "react";
import { Flex, IconButton } from "@chakra-ui/react";
import { FaBars } from "react-icons/fa";
import AppContext from "../context";

class Controlbar extends React.Component {
  handleToggle = () => {
    const { toggleSidebar } = this.context;
    toggleSidebar();
  };

  render() {
    return (
      <AppContext.Consumer>
        {({ sidebarOpened }) => (
          <Flex
            className={`controlbar ${sidebarOpened ? " open" : ""}`}
            as="header"
            align="center"
            justify="space-between"
            wrap="wrap"
            padding="1.5rem"
            bg="gray.500"
            color="white"
          >
            <IconButton
              colorScheme="blue"
              icon={<FaBars />}
              onClick={this.handleToggle}
              aria-label={sidebarOpened ? "Close Sidebar" : "Open Sidebar"}
              ml="auto"
            />
          </Flex>
        )}
      </AppContext.Consumer>
    );
  }
}

Controlbar.contextType = AppContext;
export default Controlbar;
