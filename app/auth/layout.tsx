"use client";
import Image from "next/image";
import AuthImage from "../../public/images/auth.jpg";
import FullLogo from "../../public/images/full-logo.png";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useIsAuthenticated, useMsal } from "@azure/msal-react";
import { InteractionStatus } from "@azure/msal-browser";

export default function AuthenticationLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const router = useRouter();
  const isAuthenticated = useIsAuthenticated();
  const { inProgress } = useMsal();

  useEffect(() => {
    async function checkAlreadyLoggedIn() {
      if (isAuthenticated) router.replace("/home");
    }
    if (inProgress === InteractionStatus.None) checkAlreadyLoggedIn();
  }, [isAuthenticated, router, inProgress]);

  return (
    <div className="auth-layout-wrapper flex">
      <div className="auth-layout-logo flex items-center justify-center">
        <Image
          src={AuthImage}
          className="h-[100%] object-cover object-center"
          alt="Logo"
        />
      </div>

      <div className="auth-layout-left-container">
        <div className="auth-inner">
          <div>Powered</div>
          <Image
            src={FullLogo}
            className="h-[30px] w-auto ml-[10px]"
            alt="Logo"
          />
        </div>
      </div>
      <div className="auth-layout-form-container">{children}</div>
    </div>
  );
}
