/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import Breadcrumbs from "@/app/components/breadcrumbs";
import {
  ACCELERATORS_LIFE_CYCLE,
  ProjectSegmentsBreadcrumbs,
} from "@/app/constants/projects";
import AuthGuard from "@/app/lib/authguard";
import { useProjects } from "@/app/lib/projectsStore";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";

const polarToCartesian = (cx: number, cy: number, r: number, angle: number) => {
  const rad = (Math.PI / 180) * angle;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
};

const arcPath = (
  cx: number,
  cy: number,
  r1: number,
  r2: number,
  startAngle: number,
  endAngle: number
) => {
  const [x1, y1] = polarToCartesian(cx, cy, r1, startAngle);
  const [x2, y2] = polarToCartesian(cx, cy, r1, endAngle);
  const [x3, y3] = polarToCartesian(cx, cy, r2, endAngle);
  const [x4, y4] = polarToCartesian(cx, cy, r2, startAngle);

  const largeArc = endAngle - startAngle > 180 ? 1 : 0;

  return `
    M ${x1} ${y1}
    A ${r1} ${r1} 0 ${largeArc} 1 ${x2} ${y2}
    L ${x3} ${y3}
    A ${r2} ${r2} 0 ${largeArc} 0 ${x4} ${y4}
    Z
  `;
};

