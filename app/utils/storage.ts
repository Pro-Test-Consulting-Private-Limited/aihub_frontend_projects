// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const setItem = (key: string, value: any) => {
  if (typeof window !== "undefined") {
    localStorage.setItem(key, value);
  }
};

export const getItem = (key: string) => {
  if (typeof window !== "undefined") {
    return localStorage.getItem(key);
  }
  return null;
};

export const removeItem = (key: string) => {
  if (typeof window !== "undefined") {
    localStorage.removeItem(key);
  }
};

export const clearStorage = () => {
  if (typeof window !== "undefined") {
    localStorage.clear();
  }
};
