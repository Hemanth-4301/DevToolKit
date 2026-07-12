export default function GradientMesh({ active }) {
  if (!active) return null;

  return (
    <div className="gradient-mesh-canvas" aria-hidden="true">
      <div
        className="mesh-blob"
        style={{
          top: "-10%",
          left: "-8%",
          width: "45vw",
          height: "45vw",
          background: "#64748b",
          animation: "mesh-drift-1 22s ease-in-out infinite",
        }}
      />
      <div
        className="mesh-blob"
        style={{
          top: "10%",
          right: "-12%",
          width: "38vw",
          height: "38vw",
          background: "#e2e8f0",
          animation: "mesh-drift-2 26s ease-in-out infinite",
        }}
      />
      <div
        className="mesh-blob"
        style={{
          bottom: "-15%",
          left: "20%",
          width: "42vw",
          height: "42vw",
          background: "#334155",
          animation: "mesh-drift-3 30s ease-in-out infinite",
        }}
      />
    </div>
  );
}
