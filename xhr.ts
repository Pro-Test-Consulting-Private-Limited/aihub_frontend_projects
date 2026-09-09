import axios from "axios";
import { loginRequest, msalInstance } from "./app/lib/msal";

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
  delete httpOptions.skipAuth;

  const token = skipAuth ? null : await getAccessToken();

  httpOptions.headers = {
    "Content-Type": httpOptions.files
      ? "multipart/form-data"
      : httpOptions.urlEncoded
        ? "application/x-www-form-urlencoded"
        : "application/json",
    Accept: "application/json",
    // Authorization: token ? `Bearer ${token}` : "",
    ...httpOptions.headers,
  };

  return api(httpOptions)
    .then((response) => response)
    .catch((error) => {
      throw error.response;
    });
}


