/* eslint-disable @typescript-eslint/no-explicit-any */
import Checkbox from "@/app/components/checkbox";
import { RenderObject } from "@/app/components/renderobject";
import { TestResultsItem } from "@/app/interfaces/project";
import React, { useState } from "react";

const TestResultsTable = ({ data }: { data: TestResultsItem[] }) => {
  const [selectAll, setSelectAll] = useState<boolean>(false);
  return (
    <table className="min-w-max w-[100%] overflow-x-auto mt-4 border border-[rgba(130,130,130,0.3)] border-collapse">
      <thead>
        <tr className="text-[#1F1F1F] text-sm bg-[rgba(105,98,188,0.3)]">
          <th className="border=0 border-[rgba(130,130,130,0.3)] border-collapse py-3 text-sm flex">
            <Checkbox
              checked={selectAll}
              onChange={(value: boolean) => setSelectAll(value)}
              label=""
            />
          </th>
          <th className="border border-[rgba(130,130,130,0.3)] border-collapse py-3 text-sm">
            Test Case ID
          </th>
          <th className="border border-[rgba(130,130,130,0.3)] border-collapse">
            Module
          </th>
          <th className="border border-[rgba(130,130,130,0.3)] border-collapse">
            Sub Module
          </th>
          <th className="border border-[rgba(130,130,130,0.3)] border-collapse">
            Scenario Description
          </th>
          <th className="border border-[rgba(130,130,130,0.3)] border-collapse">
            Preconditions
          </th>
          <th className="border border-[rgba(130,130,130,0.3)] border-collapse">
            Test Steps
          </th>
          <th className="border border-[rgba(130,130,130,0.3)] border-collapse">
            Inputs
          </th>
          <th className="border border-[rgba(130,130,130,0.3)] border-collapse">
            Expected Result
          </th>
        </tr>
      </thead>

      <tbody>
        {data.map((item: TestResultsItem) => {
          return (
            <tr key={item.TestCaseId}>
              <td className="border min-w-[75px] border-[rgba(130,130,130,0.3)] p-4 border-collapse py-3 text-center text-sm">
                <Checkbox
                  checked={selectAll}
                  onChange={(value: boolean) => setSelectAll(value)}
                  label=""
                />
              </td>
              <td className="border w-[150px] border-[rgba(130,130,130,0.3)] p-4 border-collapse py-3 text-center text-sm">
                {item.TestCaseId}
              </td>
              <td className="border w-[150px] border-[rgba(130,130,130,0.3)] p-4 border-collapse text-center text-sm">
                {item.Module}
              </td>
              <td className="border w-[250px] border-[rgba(130,130,130,0.3)] p-4 border-collapse text-center text-sm">
                {item.SubModule}
              </td>
              <td className="border w-[200px] border-[rgba(130,130,130,0.3)] p-4 border-collapse text-center text-sm">
                {item.ScenarioDescription}
              </td>
              <td className="border w-[250px] border-[rgba(130,130,130,0.3)] p-4 border-collapse text-center text-sm">
                {item.Preconditions}
              </td>
              <td className="border w-[250px] border-[rgba(130,130,130,0.3)] p-4 border-collapse text-center text-sm">
                {item.TestSteps?.join(", ")}
              </td>
              <td className="border w-[350px] border-[rgba(130,130,130,0.3)] p-4 border-collapse text-sm">
                {item.Inputs && <RenderObject data={item.Inputs} />}
              </td>
              <td className="border w-[250px] border-[rgba(130,130,130,0.3)] p-4 border-collapse text-center text-sm">
                {item.ExpectedResult}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

export default TestResultsTable;
