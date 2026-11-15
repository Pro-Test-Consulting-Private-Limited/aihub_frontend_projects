"use client";

import { useEffect, useRef, useState } from "react";
import Avatar from "react-avatar";
import { useMsal } from "@azure/msal-react";
import type { AccountInfo } from "@azure/msal-browser";
import { fetchGraphProfilePhotoUrl } from "@/app/lib/auth-client";

/** Human name only — never raw UPN / @microsoft / onmicrosoft strings in chrome. */
function friendlyDisplayName(user: AccountInfo | undefined): string {
  const raw = (user?.name || "").trim();
  if (raw && !raw.includes("@") && !/onmicrosoft|\.ms\b/i.test(raw)) return raw;
  const upn = (user?.username || "").trim();
  const local = upn.split("@")[0] || "";
  if (local) {
    return local
      .replace(/[._]+/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim();
  }
  return "Account";
}

/**
 * Shared signed-in user control (photo + logout).
 * Used by Home TopNav and App Atlas header so both stay in sync.
 */
export function UserProfileMenu({ size = 40 }: { size?: number }) {
  const { instance, accounts } = useMsal();
  const [open, setOpen] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const photoUrlRef = useRef<string | null>(null);
  const user = accounts[0];
  const displayName = friendlyDisplayName(user);

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
        className="cursor-pointer select-none"
        onClick={() => setOpen((v) => !v)}
        title={displayName}
        aria-label={`Account · ${displayName}`}
      >
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoUrl}
            alt=""
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
            maxInitials={2}
          />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+10px)] z-50 min-w-[160px] rounded-[7px] border border-[#E5E7EB] bg-white shadow-xl dark:border-[#2a2a2a] dark:bg-[#141414]">
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
