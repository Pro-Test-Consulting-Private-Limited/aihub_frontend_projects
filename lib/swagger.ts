export type SwaggerSpecInfo = {
  title: string;
  version: string | null;
  openapi: string | null;
  specUrl: string;
};

const BLOCKED_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);

export function normalizeSwaggerSpecUrl(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("Enter an OpenAPI / Swagger spec URL");

  let url: URL;
  try {
    url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
  } catch {
    throw new Error("Enter a valid OpenAPI / Swagger spec URL");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Spec URL must use http or https");
  }

  const host = url.hostname.toLowerCase();
  if (
    BLOCKED_HOSTS.has(host) ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
  ) {
    throw new Error("Spec URL host is not allowed");
  }

  return url.toString();
}

function titleFromYaml(text: string) {
  const openapi = /^\s*openapi\s*:/m.test(text) || /^\s*swagger\s*:/m.test(text);
  if (!openapi) return null;
  const titleMatch = /^\s*title\s*:\s*["']?(.+?)["']?\s*$/m.exec(text);
  const versionMatch =
    /^\s*openapi\s*:\s*["']?(.+?)["']?\s*$/m.exec(text) ||
    /^\s*swagger\s*:\s*["']?(.+?)["']?\s*$/m.exec(text);
  return {
    title: titleMatch?.[1]?.trim() || "OpenAPI Spec",
    version: null,
    openapi: versionMatch?.[1]?.trim() || null,
  };
}

export async function verifySwaggerSpec(
  specUrl: string,
  token?: string,
): Promise<SwaggerSpecInfo> {
  const headers: Record<string, string> = {
    Accept: "application/json, application/yaml, text/yaml, text/plain, */*",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(specUrl, {
    method: "GET",
    headers,
    redirect: "follow",
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    throw new Error(
      res.status === 401 || res.status === 403
        ? "Spec URL requires a valid access token"
        : "Could not fetch the OpenAPI / Swagger spec",
    );
  }

  const text = await res.text();
  let title = "OpenAPI Spec";
  let version: string | null = null;
  let openapi: string | null = null;

  try {
    const json = JSON.parse(text) as {
      openapi?: string;
      swagger?: string;
      info?: { title?: string; version?: string };
    };
    if (!json.openapi && !json.swagger) {
      throw new Error("URL is not a valid OpenAPI / Swagger document");
    }
    title = json.info?.title?.trim() || title;
    version = json.info?.version?.trim() || null;
    openapi = json.openapi || json.swagger || null;
  } catch (err) {
    if (err instanceof Error && err.message.includes("not a valid OpenAPI")) {
      throw err;
    }
    const yaml = titleFromYaml(text);
    if (!yaml) {
      throw new Error("URL is not a valid OpenAPI / Swagger document");
    }
    title = yaml.title;
    version = yaml.version;
    openapi = yaml.openapi;
  }

  return { title, version, openapi, specUrl };
}
