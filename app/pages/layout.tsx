"use client";

import SideNav from "../components/sidenav";
import TopNav from "../components/topnav";
import { AnimatePresence, motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { ProjectsProvider } from "../lib/projectsStore";
import { useEffect, useState } from "react";
import { TbChevronLeft } from "react-icons/tb";

const SIDENAV_COLLAPSED_KEY = "sidenav-collapsed";

export default function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [savedCollapsed, setSavedCollapsed] = useState(false);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    setSavedCollapsed(localStorage.getItem(SIDENAV_COLLAPSED_KEY) === "true");
    // Enable transitions only after the saved state is applied, so reloads don't animate.
    const frame = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const transition = animate ? "ease-in-out duration-500" : "duration-0";

  // App Atlas is a full-screen workspace: icon rail only, unless expanded for this visit.
  const isAtlas = pathname?.startsWith("/app-atlas") ?? false;
  const [atlasExpanded, setAtlasExpanded] = useState(false);
  useEffect(() => setAtlasExpanded(false), [isAtlas]);
  const collapsed = isAtlas ? !atlasExpanded : savedCollapsed;

  const toggleCollapsed = (value: boolean) => {
    if (isAtlas) return setAtlasExpanded(!value);
    setSavedCollapsed(value);
    localStorage.setItem(SIDENAV_COLLAPSED_KEY, String(value));
  };

  return (
    <ProjectsProvider>
      <div className="flex h-[100dvh] max-h-[100dvh] overflow-hidden overscroll-none">
        <SideNav
          collapsed={collapsed}
          transition={transition}
          onExpand={() => toggleCollapsed(false)}
        />

        <button
          type="button"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={() => toggleCollapsed(!collapsed)}
          className={`fixed top-[38px] z-50 hidden h-[26px] w-[26px] items-center justify-center rounded-full border border-[#E5E7EB] bg-[#fff] text-[#5E6066] shadow-sm transition-[left] hover:text-[#8664F2] md:flex dark:border-[#2a2a2a] dark:bg-[#141414] dark:text-[#ededed] ${transition} ${
            collapsed ? "left-[62px]" : "left-[287px]"
          }`}
        >
          <TbChevronLeft
            size={16}
            className={`transition-transform ${transition} ${collapsed ? "rotate-180" : ""}`}
          />
        </button>

        <div
          className={`relative flex h-full min-h-0 flex-grow flex-col transition-[margin-left,width] ${transition} ${
            collapsed
              ? "ml-[75px] w-[calc(100%-75px)]"
              : "ml-[75px] w-[calc(100%-75px)] md:ml-[300px] md:w-[calc(100%-300px)]"
          }`}
        >
          {isAtlas ? (
            <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
          ) : (
            <>
              <TopNav />
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={pathname}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                  className="min-h-0 flex-1 overflow-y-auto"
                >
                  {children}
                </motion.div>
              </AnimatePresence>
            </>
          )}
        </div>
      </div>
    </ProjectsProvider>
  );
}
