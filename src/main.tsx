import { DiceProvider } from "./components/DiceProvider";
import { ToastProvider } from "./components/Toasts";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "@fontsource/cinzel/600.css";
import "@fontsource/cinzel/700.css";
import "@fontsource-variable/inter";
import "./theme.css";
import "./app.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ToastProvider><DiceProvider><App /></DiceProvider></ToastProvider>
  </StrictMode>,
);
