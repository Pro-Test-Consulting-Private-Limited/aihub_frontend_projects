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

  // Swagger UI links often include #/ — drop the fragment.
  url.hash = "";

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

/** NestJS/Swagger UI pages are HTML; their JSON usually lives at sibling paths. */
function candidateSpecUrls(specUrl: string): string[] {
  const url = new URL(specUrl);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const urls = [url.toString()];

  if (/\/docs$/i.test(path)) {
    url.pathname = `${path}-json`;
    urls.push(url.toString());
  }
  if (/\/swagger$/i.test(path)) {
    url.pathname = `${path}-json`;
    urls.push(url.toString());
    url.pathname = path.replace(/\/swagger$/i, "/v3/api-docs");
    urls.push(url.toString());
  }

  return [...new Set(urls)];
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

function parseOpenApiDocument(text: string) {
  try {
    const json = JSON.parse(text) as {
      openapi?: string;
      swagger?: string;
      info?: { title?: string; version?: string };
    };
    if (!json.openapi && !json.swagger) {
      throw new Error("not openapi json");
    }
    return {
      title: json.info?.title?.trim() || "OpenAPI Spec",
      version: json.info?.version?.trim() || null,
      openapi: json.openapi || json.swagger || null,
    };
  } catch {
    const yaml = titleFromYaml(text);
    if (!yaml) return null;
    return yaml;
  }
}

export async function verifySwaggerSpec(
  specUrl: string,
  token?: string,
): Promise<SwaggerSpecInfo> {
  const headers: Record<string, string> = {
    Accept: "application/json, application/yaml, text/yaml, text/plain, */*",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  let lastAuthError = false;
  let lastFetchError = false;

  for (const candidate of candidateSpecUrls(specUrl)) {
    try {
      const res = await fetch(candidate, {
        method: "GET",
        headers,
        redirect: "follow",
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) lastAuthError = true;
        else lastFetchError = true;
        continue;
      }

      const text = await res.text();
      const parsed = parseOpenApiDocument(text);
      if (!parsed) continue;

      return {
        title: parsed.title,
        version: parsed.version,
        openapi: parsed.openapi,
        specUrl: candidate,
      };
    } catch {
      lastFetchError = true;
    }
  }

  if (lastAuthError) {
    throw new Error("Spec URL requires a valid access token");
  }
  if (lastFetchError) {
    throw new Error("Could not fetch the OpenAPI / Swagger spec");
  }
  throw new Error(
    "URL is not a valid OpenAPI / Swagger document. Use the JSON/YAML spec URL (e.g. .../docs-json), not the Swagger UI page.",
  );
}
