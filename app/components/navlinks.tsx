"use client";

import { usePathname, useRouter } from "next/navigation";
import ArrowIcon from "../../public/icons/arrow.png";
import Image, { StaticImageData } from "next/image";
import { NavBarItem } from "../interfaces/navbar";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IconType } from "react-icons";

interface NavProps {
  list: NavBarItem[];
}

const NavLinks = ({ list }: NavProps) => {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState("");
  const router = useRouter();

  const renderImage = (
    icon: StaticImageData | IconType,
    href: string,
  ) => {
    const isActive = pathname === href;

    if (typeof icon === "function") {
      const Icon = icon as IconType;
      return (
        <Icon
          size={18}
          color={isActive ? "#8664F2" : "currentColor"}
          className="dark:text-[#ededed]"
        />
      );
    }

    return (
      <Image
        src={icon}
        className="w-[18px] dark:invert-0"
        style={
          isActive
            ? {
                filter:
                  "brightness(0) saturate(100%) invert(44%) sepia(12%) saturate(2326%) hue-rotate(205deg) brightness(91%) contrast(91%)",
              }
            : {}
        }
        alt="nav-icon"
      />
    );
  };

  return (
    <>
      {list.map((link: NavBarItem) => {
        const isExpanded = expanded === link.href;

        return (
          <div
            key={link.name}
            onClick={() => {
              if (link.items.length === 0) {
                if (pathname !== link.href) router.push(link.href);
                setExpanded("");
              } else setExpanded(isExpanded ? "" : link.href);
            }}
            className={`w-[45px] md:w-[260px] relative rounded-md font-[500] p-2 px-3 text-[15.5px] cursor-pointer ${
              pathname === link.href
                ? "text-[#8664F2] bg-[#FBF8FF] dark:bg-[#2a2440]"
                : "text-[#333333] dark:text-[#ededed] bg-[#fff] dark:bg-transparent"
            } ${isExpanded ? "mb-[0px]" : "mb-[10px]"}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {renderImage(link.icon, link.href)}
                <p className="font-[500] hidden md:block">{link.name}</p>
              </div>
              {link.items.length > 0 && (
                <motion.div
                  animate={{ rotate: isExpanded ? 180 : 0 }}
                  transition={{ duration: 1 }}
                  className="absolute right-4 top-[12.5px] md:static hidden md:block"
                >
                  <Image src={ArrowIcon} alt="arrow" width={17} className="dark:invert" />
                </motion.div>
              )}
            </div>

            <AnimatePresence initial={false}>
              {isExpanded && (
                <motion.div
                  key="content"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{
                    duration: 1,
                  }}
                  className="overflow-hidden"
                >
                  {link.items.map((sub, index) => (
                    <div
                      className={`h-[50px] flex items-center ${
                        index === 0 ? "mt-[10px]" : ""
                      }`}
                      key={index}
                    >
                      <div
                        key={index}
                        className={`flex justify-between h-[40px] w-[260px] items-center rounded-md pl-[25px] text-[15.5px] cursor-pointer ${
                          pathname === sub.href
                            ? "text-[#8664F2] bg-[#FBF8FF] dark:bg-[#2a2440]"
                            : "text-[#333333] dark:text-[#ededed] bg-[#fff] dark:bg-transparent"
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(sub.href);
                        }}
                      >
                        <p className="font-[500]">{sub.name}</p>
                      </div>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </>
  );
};

export default NavLinks;