"use client";
import Breadcrumbs from "@/app/components/breadcrumbs";
import {
  WORKPLACE_ERROR_LOG_SORTBY,
  WorkPlaceErrorLogBreadcrumbs,
} from "@/app/constants/workplace";
import AuthGuard from "@/app/lib/authguard";
import Image from "next/image";
import { useEffect, useState } from "react";
import SearchImage from "../../../../public/icons/navbar/search.png";
import Dropdown from "@/app/components/dropdown";
import { DropdownItem } from "@/app/interfaces/dropdown";
import ErrorLogTable from "./table";
import Pagination from "@/app/components/pagination";
import { fetchErrorLogs } from "@/app/services/workplace";

export default function ErrorLog() {
  const limit = 10;
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<DropdownItem | null>(
    WORKPLACE_ERROR_LOG_SORTBY[0]
  );
  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  useEffect(() => {
    fetchList();
  }, [page]);

  const fetchList = () => {
    setLoading(true);
    fetchErrorLogs(page, limit)
      .then((res) => {
        setLogs(res?.data?.data || []);
        setTotal(res?.data?.total || 0);
        setTotalPages(res?.data?.pages || 0);
      })
      .catch((err) => console.log(err))
      .finally(() => setLoading(false));
  };

  return (
    <AuthGuard>
      <div className="p-6 pb-[4.5rem] h-full overflow-y-auto">
        <Breadcrumbs breadcrumbs={WorkPlaceErrorLogBreadcrumbs} />

        <div className="w-[100%] flex justify-between items-center flex-wrap mt-[30px] mb-[15px]">
          <div className="font-[500] text-[22px] text-[#081332]">Error Log</div>

          <div className="flex items-center flex-wrap mt-[15px]">
            <div className="w-[190px] relative h-[40px] border border-[border-[rgba(94,96,102, 0.5)]] rounded-[12px] relative mr-[15px]">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="w-full h-full rounded-[15px] text-[14px] text-[#5E6066] pl-[15px] placeholder-gray-500 placeholder-input"
              />
              <Image
                src={SearchImage}
                width={15}
                alt="search"
                className="absolute right-[15px] top-[12px]"
              />
            </div>

            <div className="w-[max-content] text-[#000000] bg-[#fff] border border-[rgba(94,96,102, 0.5)] rounded-[12px] text-[14px] h-[40px] flex">
              <div className="flex justify-center h-full flex items-center pl-[15px] pr-[10px] font-[500]">
                Sort by :
              </div>
              <Dropdown
                options={WORKPLACE_ERROR_LOG_SORTBY}
                selected={sortBy}
                onChange={setSortBy}
                placeholder="Select Sort by"
                buttonClass="border-0 h-[38px] min-w-[150px] rounded-l-[0px] pl-[10px] pr-[15px] text-[#5E6066]"
              />
            </div>

            <button className="px-[25px] rounded-[7px] bg-[#8664F2] text-[#fff] h-[40px] flex items-center text-[14px] font-[500] ml-[15px]">
              <div className="text-[22px] mr-[5px] mb-[3px]">+</div> Add
            </button>
          </div>
        </div>

        <ErrorLogTable data={logs} loading={loading} />

        {logs?.length !== 0 && (
          <div className="mt-[25px] flex justify-between items-center">
            <div className="text-[14px] text-[#AAA7A7] font-[500]">
              Showing {start}-{end} of {total} logs
            </div>

            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={(p) => setPage(p)}
              disabled={loading}
            />
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
