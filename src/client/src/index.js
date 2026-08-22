import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import configStore from "./store";
import App from "./App";
import * as serviceWorker from "./serviceWorker";
import "./index.css";

const store = configStore();

ReactDOM.createRoot(document.getElementById("root")).render(
  <Provider store={store}>
    <App />
  </Provider>
);

// Unregister any service worker left over from the Create-React-App build so
// stale cached assets cannot shadow the Vite bundle.
serviceWorker.unregister();
