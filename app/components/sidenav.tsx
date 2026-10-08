"use client";
import NavLinks from "./navlinks";
import Image from "next/image";
import Logo from "../../public/images/logo.png";
import LogoMobile from "../../public/images/logo-mobile.png";
import { useRouter } from "next/navigation";
import { NavItems, SettingsNav } from "../constants/nav-items";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import LightImage from "../../public/icons/navbar/light.png";
import DarkImage from "../../public/icons/navbar/dark.png";

interface SideNavProps {
  collapsed: boolean;
  transition: string;
  onExpand: () => void;
}

export default function SideNav({ collapsed, transition, onExpand }: SideNavProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const route = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  const activeTheme = mounted ? theme : "light";
  const wideOnly = collapsed ? "hidden" : "hidden md:block";

  const themeButtonClass = (value: string) =>
    `w-[100%] ${collapsed ? "" : "md:w-[50%]"} rounded-[10px] h-[35px] flex items-center justify-center cursor-pointer text-[16px] text-[#1F1F1F] dark:text-[#ededed] font-[500] ${
      activeTheme === value ? "bg-[#fff] dark:bg-[#0a0a0a]" : ""
    }`;
  const themeIconClass = `mr-[0px] ${collapsed ? "" : "md:mr-[5px]"} h-5 w-auto`;

  return (
    <div
      className={`flex justify-between h-full overflow-y-auto overflow-x-hidden flex-col px-4 py-4 bg-[#fff] dark:bg-[#0a0a0a] border-r border-[#FAFAFA] dark:border-[#1a1a1a] transition-[width] ${transition} fixed top-0 bottom-0 left-0 z-40 ml-0 ${
        collapsed ? "w-[75px]" : "w-[75px] md:w-[300px]"
      }`}
    >
      <div>
        <div
          className="h-[100px] flex items-center justify-center mb-4 cursor-pointer"
          onClick={() => route.push("/home")}
        >
          <Image
            src={Logo}
            alt="logo"
            height={50}
            width={180}
            priority
            className={`${wideOnly} h-[50px] w-auto`}
          />
          <Image
            src={LogoMobile}
            alt="logo"
            height={50}
            width={50}
            priority
            className={`${collapsed ? "block" : "block md:hidden"} h-[50px] w-auto`}
          />
        </div>
        <div className="flex grow flex-col">
          <div className={`text-[16px] text-[#1F1F1F] dark:text-[#ededed] mb-[15px] pl-[15px] font-[500] ${wideOnly}`}>
            Main Menu
          </div>
          <NavLinks list={NavItems} collapsed={collapsed} onExpand={onExpand} />
        </div>
      </div>

      <div className="flex flex-col mt-[40px]">
        <div className={`text-[16px] text-[#1F1F1F] dark:text-[#ededed] mb-[15px] pl-[15px] font-[500] ${wideOnly}`}>
          Preferences
        </div>
        <NavLinks list={SettingsNav} collapsed={collapsed} onExpand={onExpand} />
        <div
          className={`flex flex-col items-center w-[100%] rounded-[10px] h-[80px] px-[5px] py-[5px] bg-[#F5F6F6] dark:bg-[#1a1a1a] mb-[30px] mt-[20px] ${
            collapsed ? "" : "md:flex-row md:h-[45px] md:py-[0px]"
          }`}
        >
          <div className={themeButtonClass("light")} onClick={() => setTheme("light")} title="Light">
            <Image src={LightImage} alt="light" width={20} height={20} className={themeIconClass} />
            <div className={wideOnly}>Light</div>
          </div>
          <div className={themeButtonClass("dark")} onClick={() => setTheme("dark")} title="Dark">
            <Image src={DarkImage} alt="dark" width={20} height={20} className={themeIconClass} />
            <div className={wideOnly}>Dark</div>
          </div>
        </div>
      </div>
    </div>
  );
}
