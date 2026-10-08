"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useMsal } from "@azure/msal-react";
import { loginRequest } from "@/app/lib/msal";
import { APPATLAS_API } from "@/app/services/appatlas";

/** Tells the operations dashboard (logs) who has the AI Hub open, on which site and page. Renders nothing. */
export default function SitePresence() {
  const { instance, accounts } = useMsal();
  const pathname = usePathname();
  const page = useRef(pathname);
  page.current = pathname;
  const account = accounts[0];

  useEffect(() => {
    if (!account) return;
    // Silent only: a background heartbeat must never send the user to the Microsoft sign-in page.
    const beat = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const { idToken } = await instance.acquireTokenSilent({ ...loginRequest, account });
        await fetch(`${APPATLAS_API}/presence`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
          body: JSON.stringify({ room: "ai-hub", page: page.current }),
        });
      } catch {
        // Offline or token not available silently; the next beat tries again.
      }
    };
    void beat();
    const timer = setInterval(beat, 15_000);
    document.addEventListener("visibilitychange", beat);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", beat);
    };
  }, [account, instance, pathname]);

  return null;
}
