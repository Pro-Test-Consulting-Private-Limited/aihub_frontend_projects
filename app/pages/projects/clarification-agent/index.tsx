"use client";

import Breadcrumbs from "@/app/components/breadcrumbs";
import { ProjectList } from "@/app/data/project";
import { ProjectItem } from "@/app/interfaces/project";
import AuthGuard from "@/app/lib/authguard";
import { useSearchParams } from "next/navigation";
import { ChangeEvent, useEffect, useState } from "react";
import FileIcon from "../../../../public/icons/projects/file.svg";
import JiraIcon from "../../../../public/icons/projects/jira.svg";
import Image from "next/image";

const CLARIFY_API_BASE =
  process.env.NEXT_PUBLIC_CLARIFY_API_BASE_URL || "http://localhost:4000";

type ClarifyPhase =
  | "idle"
  | "processing"
  | "clarified"
  | "failed";

interface ClarificationQuestion {
  questionId: string;
  category: string;
  question: string;
  reason?: string;
}

interface ClarificationFinding {
  category: string;
  priority?: string;
  question: string;
  reason?: string;
  confidenceScore?: number;
}

interface ClarificationJson {
  findings?: ClarificationFinding[];
  errors?: string[];
}

interface ClarificationResult {
  processingId?: string;
  filename?: string;
  inputType?: string;
  status?: string;
  model?: string;
  qwenOutput?: ClarificationJson;
  finalOutput?: ClarificationJson;
  questions?: ClarificationQuestion[];
  questionCount?: number;
  qualityGate?: {
    passed: boolean;
    errors?: string[];
  };
  confidenceScore?: number;
  processingTimeMs?: number;
}

