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

type ModelState =
  | "running"
  | "scaledToZero"
  | "initializing"
  | "pending"
  | "updating"
  | "paused"
  | "failed"
  | "unknown";

const MODEL_STATUS_UI: Record<
  ModelState,
  { label: string; hint?: string; dot: string; badge: string }
> = {
  running: {
    label: "Model ready",
    dot: "bg-[#22C55E]",
    badge: "bg-[#F0FDF4] text-[#166534] border-[#BBF7D0]",
  },
  scaledToZero: {
    label: "Model asleep",
    hint: "Your first upload wakes it up and can take about 2 minutes.",
    dot: "bg-[#F59E0B]",
    badge: "bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]",
  },
  initializing: {
    label: "Model starting",
    hint: "Usually ready in about 2 minutes.",
    dot: "bg-[#3B82F6] animate-pulse",
    badge: "bg-[#EFF6FF] text-[#1E40AF] border-[#BFDBFE]",
  },
  pending: {
    label: "Model starting",
    hint: "Usually ready in about 2 minutes.",
    dot: "bg-[#3B82F6] animate-pulse",
    badge: "bg-[#EFF6FF] text-[#1E40AF] border-[#BFDBFE]",
  },
  updating: {
    label: "Model updating",
    dot: "bg-[#3B82F6] animate-pulse",
    badge: "bg-[#EFF6FF] text-[#1E40AF] border-[#BFDBFE]",
  },
  paused: {
    label: "Model paused",
    hint: "Uploads will fail until the endpoint is resumed in Hugging Face.",
    dot: "bg-[#DC3545]",
    badge: "bg-[#FDF1F1] text-[#991B1B] border-[#FECACA]",
  },
  failed: {
    label: "Model failed",
    hint: "The Hugging Face endpoint reported an error.",
    dot: "bg-[#DC3545]",
    badge: "bg-[#FDF1F1] text-[#991B1B] border-[#FECACA]",
  },
  unknown: {
    label: "Model status unavailable",
    dot: "bg-[#9CA3AF]",
    badge: "bg-[#F3F4F6] text-[#374151] border-[#E5E7EB]",
  },
};

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

  const [modelState, setModelState] =
    useState<ModelState | null>(null);

  // ---------------------------------------------------------
  // Model Status (reads HF endpoint state; never wakes the model)
  // ---------------------------------------------------------

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      let next: ModelState = "unknown";

      try {
        const res = await fetch(
          `${CLARIFY_API_BASE}/api/v1/clarify/model-status`,
          { cache: "no-store" }
        );
        const data = await res.json();

        if (data?.state && data.state in MODEL_STATUS_UI) {
          next = data.state;
        }
      } catch {
        next = "unknown";
      }

      if (cancelled) return;

      setModelState(next);

      const starting =
        next === "initializing" ||
        next === "pending" ||
        next === "updating";

      timer = setTimeout(poll, starting ? 10_000 : 30_000);
    };

    poll();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

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

        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="text-base text-[#081332]">
            Requirement Clarification Agent
          </div>

          {modelState && (
            <div
              className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full border text-xs font-medium ${MODEL_STATUS_UI[modelState].badge}`}
            >
              <span
                className={`w-2 h-2 rounded-full ${MODEL_STATUS_UI[modelState].dot}`}
              />
              {MODEL_STATUS_UI[modelState].label}
            </div>
          )}

          {modelState && MODEL_STATUS_UI[modelState].hint && (
            <div className="text-xs text-[#6B7280]">
              {MODEL_STATUS_UI[modelState].hint}
            </div>
          )}
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

            </div>
          )}

      </div>
    </AuthGuard>
  );
}