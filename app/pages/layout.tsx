"use client";

import SideNav from "../components/sidenav";
import TopNav from "../components/topnav";
import { AnimatePresence, motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { ProjectsProvider } from "../lib/projectsStore";

export default function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <ProjectsProvider>
      <div className="flex h-screen overflow-hidden">
        <SideNav />

        <div
          className={`flex-grow h-full relative w-[calc(100%-75px)] md:w-[calc(100%-300px)] ml-[75px] md:ml-[300px] transition-[margin-left,width] ease-in-out duration-500`}
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
