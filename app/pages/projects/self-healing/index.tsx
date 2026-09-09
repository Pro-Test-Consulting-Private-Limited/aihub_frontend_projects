/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import Breadcrumbs from "@/app/components/breadcrumbs";
import { ProjectGenerateDraftBreadcrumbs } from "@/app/constants/projects";
import { ProjectList } from "@/app/data/project";
import { ProjectItem } from "@/app/interfaces/project";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import PasteIcon from "../../../../public/icons/projects/paste.svg";
import Image from "next/image";
import {
  getSelfHealingFileContent,
  getSelfHealingRepoStructure,
  runSelfHealingHeal,
  runSelfHealingReset,
  runSelfHealingScripts,
} from "@/app/services/generate";
import { validateURL } from "@/app/utils";
import FileViewer from "@/app/components/fileviewer";
import AuthGuard from "@/app/lib/authguard";
import FileItem from "./file";
import { BASE_URL, SELF_HEALING_SPEC } from "@/app/config/urls";
import { toast } from "react-toastify";

export default function ProjectAutomatedTestScriptGenerationSelenium() {
  const searchParams = useSearchParams();
  const projectId: number | null | undefined = Number(
    searchParams?.get("projectId"),
  );
  const workplace: string = searchParams.get("workplace") || "";
  const domain: string = searchParams.get("domain") || "";
  const [projectDetails, setProjectDetails] = useState<
    ProjectItem | null | undefined
  >(null);
  const [inputvalue, setInputValue] = useState<string | null>(null);
  const [error, setError] = useState<boolean>(false);
  const [link, setLink] = useState<string | null>(null);
  const [resTree, setResTree] = useState<any>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<boolean>(false);
  const [resetLoading, setResetLoading] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [fileContent, setFileContent] = useState<any>(null);
  const [fileLoading, setFileLoading] = useState<boolean>(false);
  const [scripts, setScripts] = useState<string[]>([]);
  const [resetAvailable, setResetAvailable] = useState<boolean>(false);
  const [healLoading, setHealLoading] = useState<boolean>(false);
  const [failedRunPayload, setFailedRunPayload] = useState<any>(null);
  const [breakTest, setBreakTest] = useState(true);
  const [healedPath, setHealedPath] = useState<string | null>(null);

  useEffect(() => {
    fetchFilesTree();
  }, []);

  useEffect(() => {
    fetchProjectDetails();
  }, [projectId]);

  const fetchFilesTree = () => {
    getSelfHealingRepoStructure()
      .then((res) => setResTree(res.data))
      .catch((err) => console.log(err));
  };

  const fetchProjectDetails = () => {
    const matched = ProjectList.find((elem) => elem.id === projectId);
    setProjectDetails(matched);
  };

  const handleEnter = async () => {
    if (validateURL(inputvalue || "")) {
      setLink(inputvalue || "");
    } else setError(true);
  };

  const fetchPath = (path: string) => {
    const splitted = path
      .split("/")
      .filter((item) => item !== resTree?.framework)
      .join("/");
    return splitted;
  };

  const normalizePath = (path: string) => path.replace(/^\/+|\/+$/g, "");

  const findFileInTree = (
    items: any[],
    targetPath: string,
    folderKeys: string[] = [],
  ): { filePath: string; folderKeys: string[] } | null => {
    const normalizedTarget = normalizePath(targetPath);

    for (const item of items) {
      const nextFolderKeys =
        item.type === "folder" ? [...folderKeys, item.name] : folderKeys;

      if (item.type === "file" && item.path) {
        const normalizedItemPath = normalizePath(item.path);
        const normalizedRelativePath = normalizePath(fetchPath(item.path));

        if (
          normalizedItemPath === normalizedTarget ||
          normalizedRelativePath === normalizedTarget ||
          normalizedItemPath.endsWith(normalizedTarget) ||
          normalizedTarget.endsWith(normalizedItemPath)
        ) {
          return { filePath: item.path, folderKeys };
        }
      }

      if (item.items?.length) {
        const match = findFileInTree(
          item.items,
          targetPath,
          nextFolderKeys,
        );
        if (match) return match;
      }
    }

    return null;
  };

  const fetchFileContent = (path: string) => {
    setScripts([]);
    setHealedPath(null);
    setSelectedFile(path);
    setFileLoading(true);
    getSelfHealingFileContent(fetchPath(path))
      .then((res) => {
        setFileContent(res.data || "");
      })
      .catch((err) => console.log(err))
      .finally(() => setFileLoading(false));
  };

  const openHealedFile = (path: string) => {
    const match = findFileInTree(resTree || [], path);

    if (match) {
      setExpanded((prev) => new Set([...prev, ...match.folderKeys]));
      fetchFileContent(match.filePath);
      return;
    }

    fetchFileContent(path);
  };

  const handleDownload = (path: string) => {
    const url = BASE_URL + "cypress/download" + `?path=${path}`;
    window.open(url, "_blank");
  };

  const handleRun = async () => {
    setLoading(true);
    setScripts([]);
    setResetAvailable(false);
    setFailedRunPayload(null);
    let runPassed = false;
    let failedPayload: any = null;

    try {
      const response = await runSelfHealingScripts(workplace, {
        break_test: breakTest,
        spec: SELF_HEALING_SPEC,
        url: link,
      });

      if (!response.ok) throw new Error(`Run failed: ${response.status}`);

      const reader = response.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let buffer = "";

      const handleLines = (lines: string[]) => {
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.replace("data: ", "").trim();
          if (!jsonStr || jsonStr === "[DONE]") continue;

          try {
            const parsed = JSON.parse(jsonStr);
            console.log("Received:", parsed);
            let parsedLine = parsed?.line || "";

            if (parsed.done && parsed.failed) {
              parsedLine = `Failed at ${parsed.file_path} at line ${parsed.line}`;
              failedPayload = parsed;
              setFailedRunPayload(parsed);
            } else if (parsed.done && !parsed.failed) {
              runPassed = true;
            }
            setScripts((prev) => [...prev, parsedLine]);
          } catch (err: any) {
            console.error("Invalid JSON:", err);
          }
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        handleLines(lines);
      }

      buffer += decoder.decode();
      if (buffer) handleLines(buffer.split("\n"));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      if (runPassed && !failedPayload) setResetAvailable(true);
      setBreakTest(!breakTest);
    }
  };

  const handleReset = () => {
    setResetLoading(true);
    runSelfHealingReset()
      .then(() => {
        setScripts([]);
        setHealedPath(null);
        setSelectedFile(null);
        setFileContent(null);
        setExpanded(new Set());
        setResetAvailable(false);
        setFailedRunPayload(null);
        setBreakTest(true);
        fetchFilesTree();
        toast.success("Reset completed successfully");
      })
      .catch((err) => {
        console.log(err);
        toast.error("Reset failed");
      })
      .finally(() => setResetLoading(false));
  };

  const handleHealing = () => {
    if (!failedRunPayload) return;

    setHealLoading(true);
    runSelfHealingHeal(workplace, {
      failed_selector: failedRunPayload.failed_selector,
      file_path: failedRunPayload.file_path,
    })
      .then((res) => {
        console.log(res);
        const healed = res?.data || {};
        const healedMessage = `AI Healed: ${healed.healedSelector} with (${healed.confidence} confidence)`;
        toast.success(healedMessage);
        setScripts((prev) => [...prev, healedMessage]);
        setScripts((prev) => [...prev, `Strategy: ${healed.strategy}`]);
        setHealedPath(healed.filePath);
        setFailedRunPayload(null);
        setResetAvailable(true);
        fetchFilesTree();
      })
      .catch((err) => console.log(err))
      .finally(() => setHealLoading(false));
  };

  return (
    <AuthGuard>
      <div className="p-6 pb-[20px] h-full flex flex-col overflow-y-auto">
        <Breadcrumbs
          breadcrumbs={ProjectGenerateDraftBreadcrumbs(
            workplace,
            domain,
            projectDetails,
            "Self Healing",
          )}
        />

        <div className="text-[16px] text-[#40382E] mb-2">
          Test Execution - Self Healing
        </div>

        <div className="flex items-center">
          <div>
            {!link ? (
              <div className="flex min-w-[120px] justify-center items-center px-2 pr-[40px] h-[40px] mr-[15px] border border-[#5E6066] rounded-[7px] bg-[#ffffff] text-sm text-[#8664f2] relative">
                <Image
                  src={PasteIcon}
                  width={17}
                  className="absolute right-[15px]"
                  alt="link"
                />
                <input
                  className="w-[225px] border-0 h-[38px] text-[#5E6066]"
                  placeholder="Paste the link here..."
                  value={inputvalue || ""}
                  onChange={(e) => {
                    setInputValue(e.target.value);
                    setError(false);
                  }}
                  onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                    if (e.key === "Enter") handleEnter();
                  }}
                />
              </div>
            ) : (
              <div className="text-sm text-[#8664f2] font-medium py-2 mr-[15px] underline">
                {link}
              </div>
            )}

            {link && (
              <div className="flex items-center gap-[10px] mt-[15px]">
                <button
                  onClick={() => handleRun()}
                  disabled={loading || resetLoading || healLoading}
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
                  Run the scripts
                </button>

                {failedRunPayload && (
                  <button
                    onClick={() => handleHealing()}
                    disabled={loading || resetLoading || healLoading}
                    className="flex justify-center items-center px-4 py-2 border-0 rounded-[7px] bg-[#2E7D32] text-sm text-[#FFFFFF]"
                  >
                    {healLoading && (
                      <Image
                        src={"/icons/loading.gif"}
                        width={15}
                        height={15}
                        className="mr-1"
                        alt="loading"
                      />
                    )}
                    Heal
                  </button>
                )}

                {resetAvailable && (
                  <button
                    onClick={() => handleReset()}
                    disabled={loading || resetLoading || healLoading}
                    className="flex justify-center items-center px-4 py-2 border border-[#8664f2] rounded-[7px] bg-[#ffffff] text-sm text-[#8664f2]"
                  >
                    {resetLoading && (
                      <Image
                        src={"/icons/loading.gif"}
                        width={15}
                        height={15}
                        className="mr-1"
                        alt="loading"
                      />
                    )}
                    Reset
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="text-[14px] font-[500] text-red-500 mt-[5px]">
            Please enter a valid URL
          </div>
        )}

        {resTree && resTree.length !== 0 && (
          <div className="flex mt-[20px]">
            <div className="w-[300px] h-[calc(100vh-150px)] pb-[50px] bg-[#FAFAFA] rounded-[5px] overflow-auto">
              <div className="min-w-max px-[15px] py-[15px]">
                <div className="text-[15px] text-[#5E6066] font-[500] mb-[7px]">
                  File Name
                </div>

                {resTree
                  ?.sort((a: any, b: any) => b.type.localeCompare(a.type))
                  ?.map((file: any, index: number) => {
                    return (
                      <FileItem
                        key={file.path || `file-${file.name}-${index}`}
                        file={file}
                        expanded={expanded}
                        setExpanded={setExpanded}
                        fetchFileContent={fetchFileContent}
                        selectedFile={selectedFile}
                        fileContent={fileContent}
                        handleDownload={handleDownload}
                      />
                    );
                  })}
              </div>
            </div>

            <div className="w-[calc(100%-315px)] h-[calc(100vh-150px)] ml-[15px] bg-[#FAFAFA] rounded-[5px]">
              {link && (
                <div className="p-[15px] flex justify-between items-center">
                  <div className="text-[16px] text-[#5E6066] font-[500]">
                    {scripts.length > 0
                      ? "Execution Logs"
                      : selectedFile?.split("/").pop() ||
                        "Run the scripts to view execution logs and results..."}
                  </div>
                </div>
              )}

              <div className="h-[calc(100vh-230px)] pb-[50px] overflow-auto">
                <div className="min-w-max">
                  {scripts.map((line, index) => {
                    if (line && line !== "")
                      return (
                        <div
                          key={`${line}-${index}`}
                          className="whitespace-pre-wrap border-b border-[rgba(94,96,102,0.12)] py-[10px]"
                        >
                          {line}
                        </div>
                      );
                  })}
                  {healedPath && (
                    <div
                      className="cursor-pointer text-[#2E7D32] py-[10px]"
                      onClick={() => openHealedFile(healedPath)}
                    >
                      Open {healedPath}
                    </div>
                  )}
                  {scripts.length === 0 && (
                    <div>
                      {fileLoading ? (
                        <div className="animate-pulse">
                          {Array.from({ length: 30 }).map((_, i) => (
                            <div
                              key={i}
                              className="h-[20px] mb-[20px] w-full rounded-[10px] bg-gray-200"
                            />
                          ))}
                        </div>
                      ) : (
                        <FileViewer
                          filePath={fileContent?.path || ""}
                          content={fileContent?.content || ""}
                        />
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
