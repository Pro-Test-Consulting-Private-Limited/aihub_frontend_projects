"use client";
import Breadcrumbs from "@/app/components/breadcrumbs";
import { ProjectGenerateDraftBreadcrumbs } from "@/app/constants/projects";
import { ProjectList } from "@/app/data/project";
import { ProjectItem, TestResultsItem } from "@/app/interfaces/project";
import AuthGuard from "@/app/lib/authguard";
import { useRouter, useSearchParams } from "next/navigation";
import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import FileIcon from "../../../../public/icons/projects/file.svg";
import JiraIcon from "../../../../public/icons/projects/jira.svg";
import CloseIcon from "../../../../public/icons/projects/close.svg";
import GenerateIcon from "../../../../public/icons/projects/generate.svg";
import ReGenerateIcon from "../../../../public/icons/projects/regenerate.svg";
import DownloadIcon from "../../../../public/icons/projects/download.svg";
import Image from "next/image";
import { GENERATE_DRAFT_ACCEPTED_FILES } from "@/app/constants/common";
import TestResultsTable from "./table";
import { downloadExcelDraft, generateDraft } from "@/app/services/generate";
import { useIntegrationStatus } from "@/app/hooks/use-integration-status";
import ConnectIntegrationModal from "@/app/components/connect-integration-modal";
import { toast } from "react-toastify";

function filenameFromContentDisposition(header: string | undefined, fallback: string) {
  if (!header) return fallback;
  const utfMatch = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utfMatch?.[1]) return decodeURIComponent(utfMatch[1]);
  const plainMatch = /filename="?([^"]+)"?/i.exec(header);
  return plainMatch?.[1] || fallback;
}

