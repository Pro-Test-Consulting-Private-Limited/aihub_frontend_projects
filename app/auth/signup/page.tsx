"use client";

import Image from "next/image";
import { useState } from "react";
import EmailIcon from "../../../public/icons/mail.svg";
import LockIcon from "../../../public/icons/lock.svg";
import MicrosoftIcon from "../../../public/icons/microsoft.png";
import UserIcon from "../../../public/icons/user.svg";
import ShowIcon from "../../../public/icons/show.svg";
import HideIcon from "../../../public/icons/hide.svg";
import Link from "next/link";

const Signup = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisibility, setPasswordVisibility] = useState(false);
  const [loading] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [confirmPasswordVisibility, setConfirmPasswordVisibility] =
    useState(false);

  const handleSignup = async () => {
    // setLoading(true);
    // signUp({
    //   username: name,
    //   password: password,
    //   options: { userAttributes: { email: email } },
    // })
    //   .then(() => {
    //     toast(
    //       "Signed up successfully, Please contact your admin to confirm your account",
    //     );
    //     router.push("/");
    //   })
    //   .catch((err) => toast.error(err.message))
    //   .finally(() => setLoading(false));
  };

  return (
    <form
      className="auth-form"
      onSubmit={(e) => {
        e.preventDefault();
        handleSignup();
      }}
    >
      <div className="switch-auth">
        Already have an account?
        <Link href="/" className="switch-button">
          Login
        </Link>
      </div>
      <div className="form-container">
        <div className="welcome-back">Create Your Account ✨</div>
        <div className="login-message">Let&apos;s Get You Set Up</div>

        <div className="input-wrapper">
          <div className="label">Full Name</div>
          <input
            placeholder="Enter your full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Image className="input-icon" width={14} src={UserIcon} alt="name" />
        </div>

        <div className="input-wrapper">
          <div className="label">Email</div>
          <input
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Image
            className="input-icon"
            width={14}
            src={EmailIcon}
            alt="email"
          />
        </div>

        <div className="input-wrapper">
          <div className="label">Set Password</div>
          <input
            type={passwordVisibility ? "text" : "password"}
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Image
            width={14}
            className="input-icon"
            src={LockIcon}
            alt="password"
          />
          <Image
            className="action-icon"
            width={14}
            src={passwordVisibility ? ShowIcon : HideIcon}
            alt="password"
            onClick={() => setPasswordVisibility(!passwordVisibility)}
          />
        </div>

        <div className="input-wrapper">
          <div className="label">Confirm Password</div>
          <input
            type={confirmPasswordVisibility ? "text" : "password"}
            placeholder="Enter your password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          <Image
            width={14}
            className="input-icon"
            src={LockIcon}
            alt="password"
          />
          <Image
            width={14}
            className="action-icon"
            src={confirmPasswordVisibility ? ShowIcon : HideIcon}
            alt="password"
            onClick={() =>
              setConfirmPasswordVisibility(!confirmPasswordVisibility)
            }
          />
        </div>

        <div className="terms-and-conditions">
          By signing up, you&apos;re agreeing to our
          <div className="link">Terms & Conditions</div>
          and
          <div className="link">Privacy Policy</div>
        </div>

        <button
          className={`form-submit ${
            !name || !email || !password || !confirmPassword || loading
              ? "opacity-[0.5]"
              : ""
          }`}
          disabled={!name || !email || !password || !confirmPassword || loading}
          onClick={() => handleSignup()}
        >
          Sign Up
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

        <div className="google" onClick={() => null}>
          <Image src={MicrosoftIcon} alt="google" width={17} />
          Register with Microsoft
        </div>
      </div>
    </form>
  );
};

export default Signup;
