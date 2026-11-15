/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useRef, useState } from "react";
import Avatar from "react-avatar";
import NotificationImage from "../../public/icons/navbar/notifications.png";
import MessagesImage from "../../public/icons/navbar/messages.png";
import SearchImage from "../../public/icons/navbar/search.png";
import Image from "next/image";
import { useMsal } from "@azure/msal-react";
import { fetchGraphProfilePhotoUrl } from "@/app/lib/auth-client";

export default function TopNav() {
  const [user, setUser] = useState<any>({});
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<boolean>(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const photoUrlRef = useRef<string | null>(null);
  const { instance, accounts } = useMsal();

  useEffect(() => {
    if (accounts.length !== 0) setUser(accounts[0]);
  }, [accounts]);

  useEffect(() => {
    let cancelled = false;
    if (!accounts.length) {
      setPhotoUrl(null);
      return;
    }
    void fetchGraphProfilePhotoUrl(instance, accounts)
      .then((url) => {
        if (cancelled) {
          if (url) URL.revokeObjectURL(url);
          return;
        }
        if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current);
        photoUrlRef.current = url;
        setPhotoUrl(url);
      })
      .catch(() => {
        if (!cancelled) setPhotoUrl(null);
      });
    return () => {
      cancelled = true;
      if (photoUrlRef.current) {
        URL.revokeObjectURL(photoUrlRef.current);
        photoUrlRef.current = null;
      }
    };
  }, [instance, accounts]);

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

  const displayName = user?.name || user?.username || "Account";

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

        <div
          className="group relative cursor-pointer select-none"
          onClick={() => setOpen((prev) => !prev)}
          title={displayName}
        >
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl}
              alt={displayName}
              width={40}
              height={40}
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : (
            <Avatar
              name={displayName}
              size="40px"
              textSizeRatio={2}
              round="25px"
              color="#8664f2"
              maxInitials={3}
            />
          )}
          <div className="pointer-events-none absolute right-0 top-[48px] z-50 hidden whitespace-nowrap rounded-[8px] border border-[#E5E7EB] bg-white px-2.5 py-1.5 text-[12.5px] font-medium text-[#1F1F1F] shadow-md group-hover:block dark:border-[#2a2a2a] dark:bg-[#141414] dark:text-[#ededed]">
            {displayName}
          </div>
        </div>

        {open && (
          <div
            ref={cardRef}
            className="absolute right-0 top-[52px] z-50 min-w-[180px] rounded-[7px] border border-[#E5E7EB] bg-white shadow-xl dark:border-[#2a2a2a] dark:bg-[#141414]"
          >
            <div className="border-b border-[#E5E7EB] px-[17px] py-[10px] text-[13px] font-medium text-[#1F1F1F] dark:border-[#2a2a2a] dark:text-[#ededed]">
              {displayName}
            </div>
            <ul>
              <li
                className="cursor-pointer px-[17px] py-[8px] text-[15px] font-[500] text-black hover:bg-[#E5E7EB] dark:text-[#ededed] dark:hover:bg-[#2a2a2a]"
                onClick={() => void handleLogout()}
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
