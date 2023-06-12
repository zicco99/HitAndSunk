import React, { Component } from "react";
import { ChakraProvider} from "@chakra-ui/react";
import { BrowserRouter } from "react-router-dom";
import Controlbar from "./components/controlbar/Controlbar";
import Sidebar from "./components/sidebar/Sidebar";
import Discovery from "./pages/Discovery";
import { Play } from "./pages/Play";
import { extendTheme } from "@chakra-ui/react";
import { AppContextProvider } from "./components/context";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      sidebarOpened: false,
    };
  }

  render() {
    const { sidebarOpened} = this.state;
    const path = window.location.pathname;
    const parts = path.split("/"); // Split the path by "/"

    let content;
    switch (parts[1]) {
      case "play":
        const parts = path.split("/"); // Split the path by "/"
        const id = parts[2];
        content = <Play gameId={id} />;
        break;
      default:
        content = <Discovery />;
        break;
    }

    // Define your custom theme with color mode configuration
    const theme = extendTheme({
      config: {
        initialColorMode: "dark",
        useSystemColorMode: false,
      },
    });

    return (
      <DndProvider backend={HTML5Backend}>
        <ChakraProvider theme={theme}>
          <AppContextProvider
            value={{
              sidebarOpened,
              toggleSidebar: this.toggleSidebar,
            }}
          >
            <BrowserRouter>
              <Controlbar value={sidebarOpened} />
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  height: "100%",
                }}
              >
                <Sidebar value={sidebarOpened} />
                <div style={{ flexGrow: 1, padding: "20px" }}>{content}</div>
              </div>
            </BrowserRouter>
          </AppContextProvider>
        </ChakraProvider>
      </DndProvider>
    );
  }
}

export default App;
