"use client";
import { useEffect, useState } from "react";
import { MsalProvider } from "@azure/msal-react";
import { msalInstance } from "./msal";
import { ThemeProvider } from "next-themes";

export default function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const init = async () => {
      await msalInstance.initialize();
      await msalInstance.handleRedirectPromise();
      setReady(true);
    };
    init();
  }, []);
  if (!ready) return null;
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <MsalProvider instance={msalInstance}>{children}</MsalProvider>
    </ThemeProvider>
  );
}