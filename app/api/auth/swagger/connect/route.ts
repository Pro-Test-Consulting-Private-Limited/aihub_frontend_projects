import { NextResponse } from "next/server";
import { normalizeSwaggerSpecUrl, verifySwaggerSpec } from "@/lib/swagger";
import { OAUTH_COOKIES, oauthCookieOptions } from "@/lib/oauth";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const specUrl = normalizeSwaggerSpecUrl(String(body.specUrl ?? ""));
    const token = String(body.token ?? "").trim();

    const profile = await verifySwaggerSpec(specUrl, token || undefined);
    const res = NextResponse.json({
      connected: true,
      title: profile.title,
      version: profile.version,
      openapi: profile.openapi,
      specUrl: profile.specUrl,
    });

    res.cookies.set(
      OAUTH_COOKIES.swaggerSpecUrl,
      encodeURIComponent(profile.specUrl),
      oauthCookieOptions(),
    );
    res.cookies.set(
      OAUTH_COOKIES.swaggerTitle,
      encodeURIComponent(profile.title),
      oauthCookieOptions(),
    );
    if (token) {
      res.cookies.set(OAUTH_COOKIES.swaggerToken, token, oauthCookieOptions());
    } else {
      res.cookies.set(OAUTH_COOKIES.swaggerToken, "", {
        ...oauthCookieOptions(0),
        maxAge: 0,
      });
    }

    return res;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not connect to Swagger";
    const status =
      message.includes("token") || message.includes("fetch") ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