export default function ProjectSegments({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { projects } = useProjects();

  const [projectId, setProjectId] = useState<string | null>(null);

  const projectDetails = projects.find((project) => String(project.id) === String(projectId));
  const [activeIndex, setActiveIndex] = useState<any>();
  const [rotation, setRotation] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const workplace: string = searchParams.get("workplace") || "";
  const domain: string = searchParams.get("domain") || "";

  const size = 650;
  const cx = size / 2;
  const cy = size / 2;
  const innerR = 120;
  const outerR = 240;
  const stepAngle = 360 / ACCELERATORS_LIFE_CYCLE.length;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
        setRotation(0);
        setActiveIndex(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    params.then((res: { slug: string }) => setProjectId(res.slug));
  }, [params]);



  const handleClick = (index: number) => {
    if (index === activeIndex) {
      setShowDropdown((prev) => !prev);
      return;
    }

    if (index === activeIndex) return;

    let diff = (index - (activeIndex || 0)) * stepAngle;

    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;

    const targetRotation = rotation - diff;

    setShowDropdown(false);
    setRotation(targetRotation);
    setActiveIndex(index);

    setTimeout(() => setShowDropdown(true), 500);
  };

  return (
    <AuthGuard>
      <div className="p-6 pb-[4.5rem] h-full overflow-y-auto">
        <Breadcrumbs
          breadcrumbs={ProjectSegmentsBreadcrumbs(
            workplace,
            domain,
            projectDetails
          )}
        />

        <div className="flex items-center justify-center min-h-screen relative">
          {showDropdown &&
            ACCELERATORS_LIFE_CYCLE[activeIndex]?.accelerators?.length !==
              0 && (
              <motion.div
                ref={dropdownRef}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                className="absolute bg-[#444444] text-white rounded-xl shadow-lg p-[8px] min-w-[150px]"
                style={{
                  top: "5%",
                  left: "50%",
                  transform: "translateX(-50%)",
                }}
              >
                <ul className="space-y-2">
                  {ACCELERATORS_LIFE_CYCLE[activeIndex]?.accelerators?.map(
                    (agent, i) => (
                      <li
                        key={i}
                        className="flex items-center space-x-2 cursor-pointer hover:bg-[#3887C7] text-[14px] p-[7px] px-[15px] rounded-[5px]"
                        onClick={() => {
                          router.push(
                            `/projects/${
                              agent.route
                            }?projectId=${projectId}&workplace=${workplace}&domain=${domain}${
                              agent.segment ? `&segment=${agent.segment}` : ""
                            }`
                          );
                        }}
                      >
                        <span>{agent?.label}</span>
                      </li>
                    )
                  )}
                </ul>
              </motion.div>
            )}
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <motion.svg
              width={size}
              height={size}
              viewBox={`0 0 ${size} ${size}`}
              animate={{ rotate: rotation }}
              transition={{ duration: 0.8, ease: "easeInOut" }}
              style={{ originX: "50%", originY: "50%" }}
            >
              {ACCELERATORS_LIFE_CYCLE.map((step, i) => {
                const startAngle = i * stepAngle - 120;
                const endAngle = startAngle + stepAngle;

                // Middle angle for positioning icon/text
                const midAngle = (startAngle + endAngle) / 2;
                const [tx, ty] = polarToCartesian(
                  cx,
                  cy,
                  (innerR + outerR) / 2,
                  midAngle
                );

                const [ox, oy] = polarToCartesian(cx, cy, outerR, midAngle);
                const isActive = i === activeIndex;

                return (
                  <motion.g
                    key={i}
                    onClick={() => handleClick(i)}
                    className="cursor-pointer"
                    animate={{ scale: isActive ? 1.1 : 1 }}
                    transition={{ duration: 0.4 }}
                  >
                    <path
                      d={arcPath(cx, cy, outerR, innerR, startAngle, endAngle)}
                      fill={`url(#grad${i})`}
                      stroke="white"
                      strokeWidth="7"
                    />

                    <path
                      d={arcPath(
                        cx,
                        cy,
                        outerR - 15,
                        outerR - 15,
                        startAngle + 4,
                        endAngle - 44
                      )}
                      fill="none"
                      stroke="white"
                      strokeWidth="4"
                      strokeLinecap="round"
                    />

                    <path
                      d={arcPath(
                        cx,
                        cy,
                        outerR - 15,
                        outerR - 15,
                        startAngle + 19,
                        endAngle - 39
                      )}
                      fill="none"
                      stroke="white"
                      strokeWidth="4"
                      strokeLinecap="round"
                    />

                    <g>
                      <circle
                        cx={ox}
                        cy={oy}
                        r="35"
                        fill={step.color}
                        stroke={step.color}
                        strokeWidth="4"
                      />
                      <foreignObject
                        x={ox - 20}
                        y={oy - 20}
                        width="50"
                        height="50"
                      >
                        <div className="flex items-center justify-center w-10 h-10">
                          <motion.div
                            className="flex items-center justify-center w-10 h-10"
                            animate={{ rotate: -rotation }}
                            transition={{ duration: 0.8, ease: "easeInOut" }}
                            style={{ transformOrigin: "center" }}
                          >
                            <Image
                              src={step.icon}
                              alt={step.title}
                              className="w-[30px] h-[30px] object-contain"
                            />
                          </motion.div>
                        </div>
                      </foreignObject>
                    </g>

                    {/* Gradient for each slice */}
                    <defs>
                      <linearGradient
                        id={`grad${i}`}
                        x1="0"
                        y1="0"
                        x2="1"
                        y2="1"
                      >
                        <stop offset="0%" stopColor={step.color} />
                      </linearGradient>
                    </defs>

                    {/* Icon + Text */}
                    <motion.g
                      animate={{ rotate: -rotation }}
                      transition={{ duration: 0.8, ease: "easeInOut" }}
                      transform={`rotate(${-rotation}, ${tx}, ${ty})`}
                    >
                      <foreignObject
                        x={tx - 50}
                        y={ty - 50}
                        width="100"
                        height="100"
                      >
                        <div className="h-full w-[100px] h-[100px] flex flex-col items-center justify-center text-white text-center">
                          {/* <step.icon className="w-6 h-6 mb-1" /> */}
                          <span className="text-xs font-medium">
                            {step.title}
                          </span>
                        </div>
                      </foreignObject>
                    </motion.g>
                  </motion.g>
                );
              })}
            </motion.svg>

            {/* Center Circle */}
            <circle cx={cx} cy={cy} r={innerR - 25} fill="#444444" />
            <circle
              cx={cx}
              cy={cy}
              r={innerR - 13} // slightly larger than outerR
              fill="none"
              stroke="#444444"
              strokeWidth="1"
            />
            <text
              x={cx}
              y={cy - 15}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-white text-lg font-semibold"
            >
              AI-Powered
            </text>
            <text
              x={cx}
              y={cy + 15}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-white text-lg font-semibold"
            >
              Testing Hub
            </text>
          </svg>
        </div>
      </div>
    </AuthGuard>
  );
}







