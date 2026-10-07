import axios from "axios";
import { loginRequest, msalInstance } from "./app/lib/msal";
import { getFreshIdToken } from "./app/lib/auth-client";

const api = axios.create();

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      // clearStorage();
      // toast.error("Session expired, please login again");
      // window.location.href = "/";

      return Promise.reject(error);
    }

    return Promise.reject(error);
  },
);

async function getAccessToken() {
  const account =
    msalInstance.getActiveAccount() ?? msalInstance.getAllAccounts()[0];

  if (!account) return null;

  const response = await msalInstance.acquireTokenSilent({
    ...loginRequest,
    account,
  });

  return response.accessToken;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function request(httpOptions: any) {
  const skipAuth = httpOptions.skipAuth === true;
  const sendIdToken = httpOptions.idToken === true;
  delete httpOptions.skipAuth;
  delete httpOptions.idToken;

  const token = skipAuth ? null : await getAccessToken();
  // Services that verify the user (e.g. the Playwright recorder) take the Entra ID token, whose audience is our app.
  const idToken = sendIdToken ? await getFreshIdToken(msalInstance, msalInstance.getAllAccounts()) : null;
  const isFormData =
    typeof FormData !== "undefined" && httpOptions.data instanceof FormData;

  httpOptions.headers = {
    ...(isFormData
      ? {}
      : {
          "Content-Type": httpOptions.files
            ? "multipart/form-data"
            : httpOptions.urlEncoded
              ? "application/x-www-form-urlencoded"
              : "application/json",
        }),
    Accept: httpOptions.responseType === "blob" ? "*/*" : "application/json",
    // Authorization: token ? `Bearer ${token}` : "",
    ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
    ...httpOptions.headers,
  };

  return api(httpOptions)
    .then((response) => response)
    .catch((error) => {
      throw error.response;
    });
}


