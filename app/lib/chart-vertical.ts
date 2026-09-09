import { Plugin } from "chart.js";

export const verticalHoverLine: Plugin<"line"> = {
  id: "verticalHoverLine",
  afterDraw: (chart) => {
    const active = chart.getActiveElements();
    if (!active.length) return;

    const { ctx, chartArea } = chart;
    const x = active[0].element.x;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, chartArea.top);
    ctx.lineTo(x, chartArea.bottom);
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(139,124,255,0.6)";
    ctx.stroke();
    ctx.restore();
  },
};
