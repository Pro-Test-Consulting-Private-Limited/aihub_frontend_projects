import { NextResponse } from "next/server";
import { clearCookies, OAUTH_COOKIES } from "@/lib/oauth";

const SWAGGER_COOKIES = [
  OAUTH_COOKIES.swaggerSpecUrl,
  OAUTH_COOKIES.swaggerTitle,
  OAUTH_COOKIES.swaggerToken,
];

export async function POST() {
  const res = NextResponse.json({ disconnected: true });
  return clearCookies(res, SWAGGER_COOKIES);
}
