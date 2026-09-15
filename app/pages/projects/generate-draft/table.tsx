import Checkbox from "@/app/components/checkbox";
import { RenderObject } from "@/app/components/renderobject";
import { TestDataItem, TestResultsItem } from "@/app/interfaces/project";
import React, { useState } from "react";

function cell(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

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
            Requirement ID
          </th>
          <th className="border border-[rgba(130,130,130,0.3)] border-collapse">
            Module
          </th>
          <th className="border border-[rgba(130,130,130,0.3)] border-collapse">
            Feature
          </th>
          <th className="border border-[rgba(130,130,130,0.3)] border-collapse">
            Scenario
          </th>
          <th className="border border-[rgba(130,130,130,0.3)] border-collapse">
            Test Type
          </th>
          <th className="border border-[rgba(130,130,130,0.3)] border-collapse">
            Preconditions
          </th>
          <th className="border border-[rgba(130,130,130,0.3)] border-collapse">
            Test Steps
          </th>
          <th className="border border-[rgba(130,130,130,0.3)] border-collapse">
            Test Data ID
          </th>
          <th className="border border-[rgba(130,130,130,0.3)] border-collapse">
            Expected Result
          </th>
        </tr>
      </thead>

      <tbody>
        {data.map((item: TestResultsItem) => {
          const feature = item.Feature || item.SubModule || "";
          const scenario = item.Scenario || item.ScenarioDescription || "";
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
                {cell(item.RequirementId)}
              </td>
              <td className="border w-[150px] border-[rgba(130,130,130,0.3)] p-4 border-collapse text-center text-sm">
                {item.Module}
              </td>
              <td className="border w-[200px] border-[rgba(130,130,130,0.3)] p-4 border-collapse text-center text-sm">
                {feature}
              </td>
              <td className="border w-[220px] border-[rgba(130,130,130,0.3)] p-4 border-collapse text-center text-sm">
                {scenario}
              </td>
              <td className="border w-[140px] border-[rgba(130,130,130,0.3)] p-4 border-collapse text-center text-sm">
                {cell(item.TestType)}
              </td>
              <td className="border w-[250px] border-[rgba(130,130,130,0.3)] p-4 border-collapse text-center text-sm">
                {item.Preconditions}
              </td>
              <td className="border w-[250px] border-[rgba(130,130,130,0.3)] p-4 border-collapse text-center text-sm">
                {item.TestSteps?.join(", ")}
              </td>
              <td className="border w-[180px] border-[rgba(130,130,130,0.3)] p-4 border-collapse text-center text-sm">
                {item.TestDataId
                  ? item.TestDataId
                  : item.Inputs
                    ? <RenderObject data={item.Inputs} />
                    : "—"}
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

export const TestDataTable = ({ data }: { data: TestDataItem[] }) => {
  if (!data.length) {
    return (
      <div className="mt-4 text-sm text-[#7E7E7E] dark:text-[#9ca3af]">
        No test data
      </div>
    );
  }

  return (
    <table className="min-w-max w-[100%] overflow-x-auto mt-4 border border-[rgba(130,130,130,0.3)] border-collapse">
      <thead>
        <tr className="text-[#1F1F1F] text-sm bg-[rgba(105,98,188,0.3)]">
          <th className="border border-[rgba(130,130,130,0.3)] border-collapse py-3 text-sm px-3">
            Test Data ID
          </th>
          <th className="border border-[rgba(130,130,130,0.3)] border-collapse px-3">
            Linked Test Case
          </th>
          <th className="border border-[rgba(130,130,130,0.3)] border-collapse px-3">
            First Name
          </th>
          <th className="border border-[rgba(130,130,130,0.3)] border-collapse px-3">
            Last Name
          </th>
          <th className="border border-[rgba(130,130,130,0.3)] border-collapse px-3">
            Email
          </th>
          <th className="border border-[rgba(130,130,130,0.3)] border-collapse px-3">
            Phone
          </th>
          <th className="border border-[rgba(130,130,130,0.3)] border-collapse px-3">
            Age
          </th>
          <th className="border border-[rgba(130,130,130,0.3)] border-collapse px-3">
            Password
          </th>
          <th className="border border-[rgba(130,130,130,0.3)] border-collapse px-3">
            Amount
          </th>
          <th className="border border-[rgba(130,130,130,0.3)] border-collapse px-3">
            OTP
          </th>
          <th className="border border-[rgba(130,130,130,0.3)] border-collapse px-3">
            Status
          </th>
          <th className="border border-[rgba(130,130,130,0.3)] border-collapse px-3">
            Generation Strategy
          </th>
        </tr>
      </thead>
      <tbody>
        {data.map((item) => (
          <tr key={item.TestDataId}>
            <td className="border border-[rgba(130,130,130,0.3)] p-4 border-collapse text-center text-sm">
              {cell(item.TestDataId)}
            </td>
            <td className="border border-[rgba(130,130,130,0.3)] p-4 border-collapse text-center text-sm">
              {cell(item.LinkedTestCaseId)}
            </td>
            <td className="border border-[rgba(130,130,130,0.3)] p-4 border-collapse text-center text-sm">
              {cell(item.FirstName)}
            </td>
            <td className="border border-[rgba(130,130,130,0.3)] p-4 border-collapse text-center text-sm">
              {cell(item.LastName)}
            </td>
            <td className="border border-[rgba(130,130,130,0.3)] p-4 border-collapse text-center text-sm">
              {cell(item.Email)}
            </td>
            <td className="border border-[rgba(130,130,130,0.3)] p-4 border-collapse text-center text-sm">
              {cell(item.Phone)}
            </td>
            <td className="border border-[rgba(130,130,130,0.3)] p-4 border-collapse text-center text-sm">
              {cell(item.Age)}
            </td>
            <td className="border border-[rgba(130,130,130,0.3)] p-4 border-collapse text-center text-sm">
              {cell(item.Password)}
            </td>
            <td className="border border-[rgba(130,130,130,0.3)] p-4 border-collapse text-center text-sm">
              {cell(item.Amount)}
            </td>
            <td className="border border-[rgba(130,130,130,0.3)] p-4 border-collapse text-center text-sm">
              {cell(item.OTP)}
            </td>
            <td className="border border-[rgba(130,130,130,0.3)] p-4 border-collapse text-center text-sm">
              {cell(item.Status)}
            </td>
            <td className="border border-[rgba(130,130,130,0.3)] p-4 border-collapse text-center text-sm">
              {cell(item.GenerationStrategy)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default TestResultsTable;
