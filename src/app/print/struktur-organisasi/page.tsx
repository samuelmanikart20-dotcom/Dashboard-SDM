"use client";

import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import PrintOrgChart from "./PrintOrgChart";

export default function PrintStrukturOrganisasiPage() {
  const searchParams = useSearchParams();
  const daerahId = useMemo(() => searchParams.get("daerah_id") || "1", [searchParams]);

  return (
    <div style={{ padding: 0, margin: 0, background: "#ffffff" }}>
      {/* Force ReactFlow height for print/headless */}
      <style>{`
  #struktur-print .h-\\[70vh\\] { height: 1200px !important; }
`}</style>
      <div id="struktur-print" style={{ background: "#ffffff" }}>
        <PrintOrgChart daerahId={daerahId} />
      </div>
    </div>
  );
}