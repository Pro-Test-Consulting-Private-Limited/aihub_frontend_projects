"use client";
import Breadcrumbs from "@/app/components/breadcrumbs";
import AuthGuard from "@/app/lib/authguard";
import { useEffect, useState } from "react";
import Pagination from "@/app/components/pagination";
import { ProjectGenerateDraftBreadcrumbs } from "@/app/constants/projects";
import { useSearchParams } from "next/navigation";
import { ProjectItem } from "@/app/interfaces/project";
import { ProjectList } from "@/app/data/project";
import { getExecutions } from "@/app/services/generate";
import ExecutionsTable from "./table";

export default function ErrorLog() {
  const searchParams = useSearchParams();
  const limit = 5;
  const [executions, setExecutions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  const projectId: number | null | undefined = Number(
    searchParams.get("projectId"),
  );
  const workplace: string = searchParams.get("workplace") || "";
  const domain: string = searchParams.get("domain") || "";

  const [projectDetails, setProjectDetails] = useState<
    ProjectItem | null | undefined
  >(null);

  useEffect(() => {
    fetchList();
  }, [page]);

  useEffect(() => {
    fetchProjectDetails();
  }, [projectId]);

  const fetchProjectDetails = () => {
    const matched = ProjectList.find((elem) => elem.id === projectId);
    setProjectDetails(matched);
  };

  const fetchList = () => {
    setLoading(true);
    getExecutions(page, limit)
      .then((res) => {
        setExecutions(res?.data?.items || []);
        setTotal(res?.data?.total || 0);
        setTotalPages(res?.data?.pages || 0);
      })
      .catch((err) => console.log(err))
      .finally(() => setLoading(false));
  };

  return (
    <AuthGuard>
      <div className="p-6 pb-[4.5rem] h-full overflow-y-auto">
        <Breadcrumbs
          breadcrumbs={ProjectGenerateDraftBreadcrumbs(
            workplace,
            domain,
            projectDetails,
            "Action Driven Test Case Generation - Rerun",
          )}
        />

        <div className="font-[500] text-[22px] text-[#081332] mt-[30px] mb-[15px]">
          Rerun
        </div>

        <ExecutionsTable data={executions} loading={loading} />

        {executions?.length !== 0 && (
          <div className="mt-[25px] flex justify-between items-center">
            <div className="text-[14px] text-[#AAA7A7] font-[500]">
              Showing {start}-{end} of {total} executions
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
