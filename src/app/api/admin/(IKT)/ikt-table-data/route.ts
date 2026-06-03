export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import ExcelJS from 'exceljs';

export const dynamic = "force-dynamic";

const dbConfig = {
  host:     process.env.DB_HOST     || '127.0.0.1',
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || 'spmt_pelindo_revisi',
  port:     Number(process.env.DB_PORT) || 3307
};

export async function GET(request: NextRequest) {
  let connection: mysql.Connection | null = null;

  try {
    const { searchParams } = new URL(request.url);
    const bulan      = searchParams.get('bulan');
    const tahun      = searchParams.get('tahun');
    const unitKerja  = searchParams.get('unit_kerja');
    const exportExcel = searchParams.get('export');
    const page       = Math.max(1, parseInt(searchParams.get('page')  || '1',   10) || 1);
    const limit      = Math.max(1, Math.min(10000, parseInt(searchParams.get('limit') || '100', 10) || 100));

    if (!bulan || !tahun) {
      return NextResponse.json({ message: 'Bulan dan tahun harus diisi' }, { status: 400 });
    }

    connection = await mysql.createConnection(dbConfig);

    // ── WHERE clause ─────────────────────────────────────────────────────────
    let whereClause = '';
    const params: (string | number)[] = [];

    if (bulan === 'all') {
      const tahunInt = parseInt(tahun, 10);
      if (!isNaN(tahunInt)) {
        whereClause = 'WHERE tahun = ?';
        params.push(tahunInt);
      }
    } else {
      const bulanInt = parseInt(bulan, 10);
      const tahunInt = parseInt(tahun, 10);

      if (isNaN(bulanInt) || bulanInt < 1 || bulanInt > 12) {
        return NextResponse.json({ message: 'Bulan tidak valid (harus 1-12 atau "all")' }, { status: 400 });
      }
      if (isNaN(tahunInt) || tahunInt < 2000 || tahunInt > 2100) {
        return NextResponse.json({ message: 'Tahun tidak valid' }, { status: 400 });
      }

      whereClause = 'WHERE bulan = ? AND tahun = ?';
      params.push(bulanInt, tahunInt);
    }

    // ── Unit kerja filter (skip saat export agar semua unit masuk) ────────────
    if (exportExcel !== 'excel' && unitKerja && unitKerja !== 'all') {
      const uk = unitKerja.toUpperCase();

      if (uk.includes('KP') || unitKerja === 'IKT-KP') {
        whereClause += ' AND (unit_kerja LIKE ? OR unit_kerja LIKE ? OR unit_kerja LIKE ?)';
        params.push('%KANTOR PUSAT%', '%Kantor Pusat%', '%PUSAT%');
      } else if (uk.includes('JKT') || unitKerja === 'IKT-JKT') {
        whereClause += ' AND (unit_kerja LIKE ? OR unit_kerja LIKE ? OR unit_kerja LIKE ?)';
        params.push('%Jakarta%', '%JAKARTA%', '%JKT%');
      } else if (uk.includes('BPP') || unitKerja === 'IKT-BPP') {
        whereClause += ' AND (unit_kerja LIKE ? OR unit_kerja LIKE ?)';
        params.push('%BALIKPAPAN%', '%Balikpapan%');
      } else if (uk.includes('BJM') || unitKerja === 'IKT-BJM') {
        whereClause += ' AND (unit_kerja LIKE ? OR unit_kerja LIKE ?)';
        params.push('%BANJARMASIN%', '%Banjarmasin%');
      } else if (uk.includes('BLW') || unitKerja === 'IKT-BLW') {
        whereClause += ' AND (unit_kerja LIKE ? OR unit_kerja LIKE ?)';
        params.push('%BELAWAN%', '%Belawan%');
      } else if (uk.includes('MKS') || unitKerja === 'IKT-MKS') {
        whereClause += ' AND (unit_kerja LIKE ? OR unit_kerja LIKE ?)';
        params.push('%MAKASSAR%', '%Makassar%');
      } else if (uk.includes('PTK') || unitKerja === 'IKT-PTK') {
        whereClause += ' AND (unit_kerja LIKE ? OR unit_kerja LIKE ?)';
        params.push('%PONTIANAK%', '%Pontianak%');
      } else if (uk.includes('TPK') || unitKerja === 'IKT-TPK') {
        whereClause += ' AND (unit_kerja LIKE ? OR unit_kerja LIKE ? OR unit_kerja LIKE ?)';
        params.push('%TANJUNG PRIOK%', '%Tanjung Priok%', '%PRIOK%');
      } else {
        whereClause += ' AND unit_kerja LIKE ?';
        params.push(`%${unitKerja}%`);
      }
    }

    const bulanNames = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const bulanName = bulan && bulan !== 'all'
      ? (bulanNames[parseInt(bulan)] || bulan)
      : 'Semua';

    const SELECT_COLS = `
      npp, nama, tanggal_lahir, jabatan, entitas, unit_kerja, kategori,
      jenis_kelamin, pendidikan, organik_non_organik, pusat_pelayanan,
      non_operasional, status_laporan, bulan, tahun
    `;

    // =========================================================================
    // EXPORT EXCEL
    // =========================================================================
    if (exportExcel === 'excel') {

      const [exportRows] = await connection.execute(
        `SELECT ${SELECT_COLS} FROM iktdata ${whereClause} ORDER BY nama ASC`,
        params
      );

      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('DATA IKT');

      const GREEN     = '1A5C38';
      const GREEN_SUB = 'D9EAD3';
      const GREEN_ROW = 'EAF4EA';
      const WHITE     = 'FFFFFF';
      const NCOLS     = 15;

      const thin: Partial<ExcelJS.Borders> = {
        top:    { style: 'thin' as ExcelJS.BorderStyle },
        left:   { style: 'thin' as ExcelJS.BorderStyle },
        bottom: { style: 'thin' as ExcelJS.BorderStyle },
        right:  { style: 'thin' as ExcelJS.BorderStyle },
      };

      const C = { h: 'center' as const, v: 'middle' as const, wrapText: true };
      const L = { h: 'left'   as const, v: 'middle' as const, wrapText: true };

      // --- BARIS 1: JUDUL UTAMA ---
      ws.mergeCells(1, 1, 1, NCOLS);
      const b1     = ws.getCell('A1');
      b1.value     = 'DATA IKT - PELINDO';
      b1.font      = { name: 'Arial', bold: true, size: 14, color: { argb: WHITE } };
      b1.alignment = { horizontal: 'center', vertical: 'middle' };
      b1.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN } };
      ws.getRow(1).height = 32;

      // --- BARIS 2: SUB JUDUL ---
      ws.mergeCells(2, 1, 2, NCOLS);
      const b2     = ws.getCell('A2');
      b2.value     = `Entitas: IKT  |  Bulan: ${bulanName}  |  Tahun: ${tahun || ''}`;
      b2.font      = { name: 'Arial', size: 11, color: { argb: '000000' } };
      b2.alignment = { horizontal: 'center', vertical: 'middle' };
      b2.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN_SUB } };
      ws.getRow(2).height = 22;

      // --- BARIS 3: KOSONG ---
      ws.getRow(3).height = 8;

      // --- BARIS 4: HEADER ---
      const headers = [
        'No', 'NPP', 'Nama', 'Tanggal Lahir', 'Jabatan', 'Entitas',
        'Unit Kerja', 'Kategori', 'Jenis Kelamin', 'Pendidikan',
        'Organik/Non Organik', 'Pusat Pelayanan', 'Non Operasional',
        'Status Laporan', 'Bulan'
      ];
      ws.getRow(4).height = 36;
      headers.forEach((h, i) => {
        const cell     = ws.getRow(4).getCell(i + 1);
        cell.value     = h;
        cell.font      = { name: 'Arial', bold: true, size: 11, color: { argb: WHITE } };
        cell.alignment = C;
        cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN } };
        cell.border    = thin;
      });

      // --- BARIS DATA ---
      const safeDate = (v: any): string => {
        if (!v) return '';
        const str = typeof v === 'string' ? v : String(v);
        if (!str || str === '0000-00-00') return '';
        const d = new Date(str);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
      };

      (exportRows as any[]).forEach((item, idx) => {
        const row  = ws.getRow(idx + 5);
        row.height = 18;
        const bg   = idx % 2 === 0 ? GREEN_ROW : WHITE;

        const vals = [
          idx + 1, item.npp, item.nama, safeDate(item.tanggal_lahir),
          item.jabatan, item.entitas, item.unit_kerja, item.kategori,
          item.jenis_kelamin, item.pendidikan, item.organik_non_organik,
          item.pusat_pelayanan, item.non_operasional,
          item.status_laporan, item.bulan,
        ];

        vals.forEach((v, i) => {
          const cell     = row.getCell(i + 1);
          cell.value     = v ?? '';
          cell.font      = { name: 'Arial', size: 10 };
          cell.alignment = i === 0 ? C : L;
          cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
          cell.border    = thin;
        });
      });

      // --- BARIS TOTAL ---
      const allRows    = exportRows as any[];
      const totalRowNum = allRows.length + 5;
      ws.mergeCells(totalRowNum, 1, totalRowNum, NCOLS);
      const totalCell     = ws.getCell(totalRowNum, 1);
      totalCell.value     = `TOTAL: ${allRows.length} orang`;
      totalCell.font      = { name: 'Arial', bold: true, size: 11, color: { argb: WHITE } };
      totalCell.alignment = { horizontal: 'center', vertical: 'middle' };
      totalCell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN } };
      totalCell.border    = thin;
      ws.getRow(totalRowNum).height = 22;

      // --- LEBAR KOLOM ---
      const widths = [5, 14, 28, 18, 30, 10, 28, 15, 14, 12, 22, 18, 18, 18, 8];
      widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

      // --- FREEZE HEADER ---
      ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 4, activeCell: 'A5' }];

      const buffer = await wb.xlsx.writeBuffer();
      await connection.end();
      connection = null;

      const labelMonth = bulan && bulan !== 'all' ? bulanName : 'ALL';
      const labelYear  = tahun || 'ALL';

      return new NextResponse(Buffer.from(buffer), {
        status: 200,
        headers: {
          'Content-Disposition': `attachment; filename=IKT_${labelYear}_${labelMonth}.xlsx`,
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
      });
    }

    // ── PAGINATED JSON ────────────────────────────────────────────────────────
    const [countResult] = await connection.execute(
      `SELECT COUNT(*) as total FROM iktdata ${whereClause}`,
      params
    );
    const total      = (countResult as any)[0].total as number;
    const totalPages = Math.ceil(total / limit);
    const offset     = Math.max(0, (page - 1) * limit);

    // Validate & push pagination params (Node v24 safety)
    const dataParams: (string | number)[] = params.filter(
      p => (typeof p === 'number' && !isNaN(p)) || typeof p === 'string'
    );
    const limitInt  = Math.floor(Number(limit));
    const offsetInt = Math.floor(Number(offset));
    if (isNaN(limitInt) || isNaN(offsetInt) || limitInt < 0 || offsetInt < 0) {
      throw new Error(`Invalid pagination: limit=${limitInt}, offset=${offsetInt}`);
    }
    dataParams.push(limitInt, offsetInt);

    const [rows] = await connection.execute(
      `SELECT ${SELECT_COLS} FROM iktdata ${whereClause} ORDER BY nama ASC LIMIT ? OFFSET ?`,
      dataParams
    );

    const tableData = (rows as any[]).map(row => ({
      npp:                  row.npp,
      nama:                 row.nama,
      tanggal_lahir:        row.tanggal_lahir
                              ? new Date(row.tanggal_lahir).toISOString().split('T')[0]
                              : '',
      jabatan:              row.jabatan              || '',
      entitas:              row.entitas              || '',
      unit_kerja:           row.unit_kerja           || '',
      kategori:             row.kategori             || '',
      jenis_kelamin:        row.jenis_kelamin        || '',
      pendidikan:           row.pendidikan           || '',
      organik_non_organik:  row.organik_non_organik  || '',
      pusat_pelayanan:      row.pusat_pelayanan      || '',
      non_operasional:      row.non_operasional      || '',
      status_laporan:       row.status_laporan       || '',
      bulan:                row.bulan,
      tahun:                row.tahun,
    }));

    return NextResponse.json({
      tableData,
      pagination: { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 },
    });

  } catch (error) {
    console.error('IKT TABLE API ERROR:', error);
    return NextResponse.json(
      { message: 'Error fetching table data', debug: error instanceof Error ? error.message : error },
      { status: 500 }
    );
  } finally {
    if (connection) { try { await connection.end(); } catch {} }
  }
}