"use client";

import { useState } from "react";
import NotificationImage from "../../public/icons/navbar/notifications.png";
import MessagesImage from "../../public/icons/navbar/messages.png";
import SearchImage from "../../public/icons/navbar/search.png";
import Image from "next/image";
import { UserProfileMenu } from "@/app/components/user-profile-menu";

export default function TopNav() {
  const [search, setSearch] = useState("");

  return (
    <div className="mx-6 flex h-[64px] w-[calc(100%-3rem)] shrink-0 items-center justify-between border-b border-[#E5E7EB] bg-[#FFFFFF] dark:border-[#2a2a2a] dark:bg-[#0a0a0a]">
      <div></div>

      <div className="relative flex items-center">
        <div className="relative mr-[30px] hidden h-[40px] w-[250px] rounded-[15px] border border-[rgba(94,96,102,0.5)] md:block dark:border-[#2a2a2a]">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="placeholder-input h-full w-full rounded-[15px] bg-transparent pl-[15px] text-[16px] text-[#1F1F1F] placeholder-gray-500 dark:text-[#ededed]"
          />
          <Image
            src={SearchImage}
            width={18}
            alt="search"
            className="absolute right-[15px] top-[10px] dark:invert"
          />
        </div>
        <div className="mr-[15px] flex h-[40px] w-[40px] cursor-pointer items-center justify-center rounded-[50px] border border-[#E5E7EB] dark:border-[#2a2a2a]">
          <Image src={MessagesImage} width={20} alt="messages" className="dark:invert" />
        </div>
        <div className="mr-[15px] flex h-[40px] w-[40px] cursor-pointer items-center justify-center rounded-[50px] border border-[#E5E7EB] dark:border-[#2a2a2a]">
          <Image src={NotificationImage} width={20} alt="notification" className="dark:invert" />
        </div>
        <UserProfileMenu size={40} />
      </div>
    </div>
  );
}
