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
  const [collapsed, setCollapsed] = useState(false);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem(SIDENAV_COLLAPSED_KEY) === "true");
    // Enable transitions only after the saved state is applied, so reloads don't animate.
    const frame = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const transition = animate ? "ease-in-out duration-500" : "duration-0";

  const toggleCollapsed = (value: boolean) => {
    setCollapsed(value);
    localStorage.setItem(SIDENAV_COLLAPSED_KEY, String(value));
  };

  return (
    <ProjectsProvider>
      <div className="flex h-screen overflow-hidden">
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
          className={`hidden md:flex fixed top-[38px] z-50 h-[26px] w-[26px] items-center justify-center rounded-full border border-[#E5E7EB] dark:border-[#2a2a2a] bg-[#fff] dark:bg-[#141414] text-[#5E6066] dark:text-[#ededed] shadow-sm hover:text-[#8664F2] transition-[left] ${transition} ${
            collapsed ? "left-[62px]" : "left-[287px]"
          }`}
        >
          <TbChevronLeft
            size={16}
            className={`transition-transform ${transition} ${collapsed ? "rotate-180" : ""}`}
          />
        </button>

        <div
          className={`flex-grow h-full relative transition-[margin-left,width] ${transition} ${
            collapsed
              ? "w-[calc(100%-75px)] ml-[75px]"
              : "w-[calc(100%-75px)] md:w-[calc(100%-300px)] ml-[75px] md:ml-[300px]"
          }`}
        >
          <TopNav />

          {!pathname?.includes("metrics") ? (
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={pathname}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 1, ease: "easeInOut" }}
                className="h-[calc(100%-80px)] overflow-auto"
              >
                {children}
              </motion.div>
            </AnimatePresence>
          ) : (
            <div className="h-[calc(100%-80px)] overflow-auto">
              {children}
            </div>
          )}
        </div>
      </div>
    </ProjectsProvider>
  );
}