export default function ProjectGenerateDraft() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId: number | null | undefined = Number(
    searchParams.get("projectId"),
  );
  const workplace: string = searchParams.get("workplace") || "";
  const domain: string = searchParams.get("domain") || "";
  const [projectDetails, setProjectDetails] = useState<
    ProjectItem | null | undefined
  >(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [downloadingExcel, setDownloadingExcel] = useState(false);
  const [generated, setGenerated] = useState<boolean>(false);
  const [response, setResponse] = useState<TestResultsItem[]>([]);
  const { jira, refresh } = useIntegrationStatus();
  const [connectJira, setConnectJira] = useState(false);
  const handledJiraCallback = useRef(false);

  const fetchProjectDetails = useCallback(() => {
    const matched = ProjectList.find((elem) => elem.id === projectId);
    setProjectDetails(matched);
  }, [projectId]);

  useEffect(() => {
    fetchProjectDetails();
  }, [fetchProjectDetails]);

  useEffect(() => {
    const connected = searchParams.get("connected");
    const error = searchParams.get("error");
    if (!connected && !error) return;
    if (handledJiraCallback.current) return;
    handledJiraCallback.current = true;

    if (connected === "jira") toast.success("Jira connected");
    if (error) toast.error("Could not connect to Jira. Please try again.");

    const next = new URLSearchParams(searchParams.toString());
    next.delete("connected");
    next.delete("error");
    const qs = next.toString();
    router.replace(`${window.location.pathname}${qs ? `?${qs}` : ""}`);
  }, [searchParams, router]);

  const handleFile = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selected = e.target.files[0];
      setFile(selected);
    }
  }, []);

  const handleGenerate = () => {
    if (!file) return;
    setLoading(true);
    generateDraft(file)
      .then((res) => {
        setResponse(res.data || []);
        setGenerated(true);
      })
      .catch((err) => {
        console.log(err);
        toast.error(err?.data?.error || "Failed to generate test cases");
      })
      .finally(() => setLoading(false));
  };

  const handleDownloadExcel = async () => {
    if (!file) {
      toast.error("Upload the same PDF again before exporting Excel");
      return;
    }

    setDownloadingExcel(true);
    try {
      const res = await downloadExcelDraft(file);
      const blob = new Blob([res.data], {
        type:
          res.headers?.["content-type"] ||
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const fallbackName = `${file.name.replace(/\.pdf$/i, "")}_test_suite.xlsx`;
      const downloadName = filenameFromContentDisposition(
        res.headers?.["content-disposition"],
        fallbackName,
      );

      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = downloadName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Excel downloaded");
    } catch (err: unknown) {
      console.log(err);
      const maybeAxios = err as { data?: Blob | { error?: string } };
      if (maybeAxios?.data instanceof Blob) {
        try {
          const text = await maybeAxios.data.text();
          const parsed = JSON.parse(text) as { error?: string };
          toast.error(parsed.error || "Failed to download Excel");
        } catch {
          toast.error("Failed to download Excel");
        }
      } else {
        toast.error(
          (maybeAxios?.data as { error?: string } | undefined)?.error ||
            "Failed to download Excel",
        );
      }
    } finally {
      setDownloadingExcel(false);
    }
  };

  const handleClear = useCallback(() => {
    setGenerated(false);
    setFile(null);
  }, []);

  return (
    <AuthGuard>
      <div className="p-6 pb-[10rem] w-[100%] h-full overflow-y-auto">
        <Breadcrumbs
          breadcrumbs={ProjectGenerateDraftBreadcrumbs(
            workplace,
            domain,
            projectDetails,
            "Test Case Generation",
          )}
        />

        <div className="text-base text-[#081332] mb-5">
          Test Case Requirements
        </div>

        <div className="flex items-center">
          {!file ? (
            <button className="flex min-w-[150px] justify-center items-center px-3 py-2 mr-4 border border-[#8664f2] rounded-[7px] bg-[#ffffff] text-sm text-[#8664f2]">
              <Image src={FileIcon} width={20} className="mr-1" alt="file" />
              <input
                id="generate-file"
                type="file"
                hidden
                onChange={(e: ChangeEvent<HTMLInputElement>) => handleFile(e)}
                accept={GENERATE_DRAFT_ACCEPTED_FILES}
              />
              <label
                className="menu-icon-uploader-label cursor-pointer"
                htmlFor="generate-file"
                tabIndex={0}
              >
                Choose File
              </label>
            </button>
          ) : (
            <div className="relative flex items-center min-w-[150px] px-3 py-2 pr-10 mr-4 bg-[#F1EDED] border border-[#F1EDED] rounded-[7px] text-sm text-[#8664f2] font-medium cursor-pointer">
              {file.name}
              <Image
                src={CloseIcon}
                alt="close"
                className="absolute right-3"
                width={10}
                onClick={() => setFile(null)}
              />
            </div>
          )}
          {!generated && (
            jira.connected ? (
              <div className="flex min-w-[150px] justify-center items-center px-3 py-2 border border-[#28A745] rounded-[7px] bg-[#ffffff] text-sm text-[#28A745]">
                <Image src={JiraIcon} width={20} className="mr-1" alt="jira" />
                {jira.siteName ? `Connected to ${jira.siteName}` : "Connected to Jira"}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConnectJira(true)}
                className="flex min-w-[150px] justify-center items-center px-3 py-2 border border-[#8664f2] rounded-[7px] bg-[#ffffff] text-sm text-[#8664f2]"
              >
                <Image src={JiraIcon} width={20} className="mr-1" alt="jira" />
                Connect to Jira
              </button>
            )
          )}
        </div>

        {file && !generated && (
          <button
            onClick={() => handleGenerate()}
            disabled={loading}
            className="flex min-w-[150px] mt-6 justify-center items-center px-3 py-2 border-0 rounded-[7px] bg-[#8664f2] text-sm text-[#FFFFFF]"
          >
            {loading && (
              <Image
                src={"/icons/loading.gif"}
                width={15}
                height={15}
                className="mr-1"
                alt="loading"
              />
            )}
            <Image src={GenerateIcon} width={15} className="mr-1" alt="jira" />
            Generate Draft
          </button>
        )}

        {generated && (
          <div className="w-[100%] overflow-x-auto mt-[10px]">
            {/* <div className="flex flex-wrap justify-between items-center mt-4">
              <div className="text-sm text-[#081332]">Project Name: </div>
              <div className="text-sm text-[#081332]">Module Tested: </div>
              <div className="text-sm text-[#081332]">Testing Type: </div>
              <div className="text-sm text-[#081332]">Tested on/in: </div>
            </div> */}

            <TestResultsTable data={response || []} />
          </div>
        )}

        {generated && (
          <div className="mt-[50px] flex justify-between">
            <button
              className="border-0 text-[#8664f2] text-sm font-medium"
              onClick={() => handleClear()}
            >
              CLEAR ALL
            </button>

            <div className="flex items-center">
              <button
                type="button"
                onClick={() => handleGenerate()}
                disabled={loading || !file}
                className="flex items-center border px-5 h-9 rounded-[7px] border-[#8664f2] bg-[#8664f2] text-[#FFFFFF] text-sm font-medium disabled:opacity-60"
              >
                <Image
                  src={ReGenerateIcon}
                  alt="regenerate"
                  width={17}
                  className="mr-2"
                />
                Regenerate
              </button>
              <button
                type="button"
                onClick={() => handleDownloadExcel()}
                disabled={downloadingExcel || !file}
                className="flex items-center border px-5 h-9 rounded-[7px] border-[#8664f2] bg-[#FFFFFF] text-[#8664f2] text-sm font-medium ml-5 disabled:opacity-60"
              >
                <Image
                  src={DownloadIcon}
                  alt="download excel"
                  width={17}
                  className="mr-2"
                />
                {downloadingExcel ? "Downloading..." : "Download as Excel"}
              </button>
            </div>
          </div>
        )}
      </div>
      <ConnectIntegrationModal
        provider={connectJira ? "jira" : null}
        onClose={() => setConnectJira(false)}
        onConnected={async () => {
          await refresh();
          toast.success("Jira connected");
        }}
      />
    </AuthGuard>
  );
}
