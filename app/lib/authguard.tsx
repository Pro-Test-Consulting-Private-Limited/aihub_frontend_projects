"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useIsAuthenticated, useMsal } from "@azure/msal-react";
import { InteractionStatus } from "@azure/msal-browser";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const isAuthenticated = useIsAuthenticated();
  const { inProgress } = useMsal();

  useEffect(() => {
    async function checkAuth() {
      if (!isAuthenticated) router.replace("/");
      setLoading(false);
    }
    if (inProgress === InteractionStatus.None) checkAuth();
  }, [isAuthenticated, router, inProgress]);

  if (loading)
    return (
      <div className="w-[100%] h-[calc(100%-80px)] flex items-center justify-center">
        <Image
          src={"/icons/loading.gif"}
          width={15}
          height={15}
          alt="Loading..."
          className="w-[100px] h-[100px]"
        />
      </div>
    );

  return <>{children}</>;
}
