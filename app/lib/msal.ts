import { PublicClientApplication, Configuration } from "@azure/msal-browser";

const clientId = process.env.NEXT_PUBLIC_MICROSOFT_ENTRA_CLIENT_ID ?? "";
const tenantId = process.env.NEXT_PUBLIC_MICROSOFT_ENTRA_TENANT_ID ?? "";
// Back to the site the user signed in from (prod / sit / dev / demo share one build config); the env value
// only applies during server rendering. Each site's origin must be a registered SPA redirect URI.
const redirectUri =
  typeof window !== "undefined"
    ? `${window.location.origin}/`
    : process.env.NEXT_PUBLIC_MICROSOFT_ENTRA_AD_REDIRECT_URI || "http://localhost:3000/";

const msalConfig: Configuration = {
  auth: {
    clientId,
    authority: tenantId
      ? `https://login.microsoftonline.com/${tenantId}`
      : "https://login.microsoftonline.com/common",
    redirectUri,
  },
  cache: {
    cacheLocation: "sessionStorage",
  },
};

export const loginRequest = {
  scopes: ["User.Read"],
};

export const msalInstance = new PublicClientApplication(msalConfig);
