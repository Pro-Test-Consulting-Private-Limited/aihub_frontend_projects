"use client";

import Breadcrumbs from "@/app/components/breadcrumbs";
import { ProjectGenerateDraftBreadcrumbs } from "@/app/constants/projects";
import { ProjectList } from "@/app/data/project";
import { ProjectItem } from "@/app/interfaces/project";
import { useSearchParams } from "next/navigation";
import { ChangeEvent, useCallback, useEffect, useState } from "react";

import FileIcon from "../../../../public/icons/projects/file.svg";
import PasteIcon from "../../../../public/icons/projects/paste.svg";
import CloseIcon from "../../../../public/icons/projects/close.svg";
import DeleteImage from "../../../../public/icons/delete.svg";
import CopyImage from "../../../../public/icons/projects/copy.svg";
import GenerateImage from "../../../../public/icons/projects/generate.svg";

import Image from "next/image";

import {
  AUTOMATED_TEST_CASE_GENERATION_ACCEPTED_FILES,
} from "@/app/constants/common";

import { generateScript } from "@/app/services/generate";
import { validateURL } from "@/app/utils";
import AuthGuard from "@/app/lib/authguard";

export default function ProjectAutomatedTestScriptGeneration() {
  const searchParams = useSearchParams();

  const projectId: number | null | undefined = Number(
    searchParams?.get("projectId"),
  );

  const workplace: string = searchParams?.get("workplace") || "";
  const domain: string = searchParams?.get("domain") || "";
  const segment: string = searchParams?.get("segment") || "Selenium";

  const [projectDetails, setProjectDetails] = useState<
    ProjectItem | null | undefined
  >(null);

  const [inputvalue, setInputValue] = useState<string | null>(null);
  const [error, setError] = useState<boolean>(false);

  const [file, setFile] = useState<File | null>(null);
  const [link, setLink] = useState<string | null>(null);

  const [loading, setLoading] = useState<boolean>(false);

  // Generated script
  const [response, setResponse] = useState<string>("");

  useEffect(() => {
    const matched = ProjectList.find((elem) => elem.id === projectId);
    setProjectDetails(matched);
  }, [projectId]);

  /**
   * Validate URL when Enter is pressed.
   */
  const handleEnter = () => {
    const value = inputvalue || "";

    if (validateURL(value)) {
      setLink(value);
      setError(false);
    } else {
      setError(true);
    }
  };

  /**
   * Handle test case file selection.
   */
  const handleFile = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files || e.target.files.length === 0) {
        return;
      }

      const selectedFile = e.target.files[0];

      setFile(selectedFile);
    },
    [],
  );

  /**
   * Generate Selenium/Cypress script.
   *
   * IMPORTANT:
   * - URL remains visible after generation.
   * - File remains visible after generation.
   * - Generate button changes to "Generated Script".
   * - Loading message is shown immediately.
   * - Loading stays for a minimum of 40 seconds.
   */
  const handleGenerate = async () => {
    if (!file || !link || loading) {
      return;
    }

    const startTime = Date.now();

    // Minimum loading time = 40 seconds
    const MINIMUM_LOADING_TIME = 40 * 1000;

    setLoading(true);

    // Clear old generated code before starting a new generation
    setResponse("");

    try {
      const res = await generateScript({
        file: file,
        url: link,
        test_engine: segment.toLowerCase(),
      });

      const generatedCode = res?.data?.code || "";

      // Calculate how much time is remaining
      const elapsedTime = Date.now() - startTime;

      const remainingTime =
        MINIMUM_LOADING_TIME - elapsedTime;

      // Keep loading visible for at least 40 seconds
      if (remainingTime > 0) {
        await new Promise<void>((resolve) => {
          setTimeout(resolve, remainingTime);
        });
      }

      // Show generated script
      setResponse(generatedCode);
    } catch (err) {
      console.error(
        `${segment} generation failed:`,
        err,
      );

      // Even if API fails quickly, keep loading
      // visible for at least 40 seconds.
      const elapsedTime = Date.now() - startTime;

      const remainingTime =
        MINIMUM_LOADING_TIME - elapsedTime;

      if (remainingTime > 0) {
        await new Promise<void>((resolve) => {
          setTimeout(resolve, remainingTime);
        });
      }

      setResponse("");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Copy generated script.
   */
  const handleCopy = async () => {
    if (!response) {
      return;
    }

    try {
      await navigator.clipboard.writeText(response);
    } catch (err) {
      console.error("Failed to copy!", err);
    }
  };

  /**
   * Clear everything.
   */
  const handleClearAll = () => {
    setFile(null);
    setLink(null);
    setInputValue(null);
    setResponse("");
    setError(false);
    setLoading(false);
  };

  /**
   * Remove only selected file.
   */
  const handleRemoveFile = () => {
    setFile(null);
  };



  return (
    <AuthGuard>
      <div className="p-6 pb-[4.5rem] h-full overflow-y-auto">

        {/* Breadcrumbs */}
        <Breadcrumbs
          breadcrumbs={ProjectGenerateDraftBreadcrumbs(
            workplace,
            domain,
            projectDetails,
            `Automated Test Script Generation - ${
              segment || ""
            }`,
          )}
        />

        {/* Heading */}
        <div className="text-[16px] text-[#40382E] mb-5">
          {response
            ? "Test Script Generated"
            : "Test Case uploaded"}
        </div>

        {/* =========================================================
            URL + FILE + GENERATE BUTTON
            This row remains visible even after generation.
           ========================================================= */}
        <div className="flex items-center">
          <div className="flex items-center">

            {/* ================= URL ================= */}
            {!link ? (
              <div
                className="
                  flex
                  min-w-[120px]
                  justify-center
                  items-center
                  px-2
                  pr-[40px]
                  h-[40px]
                  mr-4
                  border
                  border-[#5E6066]
                  rounded-[7px]
                  bg-white
                  text-sm
                  text-[#8664f2]
                  relative
                "
              >
                <Image
                  src={PasteIcon}
                  width={17}
                  className="absolute right-[15px]"
                  alt="paste"
                />

                <input
                  className="
                    w-[225px]
                    border-0
                    h-[38px]
                    text-[#5E6066]
                    outline-none
                  "
                  placeholder="Paste the link here..."
                  value={inputvalue || ""}
                  onChange={(e) => {
                    setInputValue(e.target.value);
                    setError(false);
                  }}
                  onKeyDown={(
                    e: React.KeyboardEvent<HTMLInputElement>,
                  ) => {
                    if (e.key === "Enter") {
                      handleEnter();
                    }
                  }}
                />
              </div>
            ) : (
              <div
                className="
                  text-sm
                  text-[#8664f2]
                  font-medium
                  py-2
                  mr-[10px]
                  underline
                "
              >
                {link}
              </div>
            )}

            {/* ================= FILE ================= */}
            {!file ? (
              <button
                type="button"
                className="
                  flex
                  min-w-[120px]
                  justify-center
                  items-center
                  px-2
                  py-2
                  mr-4
                  border
                  border-[#8664f2]
                  rounded-[7px]
                  bg-white
                  text-sm
                  text-[#8664f2]
                "
              >
                <Image
                  src={FileIcon}
                  width={20}
                  className="mr-1"
                  alt="file"
                />

                <input
                  id="generate-file"
                  type="file"
                  hidden
                  onChange={(
                    e: ChangeEvent<HTMLInputElement>,
                  ) => handleFile(e)}
                  accept={
                    AUTOMATED_TEST_CASE_GENERATION_ACCEPTED_FILES
                  }
                />

                <label
                  className="
                    menu-icon-uploader-label
                    cursor-pointer
                  "
                  htmlFor="generate-file"
                  tabIndex={0}
                >
                  Choose File
                </label>
              </button>
            ) : (
              <div
                className="
                  relative
                  flex
                  items-center
                  px-3
                  py-2
                  mr-4
                  bg-[#F1EDED]
                  border
                  border-[#F1EDED]
                  rounded-[7px]
                  text-sm
                  text-[#8664f2]
                  font-medium
                "
              >
                {file.name}

                {!loading && (
                  <Image
                    src={CloseIcon}
                    alt="close"
                    className="
                      ml-[15px]
                      cursor-pointer
                    "
                    width={11}
                    onClick={handleRemoveFile}
                  />
                )}
              </div>
            )}

            {/* ================= GENERATE BUTTON ================= */}
            {link && file && (
              <button
                type="button"
                onClick={handleGenerate}
                disabled={loading}
                className="
                  flex
                  justify-center
                  items-center
                  px-4
                  py-2
                  border-0
                  rounded-[7px]
                  bg-[#8664f2]
                  text-sm
                  text-white
                  disabled:opacity-70
                  disabled:cursor-not-allowed
                "
              >
                {loading ? (
                  <>
                    <Image
                      src="/icons/loading.gif"
                      width={15}
                      height={15}
                      className="mr-1"
                      alt="loading"
                      unoptimized
                    />

                    Generating...
                  </>
                ) : response ? (
                  <>
                    <Image
                      src={GenerateImage}
                      width={15}
                      className="mr-1"
                      alt="generated"
                    />

                    Generated Script
                  </>
                ) : (
                  <>
                    <Image
                      src={GenerateImage}
                      width={15}
                      className="mr-1"
                      alt="generate"
                    />

                    Generate Script
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* URL error */}
        {error && (
          <div
            className="
              text-[14px]
              font-[500]
              text-red-500
              mt-[5px]
            "
          >
            Please enter a valid URL
          </div>
        )}

        {/* =========================================================
            LOADING MESSAGE

            This appears immediately after clicking Generate Script
            and stays until the minimum 40 seconds is completed.
           ========================================================= */}
        {loading && (
          <div
            className="
              mt-[20px]
              ml-[20px]
              text-[14px]
              text-[#5E6066]
            "
          >
            Generating {segment} test script... Please wait.
          </div>
        )}

        {/* =========================================================
            GENERATED SCRIPT SECTION
           ========================================================= */}
        {response && !loading && (
          <div className="mt-[25px]">

            {/* Generated heading */}
            <div
              className="
                text-[16px]
                text-[#40382E]
                mb-5
              "
            >
              Test Script Generated
            </div>

            {/* Code container */}
            <div
              className="
                w-full
                overflow-x-auto
                bg-[#F1EDED]
                p-[20px]
                rounded-[7px]
              "
              style={{
                whiteSpace: "pre-wrap",
              }}
            >
              <pre
                className="
                  text-[13px]
                  text-[#40382E]
                  font-mono
                  whitespace-pre-wrap
                  break-words
                "
              >
                {response}
              </pre>
            </div>

            {/* Buttons */}
            <div
              className="
                flex
                items-center
                justify-end
                mt-[20px]
              "
            >
              {/* Clear */}
              <button
                type="button"
                className="
                  flex
                  items-center
                  border
                  border-[#CDCED1]
                  px-5
                  h-9
                  rounded-[7px]
                  text-[#504F55]
                  text-[13px]
                  cursor-pointer
                "
                onClick={handleClearAll}
              >
                <Image
                  src={DeleteImage}
                  width={18}
                  className="mr-[5px]"
                  alt="delete"
                />

                Clear All
              </button>

              {/* Copy */}
              <button
                type="button"
                className="
                  flex
                  items-center
                  border
                  px-5
                  h-9
                  rounded-[7px]
                  border-[#8664f2]
                  bg-[#8664f2]
                  text-white
                  text-sm
                  font-medium
                  ml-5
                "
                onClick={handleCopy}
              >
                <Image
                  src={CopyImage}
                  alt="copy"
                  width={15}
                  className="mr-2"
                />

                Copy to Clipboard
              </button>
            </div>
          </div>
        )}
      </div>
    </AuthGuard>
  );
}