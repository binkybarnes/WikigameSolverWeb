import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

import { ThemeProvider } from "@/components/theme-provider";
import { GoogleOAuthProvider } from "@react-oauth/google";
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
console.log("Frontend GOOGLE_CLIENT_ID:", GOOGLE_CLIENT_ID);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <App />
      </GoogleOAuthProvider>
    </ThemeProvider>
  </StrictMode>,
);
