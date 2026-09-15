import { NextResponse } from "next/server";
import { pool } from "@/app/lib/db";
import { verifyRequestUser } from "@/app/lib/auth-server";

export async function GET() {
  const { rows } = await pool.query(`
    SELECT id, name, description, domain, department, workspace,
           owner_name AS owner,
           to_char(date_of_creation, 'DD Mon YYYY') AS "dateOfCreation",
           application_url AS "applicationUrl", auth_required AS "authRequired",
           auth_type AS "authType", product, status,
           to_char(due_date, 'DD/MM/YYYY') AS "dueDate", progress
    FROM projects
    ORDER BY created_at DESC
  `);
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const user = await verifyRequestUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, description, domain, department, workspace, applicationUrl, authRequired, authType, product, status } = body;

  const { rows } = await pool.query(
    `INSERT INTO projects
       (name, description, domain, department, workspace, owner_name, owner_email, owner_oid,
        date_of_creation, application_url, auth_required, auth_type, product, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8, now(), $9,$10,$11,$12,$13)
     RETURNING id, name, description, domain, department, workspace,
               owner_name AS owner,
               to_char(date_of_creation, 'DD Mon YYYY') AS "dateOfCreation",
               application_url AS "applicationUrl", auth_required AS "authRequired",
               auth_type AS "authType", product, status`,
    [name, description ?? "", domain, department, workspace, user.name, user.email, user.oid,
     applicationUrl ?? "", authRequired ?? false, authType ?? "", product, status ?? "Active"]
  );

  return NextResponse.json(rows[0], { status: 201 });
}