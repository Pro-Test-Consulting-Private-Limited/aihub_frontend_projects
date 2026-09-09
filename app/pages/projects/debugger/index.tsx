"use client";
import Breadcrumbs from "@/app/components/breadcrumbs";
import { ProjectGenerateDraftBreadcrumbs } from "@/app/constants/projects";
import { ProjectList } from "@/app/data/project";
import { ProjectItem } from "@/app/interfaces/project";
import { useSearchParams } from "next/navigation";
import { ChangeEvent, useCallback, useEffect, useState } from "react";
import FileIcon from "../../../../public/icons/projects/file.svg";
import CloseIcon from "../../../../public/icons/projects/close.svg";
import DeleteImage from "../../../../public/icons/delete.svg";
import ArrowUp from "../../../../public/icons/arrow-up.svg";
import Image from "next/image";
import { DEBUGGER_ACCEPTED_FILES } from "@/app/constants/common";
import { processImage } from "@/app/services/generate";
import Markdown from "react-markdown";
import AuthGuard from "@/app/lib/authguard";

export default function ProjectDebugger() {
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
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [response, setResponse] = useState<any>(null);

  useEffect(() => {
    fetchProjectDetails();
  }, [projectId]);

  const fetchProjectDetails = () => {
    const matched = ProjectList.find((elem) => elem.id === projectId);
    setProjectDetails(matched);
  };

  const handleFile = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selected = e.target.files[0];
      setFile(selected);
      setImage(URL.createObjectURL(selected));
    }
  }, []);

  const handleGenerate = () => {
    setLoading(true);
    processImage(file)
      .then((res) => {
        setResponse(res.data?.markdown || []);
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
            "Debugger",
          )}
        />

        {response ? (
          <div
            className="flex border border-[#CDCED1] px-[10px] py-[4px] rounded-[8px] text-[#504F55] text-[13px] w-[fit-content] cursor-pointer mb-[20px]"
            onClick={() => {
              setFile(null);
              setResponse(null);
              setImage(null);
            }}
          >
            <Image
              src={DeleteImage}
              width={18}
              className="mr-[5px]"
              alt="delete"
            />
            Clear All
          </div>
        ) : (
          <div className="text-[16px] text-[#40382E] mb-5">
            Provide a detailed explanation of the error, the steps to fix it
            with code examples
          </div>
        )}

        <div className="flex items-center">
          {!file ? (
            <button className="flex min-w-[120px] justify-center items-center px-2 py-2 mr-4 border border-[#8664f2] rounded-[7px] bg-[#ffffff] text-sm text-[#8664f2]">
              <Image src={FileIcon} width={20} className="mr-1" alt="file" />
              <input
                id="generate-file"
                type="file"
                hidden
                onChange={(e: ChangeEvent<HTMLInputElement>) => handleFile(e)}
                accept={DEBUGGER_ACCEPTED_FILES}
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
            <div className="relative flex items-center pr-10 mr-4 text-sm text-[#8664f2] font-medium cursor-pointer">
              {file.name}
              {!response && (
                <Image
                  src={CloseIcon}
                  alt="close"
                  className="absolute right-3"
                  width={10}
                  onClick={() => {
                    setFile(null);
                    setImage(null);
                  }}
                />
              )}
            </div>
          )}
        </div>

        {image && (
          <Image
            src={image}
            alt="image"
            width="80"
            height="100"
            className="w-[80%] mt-[20px]"
          />
        )}

        {response && (
          <div className="mt-[20px] max-w-[90%] overflow-x-auto">
            <Markdown>{response}</Markdown>
          </div>
        )}

        {file && !response && (
          <button
            onClick={() => handleGenerate()}
            disabled={loading}
            className="flex mt-6 justify-center items-center px-4 py-2 border-0 rounded-[7px] bg-[#8664f2] text-sm text-[#FFFFFF]"
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
            <Image src={ArrowUp} width={15} className="mr-1" alt="jira" />
            Generate
          </button>
        )}
      </div>
    </AuthGuard>
  );
}
