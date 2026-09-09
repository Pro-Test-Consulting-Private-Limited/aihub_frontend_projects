"use client";

import * as React from "react";

export type UseIsInViewOptions = {
  inView?: boolean;
  inViewMargin?: string;
  inViewOnce?: boolean;
};

export function useIsInView(
  ref: React.Ref<HTMLDivElement>,
  options: UseIsInViewOptions = {},
) {
  const {
    inView = false,
    inViewMargin = "0px",
    inViewOnce = true,
  } = options;

  const [isInView, setIsInView] = React.useState(!inView);

  React.useEffect(() => {
    if (!inView) {
      setIsInView(true);
      return;
    }

    const element =
      typeof ref === "object" && ref !== null ? ref.current : null;

    if (!element) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);

          if (inViewOnce) {
            observer.disconnect();
          }
        } else if (!inViewOnce) {
          setIsInView(false);
        }
      },
      {
        rootMargin: inViewMargin,
      },
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [ref, inView, inViewMargin, inViewOnce]);

  return {
    ref,
    isInView,
  };
}