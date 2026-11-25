import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * DEV-ONLY reverse proxy to AppAtlas API with X-Proxy-Auth injected server-side.
 * Refuses to run when NODE_ENV=production or AUTH_BYPASS_LOCAL≠1 or Host is not localhost.
 */
function allow(req: NextRequest): string | null {
  if (process.env.NODE_ENV === "production") return "disabled in production";
  if (process.env.AUTH_BYPASS_LOCAL !== "1") return "AUTH_BYPASS_LOCAL is not 1";
  const host = req.headers.get("host") || "";
  if (!/^localhost(:\d+)?$/i.test(host) && !/^127\.0\.0\.1(:\d+)?$/.test(host)) {
    return `host ${host} is not localhost`;
  }
  return null;
}

async function proxy(req: NextRequest, path: string[]) {
  const denied = allow(req);
  if (denied) return NextResponse.json({ error: `dev-atlas proxy: ${denied}` }, { status: 404 });

  const secret = process.env.PROXY_AUTH_SECRET || process.env.DEV_PROXY_AUTH || "";
  if (!secret) return NextResponse.json({ error: "PROXY_AUTH_SECRET not set for local bypass" }, { status: 500 });

  const upstream = (process.env.APPATLAS_API_INTERNAL || process.env.NEXT_PUBLIC_APPATLAS_API || "http://127.0.0.1:4400").replace(
    /\/$/,
    "",
  );
  const url = new URL(req.url);
  const target = `${upstream}/${path.map(encodeURIComponent).join("/")}${url.search}`;

  const headers = new Headers();
  const ct = req.headers.get("content-type");
  if (ct) headers.set("content-type", ct);
  headers.set("X-Proxy-Auth", secret);
  headers.set("X-Remote-User", process.env.DEV_PROXY_USER || "local-bypass");

  const init: RequestInit = { method: req.method, headers };
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = Buffer.from(await req.arrayBuffer());
  }

  const res = await fetch(target, init);
  const outHeaders = new Headers();
  const pass = ["content-type", "cache-control"];
  for (const k of pass) {
    const v = res.headers.get(k);
    if (v) outHeaders.set(k, v);
  }
  return new NextResponse(res.body, { status: res.status, headers: outHeaders });
}

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  return proxy(req, (await ctx.params).path || []);
}
export async function POST(req: NextRequest, ctx: Ctx) {
  return proxy(req, (await ctx.params).path || []);
}
export async function PUT(req: NextRequest, ctx: Ctx) {
  return proxy(req, (await ctx.params).path || []);
}
export async function PATCH(req: NextRequest, ctx: Ctx) {
  return proxy(req, (await ctx.params).path || []);
}
export async function DELETE(req: NextRequest, ctx: Ctx) {
  return proxy(req, (await ctx.params).path || []);
}
