import { DiceProvider } from "./components/DiceProvider";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DiceProvider><App /></DiceProvider>
  </StrictMode>,
);
