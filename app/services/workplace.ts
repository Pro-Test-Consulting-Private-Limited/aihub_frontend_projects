import request from "@/xhr";
import { BASE_URL } from "../config/urls";

export const fetchErrorLogs = async (page: number, limit: number) =>
  request({
    method: "get",
    url: BASE_URL + "error-logs?page=" + page + `&limit=${limit}`,
  });
