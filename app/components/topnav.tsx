  /* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useRef, useState } from "react";
import Avatar from "react-avatar";
import NotificationImage from "../../public/icons/navbar/notifications.png";
import MessagesImage from "../../public/icons/navbar/messages.png";
import SearchImage from "../../public/icons/navbar/search.png";
import Image from "next/image";
import { useMsal } from "@azure/msal-react";

export default function TopNav() {
  const [user, setUser] = useState<any>({});
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<boolean>(false);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const { instance, accounts } = useMsal();

  useEffect(() => {
    if (accounts.length !== 0) setUser(accounts[0]);
  }, [accounts]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await instance.logoutRedirect();
  };

  return (
    <div className="flex justify-between items-center h-[70px] mt-[10px] w-[calc(100%-3rem)] bg-[#FFFFFF] dark:bg-[#0a0a0a] border-b border-[#E5E7EB] dark:border-[#2a2a2a] mx-6">
      <div></div>

      <div className="flex items-center">
        <div className="hidden md:block w-[250px] relative h-[40px] border border-[rgba(94,96,102, 0.5)] dark:border-[#2a2a2a] rounded-[15px] relative mr-[30px]">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="w-full h-full rounded-[15px] text-[16px] pl-[15px] placeholder-gray-500 placeholder-input bg-transparent text-[#1F1F1F] dark:text-[#ededed]"
          />
          <Image
            src={SearchImage}
            width={18}
            alt="search"
            className="absolute right-[15px] top-[10px]"
          />
        </div>
        <div className="w-[40px] h-[40px] rounded-[50px] border border-[#E5E7EB] dark:border-[#2a2a2a] flex items-center justify-center mr-[15px] cursor-pointer">
          <Image src={MessagesImage} width={20} alt="notification" />
        </div>
        <div className="w-[40px] h-[40px] rounded-[50px] border border-[#E5E7EB] dark:border-[#2a2a2a] flex items-center justify-center mr-[15px] cursor-pointer">
          <Image src={NotificationImage} width={20} alt="notification" />
        </div>

        <div
          className="cursor-pointer select-none"
          onClick={() => setOpen((prev) => !prev)}
        >
          <Avatar
            name={user?.name || ""}
            size="40px"
            textSizeRatio={2}
            round="25px"
            color="#8664f2"
            maxInitials={3}
          />
        </div>

        {open && (
          <div
            ref={cardRef}
            className="absolute top-[75px] right-[20px] w-[auto] bg-white dark:bg-[#141414] shadow-xl rounded-[7px] border border-[#E5E7EB] dark:border-[#2a2a2a] group"
          >
            <div className="absolute -top-[6px] right-[17px] w-[12px] h-[12px] bg-white dark:bg-[#141414] hover:bg-[#E5E7EB] dark:hover:bg-[#2a2a2a] border-t border-l border-[#E5E7EB] dark:border-[#2a2a2a] rotate-45 group-hover:bg-[#E5E7EB] dark:group-hover:bg-[#2a2a2a]"></div>

            <ul className="divide-y divide-[#E5E7EB] dark:divide-[#2a2a2a]">
              <li
                className="px-[17px] py-[8px] hover:bg-[#E5E7EB] dark:hover:bg-[#2a2a2a] cursor-pointer text-black dark:text-[#ededed] font-[500] text-[15px]"
                onClick={() => handleLogout()}
              >
                Logout
              </li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}