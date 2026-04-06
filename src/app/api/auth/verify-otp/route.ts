import { NextResponse } from "next/server";
import mysql from "mysql2/promise";
import { dbConfig } from "@/lib/db-config";

export async function POST(req: Request) {

  try {

    const { email, otp } = await req.json();

    const connection = await mysql.createConnection(dbConfig);

    const [rows]: any = await connection.execute(
      "SELECT * FROM user WHERE email = ?",
      [email]
    );

    if (!rows || rows.length === 0) {
      await connection.end();
      return NextResponse.json({
        success:false,
        message:"User tidak ditemukan"
      });
    }

    const user = rows[0];

    if (user.otp !== otp) {
      await connection.end();
      return NextResponse.json({
        success:false,
        message:"OTP salah"
      });
    }

    // OTP valid → hapus OTP
    await connection.execute(
      "UPDATE user SET otp = NULL, otp_expired = NULL WHERE id = ?",
      [user.id]
    );

    await connection.end();

    return NextResponse.json({
      success:true,
      message:"Login berhasil",
      user:{
        id:user.id,
        name:user.name,
        email:user.email,
        role:user.role
      },
      token:"logged-in"
    });

  } catch (error) {

    console.error("Verify OTP error:",error);

    return NextResponse.json({
      success:false,
      message:"Terjadi kesalahan server"
    });

  }

}