/* eslint-disable @typescript-eslint/no-explicit-any */
import request from "@/xhr";
import { BASE_URL, BASE_URL_VERSION } from "../config/urls";
import { ActionDrivenTestCaseSession } from "../interfaces/project";

export const generateDraft = async (files: unknown) =>
  request({
    method: "post",
    url: BASE_URL + "upload",
    data: { file: files },
    files: true,
  });

export const processImage = async (files: unknown) =>
  request({
    method: "post",
    url: BASE_URL + "process-image",
    data: { file: files },
    files: true,
  });

export const generateScript = async (payload: unknown) =>
  request({
    method: "post",
    url: BASE_URL + "manual-test",
    data: payload,
    files: true,
  });

export const getFilesTree = () =>
  request({
    method: "get",
    url: BASE_URL + BASE_URL_VERSION + "/framework/tree",
  });

export const uploadGenerateScriptFile = (payload: unknown) =>
  request({
    method: "post",
    url: BASE_URL + BASE_URL_VERSION + "/input",
    data: payload,
    files: true,
  });

export const generateCypress = (payload: unknown) =>
  request({
    method: "post",
    url: BASE_URL + BASE_URL_VERSION + "/generate",
    data: payload,
  });

export const getFileContent = (path: string) =>
  request({
    method: "get",
    url: BASE_URL + BASE_URL_VERSION + "/files/content" + `?path=${path}`,
  });

export const getDownloadUrl = (path: string) =>
  request({
    method: "get",
    url: BASE_URL + BASE_URL_VERSION + "/files/download" + `?path=${path}`,
  });

export const generateActionDrivenNewRunSessions = async (url: string) =>
  request({
    method: "post",
    url: BASE_URL + "sessions",
    data: { url },
  });

export const generateActionDrivenStopSession = async (id: string) =>
  request({
    method: "post",
    url: BASE_URL + "sessions/" + id + "/stop",
  });

export const generateActionDrivenSaveSession = async (
  id: string,
  payload: ActionDrivenTestCaseSession,
) =>
  request({
    method: "post",
    url: BASE_URL + "sessions/" + id + "/save",
    data: payload,
  });

export const getExecutions = async (page: number, limit: number) =>
  request({
    method: "get",
    url: BASE_URL + "sessions/executions?page=" + page + `&limit=${limit}`,
  });

export const generateActionDrivenRerunSession = async (id: string) =>
  request({
    method: "post",
    url: BASE_URL + "sessions/executions/" + id + "/run",
  });

export const generateActionDrivenManualTestCases = async (id: string) =>
  request({
    method: "get",
    url: BASE_URL + "sessions/" + id + "/manualtest",
  });

export const getSelfHealingRepoStructure = async () =>
  request({
    method: "get",
    url: BASE_URL + "repo-structure",
  });

export const getSelfHealingFileContent = (path: string) =>
  request({
    method: "get",
    url: BASE_URL + "file-content" + `?path=${path}`,
  });

export const runSelfHealingScripts = (workplace: string, payload: any) =>
  fetch(
    BASE_URL +
      "cypress/run-tests" +
      `?workplace=${encodeURIComponent(
        workplace,
      )}&accelerator=Self+Healing+Cypress`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify(payload),
    },
  );

export const runSelfHealingHeal = (workplace: string, payload: any) =>
  request({
    method: "post",
    url:
      BASE_URL +
      "cypress/heal" +
      `?workplace=${workplace}&accelerator=Self+Healing+Cypress`,
    data: payload,
  });

export const runSelfHealingReset = () =>
  request({
    method: "post",
    url: BASE_URL + "cypress/reset",
  });
