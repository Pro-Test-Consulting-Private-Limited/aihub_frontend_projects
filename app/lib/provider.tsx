"use client";
import { useEffect, useRef, useState } from "react";
import { MsalProvider } from "@azure/msal-react";
import { msalInstance } from "./msal";

export default function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [ready, setReady] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const init = async () => {
      try {
        await msalInstance.initialize();
        await msalInstance.handleRedirectPromise();
      } catch (err) {
        console.error("MSAL initialization error:", err);
      } finally {
        setReady(true);
      }
    };
    init();
  }, []);

  return ready ? (
    <MsalProvider instance={msalInstance}>{children}</MsalProvider>
  ) : null;
}