/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Breadcrumbs from "@/app/components/breadcrumbs";
import { ProjectGenerateDraftBreadcrumbs } from "@/app/constants/projects";
// import { ProjectList } from "@/app/data/project";
import { useProjects, type Project } from "@/app/lib/projectsStore";
import { useSearchParams } from "next/navigation";
import {
  ChangeEvent,
  useCallback,
  useEffect,
  useState,
} from "react";

import FileIcon from "../../../../../public/icons/projects/file.svg";
import PasteIcon from "../../../../../public/icons/projects/paste.svg";
import CloseIcon from "../../../../../public/icons/projects/close.svg";
import GenerateImage from "../../../../../public/icons/projects/generate.svg";
import DownloadIcon from "../../../../../public/icons/download.png";

import Image from "next/image";

import {
  AUTOMATED_TEST_CASE_GENERATION_ACCEPTED_FILES,
} from "@/app/constants/common";

import {
  generateCypress,
  getDownloadUrl,
  getFileContent,
  getFilesTree,
  uploadGenerateScriptFile,
} from "@/app/services/generate";

import { validateURL } from "@/app/utils";
import AuthGuard from "@/app/lib/authguard";
// import { useProjects } from "@/app/lib/projectsStore";

import FileItem from "./file";
import FileViewer from "@/app/components/fileviewer";

