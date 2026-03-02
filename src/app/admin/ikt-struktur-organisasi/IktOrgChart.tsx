"use client";
import React, { useEffect, useState } from "react";
import OrgChart, { OrgItem } from "../../../components/OrgChart";

export default function IktOrgChart() {
  const [items, setItems] = useState<OrgItem[]>([]);
  const [detailNode, setDetailNode] = useState<OrgItem | null>(null);
  
  // Ganti endpoint dan mapping sesuai API IKT Anda!
  useEffect(() => {
    async function fetchData() {
      const res = await fetch("/api/admin/ikt-struktur-organisasi/by-daerah/ID_IKT");
      const json = await res.json();
      // Contoh mapping, sesuaikan dengan response API Anda!
      if (json.success && json.data) {
        setItems(json.data.map((row: any) => ({
          id: String(row.id),
          parentId: row.parent_id ? String(row.parent_id) : undefined,
          label: row.nama || row.jabatan || "Tanpa Nama",
          subtitle: row.jabatan || undefined,
          unit: row.unit_kerja || undefined,
          nipp: row.nipp || undefined,
          positionTitle: row.jabatan || undefined,
          photoUrl: row.photo_url || undefined,
          badgeColor: '#1E40AF',
        })));
      }
    }
    fetchData();
  }, []);

  const handleNodeClick = (nodeId: string) => {
    const node = items.find(item => item.id === nodeId);
    setDetailNode(node || null);
  };

  return (
    <div className="space-y-4">
      <OrgChart items={items} direction="TB" onNodeClick={handleNodeClick} />
      {detailNode && (
  <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
    <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-lg relative border border-gray-100 animate-fadeIn pointer-events-auto">
      <button
        className="absolute top-3 right-3 text-gray-400 hover:text-blue-700 text-2xl"
        onClick={() => setDetailNode(null)}
        aria-label="Tutup"
      >
        <svg width="28" height="28" fill="none"><circle cx="14" cy="14" r="13" stroke="#CBD5E1" strokeWidth="2"/><path d="M9 9l10 10M19 9l-10 10" stroke="#64748B" strokeWidth="2" strokeLinecap="round"/></svg>
      </button>
      <div className="flex flex-col items-center mb-6">
        <div className="w-28 h-28 rounded-full bg-gray-100 border-4 border-blue-200 shadow mb-3 flex items-center justify-center overflow-hidden">
          {detailNode.photoUrl ? (
            <img src={detailNode.photoUrl} alt="Foto" className="w-full h-full object-cover" />
          ) : (
            <span className="text-4xl text-blue-400 font-bold">{detailNode.label?.charAt(0) || '?'}</span>
          )}
        </div>
        <div className="text-xl font-bold text-blue-900 flex items-center gap-2">
          {detailNode.label}
        </div>
        <div className="text-base text-gray-700 font-semibold mt-1">{detailNode.positionTitle || detailNode.subtitle || '-'}</div>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm mb-4">
        <div className="text-gray-500">NIPP</div>
        <div className="font-medium text-gray-800">{detailNode.nipp || '-'}</div>
        <div className="text-gray-500">Unit Kerja</div>
        <div className="font-medium text-gray-800">{detailNode.unit || '-'}</div>
        <div className="text-gray-500">ID</div>
        <div className="font-medium text-gray-800">{detailNode.id}</div>
        <div className="text-gray-500">ID Atasan</div>
        <div className="font-medium text-gray-800">{detailNode.parentId || '-'}</div>
      </div>
    </div>
  </div>
)}
    </div>
  );
}