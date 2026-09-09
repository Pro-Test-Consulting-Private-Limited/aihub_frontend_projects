import React from "react";
import { JSONValue } from "@/app/interfaces/project";

interface RenderObjectProps {
  data: JSONValue;
}

export const RenderObject: React.FC<RenderObjectProps> = ({ data }) => {
  if (data === null || typeof data !== "object") {
    return <span>{String(data)}</span>;
  }

  return (
    <ul className="ml-[20px] list-none">
      {Object.entries(data).map(([key, value]) => (
        <ul key={key}>
          <div className="flex">
            <div className="h-[5px] w-[5px] bg-[#000] rounded-[5px] mt-[7px] mr-[8px]" />
            <div className="mr-[7px] font-[600]">{key}: </div>
            {typeof value !== "object" && <RenderObject data={value} />}
          </div>
          {typeof value === "object" && <RenderObject data={value} />}
        </ul>
      ))}
    </ul>
  );
};
