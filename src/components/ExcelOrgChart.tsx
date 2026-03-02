import React, { useState, useEffect } from "react";
import OrgChart, { OrgItem } from "./OrgChart";

interface ExcelOrgChartProps {
  endpointUpload: string;
  endpointFetch: string;
  daerahId: string;
}

export default function ExcelOrgChart({
  endpointUpload,
  endpointFetch,
  daerahId,
}: ExcelOrgChartProps) {
  const [items, setItems] = useState<OrgItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpointFetch, daerahId]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(endpointFetch.replace(":daerah_id", daerahId));
      const json = await res.json();
      setItems(json.data || []);
    } catch {
      setError("Gagal mengambil data struktur organisasi.");
    }
    setLoading(false);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("daerah_id", daerahId);
      const res = await fetch(endpointUpload, {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Upload gagal");
      await fetchData();
    } catch (err: any) {
      setError(err.message || "Upload gagal");
    }
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <input
        type="file"
        accept=".xlsx"
        onChange={handleUpload}
        disabled={loading}
      />
      {loading && <div>Loading...</div>}
      {error && <div className="text-red-500">{error}</div>}
      <OrgChart
        items={items}
        direction="TB"
        onNodeClick={() => {}}
        sortMode="input"
      />
    </div>
  );
}
