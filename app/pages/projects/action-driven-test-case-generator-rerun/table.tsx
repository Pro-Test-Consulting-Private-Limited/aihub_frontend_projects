/* eslint-disable @typescript-eslint/no-explicit-any */
import { ExecutionItem } from "@/app/interfaces/project";
import dayjs from "dayjs";
import Image from "next/image";
import React, { useState } from "react";
import { generateActionDrivenRerunSession } from "@/app/services/generate";
import { ACTION_DRIVEN_TEST_CASE_GENERATOR_SITE } from "@/app/config/urls";
import { toast } from "react-toastify";
import Modal from "@/app/components/modal";

const ExecutionsTable = ({
  data,
  loading,
}: {
  data: ExecutionItem[];
  loading: boolean;
}) => {
  const [executionId, setExecutionId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState<any>(false);

  const handleRun = (id: string) => {
    setExecutionId(id);
    window.open(ACTION_DRIVEN_TEST_CASE_GENERATOR_SITE, "_blank");
    generateActionDrivenRerunSession(id)
      .then((res) => {
        setShowModal(res?.data);
      })
      .catch((err) =>
        toast.error(err?.message || "Something went wrong, Please try again"),
      )
      .finally(() => {
        setExecutionId(null);
      });
  };

  const handleDownload = (url: string) => {
    window.open(url, "_blank");
  };

  return (
    <div className="w-[100%] mt-4 overflow-x-auto">
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={""}
        modalStyle="w-[650px] p-[50px]"
      >
        <div className="w-[100%] flex flex-col items-center justify-center">
          <Image
            src={
              showModal?.status === "failed"
                ? "/icons/projects/failure.png"
                : "/icons/projects/success.png"
            }
            width={50}
            height={50}
            alt="success"
          />
          <div className="text-[#0F141A] text-[16px] my-[10px]">
            {showModal?.status === "failed"
              ? `Failed Locator: ${showModal?.failed_locator}`
              : "Execution completed successfully"}
          </div>

          {showModal?.status === "failed" && (
            <div className="flex mt-[20px]">
              <button
                onClick={() => handleDownload(showModal?.screenshot_url)}
                className="flex justify-center items-center px-4 py-2 border-0 rounded-[7px] bg-[#8664f2] text-sm text-[#FFFFFF]"
              >
                Screenshot
              </button>

              <button
                onClick={() => handleDownload(showModal?.video_url)}
                className="flex items-center border ml-4 px-5 h-9 rounded-[7px] border-[#8664f2] bg-[#fff] text-[#8664f2] text-sm font-medium"
              >
                Video
              </button>
            </div>
          )}
        </div>
      </Modal>
      <table className="min-w-[100%] border-collapse overflow-x-auto">
        <thead>
          <tr className="text-[14px] text-[#1F1F1F] bg-[#fff]">
            <th className="text-left border-b border-[#EEEEEE] border-collapse py-[23px] font-[500]">
              Created at
            </th>
            <th className="text-left border-b border-[#EEEEEE] border-collapse py-[23px] font-[500]">
              Execution Name
            </th>
            <th className="text-left border-b border-[#EEEEEE] border-collapse py-[23px] font-[500]">
              Description
            </th>
            <th className="text-left border-b border-[#EEEEEE] border-collapse py-[23px] font-[500]">
              User
            </th>
            <th className="text-left border-b border-[#EEEEEE] border-collapse py-[23px] font-[500]">
              Action
            </th>
          </tr>
        </thead>

        <tbody>
          {loading &&
            [...Array(5).keys()].map((i) => {
              return (
                <tr key={i} className="bg-[#fff]">
                  {[...Array(5).keys()].map((j) => {
                    return (
                      <td
                        key={j}
                        className="border-b border-[#EEEEEE] border-collapse py-[23px] pr-[25px] animate-pulse"
                      >
                        <div className="bg-[#e4e4e4] h-[15px] rounded-[10px]" />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          {!loading &&
            data.map((item: ExecutionItem) => {
              return (
                <tr
                  key={item?.id}
                  className="text-[14px] text-[#1F1F1F] bg-[#fff]"
                >
                  <td className="border-b border-[#EEEEEE] border-collapse py-[23px]">
                    {item.created_at
                      ? dayjs(item.created_at).format("DD MMM YYYY, hh:mm a")
                      : "-"}
                  </td>
                  <td className="border-b border-[#EEEEEE] border-collapse py-[23px]">
                    {item.name || "-"}
                  </td>
                  <td className="border-b border-[#EEEEEE] border-collapse py-[23px]">
                    {item.description || "-"}
                  </td>
                  <td className="border-b border-[#EEEEEE] border-collapse py-[23px]">
                    {item.username || "-"}
                  </td>
                  <td
                    className="border-b border-[#EEEEEE] border-collapse py-[23px] cursor-pointer text-[#8664F2] font-[500] text-center"
                    onClick={() => null}
                  >
                    <button
                      onClick={() => handleRun(item.id)}
                      disabled={executionId === item.id}
                      className="flex justify-center items-center px-4 py-2 border-0 rounded-[7px] bg-[#8664f2] text-sm text-[#FFFFFF]"
                    >
                      {executionId === item.id && (
                        <Image
                          src="/icons/loading.gif"
                          width={15}
                          height={15}
                          className="mr-1"
                          alt="loading"
                        />
                      )}
                      Rerun
                    </button>
                  </td>
                </tr>
              );
            })}
        </tbody>
      </table>
    </div>
  );
};

export default ExecutionsTable;
