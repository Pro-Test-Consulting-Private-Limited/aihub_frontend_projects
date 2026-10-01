/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useCallback, useEffect, useState } from "react";
import Dropdown from "../components/dropdown";
import { DropdownItem } from "../interfaces/dropdown";
import ArrowIcon from "../../public/icons/home/right-arrow.svg";
import InstanceType from "../../public/icons/home/instance-type.svg";
import ComputeTime from "../../public/icons/home/compute-time.svg";
import RateImage from "../../public/icons/home/rate.svg";
import ActiveHours from "../../public/icons/home/active-hours.svg";
import RequestsImage from "../../public/icons/home/request.svg";
import AverageTokenCount from "../../public/icons/home/average-token-count.svg";
import AcceleratorUsage from "../../public/icons/home/accelerator-usage.svg";
import CostImage from "../../public/icons/home/cost.svg";
import Image from "next/image";
import { poppins } from "../config/fonts";
import { useProjects } from "../lib/projectsStore";
import { useRouter } from "next/navigation";
import AuthGuard from "../lib/authguard";
import {
  DOMAIN,
  HOME_PROJECT_STATS,
  LASTOPTIONS,
  PERIODOPTIONS,
  WORKPLACES,
} from "../constants/options";
import {
  getServerStatus,
  getBusinessMetrics,
  getModelUsage,
  type ModelUsage,
} from "../services/analytics";
import { MODEL_STARTING_STATES } from "../constants/model-status";
import { useModelStatus } from "../hooks/use-model-status";
import { useMsal } from "@azure/msal-react";

const LAST_OPTION_SECONDS: Record<string, number> = {
  "30 Minutes": 30 * 60,
  "2 Hours": 2 * 60 * 60,
  "12 Hours": 12 * 60 * 60,
  day: 24 * 60 * 60,
  week: 7 * 24 * 60 * 60,
  month: 30 * 24 * 60 * 60,
  year: 365 * 24 * 60 * 60,
};

type StatsPoint = { x: string; y: number };

type StatsResponse = {
  tokens?: { input?: StatsPoint[]; output?: StatsPoint[] };
  total_invocations?: { data?: StatsPoint[] };
};

const sumPoints = (points?: StatsPoint[]) =>
  (points || []).reduce((sum, point) => sum + (Number(point.y) || 0), 0);

const formatUsd = (value: number | null | undefined) =>
  value == null ? "-" : `$${value.toFixed(2)}`;

