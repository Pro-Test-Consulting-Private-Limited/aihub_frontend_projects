/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
  InteractionMode,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { useEffect, useRef, useState } from "react";
import { ANALYTICS_CHART_DATA_POINT } from "@/app/interfaces/analytics";
import moment from "moment";
import { verticalHoverLine } from "@/app/lib/chart-vertical";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
  verticalHoverLine,
);

const AreaLineChart = ({
  metrics,
}: {
  metrics: ANALYTICS_CHART_DATA_POINT[];
}) => {
  const chartRef = useRef<any>(null);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const root = document.documentElement;

    const checkDark = () => setIsDark(root.classList.contains("dark"));
    checkDark();

    const observer = new MutationObserver(checkDark);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });

    return () => observer.disconnect();
  }, []);

  const labels: any = [];
  const values: any = [];
  metrics?.forEach((point) => {
    labels.push(moment(point.x).format("DD MMM, hh:mm a"));
    values.push(point.y);
  });

  const tickColor = isDark ? "#9ca3af" : "#6b7280";
  const gridColor = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)";

  const data = {
    labels: labels,
    datasets: [
      {
        label: "Count",
        data: values,
        borderColor: "#9B87FF",
        borderWidth: 2,
        tension: 0.4,
        fill: true,
        backgroundColor: (context: any) => {
          const chart = context.chart;
          const { ctx, chartArea } = chart;

          if (!chartArea) return;

          const gradient = ctx.createLinearGradient(
            0,
            chartArea.top,
            0,
            chartArea.bottom,
          );
          gradient.addColorStop(0, "rgba(155, 135, 255, 0.4)");
          gradient.addColorStop(1, "rgba(155, 135, 255, 0)");

          return gradient;
        },
        pointRadius: 0,
        pointHoverRadius: 4,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: "index" as InteractionMode,
      intersect: false,
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: true,
        backgroundColor: "#1e1e1e",
        titleColor: "#fff",
        bodyColor: "#fff",
      },
    },
    scales: {
      x: {
        grid: { display: false, drawBorder: false },
        border: {
          display: false,
        },
        ticks: {
          maxTicksLimit: 4,
          color: tickColor,
        },
      },
      y: {
        beginAtZero: true,
        ticks: {
          maxTicksLimit: 4,
          color: tickColor,
        },
        grid: {
          color: gridColor,
          borderDash: [4, 4],
          drawBorder: false,
        },
        border: {
          display: false,
        },
      },
    },
  };

  return (
    <div className="h-[300px] w-full rounded-xl bg-white dark:bg-[#141414] p-4">
      <div className="mb-2 text-sm font-medium text-gray-600 dark:text-[#ededed]">
        Count
      </div>
      <Line ref={chartRef} data={data} options={options} />
    </div>
  );
};

export default AreaLineChart;