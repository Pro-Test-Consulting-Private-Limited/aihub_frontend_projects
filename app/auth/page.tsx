"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import EmailIcon from "../../public/icons/mail.svg";
import LockIcon from "../../public/icons/lock.svg";
import MicrosoftIcon from "../../public/icons/microsoft.png";
import ShowIcon from "../../public/icons/show.svg";
import HideIcon from "../../public/icons/hide.svg";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMsal } from "@azure/msal-react";
import { loginRequest } from "../lib/msal";

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisibility, setPasswordVisibility] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { instance, accounts } = useMsal();

  const fetchSession = useCallback(async () => {
    const result = await instance.acquireTokenSilent({
      ...loginRequest,
      account: accounts[0],
    });
    if (result.accessToken) router.push("/home");
  }, [accounts, instance, router]);

  useEffect(() => {
    if (accounts.length !== 0) fetchSession();
  }, [accounts, fetchSession, router]);

  const handleLogin = async () => {
    await setLoading(true);
    await instance.loginRedirect(loginRequest);
    await setLoading(false);
  };

  return (
    <form
      className="auth-form"
      onSubmit={(e) => {
        e.preventDefault();
        handleLogin();
      }}
    >
      <div className="switch-auth">
        Don&apos;t have an account?
        <Link href="/auth/signup" className="switch-button">
          Sign Up
        </Link>
      </div>
      <div className="form-container">
        <div className="welcome-back">Welcome Back &#128075;</div>
        <div className="login-message">Login to continue</div>

        <button
          disabled={loading}
          className={`google ${loading ? "opacity-[0.5]" : ""}`}
          onClick={() => handleLogin()}
        >
          <Image src={MicrosoftIcon} alt="google" width={17} />
          Sign in with Microsoft
          {loading && (
            <Image
              src={"/icons/loading.gif"}
              width={15}
              height={15}
              className="ml-1"
              alt="loading"
            />
          )}
        </button>

        <div className="divider">
          <div className="line" />
          or
          <div className="line" />
        </div>

        <div className="input-wrapper">
          <div className="label">Email</div>
          <input
            placeholder="Enter your email"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <Image
            className="input-icon"
            width={13}
            src={EmailIcon}
            alt="username"
          />
        </div>

        <div className="input-wrapper">
          <div className="label">Password</div>
          <input
            type={passwordVisibility ? "text" : "password"}
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Image
            className="action-icon"
            width={13}
            src={passwordVisibility ? ShowIcon : HideIcon}
            alt="password"
            onClick={() => setPasswordVisibility(!passwordVisibility)}
          />
          <Image
            width={14}
            className="input-icon"
            src={LockIcon}
            alt="password"
          />
        </div>

        <div className="forgot-password">Forgot Password?</div>

        <button
          className={`form-submit ${
            !username || !password || loading ? "opacity-[0.5]" : ""
          }`}
          disabled={!username || !password}
          onClick={() => null}
        >
          Login
        </button>
      </div>
    </form>
  );
};

export default Login;
