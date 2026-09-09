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
  Module: string;
  ScenarioDescription: string;
  Preconditions: string;
  SubModule: string;
  TestSteps: string[];
  Inputs: JSONObject;
  ExpectedResult: string;
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