import { useEffect, useState, useMemo } from "react";
import { Chart as ChartJS, BarElement, LinearScale, CategoryScale, Tooltip } from "chart.js";
import { Bar } from "react-chartjs-2";
import { readThemeColors, solid, alpha } from "../../lib/chartTheme";

ChartJS.register(BarElement, LinearScale, CategoryScale, Tooltip);

export default function SizeDistributionChart({ data }) {
  const [colors, setColors] = useState(() => readThemeColors());

  useEffect(() => {
    const observer = new MutationObserver(() => setColors(readThemeColors()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const chartData = useMemo(
    () => ({
      labels: data.map((d) => d.bucket),
      datasets: [
        {
          label: "Snippets",
          data: data.map((d) => d.count),
          backgroundColor: alpha(colors.devCyan, 0.55),
          borderColor: solid(colors.devCyan),
          borderWidth: 1,
          borderRadius: 6,
          maxBarThickness: 40,
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
          ticks: { color: solid(colors.mutedForeground) },
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
      <Bar data={chartData} options={options} />
    </div>
  );
}
