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
      <div className="p-6 pb-[4.5rem] h-full overflow-y-auto">
        <Breadcrumbs breadcrumbs={breadcrumbs} />

        <div className="font-[500] text-[22px] text-[#081332] dark:text-[#ededed] mt-[25px]">
          Metrics
        </div>
        <div className="flex border-b border-b-[rgba(202,196,208)] dark:border-b-[#2a2a2a] mt-[20px]">
          {metricsSubItems.map((subItem) => {
            return (
              <div
                key={subItem.value}
                className={`h-[45px] w-[230px] flex items-center justify-center text-[14px] cursor-pointer ${
                  active === subItem.value
                    ? "bg-[#FBF8FF] dark:bg-[#2a2440] text-[#8664F2] font-[500] border-b-[2px] rounded-t-[10px] border-[#8664F2]"
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
            transition={{ duration: 1, ease: "easeInOut" }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </div>
    </MetricsFilterProvider>
  );
}