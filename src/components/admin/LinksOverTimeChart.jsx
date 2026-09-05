import { useEffect, useState, useMemo } from "react";
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { readThemeColors, solid, alpha } from "../../lib/chartTheme";

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Filler);

export default function LinksOverTimeChart({ data }) {
  const [colors, setColors] = useState(() => readThemeColors());

  useEffect(() => {
    const observer = new MutationObserver(() => setColors(readThemeColors()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const chartData = useMemo(
    () => ({
      labels: data.map((d) => d.date.slice(5)), // MM-DD
      datasets: [
        {
          label: "Links created",
          data: data.map((d) => d.count),
          borderColor: solid(colors.ring),
          backgroundColor: alpha(colors.ring, 0.2),
          fill: true,
          tension: 0.35,
          pointRadius: 0,
          pointHoverRadius: 4,
          borderWidth: 2,
        },
      ],
    }),
    [data, colors],
  );

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: solid(colors.accent),
          titleColor: solid(colors.foreground),
          bodyColor: solid(colors.foreground),
          borderColor: solid(colors.border),
          borderWidth: 1,
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: solid(colors.mutedForeground), maxRotation: 0, autoSkip: true, maxTicksLimit: 8 },
        },
        y: {
          beginAtZero: true,
          grid: { color: solid(colors.border) },
          ticks: { color: solid(colors.mutedForeground), precision: 0 },
        },
      },
    }),
    [colors],
  );

  return (
    <div className="h-64">
      <Line data={chartData} options={options} />
    </div>
  );
}
