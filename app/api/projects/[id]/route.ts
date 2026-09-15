import { NextResponse } from "next/server";
import { pool } from "@/app/lib/db";
import { verifyRequestUser } from "@/app/lib/auth-server";

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const user = await verifyRequestUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;

  const updates = await req.json();
  delete updates.owner; // owner is never accepted from the client — set once at creation only

  const columnMap: Record<string, string> = {
    name: "name", description: "description", workspace: "workspace",
    department: "department", applicationUrl: "application_url",
    authRequired: "auth_required", authType: "auth_type", status: "status",
  };

  const fields = Object.keys(updates).filter((f) => columnMap[f]);
  if (fields.length === 0) return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });

  const setClauses = fields.map((f, i) => `${columnMap[f]} = $${i + 2}`);
  const values = fields.map((f) => updates[f]);

  await pool.query(
    `UPDATE projects SET ${setClauses.join(", ")}, updated_at = now() WHERE id = $1`,
    [id, ...values]
  );

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  const user = await verifyRequestUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;

  const result = await pool.query(`DELETE FROM projects WHERE id = $1`, [id]);

  if (result.rowCount === 0) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}