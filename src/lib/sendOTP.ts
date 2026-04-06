import nodemailer from "nodemailer";

export async function sendOTP(email: string, otp: string) {

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  await transporter.sendMail({
    from: `"SPMT Pelindo" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Kode OTP Login",
    html: `
      <div style="font-family:Arial; text-align:center;">
        <h2 style="color:#2563eb;">Verifikasi Login</h2>
        <p>Kode OTP kamu adalah:</p>
        <h1 style="letter-spacing:5px;">${otp}</h1>
        <p style="color:gray;">Berlaku selama 5 menit</p>
      </div>
    `,
  });
}