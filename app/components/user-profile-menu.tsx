"use client";

import { useEffect, useRef, useState } from "react";
import Avatar from "react-avatar";
import { useMsal } from "@azure/msal-react";
import { fetchGraphProfilePhotoUrl } from "@/app/lib/auth-client";

/**
 * Shared signed-in user control (photo + name hover + logout).
 * Used by Home TopNav and App Atlas header so both stay in sync.
 */
export function UserProfileMenu({ size = 40 }: { size?: number }) {
  const { instance, accounts } = useMsal();
  const [open, setOpen] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const photoUrlRef = useRef<string | null>(null);
  const user = accounts[0];
  const displayName = user?.name || user?.username || "Account";

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
    const onDoc = (event: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div className="relative" ref={cardRef}>
      <button
        type="button"
        className="group relative cursor-pointer select-none"
        onClick={() => setOpen((v) => !v)}
        title={displayName}
        aria-label={displayName}
      >
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoUrl}
            alt={displayName}
            width={size}
            height={size}
            className="rounded-full object-cover"
            style={{ width: size, height: size }}
          />
        ) : (
          <Avatar
            name={displayName}
            size={`${size}px`}
            textSizeRatio={2}
            round={`${Math.round(size / 2)}px`}
            color="#8664f2"
            maxInitials={3}
          />
        )}
        <span className="pointer-events-none absolute right-0 top-[calc(100%+8px)] z-50 hidden whitespace-nowrap rounded-[8px] border border-[#E5E7EB] bg-white px-2.5 py-1.5 text-[12.5px] font-medium text-[#1F1F1F] shadow-md group-hover:block dark:border-[#2a2a2a] dark:bg-[#141414] dark:text-[#ededed]">
          {displayName}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+10px)] z-50 min-w-[180px] rounded-[7px] border border-[#E5E7EB] bg-white shadow-xl dark:border-[#2a2a2a] dark:bg-[#141414]">
          <div className="border-b border-[#E5E7EB] px-[17px] py-[10px] text-[13px] font-medium text-[#1F1F1F] dark:border-[#2a2a2a] dark:text-[#ededed]">
            {displayName}
          </div>
          <button
            type="button"
            className="block w-full px-[17px] py-[8px] text-left text-[15px] font-[500] text-black hover:bg-[#E5E7EB] dark:text-[#ededed] dark:hover:bg-[#2a2a2a]"
            onClick={() => void instance.logoutRedirect()}
          >
            Logout
          </button>
        </div>
      )}
    </div>
  );
}
