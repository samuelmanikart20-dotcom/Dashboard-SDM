import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';

export const dynamic = 'force-dynamic';

const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'spmt_pelindo_revisi',
  port: Number(process.env.DB_PORT) || 3307,
};

const BULAN_NAMES = [
  '', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

// ─── Helper: parse tanggal dari Excel ───
function parseTMT(val: any): string {
  if (!val) return '';
  if (typeof val === 'number') {
    const date = XLSX.SSF.parse_date_code(val);
    if (date) {
      const d = String(date.d).padStart(2, '0');
      const m = String(date.m).padStart(2, '0');
      return `${d}/${m}/${date.y}`;
    }
  }
  return String(val).trim();
}

// ─── Helper: cari header row yang diikuti data nomor 1,2,3 ───
function findHeaderRow(rows: any[][]): number {
  let lastValidHeader = -1;
  for (let i = 0; i < rows.length; i++) {
    const cells = (rows[i] || []).map((c: any) =>
      String(c || '').trim().toLowerCase()
    );
    const hasNama = cells.includes('nama');
    const hasStatus = cells.includes('status pekerjaan');
    if (hasNama && hasStatus) {
      const noIdx = cells.indexOf('no');
      const nextRow = rows[i + 1] || [];
      const nextNoVal = noIdx >= 0 ? nextRow[noIdx] : nextRow[0];
      const nextNoNum = Number(String(nextNoVal ?? '').trim());
      if (!isNaN(nextNoNum) && nextNoNum > 0) {
        lastValidHeader = i;
      }
    }
  }
  return lastValidHeader;
}

// ─── Helper: parse satu sheet ───
function parseSheet(ws: XLSX.WorkSheet, jenis: 'PENAMBAHAN' | 'PENGURANGAN') {
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  const headerIdx = findHeaderRow(rows);
  if (headerIdx < 0) return [];

  const headers = (rows[headerIdx] || []).map((h: any) =>
    String(h || '').trim().toLowerCase()
  );

  const ketCol =
    jenis === 'PENAMBAHAN' ? 'keterangan penambahan' : 'keterangan pengurangan';

  const result: any[] = [];
  for (const row of rows.slice(headerIdx + 1)) {
    const get = (col: string) => {
      const idx = headers.indexOf(col);
      return idx >= 0 ? String(row[idx] ?? '').trim() : '';
    };
    const nama = get('nama');
    if (!nama || nama.toLowerCase() === 'nama') continue;

    result.push({
      no: get('no'),
      nama,
      nipp: get('nipp'),
      kelas_jabatan: get('kelas jabatan'),
      tugas_jabatan: get('tugas jabatan/posisi'),
      pendidikan: get('pendidikan'),
      jenis_kelamin: get('jenis kelamin'),
      usia: parseInt(get('usia')) || null,
      status_pekerjaan: get('status pekerjaan'),
      organization_area: get('organization area'),
      organization_sub_area: get('organization sub area'),
      keterangan_penambahan: get(ketCol),
      tmt: parseTMT(row[headers.indexOf('tmt')] ?? ''),
      keterangan: get('keterangan'),
    });
  }
  return result;
}

// ─── Helper: buat sheet Excel dengan ExcelJS ───
async function buildSheet(
  wb: ExcelJS.Workbook,
  sheetName: string,
  rows: any[],
  bulanLabel: string,
  tahunLabel: string,
  entitas: string,
  jenis: 'PENAMBAHAN' | 'PENGURANGAN'
) {
  const ws = wb.addWorksheet(sheetName);

  const isP = jenis === 'PENAMBAHAN';
  const headerBgColor = isP ? '1E7E34' : 'C82333';
  const titleBgColor  = isP ? 'D4EDDA' : 'F8D7DA';
  const titleFgColor  = isP ? '155724' : '721C24';

  // ── Lebar kolom ──
  ws.columns = [
    { width: 5  },  // No
    { width: 28 },  // Nama
    { width: 15 },  // NIPP
    { width: 12 },  // Kelas Jabatan
    { width: 36 },  // Tugas Jabatan
    { width: 20 },  // Pendidikan
    { width: 13 },  // Jenis Kelamin
    { width: 7  },  // Usia
    { width: 26 },  // Status Pekerjaan
    { width: 30 },  // Organization Area
    { width: 26 },  // Organization Sub Area
    { width: 32 },  // Keterangan Penambahan/Pengurangan
    { width: 15 },  // TMT
    { width: 26 },  // Keterangan
  ];

  const COL_COUNT = 14;

  // ── Helper merge + style ──
  const mergeAndStyle = (
    rowNum: number,
    text: string,
    bgColor: string,
    fgColor: string,
    fontSize = 11,
    bold = true
  ) => {
    ws.mergeCells(rowNum, 1, rowNum, COL_COUNT);
    const cell = ws.getCell(rowNum, 1);
    cell.value = text;
    cell.font = { name: 'Arial', bold, color: { argb: 'FF' + fgColor }, size: fontSize };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + titleBgColor } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + bgColor } };
    ws.getRow(rowNum).height = 20;
  };

  // ── Baris judul ──
  mergeAndStyle(1, `MONITORING MUTASI SDM - ${sheetName}`, titleBgColor, titleFgColor, 14, true);
  mergeAndStyle(2, `Entitas: ${entitas}   |   Bulan: ${bulanLabel}   |   Tahun: ${tahunLabel}`, titleBgColor, titleFgColor, 11, false);

  // Row kosong
  ws.getRow(3).height = 8;

  // ── Baris header tabel ──
  const TABLE_HEADERS = [
    'No', 'Nama', 'NIPP', 'Kelas Jabatan', 'Tugas Jabatan/Posisi',
    'Pendidikan', 'Jenis Kelamin', 'Usia', 'Status Pekerjaan',
    'Organization Area', 'Organization Sub Area',
    isP ? 'Keterangan Penambahan' : 'Keterangan Pengurangan',
    'TMT', 'Keterangan',
  ];

  const headerRow = ws.getRow(4);
  headerRow.height = 30;
  TABLE_HEADERS.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + headerBgColor } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top:    { style: 'thin', color: { argb: 'FFFFFFFF' } },
      bottom: { style: 'thin', color: { argb: 'FFFFFFFF' } },
      left:   { style: 'thin', color: { argb: 'FFFFFFFF' } },
      right:  { style: 'thin', color: { argb: 'FFFFFFFF' } },
    };
  });

  // ── Baris data ──
  rows.forEach((r, idx) => {
    const dataRow = ws.addRow([
      idx + 1,
      r.nama,
      r.nipp || '',
      r.kelas_jabatan || '',
      r.tugas_jabatan || '',
      r.pendidikan || '',
      r.jenis_kelamin || '',
      r.usia || '',
      r.status_pekerjaan || '',
      r.organization_area || '',
      r.organization_sub_area || '',
      r.keterangan_penambahan || '',
      r.tmt || '',
      r.keterangan || '',
    ]);

    const isEven = idx % 2 === 0;
    const rowBg = isEven ? 'FFF9F9F9' : 'FFFFFFFF';

    dataRow.height = 18;
    dataRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.font = { name: 'Arial', size: 10 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
      cell.alignment = {
        vertical: 'middle',
        horizontal: colNumber === 1 ? 'center' : 'left',
        wrapText: colNumber >= 4,
      };
      cell.border = {
        top:    { style: 'hair', color: { argb: 'FFDDDDDD' } },
        bottom: { style: 'hair', color: { argb: 'FFDDDDDD' } },
        left:   { style: 'hair', color: { argb: 'FFDDDDDD' } },
        right:  { style: 'hair', color: { argb: 'FFDDDDDD' } },
      };
    });
  });

  // ── Baris total ──
  const totalRow = ws.addRow(['', `TOTAL: ${rows.length} orang`, '', '', '', '', '', '', '', '', '', '', '', '']);
  ws.mergeCells(totalRow.number, 2, totalRow.number, COL_COUNT);
  totalRow.height = 22;
  const totalCell = totalRow.getCell(1);
  totalCell.value = '';

  const totalLabelCell = totalRow.getCell(2);
  totalLabelCell.font = { name: 'Arial', bold: true, color: { argb: 'FF' + titleFgColor }, size: 11 };
  totalLabelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + titleBgColor } };
  totalLabelCell.alignment = { horizontal: 'center', vertical: 'middle' };
  totalLabelCell.border = {
    top:    { style: 'medium', color: { argb: 'FF' + headerBgColor } },
    bottom: { style: 'medium', color: { argb: 'FF' + headerBgColor } },
    left:   { style: 'medium', color: { argb: 'FF' + headerBgColor } },
    right:  { style: 'medium', color: { argb: 'FF' + headerBgColor } },
  };

  // Border luar tabel (sekitar header + data)
  const firstDataRow = 4;
  const lastDataRow  = totalRow.number;
  for (let r = firstDataRow; r <= lastDataRow; r++) {
    const leftCell  = ws.getCell(r, 1);
    const rightCell = ws.getCell(r, COL_COUNT);
    leftCell.border  = { ...leftCell.border,  left:  { style: 'medium', color: { argb: 'FF' + headerBgColor } } };
    rightCell.border = { ...rightCell.border, right: { style: 'medium', color: { argb: 'FF' + headerBgColor } } };
  }
  for (let c = 1; c <= COL_COUNT; c++) {
    const topCell    = ws.getCell(firstDataRow, c);
    const bottomCell = ws.getCell(lastDataRow,  c);
    topCell.border    = { ...topCell.border,    top:    { style: 'medium', color: { argb: 'FF' + headerBgColor } } };
    bottomCell.border = { ...bottomCell.border, bottom: { style: 'medium', color: { argb: 'FF' + headerBgColor } } };
  }
}

