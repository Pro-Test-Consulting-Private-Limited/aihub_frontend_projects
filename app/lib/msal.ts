import { PublicClientApplication, Configuration } from "@azure/msal-browser";

const clientId = process.env.NEXT_PUBLIC_MICROSOFT_ENTRA_CLIENT_ID ?? "";
const tenantId = process.env.NEXT_PUBLIC_MICROSOFT_ENTRA_TENANT_ID ?? "";
const redirectUri =
  process.env.NEXT_PUBLIC_MICROSOFT_ENTRA_AD_REDIRECT_URI ||
  "http://localhost:3000/";

const msalConfig: Configuration = {
  auth: {
    clientId,
    authority: tenantId
      ? `https://login.microsoftonline.com/${tenantId}`
      : "https://login.microsoftonline.com/common",
    redirectUri,
    navigateToLoginRequestUrl: true,
  },
  cache: {
    cacheLocation: "sessionStorage",
  },
};

export const loginRequest = {
  scopes: ["User.Read"],
};

export const msalInstance = new PublicClientApplication(msalConfig);
