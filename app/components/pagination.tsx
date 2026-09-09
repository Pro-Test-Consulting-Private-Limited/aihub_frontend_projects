import React from "react";
import PrevIcon from "../../public/icons/prev.png";
import NextIcon from "../../public/icons/next.png";
import Image from "next/image";

const Pagination = ({
  currentPage,
  totalPages,
  onPageChange,
  disabled,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}) => {
  const pageNumbers = [];

  const maxPagesToShow = 3;
  let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
  const endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);

  if (endPage - startPage + 1 < maxPagesToShow) {
    startPage = Math.max(1, endPage - maxPagesToShow + 1);
  }

  for (let i = startPage; i <= endPage; i++) {
    pageNumbers.push(i);
  }

  return (
    <div className="flex items-center justify-center space-x-[12px] text-[12px] font-[500]">
      {/* Prev Button */}
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1 || disabled}
        className="w-[25px] h-[25px] bg-[#F5F5F5] flex items-center justify-center rounded-[4px]"
      >
        <Image src={PrevIcon} width={5} alt="prev" />
      </button>

      {/* First page */}
      {startPage > 1 && (
        <>
          <button
            onClick={() => onPageChange(1)}
            className={`w-[25px] h-[25px] flex items-center justify-center rounded-[4px] ${
              currentPage === 1
                ? "bg-[#8664F2] text-white"
                : "bg-[#F5F5F5] text-[#404B52]"
            }`}
            disabled={disabled}
          >
            1
          </button>
          {startPage > 2 && <span className="px-2">...</span>}
        </>
      )}

      {/* Middle page numbers */}
      {pageNumbers.map((num) => (
        <button
          key={num}
          onClick={() => onPageChange(num)}
          className={`w-[25px] h-[25px] flex items-center justify-center rounded-[4px] ${
            num === currentPage
              ? "bg-[#8664F2] text-white"
              : "bg-[#F5F5F5] text-[#404B52]"
          }`}
          disabled={disabled}
        >
          {num}
        </button>
      ))}

      {/* Last page */}
      {endPage < totalPages && (
        <>
          {endPage < totalPages - 1 && <span className="px-2">...</span>}
          <button
            onClick={() => onPageChange(totalPages)}
            className={`w-[25px] h-[25px] flex items-center justify-center rounded-[4px] ${
              currentPage === totalPages
                ? "bg-[#8664F2] text-white"
                : "bg-[#F5F5F5] text-[#404B52]"
            }`}
            disabled={disabled}
          >
            {totalPages}
          </button>
        </>
      )}

      {/* Next Button */}
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages || disabled}
        className="w-[25px] h-[25px] bg-[#F5F5F5] flex items-center justify-center rounded-[4px]"
      >
        <Image src={NextIcon} width={5} height={5} alt="prev" />
      </button>
    </div>
  );
};

export default Pagination;
