"use client";

import { useEffect, useRef, useState } from "react";
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

function initialsOf(name: string) {
  return name
    .split(/[\s.@_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

/**
 * Shared signed-in user control (photo + logout).
 * Used by Home TopNav and App Atlas header so both stay in sync.
 * Falls back to colored initials (same visual language as presence) when Graph has no photo.
 */
export function UserProfileMenu({ size = 40 }: { size?: number }) {
  const { instance, accounts } = useMsal();
  const [open, setOpen] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const photoUrlRef = useRef<string | null>(null);
  const user = accounts[0];
  const displayName = friendlyDisplayName(user);
  const letters = initialsOf(displayName) || "?";

  useEffect(() => {
    let cancelled = false;
    if (!accounts.length) {
      setPhotoUrl(null);
      return;
    }
    // Re-fetch when the signed-in account changes (other users / account switch).
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when account identity changes
  }, [instance, accounts, accounts[0]?.homeAccountId, accounts[0]?.localAccountId]);

  useEffect(() => {
    const onDoc = (event: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const clearPhoto = () => {
    if (photoUrlRef.current) {
      URL.revokeObjectURL(photoUrlRef.current);
      photoUrlRef.current = null;
    }
    setPhotoUrl(null);
  };

  return (
    <div className="relative shrink-0" ref={cardRef}>
      <button
        type="button"
        className="flex shrink-0 cursor-pointer select-none items-center justify-center overflow-hidden rounded-full border-2 border-[#8664F2] bg-[#8664F2] text-white shadow-sm ring-2 ring-white dark:ring-[#0a0a0a]"
        style={{ width: size, height: size, minWidth: size, minHeight: size }}
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
            className="h-full w-full rounded-full object-cover"
            onError={clearPhoto}
          />
        ) : (
          <span className="text-[10px] font-semibold leading-none" style={{ fontSize: Math.max(10, Math.round(size * 0.36)) }}>
            {letters}
          </span>
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
