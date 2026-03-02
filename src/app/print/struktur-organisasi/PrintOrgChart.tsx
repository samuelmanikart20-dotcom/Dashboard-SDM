"use client";

import { useEffect, useMemo, useState } from "react";
import OrgChart, { OrgItem } from "@/components/OrgChart";

type Props = { daerahId: string };

export default function PrintOrgChart({ daerahId }: Props) {
  const [items, setItems] = useState<OrgItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolvedId, setResolvedId] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);

  // Resolve daerahId if it's a code (e.g., 'KP') into numeric id
  useEffect(() => {
    let cancelled = false;
    async function resolveId() {
      if (!daerahId) { setResolvedId(null); return; }
      // numeric? use directly
      if (/^\d+$/.test(daerahId)) { setResolvedId(daerahId); return; }
      setResolving(true);
      try {
        const res = await fetch('/api/admin/daerah', { cache: 'no-store' });
        const json = await res.json();
        const list = (json?.data || []) as Array<{ id: number; kode: string }>;
        const found = list.find((d) => String(d.kode).toUpperCase() === daerahId.toUpperCase());
        setResolvedId(found ? String(found.id) : null);
        if (!found) setError(`Kode daerah tidak dikenali: ${daerahId}`);
      } catch (e: any) {
        setError(e?.message || 'Gagal memetakan kode daerah');
        setResolvedId(null);
      } finally {
        if (!cancelled) setResolving(false);
      }
    }
    resolveId();
    return () => { cancelled = true; };
  }, [daerahId]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!resolvedId) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/admin/org-positions?daerah_id=${encodeURIComponent(resolvedId)}`, { cache: "no-store" });
        const json = await res.json();
        if (!res.ok || !json?.success) throw new Error(json?.error || "Gagal memuat data");
        const mapped: OrgItem[] = (json.data || []).map((row: any) => ({
          id: String(row.id_posisi_sap),
          parentId: row.id_posisi_atasan ? String(row.id_posisi_atasan) : undefined,
          label: row.nama || row.nama_posisi || row.nama_jabatan_sap || String(row.id_posisi_sap),
          subtitle: row.nama_posisi || row.nama_jabatan_sap || undefined,
          unit: row.unit_kerja || undefined,
          nipp: row.nipp || undefined,
          positionTitle: row.nama_posisi || row.nama_jabatan_sap || undefined,
          photoUrl: row.photo_url || undefined,
          badgeColor: "#1E40AF",
        }));
        if (!cancelled) setItems(mapped);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (resolvedId) load();
    return () => { cancelled = true; };
  }, [resolvedId]);

  const groups = useMemo(() => {
    if (items.length === 0) return [] as Array<{ title: string; nodes: OrgItem[] }>;
    // Find roots and split into subtrees to avoid massive single tree overflow
    const idSet = new Set(items.map(i => i.id));
    const roots = items.filter(i => !i.parentId || !idSet.has(String(i.parentId)));
    const childMap = new Map<string, OrgItem[]>();
    items.forEach(i => {
      if (!i.parentId) return;
      const p = String(i.parentId);
      if (!childMap.has(p)) childMap.set(p, []);
      childMap.get(p)!.push(i);
    });
    const collect = (root: OrgItem): OrgItem[] => {
      const out: OrgItem[] = [];
      const st: OrgItem[] = [root];
      const seen = new Set<string>();
      while (st.length) {
        const cur = st.pop()!;
        if (seen.has(cur.id)) continue;
        seen.add(cur.id);
        out.push(cur);
        (childMap.get(cur.id) || []).forEach(ch => st.push(ch));
      }
      return out;
    };
    return roots.map(r => ({ title: r.label || r.id, nodes: collect(r) }));
  }, [items]);

  if (resolving) return <div className="p-4 text-gray-600">Menyiapkan data…</div>;
  if (loading) return <div className="p-4 text-gray-600">Memuat…</div>;
  if (error) return <div className="p-4 text-red-600">Gagal memuat: {error}</div>;
  if (items.length === 0) return <div className="p-4 text-gray-600">Tidak ada data.</div>;

  return (
    <div className="space-y-6">
      {groups.map((g, idx) => (
        <div key={idx} className="bg-white rounded border p-4">
          <OrgChart items={g.nodes} direction="TB" />
        </div>
      ))}
    </div>
  );
}