/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState } from "react";
import Image from "next/image";
import {
  generateActionDrivenManualTestCases,
  generateActionDrivenSaveSession,
} from "@/app/services/generate";
import { useRouter } from "next/navigation";

export default function SaveExecutions({
  session,
  setShowModal,
  setManualTestCases,
  success,
  setSuccess,
  workplace,
  domain,
  projectDetails,
}: any) {
  const [loading, setLoading] = useState<boolean>(false);
  const [execution, setExecution] = useState<{
    name: string | null;
    description: string | null;
  }>({ name: null, description: null });
  const route = useRouter();

  const handleSave = () => {
    setLoading(true);
    generateActionDrivenSaveSession(session || "", execution)
      .then(() => {
        setSuccess(true);
      })
      .catch((err) => console.log(err))
      .finally(() => {
        setLoading(false);
      });
  };

  const fetchManualTestCases = () => {
    setLoading(true);
    generateActionDrivenManualTestCases(session || "")
      .then((res) => {
        setManualTestCases(res?.data || []);
        setShowModal(false);
      })
      .catch((err) => console.log(err))
      .finally(() => setLoading(false));
  };

  const handleViewExecutions = () => {
    route.push(
      `/projects/action-driven-test-case-generator-rerun?projectId=${projectDetails?.id}&workplace=${workplace}&domain=${domain}`,
    );
  };
  if (success)
    return (
      <div className="w-[100%] flex flex-col items-center justify-center">
        <Image
          src={"/icons/projects/success.png"}
          width={50}
          height={50}
          alt="success"
        />
        <div className="text-[#1F1F1F] text-[26px] my-[10px]">
          Execution Saved Successfully
        </div>
        <div className="text-[#0F141A] text-[16px]">
          Execution details saved. Choose an action to continue.
        </div>

        <div className="flex mt-[20px]">
          <button
            onClick={() => fetchManualTestCases()}
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
            Generate Test Cases
          </button>

          <button
            onClick={() => handleViewExecutions()}
            className="flex items-center border ml-4 px-5 h-9 rounded-[7px] border-[#8664f2] bg-[#fff] text-[#8664f2] text-sm font-medium"
          >
            View executions
          </button>
        </div>
      </div>
    );

  return (
    <div>
      <div className="text-[#0F141A] text-[16px] mb-[5px]">Execution Name</div>
      <input
        className="border border-[#656871] h-[40px] w-[100%] rounded-[5px] px-[15px] mb-[20px] text-[16px]"
        placeholder="Enter execution name"
        value={execution.name || ""}
        onChange={(e) => setExecution({ ...execution, name: e.target.value })}
      />
      <div className="text-[#0F141A] text-[16px] mb-[5px]">
        Description / Comments
      </div>
      <input
        className="border border-[#656871] h-[40px] w-[100%] rounded-[5px] px-[15px] text-[16px]"
        placeholder="Add description or comments for this execution"
        value={execution.description || ""}
        onChange={(e) =>
          setExecution({ ...execution, description: e.target.value })
        }
      />

      <div className="flex mt-8 items-center justify-center">
        <button
          onClick={() => handleSave()}
          disabled={loading || !execution.name || !execution.description}
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
          Save Execution
        </button>

        <button
          onClick={() => setShowModal(false)}
          className="flex items-center border ml-4 px-5 h-9 rounded-[7px] border-[#8664f2] bg-[#fff] text-[#8664f2] text-sm font-medium"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
