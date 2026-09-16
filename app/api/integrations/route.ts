import { NextRequest, NextResponse } from "next/server";
import { verifyRequestUser } from "@/app/lib/auth-server";
import {
  deleteUserIntegration,
  listUserIntegrations,
  upsertUserIntegrations,
  type IntegrationProvider,
} from "@/app/lib/integrations-db";

const ALLOWED: IntegrationProvider[] = ["jira", "github", "swagger"];

function isProvider(value: string): value is IntegrationProvider {
  return (ALLOWED as string[]).includes(value);
}

export async function GET(req: NextRequest) {
  const user = await verifyRequestUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const rows = await listUserIntegrations(user.oid);
    return NextResponse.json({
      user: { name: user.name, email: user.email, oid: user.oid },
      integrations: rows.map((row) => ({
        provider: row.provider,
        meta: row.meta ?? {},
        connectedAt: row.connected_at,
      })),
    });
  } catch (err) {
    console.error("Failed to list integrations:", err);
    return NextResponse.json({ error: "Failed to load integrations" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await verifyRequestUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const incoming = Array.isArray(body?.providers)
      ? body.providers
      : body?.provider
        ? [{ provider: body.provider, meta: body.meta }]
        : [];

    const providers = incoming
      .map((item: { provider?: string; meta?: Record<string, unknown> }) => ({
        provider: String(item?.provider ?? ""),
        meta: item?.meta ?? {},
      }))
      .filter((item: { provider: string }) => isProvider(item.provider)) as Array<{
      provider: IntegrationProvider;
      meta?: Record<string, unknown>;
    }>;

    if (providers.length === 0) {
      return NextResponse.json({ error: "No valid providers" }, { status: 400 });
    }

    await upsertUserIntegrations(user, providers);
    const rows = await listUserIntegrations(user.oid);
    return NextResponse.json({
      user: { name: user.name, email: user.email, oid: user.oid },
      integrations: rows.map((row) => ({
        provider: row.provider,
        meta: row.meta ?? {},
        connectedAt: row.connected_at,
      })),
    });
  } catch (err) {
    console.error("Failed to save integrations:", err);
    return NextResponse.json({ error: "Failed to save integrations" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const user = await verifyRequestUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const provider = req.nextUrl.searchParams.get("provider") ?? "";
  if (!isProvider(provider)) {
    return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
  }

  try {
    await deleteUserIntegration(user.oid, provider);
    return NextResponse.json({ disconnected: true, provider });
  } catch (err) {
    console.error("Failed to disconnect integration:", err);
    return NextResponse.json({ error: "Failed to disconnect" }, { status: 500 });
  }
}
