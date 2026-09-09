/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import Breadcrumbs from "@/app/components/breadcrumbs";
import { ProjectGenerateDraftBreadcrumbs } from "@/app/constants/projects";
import { ProjectList } from "@/app/data/project";
import { ProjectItem } from "@/app/interfaces/project";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import PasteIcon from "../../../../public/icons/projects/paste.svg";
import GenerateImage from "../../../../public/icons/projects/generate.svg";
import Image from "next/image";
import {
  generateActionDrivenNewRunSessions,
  generateActionDrivenStopSession,
} from "@/app/services/generate";
import TestResultsTable from "../generate-draft/table";
import DownloadIcon from "../../../../public/icons/projects/download.svg";
import { CSVLink } from "react-csv";
import { ACTION_DRIVEN_TEST_CASE_GENERATOR_SITE } from "@/app/config/urls";
import Modal from "@/app/components/modal";
import { openExternalTabAndWait } from "./actions";
import AuthGuard from "@/app/lib/authguard";
import { useProjects } from "@/app/lib/projectsStore";
import SaveExecutions from "./executions";

export default function ProjectActionDrivenTestCaseGenerationNewrun() {
  const searchParams = useSearchParams();
  const { projects } = useProjects();
  const projectId: number | null | undefined = Number(
    searchParams.get("projectId"),
  );
  const workplace: string = searchParams.get("workplace") || "";
  const domain: string = searchParams.get("domain") || "";

  const [projectDetails, setProjectDetails] = useState<
    ProjectItem | null | undefined
  >(null);
  const [inputvalue, setInputValue] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [session, setSession] = useState<string | null>(null);
  const [manualTestCases, setManualTestCases] = useState<any>(null);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [success, setSuccess] = useState<boolean>(false);

  useEffect(() => {
    fetchProjectDetails();
  }, [projectId]);

  const fetchProjectDetails = () => {
    const matched = ProjectList.find((elem) => elem.id === projectId);
    setProjectDetails(matched);
  };

  useEffect(() => {
    const project = projects.find(
      (item) => item.id === String(projectId),
    );

    if (project?.applicationUrl) {
      setInputValue(project.applicationUrl);
      setLink(null);
    }
  }, [projectId, projects]);
  const handleGenerate = () => {
    setLoading(true);
    generateActionDrivenNewRunSessions(link || "")
      .then((res) => {
        const ses = res.data?.sessionId || null;
        setSession(ses);
        openExternalTabAndWait({
          url: ACTION_DRIVEN_TEST_CASE_GENERATOR_SITE,
          onClosed: async () => {
            await generateActionDrivenStopSession(ses)
              .then(() => setShowModal(true))
              .catch((err) => console.log(err));
          },
        });
      })
      .catch((err) => console.log(err))
      .finally(() => {
        setLoading(false);
      });
  };

  const handleClear = useCallback(() => {
    setManualTestCases(null);
    setLink(null);
    setInputValue(null);
  }, []);

  return (
    <AuthGuard>
      <div className="p-6 pb-[4.5rem] h-full overflow-y-auto">
        <Breadcrumbs
          breadcrumbs={ProjectGenerateDraftBreadcrumbs(
            workplace,
            domain,
            projectDetails,
            "Action Driven Test Case Generation - New Run",
          )}
        />

        <Modal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          title={success ? "" : "Save New Execution"}
          modalStyle="w-[650px] p-[50px]"
        >
          <SaveExecutions
            session={session}
            setShowModal={setShowModal}
            setManualTestCases={setManualTestCases}
            success={success}
            setSuccess={setSuccess}
            workplace={workplace}
            domain={domain}
            projectDetails={projectDetails}
          />
        </Modal>

        <div className="flex items-center">
          <div className="flex">
            {!link ? (
              <div className="flex min-w-[120px] justify-center items-center px-2 pr-[40px] h-[40px] mr-4 border border-[#5E6066] rounded-[7px] bg-[#ffffff] text-sm text-[#8664f2] relative">
                <Image
                  src={PasteIcon}
                  width={17}
                  className="absolute right-[15px]"
                  alt="file"
                />
                <input
                  className="w-[225px] border-0 h-[38px] text-[#5E6066]"
                  placeholder="Paste the link here..."
                  value={inputvalue || ""}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                    if (e.key === "Enter") setLink(inputvalue);
                  }}
                />
              </div>
            ) : (
              <div className="text-sm text-[#8664f2] font-medium py-2 mr-[10px] underline">
                {link}
              </div>
            )}
          </div>
        </div>

        {link && !manualTestCases && (
          <div className="flex mt-6 items-center">
            <button
              onClick={() => handleGenerate()}
              disabled={loading}
              className="flex justify-center items-center px-4 py-2 border-0 rounded-[7px] bg-[#8664f2] text-sm text-[#FFFFFF]"
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
              <Image
                src={GenerateImage}
                width={15}
                className="mr-1"
                alt="jira"
              />
              Open URL
            </button>

            <button
              onClick={() => handleClear()}
              className="flex items-center border ml-4 px-5 h-9 rounded-[7px] border-[#8664f2] bg-[#fff] text-[#8664f2] text-sm font-medium"
            >
              CLEAR
            </button>
          </div>
        )}

        {manualTestCases && (
          <div>
            <TestResultsTable data={manualTestCases || []} />

            <div className="mt-24 flex justify-between">
              <div />

              <div className="flex items-center">
                <button
                  onClick={() => handleClear()}
                  className="flex items-center border px-5 h-9 rounded-[7px] border-[#8664f2] bg-[#8664f2] text-[#FFFFFF] text-sm font-medium"
                >
                  CLEAR ALL
                </button>
                <CSVLink
                  filename={`${link?.split(".")[1]}.csv`}
                  data={manualTestCases}
                  target="_blank"
                >
                  <button className="flex items-center border px-5 h-9 rounded-[7px] border-[#8664f2] bg-[#FFFFFF] text-[#8664f2] text-sm font-medium ml-5">
                    <Image
                      src={DownloadIcon}
                      alt="regenerate"
                      width={17}
                      className="mr-2"
                    />
                    Download as Excel
                  </button>
                </CSVLink>
              </div>
            </div>
          </div>
        )}
      </div>
    </AuthGuard>
  );
}


