import React from "react";

const Checkbox = ({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) => {
  return (
    <div className="w-full flex items-center justify-center">
      <input
        id="default-checkbox"
        type="checkbox"
        value=""
        checked={checked}
        onChange={() => onChange(!checked)}
        className="w-4 h-4 text-blue-600 bg-[#FFFFFF] border-[#1F1F1F] rounded-sm cursor-pointer"
      />
      {label !== "" && (
        <label
          htmlFor="default-checkbox"
          className="text-sm font-medium text-gray-900 dark:text-gray-300"
        >
          {label}
        </label>
      )}
    </div>
  );
};

export default Checkbox;