// ══════════════════════════════════════════════════════════
// GET — ambil data mutasi / export Excel
// ══════════════════════════════════════════════════════════
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const bulan       = searchParams.get('bulan');
  const tahun       = searchParams.get('tahun');
  const entitas     = searchParams.get('entitas');
  const jenis       = searchParams.get('jenis');
  const exportExcel = searchParams.get('export') === 'excel';

  if (exportExcel && (!bulan || !entitas)) {
    return NextResponse.json(
      { success: false, error: 'Export Excel hanya tersedia jika bulan dan entitas dipilih' },
      { status: 400 }
    );
  }

  let where = 'WHERE 1=1';
  const params: any[] = [];
  if (bulan)   { where += ' AND bulan = ?';   params.push(parseInt(bulan)); }
  if (tahun)   { where += ' AND tahun = ?';   params.push(parseInt(tahun)); }
  if (entitas) { where += ' AND entitas = ?'; params.push(entitas); }
  if (jenis)   { where += ' AND jenis = ?';   params.push(jenis); }

  try {
    const conn = await mysql.createConnection(dbConfig);
    const [rows] = await conn.execute(
      `SELECT * FROM mutasi_sdm ${where} ORDER BY jenis, no ASC`,
      params
    ) as any[];
    await conn.end();

    // ── Mode biasa: return JSON ──
    if (!exportExcel) {
      return NextResponse.json({ success: true, data: rows });
    }

    // ── Mode export: buat file Excel pakai ExcelJS ──
    const penambahan  = (rows as any[]).filter((r: any) => r.jenis === 'PENAMBAHAN');
    const pengurangan = (rows as any[]).filter((r: any) => r.jenis === 'PENGURANGAN');

    const bulanLabel = BULAN_NAMES[parseInt(bulan!)] || bulan!;
    const tahunLabel = tahun || '';

    const wb = new ExcelJS.Workbook();
    wb.creator  = 'Sistem Monitoring SDM';
    wb.created  = new Date();
    wb.modified = new Date();

    await buildSheet(wb, 'PENAMBAHAN',  penambahan,  bulanLabel, tahunLabel, entitas!, 'PENAMBAHAN');
    await buildSheet(wb, 'PENGURANGAN', pengurangan, bulanLabel, tahunLabel, entitas!, 'PENGURANGAN');

    const buffer = await wb.xlsx.writeBuffer();
    const filename = `Mutasi_SDM_${entitas}_${bulanLabel}_${tahunLabel}.xlsx`;

    return new NextResponse(buffer as ArrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });

  } catch (err) {
    console.error('GET mutasi error:', err);
    return NextResponse.json({ success: false, error: 'Gagal mengambil data' }, { status: 500 });
  }
}

