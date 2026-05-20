"use client";

import { useEffect, useState } from "react";

interface MutasiRow {
  id: number;
  entitas: string;
  jenis: "PENAMBAHAN" | "PENGURANGAN";
  bulan: number;
  tahun: number;
  nama: string;
  status_pekerjaan: string;
  keterangan_penambahan: string;
  tmt: string;
  keterangan: string;
}

const BULAN_NAMES = [
  "", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

const ENTITAS_LIST = ["SPMT", "PTP", "IKT", "TCU"];
const TAHUN_LIST = Array.from({ length: 13 }, (_, i) => String(2024 + i));

export default function MutasiUserPage() {
  const [filterBulan, setFilterBulan] = useState(String(new Date().getMonth() + 1));
  const [filterTahun, setFilterTahun] = useState(String(new Date().getFullYear()));
  const [filterEntitas, setFilterEntitas] = useState("");
  const [filterJenis, setFilterJenis] = useState("");

  const [data, setData] = useState<MutasiRow[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterBulan)   params.append("bulan",   filterBulan);
      if (filterTahun)   params.append("tahun",   filterTahun);
      if (filterEntitas) params.append("entitas", filterEntitas);
      if (filterJenis)   params.append("jenis",   filterJenis);

      const res  = await fetch(`/api/admin/mutasi-sdm?${params.toString()}`);
      const json = await res.json();
      setData(json.success ? json.data : []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterBulan, filterTahun, filterEntitas, filterJenis]);

  const penambahan  = data.filter((r) => r.jenis === "PENAMBAHAN");
  const pengurangan = data.filter((r) => r.jenis === "PENGURANGAN");

  const periodLabel =
    filterBulan && filterTahun
      ? `${BULAN_NAMES[parseInt(filterBulan)]} ${filterTahun}`
      : filterTahun || "Semua Periode";

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      {/* ── HEADER ── */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800">MONITORING MUTASI SDM</h1>
        <p className="text-gray-500 mt-1">
          Informasi pegawai penambahan dan pengurangan per entitas — periode{" "}
          <span className="font-semibold text-gray-700">{periodLabel}</span>
          {filterEntitas && (
            <span className="ml-1 font-semibold text-gray-700">· {filterEntitas}</span>
          )}
        </p>
      </div>

      {/* ── FILTER ── */}
      <div className="bg-white rounded-xl shadow p-5 mb-6">
        <h2 className="text-sm font-bold text-gray-600 mb-3">Filter Data</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Bulan */}
          <select
            value={filterBulan}
            onChange={(e) => setFilterBulan(e.target.value)}
            className="border rounded-lg px-3 py-2 text-gray-800 text-sm"
          >
            <option value="">Semua Bulan</option>
            {BULAN_NAMES.slice(1).map((b, i) => (
              <option key={i + 1} value={String(i + 1)}>{b}</option>
            ))}
          </select>

          {/* Tahun */}
          <select
            value={filterTahun}
            onChange={(e) => setFilterTahun(e.target.value)}
            className="border rounded-lg px-3 py-2 text-gray-800 text-sm"
          >
            <option value="">Semua Tahun</option>
            {TAHUN_LIST.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          {/* Entitas */}
          <select
            value={filterEntitas}
            onChange={(e) => setFilterEntitas(e.target.value)}
            className="border rounded-lg px-3 py-2 text-gray-800 text-sm"
          >
            <option value="">Semua Entitas</option>
            {ENTITAS_LIST.map((e) => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>

          {/* Jenis */}
          <select
            value={filterJenis}
            onChange={(e) => setFilterJenis(e.target.value)}
            className="border rounded-lg px-3 py-2 text-gray-800 text-sm"
          >
            <option value="">Penambahan & Pengurangan</option>
            <option value="PENAMBAHAN">Penambahan</option>
            <option value="PENGURANGAN">Pengurangan</option>
          </select>
        </div>
      </div>

      {/* ── SUMMARY CARDS ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
        <div className="bg-white rounded-xl shadow p-5 border-l-4 border-green-500">
          <p className="text-gray-500 text-sm mb-1">Total Penambahan</p>
          <p className="text-4xl font-bold text-green-600">{penambahan.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow p-5 border-l-4 border-red-500">
          <p className="text-gray-500 text-sm mb-1">Total Pengurangan</p>
          <p className="text-4xl font-bold text-red-600">{pengurangan.length}</p>
        </div>
      </div>

      {/* ── TABEL PENAMBAHAN ── */}
      <div className="bg-white rounded-xl shadow overflow-hidden mb-6">
        <div className="bg-green-600 text-white px-6 py-4">
          <h2 className="text-lg font-bold">
            PENAMBAHAN SDM ({penambahan.length} orang)
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-green-50 text-green-800 border-b border-green-200">
                <th className="px-4 py-3 text-left font-semibold">No</th>
                <th className="px-4 py-3 text-left font-semibold">Nama</th>
                <th className="px-4 py-3 text-left font-semibold">Status Pekerjaan</th>
                <th className="px-4 py-3 text-left font-semibold">Keterangan Penambahan</th>
                <th className="px-4 py-3 text-left font-semibold">TMT</th>
                <th className="px-4 py-3 text-left font-semibold">Keterangan</th>
                <th className="px-4 py-3 text-left font-semibold">Entitas</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-400">
                    Memuat data...
                  </td>
                </tr>
              ) : penambahan.length > 0 ? (
                penambahan.map((row, idx) => (
                  <tr key={row.id} className="border-b hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-500">{idx + 1}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{row.nama}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                        {row.status_pekerjaan || "-"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{row.keterangan_penambahan || "-"}</td>
                    <td className="px-4 py-3 text-gray-600">{row.tmt || "-"}</td>
                    <td className="px-4 py-3 text-gray-600">{row.keterangan || "-"}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                        {row.entitas}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-gray-400">
                    Tidak ada data penambahan
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── TABEL PENGURANGAN ── */}
      <div className="bg-white rounded-xl shadow overflow-hidden mb-6">
        <div className="bg-red-600 text-white px-6 py-4">
          <h2 className="text-lg font-bold">
            PENGURANGAN SDM ({pengurangan.length} orang)
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-red-50 text-red-800 border-b border-red-200">
                <th className="px-4 py-3 text-left font-semibold">No</th>
                <th className="px-4 py-3 text-left font-semibold">Nama</th>
                <th className="px-4 py-3 text-left font-semibold">Status Pekerjaan</th>
                <th className="px-4 py-3 text-left font-semibold">Keterangan Pengurangan</th>
                <th className="px-4 py-3 text-left font-semibold">TMT</th>
                <th className="px-4 py-3 text-left font-semibold">Keterangan</th>
                <th className="px-4 py-3 text-left font-semibold">Entitas</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-400">
                    Memuat data...
                  </td>
                </tr>
              ) : pengurangan.length > 0 ? (
                pengurangan.map((row, idx) => (
                  <tr key={row.id} className="border-b hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-500">{idx + 1}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{row.nama}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
                        {row.status_pekerjaan || "-"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{row.keterangan_penambahan || "-"}</td>
                    <td className="px-4 py-3 text-gray-600">{row.tmt || "-"}</td>
                    <td className="px-4 py-3 text-gray-600">{row.keterangan || "-"}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                        {row.entitas}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-gray-400">
                    Tidak ada data pengurangan
                  </td>
                </tr>
          )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}