"use client";

import React from "react";

const Progress = ({ current }: { current: number }) => {
  return (
    <div className="relative flex items-center">
      <div className="w-[calc(100%-35px)] bg-[#dddddd] dark:bg-[#2a2a2a] rounded-full h-[6px] overflow-hidden">
        <div
          className="h-full bg-[#1A932E] rounded-full transition-all duration-500"
          style={{ width: `${current}%` }}
        ></div>
      </div>

      <div className="text-center text-[11px] font-[500] ml-[8px] text-[#1A932E]">
        {current}%
      </div>
    </div>
  );
};

export default Progress;