import { StaticImageData } from "next/image";

export interface ProjectItem {
  id: number;
  name: string;
  progress: number;
  due_date: string;
  url?: string;
}

export interface ProjectSegmentItem {
  title: string;
  icon: StaticImageData;
  color?: string;
  accelerators: ProjectSegmentSections[];
}

export interface ProjectSegmentSections {
  label: string;
  value: string;
  route?: string;
  segment?: string;
}

export type JSONValue = string | number | boolean | null | JSONObject;

export interface JSONObject {
  [key: string]: JSONValue;
}

export interface TestResultsItem {
  TestCaseId: string;
  RequirementId?: string;
  Module: string;
  Feature?: string;
  Scenario?: string;
  TestType?: string;
  Preconditions: string;
  TestSteps: string[];
  TestDataId?: string;
  ExpectedResult: string;
  /** Legacy send_money / action-driven payloads */
  Inputs?: JSONObject;
  SubModule?: string;
  ScenarioDescription?: string;
}

export interface TestDataItem {
  TestDataId: string;
  LinkedTestCaseId: string;
  FirstName: string | null;
  LastName: string | null;
  Email: string | null;
  Phone: string | null;
  Age: string | number | null;
  Password: string | null;
  Amount: string | number | null;
  OTP: string | null;
  Status: string | null;
  GenerationStrategy: string | null;
}

export interface GenerateDraftResponse {
  ticket?: string;
  pdf?: string;
  excel?: string;
  test_cases: TestResultsItem[];
  test_data: TestDataItem[];
}

export interface ActionDrivenTestCaseSession {
  name: string | null;
  description: string | null;
}

export interface ExecutionItem {
  created_at: string;
  name: string;
  username: string;
  description: string;
  id: string;
}