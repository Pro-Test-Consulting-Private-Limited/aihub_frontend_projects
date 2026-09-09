/* eslint-disable @typescript-eslint/no-explicit-any */
import Modal from "@/app/components/modal";
import { ErroLogItem } from "@/app/interfaces/workplace";
import dayjs from "dayjs";
import React from "react";
import TestResultsTable from "../../projects/generate-draft/table";
import { validateJSON } from "@/app/utils";

const ErrorLogTable = ({
  data,
  loading,
}: {
  data: ErroLogItem[];
  loading: boolean;
}) => {
  const [showModal, setShowModal] = React.useState<any>(false);

  return (
    <div className="w-[100%] mt-4 overflow-x-auto">
      <table className="min-w-[100%] border-collapse overflow-x-auto">
        <thead>
          <tr className="text-[14px] text-[#1F1F1F] bg-[#fff]">
            <th className="text-left border-b border-[#EEEEEE] border-collapse py-[23px] font-[500]">
              Timestamp
            </th>
            <th className="text-left border-b border-[#EEEEEE] border-collapse py-[23px] font-[500]">
              Workplace
            </th>
            <th className="text-left border-b border-[#EEEEEE] border-collapse py-[23px] font-[500]">
              Accelerator
            </th>
            <th className="text-left border-b border-[#EEEEEE] border-collapse py-[23px] font-[500]">
              User
            </th>
            <th className="text-left border-b border-[#EEEEEE] border-collapse py-[23px] font-[500]">
              Input 1
            </th>
            <th className="text-left border-b border-[#EEEEEE] border-collapse py-[23px] font-[500]">
              Input 2
            </th>
            <th className="text-left border-b border-[#EEEEEE] border-collapse py-[23px] font-[500]">
              Status
            </th>
            <th className="text-left border-b border-[#EEEEEE] border-collapse py-[23px] font-[500]">
              Response
            </th>
          </tr>
        </thead>

        <tbody>
          {loading &&
            [...Array(5).keys()].map((i) => {
              return (
                <tr key={i} className="bg-[#fff]">
                  {[...Array(8).keys()].map((j) => {
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
            data.map((item: ErroLogItem, index: number) => {
              return (
                <tr
                  key={index}
                  className="text-[14px] text-[#1F1F1F] bg-[#fff]"
                >
                  <td className="border-b border-[#EEEEEE] border-collapse py-[23px]">
                    {item.timestamp
                      ? dayjs(item.timestamp).format("DD MMM YYYY, hh:mm a")
                      : "-"}
                  </td>
                  <td className="border-b border-[#EEEEEE] border-collapse py-[23px]">
                    {item.workplace || "-"}
                  </td>
                  <td className="border-b border-[#EEEEEE] border-collapse py-[23px]">
                    {item.accelerator || "-"}
                  </td>
                  <td className="border-b border-[#EEEEEE] border-collapse py-[23px]">
                    {item.username || "-"}
                  </td>
                  <td className="border-b border-[#EEEEEE] border-collapse py-[23px]">
                    {item.input1 || "-"}
                  </td>
                  <td className="border-b border-[#EEEEEE] border-collapse py-[23px]">
                    {item.input2 || "-"}
                  </td>
                  <td className="border-b border-[#EEEEEE] border-collapse py-[23px]">
                    <div
                      className={`w-[60px] h-[26px] flex justify-center items-center py-[3px] rounded-[5px] text-[12px] font-[500] ${
                        item.status === "Success"
                          ? "bg-[rgba(40,167,69,0.1)] text-[#28A745]"
                          : "bg-[rgba(220,53,69,0.1)] text-[#DC3545]"
                      }`}
                    >
                      {item.status}
                    </div>
                  </td>
                  <td
                    className="border-b border-[#EEEEEE] border-collapse py-[23px] cursor-pointer text-[#8664F2] font-[500] text-center"
                    onClick={() => setShowModal(item)}
                  >
                    View
                  </td>
                </tr>
              );
            })}
        </tbody>
      </table>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Action Driven Test Case Generator"
        modalStyle={`${
          showModal?.status === "Error" ? "w-[550px]" : "w-[90vw]"
        }`}
      >
        {showModal?.status === "Error" ? (
          <div className="w-[500px]">
            <p className="text-[#DC3545]">
              {showModal?.response ||
                " An error occurred while processing your request. Please try again later."}
            </p>
          </div>
        ) : (
          <div className="w-[100%] h-[80vh] overflow-auto mt-[-10px]">
            <TestResultsTable
              data={
                validateJSON(showModal?.response)
                  ? JSON.parse(showModal?.response || "{}")
                  : []
              }
            />
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ErrorLogTable;