// ══════════════════════════════════════════════════════════
// POST — upload Excel mutasi
// ══════════════════════════════════════════════════════════
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file    = formData.get('file') as File | null;
    const entitas = (formData.get('entitas') as string || '').toUpperCase();
    const bulan   = parseInt(formData.get('bulan') as string || '0');
    const tahun   = parseInt(formData.get('tahun') as string || '0');

    if (!file)            return NextResponse.json({ success: false, error: 'File tidak ditemukan' }, { status: 400 });
    if (!entitas)         return NextResponse.json({ success: false, error: 'Entitas wajib diisi' }, { status: 400 });
    if (!bulan || !tahun) return NextResponse.json({ success: false, error: 'Bulan dan tahun wajib diisi' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const wb     = XLSX.read(buffer, { type: 'buffer' });
    const allRows: any[] = [];

    for (const jenis of ['PENAMBAHAN', 'PENGURANGAN'] as const) {
      const sheetName = wb.SheetNames.find((n) => n.toUpperCase().includes(jenis));
      if (!sheetName) continue;
      const parsed = parseSheet(wb.Sheets[sheetName], jenis);
      parsed.forEach((row) => allRows.push({ ...row, jenis, entitas, bulan, tahun }));
    }

    if (allRows.length === 0) {
      return NextResponse.json({ success: false, error: 'Tidak ada data valid ditemukan di file' }, { status: 400 });
    }

    const conn = await mysql.createConnection(dbConfig);
    await conn.execute(
      'DELETE FROM mutasi_sdm WHERE bulan = ? AND tahun = ? AND entitas = ?',
      [bulan, tahun, entitas]
    );

    for (const row of allRows) {
      await conn.execute(
        `INSERT INTO mutasi_sdm
          (entitas, jenis, bulan, tahun, no, nama, nipp, kelas_jabatan, tugas_jabatan,
           pendidikan, jenis_kelamin, usia, status_pekerjaan, organization_area,
           organization_sub_area, keterangan_penambahan, tmt, keterangan)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          row.entitas, row.jenis, row.bulan, row.tahun, row.no || null,
          row.nama, row.nipp, row.kelas_jabatan, row.tugas_jabatan,
          row.pendidikan, row.jenis_kelamin, row.usia, row.status_pekerjaan,
          row.organization_area, row.organization_sub_area,
          row.keterangan_penambahan, row.tmt, row.keterangan,
        ]
      );
    }
    await conn.end();

    const pCount = allRows.filter((r) => r.jenis === 'PENAMBAHAN').length;
    const kCount = allRows.filter((r) => r.jenis === 'PENGURANGAN').length;

    return NextResponse.json({
      success: true,
      message: `Berhasil upload ${allRows.length} data (${pCount} penambahan, ${kCount} pengurangan)`,
      count: { total: allRows.length, penambahan: pCount, pengurangan: kCount },
    });
  } catch (err) {
    console.error('POST mutasi error:', err);
    return NextResponse.json({ success: false, error: 'Gagal memproses file' }, { status: 500 });
  }
}

// ══════════════════════════════════════════════════════════
// DELETE — hapus data bulan+tahun+entitas tertentu
// ══════════════════════════════════════════════════════════
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const bulan   = searchParams.get('bulan');
  const tahun   = searchParams.get('tahun');
  const entitas = searchParams.get('entitas');

  if (!bulan || !tahun || !entitas) {
    return NextResponse.json(
      { success: false, error: 'bulan, tahun, entitas wajib diisi' },
      { status: 400 }
    );
  }

  try {
    const conn = await mysql.createConnection(dbConfig);
    const [result] = await conn.execute(
      'DELETE FROM mutasi_sdm WHERE bulan = ? AND tahun = ? AND entitas = ?',
      [parseInt(bulan), parseInt(tahun), entitas]
    );
    await conn.end();
    return NextResponse.json({ success: true, deleted: (result as any).affectedRows });
  } catch (err) {
    console.error('DELETE mutasi error:', err);
    return NextResponse.json({ success: false, error: 'Gagal menghapus data' }, { status: 500 });
  }
}