export default function ProjectAutomatedTestScriptGenerationCypress() {
  const searchParams = useSearchParams();

  const projectId = searchParams?.get("projectId") || "";
  const { projects } = useProjects();

  const workplace =
    searchParams?.get("workplace") || "";

  const domain =
    searchParams?.get("domain") || "";

  const [projectDetails, setProjectDetails] =
    useState<Project | null>(null);

  const [inputvalue, setInputValue] =
    useState<string>("");

  useEffect(() => {
    const selectedProject = projects.find(
      (project) => String(project.id) === String(projectId)
    );

    if (selectedProject?.applicationUrl) {
      setInputValue(selectedProject.applicationUrl);
    }
  }, [projects, projectId]);

  const [error, setError] =
    useState<boolean>(false);

  const [file, setFile] =
    useState<File | null>(null);

  const [link, setLink] =
    useState<string | null>(null);

  const [loading, setLoading] =
    useState<boolean>(false);

  const [resTree, setResTree] =
    useState<any>(null);

  const [expanded, setExpanded] =
    useState<Set<string>>(new Set());

  const [generatedFiles, setGeneratedFiles] =
    useState<any[]>([]);

  const [selectedFile, setSelectedFile] =
    useState<string | null>(null);

  const [fileContent, setFileContent] =
    useState<any>(null);

  const [fileLoading, setFileLoading] =
    useState<boolean>(false);

  /*
   * =========================================================
   * PROJECT DETAILS
   * =========================================================
   */

  useEffect(() => {
    const matched = projects.find(
      (project) => String(project.id) === String(projectId)
    );

    setProjectDetails(matched ?? null);
  }, [projects, projectId]);

  /*
   * =========================================================
   * URL VALIDATION
   * =========================================================
   */

  const handleEnter = () => {
    const value =
      inputvalue.trim();

    if (validateURL(value)) {
      setLink(value);
      setError(false);
    } else {
      setError(true);
    }
  };

  /*
   * =========================================================
   * FILE SELECTION
   * =========================================================
   */

  const handleFile = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files?.length) {
        return;
      }

      const selected =
        e.target.files[0];

      setFile(selected);
      setError(false);
    },
    [],
  );

  /*
   * =========================================================
   * FILE TREE
   * =========================================================
   */

  const fetchFilesTree = async () => {
    try {
      const response =
        await getFilesTree();

      return response?.data || null;
    } catch (err) {
      console.error(
        "Failed to get files tree:",
        err,
      );

      return null;
    }
  };

  /*
   * =========================================================
   * FILE PATH
   * =========================================================
   */

  const getFilePath = (
    path: string,
    tree: any,
  ) => {
    if (!path) {
      return "";
    }

    return path
      .split("/")
      .filter(
        (item) =>
          item !== tree?.framework,
      )
      .join("/");
  };

  /*
   * =========================================================
   * FETCH FILE CONTENT
   * =========================================================
   */

  const fetchFileContent = async (
    path: string,
    tree: any,
  ) => {
    if (!path) {
      return null;
    }

    try {
      setSelectedFile(path);
      setFileLoading(true);

      const response =
        await getFileContent(
          getFilePath(
            path,
            tree,
          ),
        );

      const content =
        response?.data || null;

      setFileContent(content);

      return content;
    } catch (err) {
      console.error(
        "Failed to get file content:",
        err,
      );

      return null;
    } finally {
      setFileLoading(false);
    }
  };

  /*
   * =========================================================
   * PREPARE GENERATED FILES
   * =========================================================
   */

  const prepareGeneratedFiles = (
    files: any[],
    tree: any,
  ) => {
    const expandedFolders =
      new Set<string>();

    const names: string[] = [];

    files.forEach((item) => {
      if (!item?.path) {
        return;
      }

      names.push(
        item.name,
      );

      const parts =
        item.path
          .split("/")
          .filter(Boolean);

      let current =
        tree?.framework || "";

      for (
        let i = 0;
        i < parts.length - 1;
        i++
      ) {
        current = current
          ? `${current}/${parts[i]}`
          : parts[i];

        expandedFolders.add(
          current,
        );
      }
    });

    return {
      names,
      expandedFolders,
    };
  };

  /*
   * =========================================================
   * DOWNLOAD
   * =========================================================
   */

  const handleDownload = async (
    path: string,
  ) => {
    try {
      const response =
        await getDownloadUrl(
          getFilePath(
            path,
            resTree,
          ),
        );

      const url =
        response?.data
          ?.download_url;

      if (url) {
        window.open(
          url,
          "_blank",
        );
      }
    } catch (err) {
      console.error(
        "Download failed:",
        err,
      );
    }
  };

  /*
   * =========================================================
   * GENERATE SCRIPT
   * =========================================================
   *
   * Minimum loading time = 40 seconds.
   *
   * The upload row remains visible:
   *
   * Before:
   * URL | CSV | Generate Script
   *
   * During:
   * URL | CSV | Generating...
   *
   * After:
   * URL | CSV | Generated Script
   *
   * Generated code appears underneath.
   * =========================================================
   */

  const handleGenerate = async () => {
    if (
      !file ||
      !link ||
      loading
    ) {
      return;
    }

    /*
     * Start timer immediately when
     * Generate Script is clicked.
     */
    const startTime =
      Date.now();

    /*
     * Minimum 40 seconds.
     */
    const MINIMUM_LOADING_TIME =
      40 * 1000;

    /*
     * Show loading immediately.
     */
    setLoading(true);

    /*
     * Clear previous generated result.
     */
    setResTree(null);

    setExpanded(
      new Set(),
    );

    setGeneratedFiles([]);

    setSelectedFile(null);

    setFileContent(null);

    try {
      /*
       * =====================================================
       * STEP 1 - UPLOAD TEST CASE
       * =====================================================
       */

      console.log(
        "Uploading test case...",
      );

      const uploadResponse =
        await uploadGenerateScriptFile({
          excel_file: file,
          base_url: link,
        });

      console.log(
        "Upload response:",
        uploadResponse?.data,
      );

      const sessionId =
        uploadResponse?.data
          ?.session_id;

      if (!sessionId) {
        throw new Error(
          "Session ID not received.",
        );
      }

      /*
       * =====================================================
       * STEP 2 - GENERATE
       * =====================================================
       */

      console.log(
        "Starting script generation...",
      );

      const generateResponse =
        await generateCypress({
          session_id:
            sessionId,
        });

      console.log(
        "Generation response:",
        generateResponse?.data,
      );

      const generated =
        generateResponse?.data
          ?.generated_files || [];

      if (
        !Array.isArray(generated) ||
        generated.length === 0
      ) {
        throw new Error(
          "No generated files returned.",
        );
      }

      /*
       * =====================================================
       * STEP 3 - GET GENERATED FILE TREE
       * =====================================================
       */

      console.log(
        "Loading generated files...",
      );

      const latestTree =
        await fetchFilesTree();

      if (!latestTree) {
        throw new Error(
          "Generated file tree could not be loaded.",
        );
      }

      /*
       * =====================================================
       * STEP 4 - PREPARE FILE TREE
       * =====================================================
       */

      const prepared =
        prepareGeneratedFiles(
          generated,
          latestTree,
        );

      /*
       * =====================================================
       * STEP 5 - OPEN FIRST GENERATED FILE
       * =====================================================
       */

      const firstFile =
        generated[0];

      let firstFileContent =
        null;

      if (firstFile?.path) {
        try {
          const response =
            await getFileContent(
              getFilePath(
                firstFile.path,
                latestTree,
              ),
            );

          firstFileContent =
            response?.data || null;
        } catch (err) {
          console.error(
            "Failed to load first generated file:",
            err,
          );
        }
      }

      /*
       * =====================================================
       * STEP 6 - WAIT FOR MINIMUM 40 SECONDS
       * =====================================================
       */

      const elapsed =
        Date.now() -
        startTime;

      const remaining =
        MINIMUM_LOADING_TIME -
        elapsed;

      if (remaining > 0) {
        console.log(
          `Waiting another ${Math.ceil(
            remaining / 1000,
          )} seconds...`,
        );

        await new Promise<void>(
          (resolve) => {
            setTimeout(
              resolve,
              remaining,
            );
          },
        );
      }

      /*
       * =====================================================
       * STEP 7 - SHOW GENERATED RESULT
       * =====================================================
       */

      console.log(
        "40 seconds completed. Showing generated script.",
      );

      setResTree(
        latestTree,
      );

      setExpanded(
        prepared.expandedFolders,
      );

      setGeneratedFiles(
        prepared.names,
      );

      if (firstFile?.path) {
        setSelectedFile(
          firstFile.path,
        );
      }

      setFileContent(
        firstFileContent,
      );
    } catch (err) {
      console.error(
        "Script generation failed:",
        err,
      );

      /*
       * If API fails immediately,
       * still keep loading for 40 seconds.
       */

      const elapsed =
        Date.now() -
        startTime;

      const remaining =
        MINIMUM_LOADING_TIME -
        elapsed;

      if (remaining > 0) {
        await new Promise<void>(
          (resolve) => {
            setTimeout(
              resolve,
              remaining,
            );
          },
        );
      }
    } finally {
      /*
       * Loading ends only after
       * minimum 40 seconds.
       */
      setLoading(false);
    }
  };

  /*
   * =========================================================
   * CLEAR ALL
   * =========================================================
   */

  const handleClear = () => {
    setFile(null);

    setInputValue("");

    setLink(null);

    setLoading(false);

    setResTree(null);

    setExpanded(
      new Set(),
    );

    setGeneratedFiles([]);

    setSelectedFile(null);

    setFileContent(null);

    setError(false);
  };

  /*
   * =========================================================
   * UI
   * =========================================================
   */

  return (
    <AuthGuard>
      <div className="p-6 pb-[20px] h-full overflow-y-auto">

        {/* ================================================= */}
        {/* BREADCRUMBS                                      */}
        {/* ================================================= */}

        <Breadcrumbs
          breadcrumbs={ProjectGenerateDraftBreadcrumbs(
            workplace,
            domain,
            projectDetails,
            "Automated Test Script Generation - Selenium",
          )}
        />

        {/* ================================================= */}
        {/* PAGE TITLE                                        */}
        {/* ================================================= */}

        <div className="text-[16px] text-[#40382E] mb-5">
          {generatedFiles.length > 0 &&
          !loading
            ? "Test Script Generated"
            : file && link
              ? "Test Case uploaded"
              : "Upload the test cases"}
        </div>

        {/* ================================================= */}
        {/* URL + FILE + GENERATE BUTTON                     */}
        {/*                                                     */}
        {/* THIS MUST ALWAYS STAY VISIBLE.                   */}
        {/* ================================================= */}

        <div className="flex items-center">

          <div className="flex items-center">

            {/* ================================================= */}
            {/* URL                                               */}
            {/* ================================================= */}

            <div className="flex min-w-[120px] justify-center items-center px-2 pr-[40px] h-[40px] mr-[15px] border border-[#5E6066] rounded-[7px] bg-white text-sm text-[#8664f2] relative">

              <Image
                src={PasteIcon}
                width={17}
                className="absolute right-[15px]"
                alt="paste"
              />

              <input
                className="w-[225px] border-0 h-[38px] text-[#5E6066] outline-none"
                placeholder="Paste the link here..."
                value={link || inputvalue}
                disabled={loading || !!link}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  setLink(null);
                  setError(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleEnter();
                  }
                }}
              />

            </div>

            {/* ================================================= */}
            {/* FILE                                              */}
            {/* ================================================= */}

            {!file ? (
              <button
                type="button"
                disabled={loading}
                className="flex min-w-[120px] justify-center items-center px-2 py-2 mr-[15px] border border-[#8664f2] rounded-[7px] bg-white text-sm text-[#8664f2]"
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
                  disabled={loading}
                  onChange={
                    handleFile
                  }
                  accept={
                    AUTOMATED_TEST_CASE_GENERATION_ACCEPTED_FILES
                  }
                />

                <label
                  htmlFor="generate-file"
                  className="cursor-pointer"
                >
                  Choose File
                </label>

              </button>
            ) : (
              <div className="flex items-center px-3 py-2 mr-[15px] bg-[#F1EDED] rounded-[7px] text-sm text-[#8664f2] font-medium">

                {file.name}

                {!loading &&
                generatedFiles.length === 0 ? (
                  <Image
                    src={CloseIcon}
                    alt="close"
                    width={11}
                    className="ml-[15px] cursor-pointer"
                    onClick={() => {
                      setFile(null);
                      setInputValue("");
                      setLink(null);
                    }}
                  />
                ) : null}

              </div>
            )}

            {/* ================================================= */}
            {/* GENERATE BUTTON                                   */}
            {/* ================================================= */}

            {file && link && (
              <button
                type="button"
                onClick={
                  handleGenerate
                }
                disabled={
                  loading ||
                  generatedFiles.length > 0
                }
                className="flex justify-center items-center px-4 py-2 rounded-[7px] bg-[#8664f2] text-sm text-white disabled:opacity-70 disabled:cursor-not-allowed"
              >

                {/* LOADING STATE */}

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
                ) : generatedFiles.length > 0 ? (
                  /* GENERATED STATE */
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
                  /* INITIAL STATE */
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

        {/* ================================================= */}
        {/* URL ERROR                                         */}
        {/* ================================================= */}

        {error && (
          <div className="text-[14px] font-[500] text-red-500 mt-[5px]">
            Please enter a valid URL
          </div>
        )}

        {/* ================================================= */}
        {/* GENERATING MESSAGE                                */}
        {/* ================================================= */}

        {loading && (
          <div className="flex items-center mt-6 text-[14px] text-[#5E6066]">

            <Image
              src="/icons/loading.gif"
              width={15}
              height={15}
              className="mr-2"
              alt="loading"
              unoptimized
            />

            <span>
              Generating Selenium test script...
              Please wait.
            </span>

          </div>
        )}

        {/* ================================================= */}
        {/* GENERATED RESULT                                 */}
        {/* ================================================= */}

        {generatedFiles.length > 0 &&
        resTree &&
        !loading ? (
          <div>

            {/* ================================================= */}
            {/* GENERATED TITLE                                  */}
            {/* ================================================= */}

            <div className="text-[16px] text-[#40382E] mt-6 mb-5">
              Test Script Generated
            </div>

            {/* ================================================= */}
            {/* FILE TREE + CODE VIEWER                          */}
            {/* ================================================= */}

            <div className="flex mt-[20px]">

              {/* ================================================= */}
              {/* FILE TREE                                         */}
              {/* ================================================= */}

              <div className="w-[300px] h-[calc(100vh-200px)] pb-[50px] bg-[#FAFAFA] rounded-[5px] overflow-auto">

                <div className="min-w-max px-[15px] py-[15px]">

                  <div className="text-[15px] text-[#5E6066] font-[500] mb-[7px]">
                    {resTree?.framework ||
                      ""}
                  </div>

                  {resTree
                    ?.sort(
                      (
                        a: any,
                        b: any,
                      ) =>
                        b.type.localeCompare(
                          a.type,
                        ),
                    )
                    ?.map(
                      (
                        item: any,
                        index: number,
                      ) => (
                        <FileItem
                          key={
                            item.path ||
                            `${item.name}-${index}`
                          }
                          file={item}
                          expanded={
                            expanded
                          }
                          setExpanded={
                            setExpanded
                          }
                          generatedFiles={
                            generatedFiles
                          }
                          fetchFileContent={(
                            path: string,
                          ) =>
                            fetchFileContent(
                              path,
                              resTree,
                            )
                          }
                          selectedFile={
                            selectedFile
                          }
                          fileContent={
                            fileContent
                          }
                          handleDownload={
                            handleDownload
                          }
                        />
                      ),
                    )}

                </div>

              </div>

              {/* ================================================= */}
              {/* CODE VIEWER                                       */}
              {/* ================================================= */}

              <div className="w-[calc(100%-315px)] h-[calc(100vh-200px)] ml-[15px] bg-[#FAFAFA] rounded-[5px]">

                <div className="p-[15px] flex justify-between items-center">

                  <div className="text-[16px] text-[#5E6066] font-[500]">
                    {selectedFile
                      ?.split("/")
                      .pop() ||
                      ""}
                  </div>

                  {fileContent?.path ? (
                    <button
                      type="button"
                      className="h-[40px] px-[15px] rounded-[5px] flex items-center justify-center border border-[#5E6066] text-[#5E6066] font-[500] text-[14px] bg-white"
                      onClick={() =>
                        handleDownload(
                          fileContent.path,
                        )
                      }
                    >

                      <Image
                        src={
                          DownloadIcon
                        }
                        alt="download"
                        width={20}
                        className="mr-[5px]"
                      />

                      Download

                    </button>
                  ) : null}

                </div>

                <div className="h-[calc(100vh-280px)] pb-[50px] overflow-auto">

                  <div className="min-w-max px-[20px] py-[20px]">

                    {fileLoading ? (
                      <div className="text-[#5E6066]">
                        Loading code...
                      </div>
                    ) : (
                      <FileViewer
                        filePath={
                          fileContent?.path ||
                          ""
                        }
                        content={
                          fileContent?.content ||
                          ""
                        }
                      />
                    )}

                  </div>

                </div>

              </div>

            </div>

            {/* ================================================= */}
            {/* CLEAR ALL                                        */}
            {/* ================================================= */}

            <div className="flex justify-end mt-5">

              <button
                type="button"
                onClick={
                  handleClear
                }
                className="px-5 py-2 border border-[#CDCED1] rounded-[7px] text-[#504F55] text-[13px] bg-white"
              >
                Clear All
              </button>

            </div>

          </div>
        ) : null}

      </div>
    </AuthGuard>
  );
}





