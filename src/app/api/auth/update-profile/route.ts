import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

import { dbConfig } from '@/lib/db-config';

export async function PUT(request: NextRequest) {

  let connection;

  try {

    const {
      email,
      name
    } = await request.json();

    // VALIDASI
    if (!email || !name) {

      return NextResponse.json(
        {
          error: 'Nama dan email wajib diisi'
        },
        {
          status: 400
        }
      );
    }

    connection = await mysql.createConnection(
      dbConfig
    );

    // CEK USER
    const [users]: any =
      await connection.execute(
        `
        SELECT *
        FROM user
        WHERE email = ?
        `,
        [email]
      );

    if (!users || users.length === 0) {

      return NextResponse.json(
        {
          error: 'User tidak ditemukan'
        },
        {
          status: 404
        }
      );
    }

    // UPDATE PROFILE
    await connection.execute(
      `
      UPDATE user
      SET name = ?
      WHERE email = ?
      `,
      [name, email]
    );

    return NextResponse.json({
      success: true,
      message:
        'Profil berhasil diperbarui'
    });

  } catch (error) {

    console.error(
      'Update profile error:',
      error
    );

    return NextResponse.json(
      {
        error:
          'Gagal memperbarui profil'
      },
      {
        status: 500
      }
    );

  } finally {

    if (connection) {
      await connection.end();
    }
  }
}