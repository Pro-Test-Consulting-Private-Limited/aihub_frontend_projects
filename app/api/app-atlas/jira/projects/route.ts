import { NextRequest, NextResponse } from "next/server";
import { verifyRequestUser } from "@/app/lib/auth-server";
import { jiraApiBase, jiraAuthHeader, persistRotatedToken, resolveJiraCredentials } from "@/lib/jira-credentials";

/** Jira projects visible to the signed-in user's own Jira connection. */
export async function GET(req: NextRequest) {
  if (!(await verifyRequestUser(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let resolved;
  try {
    resolved = await resolveJiraCredentials(req);
  } catch {
    return NextResponse.json({ error: "Your Jira session expired. Reconnect Jira in Integrations." }, { status: 401 });
  }
  if (!resolved) return NextResponse.json({ error: "Jira is not connected. Connect it in Integrations." }, { status: 409 });

  const projects: { key: string; name: string }[] = [];
  for (let startAt = 0; startAt < 1000; startAt += 50) {
    const res = await fetch(
      `${jiraApiBase(resolved.credentials)}/project/search?maxResults=50&startAt=${startAt}&orderBy=key`,
      { headers: { Authorization: jiraAuthHeader(resolved.credentials), Accept: "application/json" } },
    );
    if (res.status === 401 || res.status === 403) {
      return NextResponse.json({ error: "Jira rejected your credentials. Reconnect Jira in Integrations." }, { status: 401 });
    }
    if (!res.ok) return NextResponse.json({ error: `Jira returned ${res.status}` }, { status: 502 });
    const page = (await res.json()) as { values: { key: string; name: string }[]; isLast: boolean };
    projects.push(...page.values.map((p) => ({ key: p.key, name: p.name })));
    if (page.isLast || !page.values.length) break;
  }

  return persistRotatedToken(NextResponse.json({ projects }), resolved);
}
