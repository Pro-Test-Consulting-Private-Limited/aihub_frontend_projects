import * as React from "react";

export function getStrictContext<T>(
  name: string,
): readonly [
  React.Provider<T | undefined>,
  () => T,
] {
  const Context = React.createContext<T | undefined>(undefined);

  function useStrictContext(): T {
    const value = React.useContext(Context);

    if (value === undefined) {
      throw new Error(
        `${name} must be used within its corresponding Provider`,
      );
    }

    return value;
  }

  return [Context.Provider, useStrictContext] as const;
}