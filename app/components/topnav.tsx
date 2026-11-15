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

  return (
    <div className="flex h-[70px] w-[calc(100%-3rem)] items-center justify-between border-b border-[#E5E7EB] bg-[#FFFFFF] mx-6 mt-[10px] dark:border-[#2a2a2a] dark:bg-[#0a0a0a]">
      <div></div>

      <div className="flex items-center">
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

        <div className="cursor-pointer select-none" onClick={() => setOpen((prev) => !prev)}>
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl}
              alt={user?.name || "Profile"}
              width={40}
              height={40}
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : (
            <Avatar
              name={user?.name || ""}
              size="40px"
              textSizeRatio={2}
              round="25px"
              color="#8664f2"
              maxInitials={3}
            />
          )}
        </div>

        {open && (
          <div
            ref={cardRef}
            className="group absolute right-[20px] top-[75px] w-[auto] rounded-[7px] border border-[#E5E7EB] bg-white shadow-xl dark:border-[#2a2a2a] dark:bg-[#141414]"
          >
            <div className="absolute -top-[6px] right-[17px] h-[12px] w-[12px] rotate-45 border-l border-t border-[#E5E7EB] bg-white group-hover:bg-[#E5E7EB] dark:border-[#2a2a2a] dark:bg-[#141414] dark:group-hover:bg-[#2a2a2a]" />
            <ul className="divide-y divide-[#E5E7EB] dark:divide-[#2a2a2a]">
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
