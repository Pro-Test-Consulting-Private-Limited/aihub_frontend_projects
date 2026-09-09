import React from "react";
import { errorToast, infoToast, successToast } from "../constants/toast";

const Toast = ({ type, message }: { type: string; message: string }) => {
  const className =
    type === "info" ? infoToast : type === "error" ? errorToast : successToast;
  return (
    <div
      id="alert-border-1"
      className={`flex items-center fixed bottom-[30px] right-[30px] p-4 mb-4 ${className}`}
      role="alert"
    >
      <div className="ms-3 text-sm font-medium">{message}</div>
      <button
        type="button"
        className="ms-auto -mx-1.5 -my-1.5 bg-blue-50 text-blue-500 rounded-lg focus:ring-2 focus:ring-blue-400 p-1.5 hover:bg-blue-200 inline-flex items-center justify-center h-6 w-6"
        data-dismiss-target="#alert-border-1"
        aria-label="Close"
      >
        <span className="sr-only">Dismiss</span>
        <svg
          className="w-3 h-3"
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 14 14"
        >
          <path
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6"
          />
        </svg>
      </button>
    </div>
  );
};

export default Toast;
