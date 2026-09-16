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
        clearBrokenMsalCache();
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

function clearBrokenMsalCache() {
  if (typeof window === "undefined") return;
  try {
    const keys = Object.keys(sessionStorage).filter((key) =>
      key.toLowerCase().includes("msal"),
    );
    keys.forEach((key) => sessionStorage.removeItem(key));
  } catch {
    // ignore storage access errors
  }
}