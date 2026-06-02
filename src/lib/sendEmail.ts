import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// ============================================
// FUNGSI 1: Notifikasi akun baru dibuat
// (sudah ada sebelumnya, tidak diubah)
// ============================================
export async function sendAccountEmail(
  email: string,
  name: string,
  password: string,
  role: string
) {
  try {
    await transporter.sendMail({
      from: `"Dashboard SPMT Pelindo" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Akun Anda Telah Dibuat',
      html: `
      <div style="margin:0;padding:0;background:#f4f7fb;font-family:Arial,sans-serif;">
        <div style="max-width:600px;margin:30px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.08);">

          <div style="background:linear-gradient(135deg,#0057b8,#0b72e7);padding:40px 25px;text-align:center;">
            <div style="font-size:55px;margin-bottom:10px;">🔐</div>
            <h1 style="color:white;margin:0;font-size:32px;line-height:1.3;">Akun Anda Telah Dibuat</h1>
            <p style="color:#dbeafe;margin-top:12px;font-size:16px;">Dashboard SPMT Pelindo</p>
          </div>

          <div style="padding:35px 28px;color:#1f2937;">
            <p style="margin-top:0;font-size:18px;">Halo <b>${name}</b>,</p>
            <p style="font-size:16px;line-height:1.7;color:#4b5563;">
              Akun Anda telah berhasil dibuat oleh Superadmin. Berikut informasi login akun Anda:
            </p>

            <div style="margin-top:28px;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;">
              <div style="display:flex;flex-wrap:wrap;border-bottom:1px solid #e5e7eb;">
                <div style="width:160px;background:#f9fafb;padding:16px;font-weight:bold;color:#111827;">Username</div>
                <div style="flex:1;padding:16px;color:#2563eb;word-break:break-word;">${email}</div>
              </div>
              <div style="display:flex;flex-wrap:wrap;border-bottom:1px solid #e5e7eb;">
                <div style="width:160px;background:#f9fafb;padding:16px;font-weight:bold;color:#111827;">Password</div>
                <div style="flex:1;padding:16px;color:#dc2626;font-weight:bold;word-break:break-word;">${password}</div>
              </div>
              <div style="display:flex;flex-wrap:wrap;">
                <div style="width:160px;background:#f9fafb;padding:16px;font-weight:bold;color:#111827;">Role</div>
                <div style="flex:1;padding:16px;color:#111827;text-transform:capitalize;">${role}</div>
              </div>
            </div>

            <div style="margin-top:30px;background:#eff6ff;border:1px solid #bfdbfe;padding:18px;border-radius:12px;">
              <p style="margin:0;color:#1e40af;font-size:15px;line-height:1.6;">
                Demi keamanan akun, disarankan untuk mengganti password setelah login pertama.
              </p>
            </div>

            <p style="margin-top:35px;font-size:14px;color:#9ca3af;text-align:center;line-height:1.6;">
              Email ini dikirim otomatis oleh sistem Dashboard SPMT Pelindo.
            </p>
          </div>
        </div>
      </div>
      `,
    });

    console.log('Email akun berhasil dikirim ke:', email);
  } catch (error) {
    console.error('Gagal mengirim email:', error);
    throw new Error('Email gagal dikirim');
  }
}

// ============================================
// FUNGSI 2: Notifikasi password berhasil diubah
// (tambahan baru — tinggal import dan panggil)
// ============================================
export async function sendPasswordChangedEmail(email: string, name: string) {
  const now = new Date().toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    dateStyle: 'full',
    timeStyle: 'short',
  });

  try {
    await transporter.sendMail({
      from: `"Dashboard SPMT Pelindo" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Password Akun Anda Berhasil Diubah',
      html: `
      <div style="margin:0;padding:0;background:#f4f7fb;font-family:Arial,sans-serif;">
        <div style="max-width:600px;margin:30px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.08);">

          <div style="background:linear-gradient(135deg,#0057b8,#0b72e7);padding:40px 25px;text-align:center;">
            <div style="font-size:55px;margin-bottom:10px;">🔒</div>
            <h1 style="color:white;margin:0;font-size:32px;line-height:1.3;">Password Berhasil Diubah</h1>
            <p style="color:#dbeafe;margin-top:12px;font-size:16px;">Dashboard SPMT Pelindo</p>
          </div>

          <div style="padding:35px 28px;color:#1f2937;">
            <p style="margin-top:0;font-size:18px;">Halo <b>${name}</b>,</p>
            <p style="font-size:16px;line-height:1.7;color:#4b5563;">
              Password akun Anda baru saja berhasil diubah pada:
            </p>

            <div style="margin-top:20px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:18px 20px;font-size:16px;font-weight:bold;color:#111827;">
              🕐 ${now} WIB
            </div>

            <div style="margin-top:24px;background:#fff7ed;border:1px solid #fed7aa;padding:18px;border-radius:12px;">
              <p style="margin:0;color:#92400e;font-size:15px;line-height:1.6;">
                ⚠️ Jika Anda <b>tidak merasa</b> mengubah password,
                segera hubungi administrator atau amankan akun Anda sekarang.
              </p>
            </div>

            <p style="margin-top:35px;font-size:14px;color:#9ca3af;text-align:center;line-height:1.6;">
              Email ini dikirim otomatis oleh sistem Dashboard SPMT Pelindo.
            </p>
          </div>
        </div>
      </div>
      `,
    });

    console.log('Email notifikasi password dikirim ke:', email);
  } catch (error) {
    console.error('Gagal mengirim email notifikasi password:', error);
    throw new Error('Email gagal dikirim');
  }
}