export default function Home() {
  const [active, setActive] = useState("inference_endpoints");
  const [activeWorkplaceTab, setActiveWorkplaceTab] = useState("ai-hub");
  const [user, setUser] = useState<any>({});
  const [workplace, setWorkplace] = useState<DropdownItem | null>(
    WORKPLACES[0],
  );
  const [domain, setDomain] = useState<string>("Information Technology");
  const [period, setPeriod] = useState<DropdownItem | null>(PERIODOPTIONS[0]);
  const [last, setLast] = useState<DropdownItem | null>(LASTOPTIONS[0]);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [usage, setUsage] = useState<ModelUsage | null>(null);
  const [usageError, setUsageError] = useState(false);
  const [server, setServer] = useState<{
    Backend: boolean;
    database: boolean;
  } | null>(null);
  const modelState = useModelStatus();
  const router = useRouter();
  const { accounts } = useMsal();
  const { projects } = useProjects();

  const fetchUser = useCallback(() => {
    if (accounts.length !== 0) setUser(accounts[0]);
  }, [accounts]);

  const lastValue = last?.value;
  const periodValue = period?.value;

  useEffect(() => {
    getBusinessMetrics(LAST_OPTION_SECONDS[String(lastValue)] ?? 1800)
      .then((response) => setStats(response?.data ?? null))
      .catch((error) => console.log(error));
  }, [lastValue]);

  useEffect(() => {
    setUsageError(false);
    getModelUsage(periodValue === "Last Month" ? "last" : "current")
      .then(setUsage)
      .catch(() => {
        setUsage(null);
        setUsageError(true);
      });
  }, [periodValue]);

  const fetchServerStatus = useCallback(async () => {
    getServerStatus()
      .then((response) => {
        console.log("AI HUB HEALTH RESPONSE:", response);
        setServer(response?.data?.details);
      })
      .catch((error) => console.log("AI HUB HEALTH ERROR:", error));
  }, []);

  useEffect(() => {
    fetchUser();
    fetchServerStatus();
  }, [fetchUser, fetchServerStatus]);

  const backendDown =
    server !== null && (!server.Backend || !server.database);
  const aiStatus =
    !backendDown && modelState === "running"
      ? { label: "Active", badge: "bg-[rgba(40,167,69,0.1)] text-[#28A745]", dot: "bg-[#28A745]" }
      : !backendDown && modelState && MODEL_STARTING_STATES.includes(modelState)
        ? { label: "Initializing", badge: "bg-[rgba(255,193,7,0.15)] text-[#B7791F]", dot: "bg-[#B7791F]" }
        : { label: "Inactive", badge: "bg-[rgba(220,53,69,0.1)] text-[#DC3545]", dot: "bg-[#DC3545]" };

  const totalRequests = sumPoints(stats?.total_invocations?.data);
  const inputTokens = sumPoints(stats?.tokens?.input);
  const outputTokens = sumPoints(stats?.tokens?.output);
  const averageTokens = totalRequests
    ? Math.round((inputTokens + outputTokens) / totalRequests)
    : 0;

  const visibleProjects = projects;

  return (
    <AuthGuard>
      <div className="p-6 pb-[4.5rem] h-[calc(100%-70px)] overflow-y-auto">
        <div className="flex justify-between">
          <div>
            <div className="text-[24px] font-medium text-[#1F1F1F] dark:text-[#ededed] capitalize">
              Welcome {user?.name || ""}
            </div>
            <div className="text-[#7E7E7E] dark:text-[#9ca3af] text-[13px]">
              Here&apos;s an overview of your workplace
            </div>
          </div>

          <button className="border-0 text-[#8664f2] font-medium text-[15px]">
            Manage Workplace
          </button>
        </div>

        <div className="flex items-center mt-[30px]">
          <div className="w-[max-content] text-[#000000] dark:text-[#ededed] bg-[#fff] dark:bg-[#141414] border border-[rgba(94,96,102,0.5)] dark:border-[#2a2a2a] rounded-[12px] text-sm h-[45px] flex">
            <div className="flex justify-center h-full flex items-center pl-[15px] mr-[10px] font-[500] dark:text-[#ededed]">
              Workplace :
            </div>
            <Dropdown
              options={WORKPLACES}
              selected={workplace}
              onChange={setWorkplace}
              placeholder="Select Workplace"
              buttonClass="border-0 h-[43px] rounded-l-[0px] min-w-[100px] pr-[15px] text-[#5E6066]"
              lessHeight
            />
          </div>

          <div
            className={`h-[26px] ml-[15px] flex justify-center items-center px-[15px] rounded-[26px] text-[12px] font-[500] ${aiStatus.badge}`}
            title={`Backend: ${server?.Backend ? "up" : "down"} · Database: ${
              server?.database ? "up" : "down"
            } · Model: ${modelState ?? "unknown"}`}
          >
            <div
              className={`w-[5px] h-[5px] rounded-full mr-[8px] animate-pulse-blocking ${aiStatus.dot}`}
            ></div>
            AI Model {aiStatus.label}
          </div>
        </div>

        <div className="font-[500] text-sm mt-[15px] mb-[5px] dark:text-[#ededed]">Domain</div>

        <div className="flex overflow-x-auto items-center">
          {DOMAIN.map((item) => {
            return (
              <div
                className={`w-[auto] whitespace-nowrap flex items-center px-[15px] border border-[rgba(94,96,102,0.5)] dark:border-[#2a2a2a] rounded-[12px] text-sm font-[500] h-[45px] cursor-pointer mr-[15px] ${
                  domain === item.value
                    ? "bg-[#8664F2] text-[#fff]"
                    : "bg-[#fff] dark:bg-[#141414] text-[#5E6066] dark:text-[#ededed]"
                }`}
                key={item.value}
                onClick={() => setDomain(item.value)}
              >
                {item.label}
              </div>
            );
          })}
        </div>

        <div className="flex justify-between mt-5 mb-[30px] gap-[25px] overflow-x-auto no-scrollbar">
          {HOME_PROJECT_STATS.map((item) => {
            return (
              <div
                key={item.value}
                className="rounded-xl px-5 py-5 w-[32%] min-w-[350px] bg-[#fff] dark:bg-[#141414] border-[0.5px] border-[rgba(94, 96, 102, 0.1)] dark:border-[#2a2a2a] cursor-pointer"
              >
                <div className="flex justify-between items-center">
                  <div className="text-[#1F1F1F] dark:text-[#ededed] font-medium text-[18px]">
                    {item.label}
                  </div>
                  <Image src={item.icon} width={40} alt="active-projects" />
                </div>

                <div className="flex justify-between items-center mt-4 pt-3">
                  <div
                    className={`${poppins.className} text-[#1F1F1F] dark:text-[#ededed] font-medium text-4xl`}
                  >
                    {item.count}
                  </div>
                  <Image src={ArrowIcon} alt="arrow" width={18} className="dark:invert" />
                </div>
              </div>
            );
          })}
        </div>

        <div className="rounded-xl px-5 pt-5 pb-3 w-[100%] mb-[30px] bg-[#fff] dark:bg-[#141414] border-[0.5px] border-[#E2ECF9] dark:border-[#2a2a2a]">
          <div className="text-[#1F1F1F] dark:text-[#ededed] font-medium text-[20px] px-[15px] mb-[10px]">
            Project Summary
          </div>

          <div className="flex items-start border-b border-[#CAC4D0] dark:border-[#2a2a2a] mb-[10px]">
            <div
              className={`relative flex justify-center items-center h-[48px] px-[16px] cursor-pointer rounded-t-[12px] transition-colors ${
                activeWorkplaceTab === "ai-hub"
                  ? "bg-[#FBF8FF] dark:bg-[#2a2440]"
                  : "bg-white dark:bg-transparent hover:bg-[#FAFAFA] dark:hover:bg-[#1a1a1a]"
              }`}
              onClick={() => setActiveWorkplaceTab("ai-hub")}
            >
              <span
                className={`text-[14px] font-[500] ${
                  activeWorkplaceTab === "ai-hub"
                    ? "text-[#8664F2]"
                    : "text-[#49454F] dark:text-[#9ca3af] font-[400]"
                }`}
              >
                AI Hub
              </span>
              {activeWorkplaceTab === "ai-hub" && (
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#8664F2]" />
              )}
            </div>
            <div
              className={`relative flex justify-center items-center h-[48px] px-[16px] cursor-pointer rounded-t-[12px] transition-colors ${
                activeWorkplaceTab === "app-atlas"
                  ? "bg-[#FBF8FF] dark:bg-[#2a2440]"
                  : "bg-white dark:bg-transparent hover:bg-[#FAFAFA] dark:hover:bg-[#1a1a1a]"
              }`}
              onClick={() => setActiveWorkplaceTab("app-atlas")}
            >
              <span
                className={`text-[14px] font-[500] ${
                  activeWorkplaceTab === "app-atlas"
                    ? "text-[#8664F2]"
                    : "text-[#49454F] dark:text-[#9ca3af] font-[400]"
                }`}
              >
                App Atlas
              </span>
              {activeWorkplaceTab === "app-atlas" && (
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#8664F2]" />
              )}
            </div>
          </div>

          <div className="flex justify-between items-center bg-[#F9FAFC] dark:bg-[#1a1a1a] h-[49px] px-[15px] my-[5px] rounded-[5px]">
            <div className="w-[25%] text-[14px] font-medium text-[#1F1F1F] dark:text-[#ededed]">
              Project Name
            </div>
            <div className="w-[15%] text-[14px] font-medium text-[#1F1F1F] dark:text-[#ededed]">
              Owner
            </div>
            <div className="w-[20%] text-[14px] font-medium text-[#1F1F1F] dark:text-[#ededed]">
              Date of Creation
            </div>
            <div className="w-[30%] text-[14px] font-medium text-[#1F1F1F] dark:text-[#ededed]">
              Application URL
            </div>
            {/* <div className="w-[10%] text-[14px] font-medium text-[#1F1F1F] dark:text-[#ededed] text-right">
              Actions
            </div> */}
          </div>

          {visibleProjects.length === 0 && (
            <div className="text-[13px] text-[#7E7E7E] dark:text-[#9ca3af] px-[15px] py-[15px]">
              No projects yet in this tab.
            </div>
          )}

          {visibleProjects.map((project) => {
            return (
              <div
                key={project.id}
                className="flex justify-between items-center h-[49px] my-[5px] cursor-pointer px-[15px]"
                onClick={() => {
                  router.push(
                    `/projects/${project.id}/?workplace=${workplace?.value}&domain=${domain}`,
                  );
                }}
              >
                <div className="w-[25%] text-[14px] text-[#1F1F1F] dark:text-[#ededed]">
                  {project.name}
                </div>
                <div className="w-[15%] text-[14px] text-[#1F1F1F] dark:text-[#ededed]">
                  {project.owner || "-"}
                </div>
                <div className="w-[20%] text-[14px] text-[#1F1F1F] dark:text-[#ededed]">
                  {project.dateOfCreation || "-"}
                </div>
                <div className="w-[30%] text-[14px] text-[#1F1F1F] dark:text-[#ededed] truncate">
                  {project.applicationUrl ? (
                      <a href={project.applicationUrl} target="_blank" rel="noopener noreferrer" className="text-[#8664F2] underline" onClick={(e) => e.stopPropagation()}>
                        {project.applicationUrl}
                      </a>
                  ) : (
                    <span className="text-[#9ca3af]">Insert Link</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div>
          <div className="text-[#1F1F1F] dark:text-[#ededed] text-[22px] font-[700] mb-[20px]">
            Usage and Cost
          </div>

          <div className="w-[max-content] text-[#000000] dark:text-[#ededed] bg-[#fff] dark:bg-[#141414] border border-[rgba(94,96,102,0.5)] dark:border-[#2a2a2a] rounded-[12px] text-sm h-[45px] flex">
            <div className="w-[75px] flex justify-center h-full flex items-center border-r border-[rgba(94,96,102,0.5)] dark:border-[#2a2a2a] dark:text-[#ededed]">
              Period
            </div>
            <Dropdown
              options={PERIODOPTIONS}
              selected={period}
              onChange={setPeriod}
              placeholder="Select Period"
              buttonClass="border-0 h-[43px] rounded-l-[0px] min-w-[150]"
              lessHeight
            />
          </div>

          <div className="flex justify-between mt-5 mb-[30px] overflow-x-auto no-scrollbar">
            <div className="rounded-xl px-5 py-5 min-w-[350px] mr-[15px] bg-[#fff] dark:bg-[#141414] border-[0.7px] border-[#E2ECF9] dark:border-[#2a2a2a] cursor-pointer">
              <div className="flex justify-between items-center">
                <div className="text-[#1F1F1F] dark:text-[#ededed] font-medium text-[18px]">
                  Instance Type
                </div>
                <Image src={InstanceType} width={35} alt="active-projects" />
              </div>

              <div className="flex justify-between items-center mt-4 pt-3">
                <div
                  className={`${poppins.className} text-[#1F1F1F] dark:text-[#ededed] text-[32px]`}
                >
                  {usage?.instanceType || "-"}
                </div>
              </div>
            </div>
            <div className="rounded-xl px-5 py-5 min-w-[350px] mr-[15px] bg-[#fff] dark:bg-[#141414] border-[0.7px] border-[#E2ECF9] dark:border-[#2a2a2a] cursor-pointer">
              <div className="flex justify-between items-center">
                <div className="text-[#1F1F1F] dark:text-[#ededed] font-medium text-[18px]">
                  Compute Time
                </div>
                <Image src={ComputeTime} width={35} alt="active-projects" />
              </div>

              <div className="flex justify-between items-center mt-4 pt-3">
                <div
                  className={`${poppins.className} text-[#1F1F1F] dark:text-[#ededed] text-[32px]`}
                >
                  {usage ? usage.computeMinutes : "-"}{" "}
                  <span className="font-[400] text-[18px]">minutes</span>
                </div>
              </div>
            </div>
            <div className="rounded-xl px-5 py-5 min-w-[350px] mr-[15px] bg-[#fff] dark:bg-[#141414] border-[0.7px] border-[#E2ECF9] dark:border-[#2a2a2a] cursor-pointer">
              <div className="flex justify-between items-center">
                <div className="text-[#1F1F1F] dark:text-[#ededed] font-medium text-[18px]">
                  Rate (USD/hour)
                </div>
                <Image src={RateImage} width={35} alt="active-projects" />
              </div>

              <div className="flex justify-between items-center mt-4 pt-3">
                <div
                  className={`${poppins.className} text-[#1F1F1F] dark:text-[#ededed] text-[32px]`}
                >
                  {formatUsd(usage?.pricePerHourUsd)}
                </div>
              </div>
            </div>
            <div className="rounded-xl px-5 py-5 min-w-[350px] mr-[15px] bg-[#fff] dark:bg-[#141414] border-[0.7px] border-[#E2ECF9] dark:border-[#2a2a2a] cursor-pointer">
              <div className="flex justify-between items-center">
                <div className="text-[#1F1F1F] dark:text-[#ededed] font-medium text-[18px]">
                  Cost (USD)
                </div>
                <Image src={CostImage} width={35} alt="active-projects" />
              </div>

              <div className="flex justify-between items-center mt-4 pt-3">
                <div
                  className={`${poppins.className} text-[#1F1F1F] dark:text-[#ededed] text-[32px]`}
                >
                  {formatUsd(usage?.costUsd)}
                </div>
              </div>
            </div>
          </div>

          {usageError && (
            <div className="-mt-[15px] mb-[30px] text-[12px] text-[#DC3545]">
              Could not load usage from Hugging Face.
            </div>
          )}
        </div>

        <div className="mt-[25px]">
          <div className="text-[#1F1F1F] dark:text-[#ededed] text-[22px] font-[700] mb-[20px]">
            Analytics
          </div>

          <div className="w-[max-content] text-[#000000] dark:text-[#ededed] bg-[#fff] dark:bg-[#141414] border border-[rgba(94,96,102,0.5)] dark:border-[#2a2a2a] rounded-[12px] text-sm h-[45px] flex">
            <div className="w-[75px] flex justify-center h-full flex items-center border-r border-[rgba(94,96,102,0.5)] dark:border-[#2a2a2a] dark:text-[#ededed]">
              Last
            </div>
            <Dropdown
              options={LASTOPTIONS}
              selected={last}
              onChange={setLast}
              placeholder="Select Last"
              buttonClass="border-0 h-[43px] rounded-l-[0px] min-w-[150]"
              lessHeight
            />
          </div>

          <div className="w-[max-content] bg-[#fff] dark:bg-transparent text-[18px] h-[70px] flex mt-5">
            <div
              className={`h-[70px] px-[15px] flex items-center h-full border-b-[2px] cursor-pointer ${
                active === "inference_endpoints"
                  ? "border-[#8664f2] text-[#8664f2] font-[500]"
                  : "border-[#E2ECF9] dark:border-[#2a2a2a] text-[#201D23] dark:text-[#ededed]"
              }`}
              onClick={() => setActive("inference_endpoints")}
            >
              Inference Endpoints
            </div>
            <div
              className={`h-[70px] px-[15px] flex items-center h-full border-b-[2px] cursor-pointer ${
                active === "user_actions"
                  ? "border-[#8664f2] text-[#8664f2] font-[500]"
                  : "border-[#E2ECF9] dark:border-[#2a2a2a] text-[#201D23] dark:text-[#ededed]"
              }`}
              onClick={() => setActive("user_actions")}
            >
              User Actions
            </div>
          </div>

          {active === "inference_endpoints" ? (
            <div className="flex justify-between mt-5 mb-[30px]  overflow-x-auto no-scrollbar">
              <div className="rounded-xl px-5 py-5 w-[32%] min-w-[350px] mr-[15px] bg-[#fff] dark:bg-[#141414] border-[0.7px] border-[#E2ECF9] dark:border-[#2a2a2a] cursor-pointer">
                <div className="flex justify-between items-center">
                  <div className="text-[#1F1F1F] dark:text-[#ededed] font-medium text-[18px]">
                    Tokens Processed
                  </div>
                  <Image src={ActiveHours} width={35} alt="tokens-processed" />
                </div>

                <div className="flex justify-between items-end mt-4 pt-3">
                  <div
                    className={`${poppins.className} text-[#1F1F1F] dark:text-[#ededed] text-[32px]`}
                  >
                    {(inputTokens + outputTokens).toLocaleString()}
                  </div>
                  <div className="text-[12px] text-[#7E7E7E] dark:text-[#9ca3af] pb-[6px]">
                    {inputTokens.toLocaleString()} in · {outputTokens.toLocaleString()} out
                  </div>
                </div>
              </div>
              <div className="rounded-xl px-5 py-5 w-[32%] min-w-[350px] mr-[15px] bg-[#fff] dark:bg-[#141414] border-[0.7px] border-[#E2ECF9] dark:border-[#2a2a2a] cursor-pointer">
                <div className="flex justify-between items-center">
                  <div className="text-[#1F1F1F] dark:text-[#ededed] font-medium text-[18px]">
                    Model Requests
                  </div>
                  <Image src={RequestsImage} width={35} alt="model-requests" />
                </div>

                <div className="flex justify-between items-center mt-4 pt-3">
                  <div
                    className={`${poppins.className} text-[#1F1F1F] dark:text-[#ededed] text-[32px]`}
                  >
                    {totalRequests}{" "}
                    <span className="font-[400] text-[18px]">reqs</span>
                  </div>
                </div>
              </div>
              <div className="rounded-xl px-5 py-5 w-[32%] min-w-[350px] mr-[15px] bg-[#fff] dark:bg-[#141414] border-[0.7px] border-[#E2ECF9] dark:border-[#2a2a2a] cursor-pointer">
                <div className="flex justify-between items-center">
                  <div className="text-[#1F1F1F] dark:text-[#ededed] font-medium text-[18px]">
                    Average token count
                  </div>
                  <Image
                    src={AverageTokenCount}
                    width={35}
                    alt="active-projects"
                  />
                </div>

                <div className="flex justify-between items-center mt-4 pt-3">
                  <div
                    className={`${poppins.className} text-[#1F1F1F] dark:text-[#ededed] text-[32px]`}
                  >
                    {averageTokens.toLocaleString()}{" "}
                    <span className="font-[400] text-[18px]">per request</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex justify-between mt-5 mb-[30px]">
              <div className="rounded-xl px-5 py-5 w-[32%] min-w-[350px] mr-[15px] bg-[#fff] dark:bg-[#141414] border-[0.7px] border-[#E2ECF9] dark:border-[#2a2a2a] cursor-pointer">
                <div className="flex justify-between items-center">
                  <div className="text-[#1F1F1F] dark:text-[#ededed] font-medium text-[18px]">
                    Accelerator Usage
                  </div>
                  <Image
                    src={AcceleratorUsage}
                    width={35}
                    alt="active-projects"
                  />
                </div>

                <div className="flex justify-between items-center mt-4 pt-3">
                  <div
                    className={`${poppins.className} text-[#1F1F1F] dark:text-[#ededed] text-[32px]`}
                  >
                    {totalRequests}{" "}
                    <span className="font-[400] text-[18px]">times</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}



