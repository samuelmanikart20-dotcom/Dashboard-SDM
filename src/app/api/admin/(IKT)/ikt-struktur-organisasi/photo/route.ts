import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import path from 'path';
import fs from 'fs/promises';

const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'spmt_pelindo_revisi',
  port: parseInt(process.env.DB_PORT || '3307'),
};

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const daerahId = form.get('daerah_id');
    const idPosisiSap = form.get('id_posisi_sap');
    const bulan = form.get('bulan');
    const tahun = form.get('tahun');
    const file = form.get('file') as File | null;
    const skipDbUpdate = form.get('skip_db_update') === 'true'; // NEW: Flag untuk skip database update

    // Untuk skip_db_update, hanya id_posisi_sap dan file yang required
    if (skipDbUpdate) {
      if (!idPosisiSap || !file) {
        return NextResponse.json({ success: false, error: 'id_posisi_sap and file are required' }, { status: 400 });
      }
    } else {
      if (!daerahId || !idPosisiSap || !file) {
        return NextResponse.json({ success: false, error: 'daerah_id, id_posisi_sap, and file are required' }, { status: 400 });
      }
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const ext = (file.name.split('.').pop() || 'png').toLowerCase();
    const safeSap = String(idPosisiSap).replace(/[^a-zA-Z0-9_-]/g, '');
    const fileName = `${safeSap}_${Date.now()}.${ext}`;
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'org-photos');
    
    // Pastikan direktori ada
    await fs.mkdir(uploadDir, { recursive: true });
    const absPath = path.join(uploadDir, fileName);
    
    // Simpan file ke disk
    await fs.writeFile(absPath, bytes);
    
    // Verifikasi bahwa file benar-benar tersimpan
    try {
      const stats = await fs.stat(absPath);
      if (!stats.isFile()) {
        throw new Error('File tidak berhasil dibuat');
      }
      console.log(`[ikt-struktur-organisasi/photo] File berhasil disimpan: ${absPath} (${stats.size} bytes), skip_db_update=${skipDbUpdate}`);
    } catch (err) {
      console.error(`[ikt-struktur-organisasi/photo] Error memverifikasi file: ${absPath}`, err);
      return NextResponse.json({ success: false, error: 'File gagal disimpan ke disk' }, { status: 500 });
    }

    const publicUrl = `/uploads/org-photos/${fileName}`;

    // NEW: Jika skip_db_update = true, langsung return tanpa update database
    if (skipDbUpdate) {
      console.log(`[ikt-struktur-organisasi/photo] skip_db_update=true, returning photo_url without database update`);
      return NextResponse.json({ success: true, photo_url: publicUrl });
    }

    const conn = await mysql.createConnection(dbConfig);
    
    // PERBAIKAN: Update foto HANYA untuk periode spesifik yang dipilih
    // Ini memungkinkan foto berbeda per periode (misalnya foto November berbeda dengan Oktober)
    if (bulan && tahun) {
      const bulanInt = parseInt(String(bulan));
      const tahunInt = parseInt(String(tahun));
      if (!isNaN(bulanInt) && !isNaN(tahunInt)) {
        console.log(`[ikt-struktur-organisasi/photo] Updating photo for daerah_id=${daerahId}, id_posisi_sap=${idPosisiSap}, periode=${bulanInt}/${tahunInt}`);
        
        // Cek apakah ada record untuk periode tersebut
        const [checkRows]: any = await conn.execute(
          `SELECT id, bulan, tahun, photo_url FROM struktur_organisasi_ikt WHERE daerah_id = ? AND id_posisi_sap = ? AND bulan = ? AND tahun = ?`,
          [daerahId, idPosisiSap, bulanInt, tahunInt]
        );
        
        console.log(`[ikt-struktur-organisasi/photo] Found ${(checkRows as any[]).length} records for periode ${bulanInt}/${tahunInt}`);
        
        if ((checkRows as any[]).length > 0) {
          // Update record untuk periode spesifik
          const [updateResult]: any = await conn.execute(
            `UPDATE struktur_organisasi_ikt SET photo_url = ? WHERE daerah_id = ? AND id_posisi_sap = ? AND bulan = ? AND tahun = ?`,
            [publicUrl, daerahId, idPosisiSap, bulanInt, tahunInt]
          );
          console.log(`[ikt-struktur-organisasi/photo] Updated ${updateResult.affectedRows} record(s) for periode ${bulanInt}/${tahunInt}`);
        } else {
          // PERBAIKAN: Jika tidak ada record untuk periode tersebut, 
          // ambil data dari periode sebelumnya dan buat record baru dengan photo_url yang baru
          // Ini memastikan semua field lain tidak hilang
          console.log(`[ikt-struktur-organisasi/photo] No record found for periode ${bulanInt}/${tahunInt}, creating new record from previous period`);
          
          // Cari data dari periode sebelumnya (periode terdekat yang lebih lama)
          const [prevRows]: any = await conn.execute(
            `SELECT * FROM struktur_organisasi_ikt 
             WHERE daerah_id = ? AND id_posisi_sap = ? 
             AND (tahun < ? OR (tahun = ? AND bulan < ?))
             ORDER BY tahun DESC, bulan DESC LIMIT 1`,
            [daerahId, idPosisiSap, tahunInt, tahunInt, bulanInt]
          );
          
          if (Array.isArray(prevRows) && prevRows.length > 0) {
            const prevData = prevRows[0];
            // Buat record baru dengan data dari periode sebelumnya, tapi dengan photo_url yang baru dan periode yang baru
            await conn.execute(
              `INSERT INTO struktur_organisasi_ikt 
               (daerah_id, id_posisi_sap, id_posisi_atasan, nama, jabatan, 
                unit_kerja, nipp, direktorat, photo_url, no_hp, 
                tmt_jabatan, periode_jabatan, kj_individu, kj_posisi, bulan, tahun)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                daerahId,
                idPosisiSap,
                prevData.id_posisi_atasan || null,
                prevData.nama || null,
                prevData.jabatan || null,
                prevData.unit_kerja || null,
                prevData.nipp || null,
                prevData.direktorat || null,
                publicUrl, // Gunakan photo_url yang baru
                prevData.no_hp || null,
                prevData.tmt_jabatan || null,
                prevData.periode_jabatan || null,
                prevData.kj_individu || null,
                prevData.kj_posisi || null,
                bulanInt,
                tahunInt,
              ]
            );
            console.log(`[ikt-struktur-organisasi/photo] Created new record from previous period data with new photo_url`);
          } else {
            // Jika tidak ada data periode sebelumnya, update semua periode sebagai fallback
            console.log(`[ikt-struktur-organisasi/photo] No previous period data found, updating all periods as fallback`);
            await conn.execute(
              `UPDATE struktur_organisasi_ikt SET photo_url = ? WHERE daerah_id = ? AND id_posisi_sap = ?`,
              [publicUrl, daerahId, idPosisiSap]
            );
          }
        }
      } else {
        // Fallback: update semua periode jika bulan/tahun tidak valid
        console.log(`[ikt-struktur-organisasi/photo] Invalid bulan/tahun, updating all periods`);
        await conn.execute(
          `UPDATE struktur_organisasi_ikt SET photo_url = ? WHERE daerah_id = ? AND id_posisi_sap = ?`,
          [publicUrl, daerahId, idPosisiSap]
        );
      }
    } else {
      // Fallback: update semua periode jika bulan/tahun tidak dikirim
      console.log(`[ikt-struktur-organisasi/photo] No bulan/tahun provided, updating all periods`);
      await conn.execute(
        `UPDATE struktur_organisasi_ikt SET photo_url = ? WHERE daerah_id = ? AND id_posisi_sap = ?`,
        [publicUrl, daerahId, idPosisiSap]
      );
    }
    
    await conn.end();

    return NextResponse.json({ success: true, photo_url: publicUrl });
  } catch (error) {
    console.error('POST /api/admin/(IKT)/ikt-struktur-organisasi/photo error', error);
    return NextResponse.json({ success: false, error: 'Failed to upload photo' }, { status: 500 });
  }
}









