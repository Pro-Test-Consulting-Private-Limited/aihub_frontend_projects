/* eslint-disable @typescript-eslint/no-explicit-any */
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import ArrowIcon from "../../../../public/icons/chevron-right.svg";
import DownloadIcon from "../../../../public/icons/download.png";
import { getFileIcon } from "@/app/utils/fileicon";

const FileItem = ({
  file,
  expanded,
  setExpanded,
  fetchFileContent,
  selectedFile,
  fileContent,
  handleDownload,
}: any) => {
  const expandKey = file.type === "folder" ? file.name : file.path;
  const isOpen = expanded.has(expandKey);

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (file.type !== "folder") fetchFileContent(file.path);
    setExpanded((prev: Set<string>) => {
      const next = new Set(prev);
      if (isOpen) next.delete(expandKey);
      else next.add(expandKey);
      return next;
    });
  };

  return (
    <div key={file.path}>
      <div
        className="flex items-center cursor-pointer min-w-max relative"
        onClick={toggle}
      >
        {file.type === "folder" ? (
          <motion.div
            animate={{ rotate: isOpen ? 90 : 0 }}
            transition={{ duration: 0.5 }}
          >
            <Image src={ArrowIcon} alt="arrow" width={5.5} />
          </motion.div>
        ) : (
          <Image src={getFileIcon(file)} alt="file" width={15} />
        )}
        <div
          title={file.name}
          className={`text-[14px] font-[500] text-[#5E6066] my-[8px] ml-[8px] whitespace-nowrap ${file.path === selectedFile ? "text-[#8664F2]" : ""} px-1 rounded`}
        >
          {file.name}
        </div>

        {file.type === "file" && (
          <button
            className="absolute right-[10px]"
            onClick={() => handleDownload(file.path)}
          >
            <Image
              src={DownloadIcon}
              alt="download"
              width={16}
              className="mr-[5px]"
            />
          </button>
        )}
      </div>

      <AnimatePresence initial={false}>
        {isOpen && file.items && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              duration: 0.5,
            }}
            className="overflow-hidden pl-[13px] border-l border-[rgba(88,88,88,0.5)] ml-[5px]"
          >
            {file?.items
              ?.sort((a: any, b: any) => b.type.localeCompare(a.type))
              ?.map((child: any, index: number) => (
                <FileItem
                  key={child.path || `file-${child.name}-${index}`}
                  file={child}
                  expanded={expanded}
                  setExpanded={setExpanded}
                  fetchFileContent={fetchFileContent}
                  selectedFile={selectedFile}
                  fileContent={fileContent}
                  handleDownload={handleDownload}
                />
              ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FileItem;
