import { ColorModeScript } from "@chakra-ui/react";
import React from "react";
import * as ReactDOM from "react-dom/client";
import App from "./App";
import reportWebVitals from "./reportWebVitals";
import * as serviceWorker from "./serviceWorker";

const container = document.getElementById("root");
const root = ReactDOM.createRoot(container);

root.render(
  <div>
    <ColorModeScript />
    <App>
    </App>
  </div>
);

serviceWorker.unregister();
reportWebVitals();
