import type { RunResult } from "@/app/interfaces/api-testing";

/** The likely cause of a failed call in plain words, from the status code the server answered with. */
export function plainCause(r: RunResult): string | null {
  if (r.status !== "failed" || !r.response) return null;
  const code = r.response.status;
  if (code === 401) return "The server did not accept the token. Check the account's token or login data in Setup.";
  if (code === 403) return "The account is not allowed to do this. It may need another role, or a completed profile or email.";
  if (code === 404) return "Not found. An id in the path may not exist: check the step that creates it.";
  if (code === 409) return "Already exists or in conflict. Generated data is new each run, so look at values you pinned.";
  if (code === 400 || code === 422) return "The server rejected the data. The response says which field.";
  if (code === 429) return "Too many requests. Wait a while, or run on a new account.";
  if (code >= 500) return "The server failed. This is a problem in the API, not in the test.";
  return null;
}

