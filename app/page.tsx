"use client";

import AuthenticationLayout from "./auth/layout";
import Login from "./auth/page";

export default function RootLogin() {
  return (
    <AuthenticationLayout>
      <Login />
    </AuthenticationLayout>
  );
}
