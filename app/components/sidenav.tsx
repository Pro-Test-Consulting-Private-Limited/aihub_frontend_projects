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

export default function SideNav() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const route = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  const activeTheme = mounted ? theme : "light";

  return (
    <div
      className={`flex justify-between h-full w-[75px] md:w-[300px] overflow-y-auto flex-col px-4 py-4 bg-[#fff] dark:bg-[#0a0a0a] border-r border-[#FAFAFA] dark:border-[#1a1a1a] transition-[width] ease-in-out duration-500 fixed top-0 bottom-0 left-0 z-40 ml-0`}
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
            className="hidden md:block"
          />
          <Image
            src={LogoMobile}
            alt="logo"
            height={50}
            className="block md:hidden"
          />
        </div>
        <div className="flex grow flex-col">
          <div className="text-[16px] text-[#1F1F1F] dark:text-[#ededed] mb-[15px] pl-[15px] font-[500] hidden md:block">
            Main Menu
          </div>
          <NavLinks list={NavItems} />
        </div>
      </div>

      <div className="flex flex-col mt-[40px]">
        <div className="text-[16px] text-[#1F1F1F] dark:text-[#ededed] mb-[15px] pl-[15px] font-[500] hidden md:block">
          Preferences
        </div>
        <NavLinks list={SettingsNav} />
        <div className="flex flex-col md:flex-row items-center w-[100%] rounded-[10px] h-[80px] md:h-[45px] px-[5px] py-[5px] md:py-[0px] items-center bg-[#F5F6F6] dark:bg-[#1a1a1a] mb-[30px] mt-[20px]">
          <div
            className={`w-[100%] md:w-[50%] rounded-[10px] h-[35px] flex items-center justify-center cursor-pointer text-[16px] text-[#1F1F1F] dark:text-[#ededed] font-[500] ${
              activeTheme === "light" ? "bg-[#fff] dark:bg-[#0a0a0a]" : ""
            }`}
            onClick={() => setTheme("light")}
          >
            <Image
              src={LightImage}
              alt="light"
              width={20}
              className="mr-[0px] md:mr-[5px]"
            />
            <div className="hidden md:block">Light</div>
          </div>
          <div
            className={`w-[100%] md:w-[50%] rounded-[10px] h-[35px] flex items-center justify-center cursor-pointer text-[16px] text-[#1F1F1F] dark:text-[#ededed] font-[500] ${
              activeTheme === "dark" ? "bg-[#fff] dark:bg-[#0a0a0a]" : ""
            }`}
            onClick={() => setTheme("dark")}
          >
            <Image
              src={DarkImage}
              alt="dark"
              width={20}
              className="mr-[0px] md:mr-[5px]"
            />
            <div className="hidden md:block">Dark</div>
          </div>
        </div>
      </div>
    </div>
  );
}