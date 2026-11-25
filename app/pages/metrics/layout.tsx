"use client";

import Breadcrumbs from "@/app/components/breadcrumbs";
import { MetricsFilterProvider } from "@/app/context/metrics-filter-context";
import { MetricsBaseBreadcrumbs } from "@/app/constants/metrics";
import { NavItems } from "@/app/constants/nav-items";
import { AnimatePresence, motion } from "framer-motion";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState("business-usage");
  const route = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const pathSegments = pathname.split("/");
    const subPage = pathSegments[pathSegments.length - 1];
    setActive(subPage);
  }, [pathname]);

  const handleActive = (value: string) => {
    route.push(`/metrics/${value}`);
    setActive(value);
  };

  const metricsSubItems =
    NavItems?.find((item) => item.value === "metrics")?.items || [];

  const activeSubItem = metricsSubItems.find((item) => item.value === active);

  const breadcrumbs = [
    ...MetricsBaseBreadcrumbs,
    { label: "Metrics", href: "/metrics", active: false },
    {
      label: activeSubItem?.name || "Business & Usage",
      href: `/metrics/${active}`,
      active: true,
    },
  ];

  return (
    <MetricsFilterProvider>
      <div className="px-6 pb-4 pt-4">
        <Breadcrumbs breadcrumbs={breadcrumbs} />

        <div className="mt-3 text-[20px] font-[500] text-[#081332] dark:text-[#ededed]">
          Metrics
        </div>
        <div className="mt-3 flex border-b border-b-[rgba(202,196,208)] dark:border-b-[#2a2a2a]">
          {metricsSubItems.map((subItem) => {
            return (
              <div
                key={subItem.value}
                className={`flex h-[45px] w-[230px] cursor-pointer items-center justify-center text-[14px] ${
                  active === subItem.value
                    ? "rounded-t-[10px] border-b-[2px] border-[#8664F2] bg-[#FBF8FF] font-[500] text-[#8664F2] dark:bg-[#2a2440]"
                    : "text-[#49454F] dark:text-[#a0a0a0]"
                }`}
                onClick={() => handleActive(subItem.value)}
              >
                {subItem.name}
              </div>
            );
          })}
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={pathname}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </div>
    </MetricsFilterProvider>
  );
}