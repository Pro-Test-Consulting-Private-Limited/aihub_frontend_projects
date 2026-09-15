import { NextResponse } from "next/server";
import { clearCookies, OAUTH_COOKIES } from "@/lib/oauth";

const JIRA_COOKIES = [
  OAUTH_COOKIES.jiraRefresh,
  OAUTH_COOKIES.jiraCloudId,
  OAUTH_COOKIES.jiraSiteName,
  OAUTH_COOKIES.jiraSiteUrl,
  OAUTH_COOKIES.jiraState,
  OAUTH_COOKIES.jiraEmail,
  OAUTH_COOKIES.jiraApiToken,
];

export async function POST() {
  const res = NextResponse.json({ disconnected: true });
  return clearCookies(res, JIRA_COOKIES);
}
