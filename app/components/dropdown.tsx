"use client";
import Image from "next/image";
import ArrowIcon from "../../public/icons/arrow.png";
import { useEffect, useRef, useState } from "react";
import { DropdownItem } from "../interfaces/dropdown";

export default function Dropdown({
  options,
  placeholder,
  selected,
  onChange,
  className,
  buttonClass,
  lessHeight,
}: {
  options: DropdownItem[];
  placeholder: string;
  selected: DropdownItem | null;
  onChange: (e: DropdownItem) => void;
  className?: string;
  buttonClass?: string;
  lessHeight?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, []);

  return (
    <div className={`relative ${className || ""}`} ref={menuRef}>
      <button
        className={`text-[#000000] dark:text-[#ededed] bg-[#fff] dark:bg-[#141414] hover:bg-[#f0f0f0] dark:hover:bg-[#1f1f1f] border border-[rgba(94,96,102,0.5)] dark:border-[#2a2a2a] rounded-[12px] text-sm min-w-[200] px-3 h-[35px] text-center flex justify-between items-center ${
          buttonClass || ""
        } ${lessHeight ? "less-height" : ""}`}
        type="button"
        onClick={() => setOpen(!open)}
      >
        {selected ? selected.label : placeholder}
        <Image src={ArrowIcon} alt="arrow" width={15} className="ml-[15px] dark:invert" />
      </button>
      {open && (
        <div className="min-w-[200px] absolute left-0 top-[45px] z-10 bg-white dark:bg-[#141414] divide-y divide-gray-100 dark:divide-[#2a2a2a] rounded-lg shadow-sm border-[0.5px] border-[rgba(94, 96, 102, 0.1)] dark:border-[#2a2a2a]">
          <ul className="py-2 text-sm text-gray-700 dark:text-[#ededed]">
            {options.map((item: DropdownItem, index: number) => {
              return (
                <li
                  key={index}
                  className="cursor-pointer block px-4 py-2 hover:bg-gray-100 dark:hover:bg-[#1f1f1f]"
                  onClick={() => {
                    onChange(item);
                    setOpen(false);
                  }}
                >
                  {item.label}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}