export default function RequirementClarificationAgent() {
  const searchParams = useSearchParams();

  const projectIdParam = searchParams.get("projectId");

  const projectId =
    projectIdParam && !Number.isNaN(Number(projectIdParam))
      ? Number(projectIdParam)
      : null;

  const workplace = searchParams.get("workplace") || "";
  const domain = searchParams.get("domain") || "";

  const [projectDetails, setProjectDetails] =
    useState<ProjectItem | null>(null);

  const [clarifyFile, setClarifyFile] =
    useState<File | null>(null);

  const [clarifyScreenshot, setClarifyScreenshot] =
    useState<File | null>(null);

  const [clarifyPhase, setClarifyPhase] =
    useState<ClarifyPhase>("idle");

  const [clarifyError, setClarifyError] =
    useState<string | null>(null);

  const [clarificationResult, setClarificationResult] =
    useState<ClarificationResult | null>(null);

  // ---------------------------------------------------------
  // JSON Expand / Collapse State
  // ---------------------------------------------------------

  const [showQwenJson, setShowQwenJson] =
    useState(false);

  const [showFinalJson, setShowFinalJson] =
    useState(false);

  const [activeJsonTab, setActiveJsonTab] =
    useState<"final" | "qwen">("final");

  // ---------------------------------------------------------
  // Project Details
  // ---------------------------------------------------------

  useEffect(() => {
    if (projectId === null) {
      setProjectDetails(null);
      return;
    }

    const matched = ProjectList.find(
      (elem) => elem.id === projectId
    );

    setProjectDetails(matched || null);
  }, [projectId]);

  // ---------------------------------------------------------
  // Stateless Clarification Pipeline
  // ---------------------------------------------------------

  const runClarificationPipeline = async (
    uploadFile: File,
    inputType: "upload" | "screenshot"
  ) => {
    setClarifyError(null);
    setClarificationResult(null);

    // Reset JSON sections whenever a new requirement is uploaded
    setShowQwenJson(false);
    setShowFinalJson(false);

    setClarifyPhase("processing");

    try {
      console.log("==============================================");
      console.log(
        "Requirement Clarification Agent started."
      );
      console.log("File:", uploadFile.name);
      console.log("Input type:", inputType);

      const formData = new FormData();

      formData.append("file", uploadFile);

      formData.append(
        "inputType",
        inputType === "screenshot"
          ? "screenshot"
          : "document"
      );

      // -----------------------------------------------------
      // Single Stateless API Call
      // -----------------------------------------------------

      const response = await fetch(
        `${CLARIFY_API_BASE}/api/v1/clarify/analyze`,
        {
          method: "POST",
          body: formData,
        }
      );

      let data: any;

      try {
        data = await response.json();
      } catch {
        throw new Error(
          `Backend returned HTTP ${response.status} with an invalid response.`
        );
      }

      if (!response.ok) {
        const backendMessage =
          data?.message ||
          data?.error ||
          data?.details ||
          "Requirement clarification failed.";

        throw new Error(String(backendMessage));
      }

      console.log(
        "Requirement Clarification Agent completed."
      );

      console.log(
        "Questions:",
        data.questionCount
      );

      console.log(
        "Confidence Score:",
        data.confidenceScore
      );

      console.log(
        "Processing Time:",
        data.processingTimeMs,
        "ms"
      );

      console.log(
        "Qwen Output:",
        data.qwenOutput
      );

      console.log(
        "Final Validated Output:",
        data.finalOutput
      );

      console.log("==============================================");

      setClarificationResult(data);
      setClarifyPhase("clarified");
    } catch (err: any) {
      console.error(
        "Clarification Agent failed:",
        err
      );

      setClarifyError(
        err?.message ||
          "Something went wrong while processing the requirement."
      );

      setClarifyPhase("failed");
    }
  };

  // ---------------------------------------------------------
  // Document Upload
  // ---------------------------------------------------------

  const handleClarifyDocSelect = (
    e: ChangeEvent<HTMLInputElement>
  ) => {
    const selected = e.target.files?.[0];

    if (!selected) {
      return;
    }

    setClarifyFile(selected);
    setClarifyScreenshot(null);

    runClarificationPipeline(
      selected,
      "upload"
    );
  };

  // ---------------------------------------------------------
  // Screenshot Upload
  // ---------------------------------------------------------

  const handleClarifyScreenshotSelect = (
    e: ChangeEvent<HTMLInputElement>
  ) => {
    const selected = e.target.files?.[0];

    if (!selected) {
      return;
    }

    setClarifyScreenshot(selected);
    setClarifyFile(null);

    runClarificationPipeline(
      selected,
      "screenshot"
    );
  };

  // ---------------------------------------------------------
  // UI State
  // ---------------------------------------------------------

  const isClarifyBusy =
    clarifyPhase === "processing";

  const selectedFile =
    clarifyFile || clarifyScreenshot;

  const clarificationQuestions =
    clarificationResult?.questions || [];

  const clarificationCount =
    clarificationResult?.questionCount ??
    clarificationQuestions.length;

  // ---------------------------------------------------------
  // UI
  // ---------------------------------------------------------

  return (
    <AuthGuard>
      <div className="p-6 pb-[10rem] w-full h-full overflow-y-auto">

        {/* -------------------------------------------------
            Breadcrumbs
        ------------------------------------------------- */}

        <Breadcrumbs
          breadcrumbs={[
            {
              label: "Home",
              href: "/home",
              active: false,
            },
            {
              label: workplace,
              href: "/home",
              active: false,
            },
            {
              label: domain,
              href: "/home",
              active: false,
            },
            {
              label: `Projects : ${
                projectDetails?.name || "Project"
              }`,
              href:
                projectId !== null
                  ? `/projects/${projectId}?workplace=${workplace}&domain=${domain}`
                  : "/projects",
              active: false,
            },
            {
              label:
                "Requirement Clarification Agent",
              href:
                projectId !== null
                  ? `/projects/clarification-agent?projectId=${projectId}&workplace=${workplace}&domain=${domain}`
                  : "/projects/clarification-agent",
              active: true,
            },
          ]}
        />

        {/* -------------------------------------------------
            Page Title
        ------------------------------------------------- */}

        <div className="text-base text-[#081332] mb-6">
          Requirement Clarification Agent
        </div>

        {/* -------------------------------------------------
            Upload Actions
        ------------------------------------------------- */}

        <div className="flex items-center gap-4 mb-6">

          {/* Choose File */}

          <button
            type="button"
            disabled={isClarifyBusy}
            className="flex min-w-[150px] justify-center items-center px-3 py-2 border border-[#8664f2] rounded-[7px] bg-white text-sm text-[#8664f2] disabled:opacity-50"
          >
            <Image
              src={FileIcon}
              width={20}
              className="mr-1"
              alt="file"
            />

            <input
              id="clarify-file"
              type="file"
              hidden
              disabled={isClarifyBusy}
              onChange={handleClarifyDocSelect}
              accept=".pdf,.docx,.txt"
            />

            <label
              className="cursor-pointer"
              htmlFor="clarify-file"
              tabIndex={0}
            >
              Choose File
            </label>
          </button>

          {/* Jira */}

          <button
            type="button"
            disabled
            className="flex min-w-[150px] justify-center items-center px-3 py-2 border border-[#8664f2] rounded-[7px] bg-white text-sm text-[#8664f2] opacity-50"
            title="Jira integration is not connected yet"
          >
            <Image
              src={JiraIcon}
              width={20}
              className="mr-1"
              alt="jira"
            />

            Connect to Jira
          </button>

          {/* Screenshot */}

          <button
            type="button"
            disabled={isClarifyBusy}
            className="flex min-w-[150px] justify-center items-center px-3 py-2 border border-[#8664f2] rounded-[7px] bg-white text-sm text-[#8664f2] disabled:opacity-50"
          >
            <input
              id="clarify-screenshot"
              type="file"
              hidden
              disabled={isClarifyBusy}
              onChange={
                handleClarifyScreenshotSelect
              }
              accept="image/png,image/jpeg"
            />

            <label
              className="cursor-pointer"
              htmlFor="clarify-screenshot"
              tabIndex={0}
            >
              Upload Screenshot
            </label>
          </button>

        </div>

        {/* -------------------------------------------------
            Selected File
        ------------------------------------------------- */}

        {selectedFile && (
          <div className="bg-[#F8F7FF] border border-[#E5E7EB] rounded-[8px] p-4 mb-6 max-w-[1000px]">

            <div className="text-xs text-[#6B7280] mb-1">
              Selected requirement
            </div>

            <div className="text-sm font-medium text-[#081332]">
              {selectedFile.name}
            </div>

          </div>
        )}

        {/* -------------------------------------------------
            Processing
        ------------------------------------------------- */}

        {isClarifyBusy && (
          <div className="max-w-[1000px] bg-[#F8F7FF] border border-[#8664f2] rounded-[8px] p-5 mb-6">

            <div className="flex items-center gap-3">

              <div className="w-5 h-5 border-2 border-[#8664f2] border-t-transparent rounded-full animate-spin" />

              <div>

                <div className="text-sm font-medium text-[#4C1D95]">
                  Analyzing Requirement
                </div>

                <div className="text-xs text-[#6B7280] mt-1">
                  Extracting and analyzing the requirement
                  to generate clarification questions.
                </div>

              </div>

            </div>

          </div>
        )}

        {/* -------------------------------------------------
            Error
        ------------------------------------------------- */}

        {clarifyError && (
          <div className="max-w-[1000px] text-sm text-[#DC3545] bg-[#FDF1F1] border border-[#DC3545] rounded-[8px] p-4 mb-6">

            <div className="font-semibold mb-1">
              Requirement clarification failed
            </div>

            <div className="leading-5">
              {clarifyError}
            </div>

            {clarifyError
              .toLowerCase()
              .includes("xref") && (
              <div className="mt-3 text-xs text-[#7F1D1D] leading-5">
                The uploaded PDF appears to have an
                invalid PDF cross-reference table.
                Open the PDF, save/export it again as
                a new PDF, and upload the newly saved
                file.
              </div>
            )}

          </div>
        )}

        {/* -------------------------------------------------
            Clarification Questions
        ------------------------------------------------- */}

        {clarifyPhase === "clarified" &&
          clarificationResult && (
            <div className="max-w-[1000px] bg-white border border-[#E5E7EB] rounded-[10px] p-5 mb-6">

              {/* Header */}

              <div className="flex items-center justify-between mb-5">

                <div>

                  <div className="text-lg font-semibold text-[#081332]">
                    Clarification Questions
                  </div>

                  <div className="text-xs text-[#6B7280] mt-1">
                    Questions that should be clarified
                    before test design.
                  </div>

                </div>

                <div className="bg-[#F0EBFF] text-[#6D4AFF] px-3 py-2 rounded-md text-sm font-semibold">
                  {clarificationCount}{" "}
                  {clarificationCount === 1
                    ? "Question"
                    : "Questions"}
                </div>

              </div>

              {/* Questions */}

              <div className="space-y-3">

                {clarificationQuestions.length > 0 ? (
                  clarificationQuestions.map(
                    (
                      item: ClarificationQuestion,
                      index: number
                    ) => (
                      <div
                        key={
                          item.questionId ||
                          index
                        }
                        className="border border-[#E5E7EB] rounded-[8px] p-4 hover:border-[#8664f2] transition-colors"
                      >

                        {/* Header */}

                        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">

                          <div className="flex items-center gap-2">

                            <span className="inline-flex items-center px-2 py-1 rounded-md bg-[#F3F4F6] text-[#374151] text-xs font-semibold">
                              {item.questionId ||
                                `Q-${String(
                                  index + 1
                                ).padStart(
                                  3,
                                  "0"
                                )}`}
                            </span>

                            <span className="text-xs font-medium text-[#6B7280]">
                              {item.category ||
                                "Uncategorized"}
                            </span>

                          </div>



                        </div>

                        {/* Question */}

                        <div className="text-sm text-[#081332] leading-6">
                          {item.question}
                        </div>

                        {/* Reason */}

                        {item.reason && (
                          <div className="mt-3 text-xs text-[#6B7280] leading-5">

                            <span className="font-semibold text-[#374151]">
                              Reason:
                            </span>{" "}

                            {item.reason}

                          </div>
                        )}



                      </div>
                    )
                  )
                ) : (
                  <div className="text-sm text-[#6B7280] py-4">
                    No clarification questions were
                    generated.
                  </div>
                )}

              </div>

              {/* -------------------------------------------------
                  JSON Output
              ------------------------------------------------- */}

              {(clarificationResult.finalOutput ||
                clarificationResult.qwenOutput) && (
                <div className="mt-5 pt-4 border-t border-[#E5E7EB]">
                  <div className="rounded-[10px] border border-[#E5E7EB] overflow-hidden bg-white">

                    {/* Tabs */}
                    <div className="flex items-center justify-between border-b border-[#E5E7EB] px-3 py-2 bg-white">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveJsonTab("final");
                            setShowFinalJson(true);
                            setShowQwenJson(false);
                          }}
                          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                            activeJsonTab === "final"
                              ? "bg-white text-[#081332] shadow-sm border border-[#E5E7EB]"
                              : "text-[#6B7280] hover:text-[#081332]"
                          }`}
                        >
                          Final Validated JSON
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setActiveJsonTab("qwen");
                            setShowQwenJson(true);
                            setShowFinalJson(false);
                          }}
                          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                            activeJsonTab === "qwen"
                              ? "bg-white text-[#081332] shadow-sm border border-[#E5E7EB]"
                              : "text-[#6B7280] hover:text-[#081332]"
                          }`}
                        >
                          Qwen Raw Payload
                        </button>
                      </div>
                    </div>

                    {/* JSON toolbar */}
                    <div className="flex items-center justify-start gap-3 px-4 py-2 border-b border-[#E5E7EB] bg-white">
                      <button
                        type="button"
                        title="Copy JSON"
                        onClick={async () => {
                          const value =
                            activeJsonTab === "final"
                              ? clarificationResult.finalOutput
                              : clarificationResult.qwenOutput;

                          if (value) {
                            await navigator.clipboard?.writeText(
                              JSON.stringify(value, null, 2)
                            );
                          }
                        }}
                        className="w-7 h-7 flex items-center justify-center rounded text-[#64748B] hover:bg-[#F3F4F6] hover:text-[#081332]"
                      >
                        ⧉
                      </button>

                      <button
                        type="button"
                        title="Download JSON"
                        onClick={() => {
                          const value =
                            activeJsonTab === "final"
                              ? clarificationResult.finalOutput
                              : clarificationResult.qwenOutput;

                          if (!value) return;

                          const blob = new Blob(
                            [JSON.stringify(value, null, 2)],
                            { type: "application/json" }
                          );

                          const url = URL.createObjectURL(blob);
                          const anchor = document.createElement("a");
                          anchor.href = url;
                          anchor.download =
                            activeJsonTab === "final"
                              ? "final-validated.json"
                              : "qwen-raw-payload.json";
                          anchor.click();
                          URL.revokeObjectURL(url);
                        }}
                        className="w-7 h-7 flex items-center justify-center rounded text-[#64748B] hover:bg-[#F3F4F6] hover:text-[#081332]"
                      >
                        ↓
                      </button>

                      <button
                        type="button"
                        title="Open JSON"
                        onClick={() => {
                          const value =
                            activeJsonTab === "final"
                              ? clarificationResult.finalOutput
                              : clarificationResult.qwenOutput;

                          if (!value) return;

                          const json = JSON.stringify(value, null, 2);
                          const newWindow = window.open("", "_blank");

                          if (newWindow) {
                            newWindow.document.write(
                              `<pre style="white-space:pre-wrap;font-family:monospace;padding:24px;">${json.replace(
                                /</g,
                                "&lt;"
                              )}</pre>`
                            );
                            newWindow.document.close();
                          }
                        }}
                        className="w-7 h-7 flex items-center justify-center rounded text-[#64748B] hover:bg-[#F3F4F6] hover:text-[#081332]"
                      >
                        ↗
                      </button>
                    </div>

                    {/* Status strip */}
                    <div className="flex items-center justify-between px-3 py-2 bg-[#111827] text-[10px] text-[#9CA3AF] border-b border-[#374151]">
                      <div className="flex items-center gap-2">
                        <span className="text-[#22C55E]">✓</span>
                        <span>
                          spec_status:{" "}
                          <span className="text-[#22C55E] font-semibold">
                            {clarificationResult.qualityGate?.passed
                              ? '"VALIDATED"'
                              : '"FAILED"'}
                          </span>
                        </span>
                      </div>

                      <span>
                        processing_id:{" "}
                        {clarificationResult.processingId
                          ? `${clarificationResult.processingId.slice(0, 8)}...`
                          : "—"}
                      </span>
                    </div>

                    {/* JSON body */}
                    <div className="w-full max-h-[420px] overflow-auto bg-[#0F172A] px-4 py-4">
                      <pre className="text-[11px] leading-5 whitespace-pre-wrap break-words font-mono">
                        {(() => {
                          const value =
                            activeJsonTab === "final"
                              ? clarificationResult.finalOutput
                              : clarificationResult.qwenOutput;

                          const json = JSON.stringify(value, null, 2) || "";

                          return json.split("\n").map((line, lineIndex) => {
                            const tokens = line.split(
                              /("(?:\\.|[^"\\])*"(?=\s*:)|"(?:\\.|[^"\\])*"|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?)/g
                            );

                            return (
                              <span key={lineIndex} className="block">
                                {tokens.map((token, tokenIndex) => {
                                  if (!token) return null;

                                  const isKey =
                                    /^"(?:\\.|[^"\\])*"(?=\s*:)$/.test(token);

                                  const isString =
                                    /^"(?:\\.|[^"\\])*"$/.test(token);

                                  const isBooleanOrNull =
                                    /^(true|false|null)$/.test(token);

                                  const isNumber =
                                    /^-?\d+(?:\.\d+)?$/.test(token);

                                  if (isKey) {
                                    return (
                                      <span
                                        key={tokenIndex}
                                        className="text-[#C084FC]"
                                      >
                                        {token}
                                      </span>
                                    );
                                  }

                                  if (isString) {
                                    return (
                                      <span
                                        key={tokenIndex}
                                        className="text-[#FBBF24]"
                                      >
                                        {token}
                                      </span>
                                    );
                                  }

                                  if (isBooleanOrNull) {
                                    return (
                                      <span
                                        key={tokenIndex}
                                        className="text-[#34D399]"
                                      >
                                        {token}
                                      </span>
                                    );
                                  }

                                  if (isNumber) {
                                    return (
                                      <span
                                        key={tokenIndex}
                                        className="text-[#60A5FA]"
                                      >
                                        {token}
                                      </span>
                                    );
                                  }

                                  return (
                                    <span
                                      key={tokenIndex}
                                      className="text-[#CBD5E1]"
                                    >
                                      {token}
                                    </span>
                                  );
                                })}
                              </span>
                            );
                          });
                        })()}
                      </pre>
                    </div>

                  </div>
                </div>
              )}

            </div>
          )}

      </div>
    </AuthGuard>
  );
}