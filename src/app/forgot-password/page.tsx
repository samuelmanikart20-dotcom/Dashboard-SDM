"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Step = "email" | "otp" | "reset" | "done";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");

  // Email step
  const [email, setEmail] = useState("");
  const [sendingOTP, setSendingOTP] = useState(false);
  const [emailError, setEmailError] = useState("");

  // OTP step
  const [otpValues, setOtpValues] = useState(["", "", "", "", "", ""]);
  const [verifying, setVerifying] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [resendCount, setResendCount] = useState(55);
  const [resending, setResending] = useState(false);

  // Reset step
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState("");

  // ── Countdown timer untuk resend ──
  const startCountdown = () => {
    setResendCount(55);
    const timer = setInterval(() => {
      setResendCount((prev) => {
        if (prev <= 1) { clearInterval(timer); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  // ── Step 1: Kirim OTP ──
  const handleSendOTP = async () => {
    setEmailError("");
    if (!email || !email.includes("@")) {
      setEmailError("Masukkan email yang valid");
      return;
    }
    setSendingOTP(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.success) {
        setStep("otp");
        startCountdown();
      } else {
        setEmailError(data.error || "Gagal mengirim OTP");
      }
    } catch {
      setEmailError("Terjadi kesalahan. Coba lagi.");
    } finally {
      setSendingOTP(false);
    }
  };

  // ── Resend OTP ──
  const handleResend = async () => {
    if (resendCount > 0 || resending) return;
    setResending(true);
    setOtpError("");
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setOtpValues(["", "", "", "", "", ""]);
      startCountdown();
    } catch {
      setOtpError("Gagal mengirim ulang kode");
    } finally {
      setResending(false);
    }
  };

  // ── OTP input handler ──
  const handleOtpChange = (idx: number, val: string) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...otpValues];
    next[idx] = val;
    setOtpValues(next);
    if (val && idx < 5) {
      const el = document.getElementById(`otp-${idx + 1}`);
      el?.focus();
    }
  };

  const handleOtpKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otpValues[idx] && idx > 0) {
      document.getElementById(`otp-${idx - 1}`)?.focus();
    }
  };

  // ── Step 2: Verifikasi OTP ──
  const handleVerifyOTP = async () => {
    const otp = otpValues.join("");
    if (otp.length < 6) {
      setOtpError("Masukkan 6 digit kode OTP");
      return;
    }
    setOtpError("");
    setVerifying(true);
    try {
      const res = await fetch("/api/auth/verify-reset-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });
      const data = await res.json();
      if (data.success) {
        setStep("reset");
      } else {
        setOtpError(data.error || "Kode OTP tidak valid");
      }
    } catch {
      setOtpError("Terjadi kesalahan. Coba lagi.");
    } finally {
      setVerifying(false);
    }
  };

  // ── Step 3: Reset password ──
  const handleResetPassword = async () => {
    setResetError("");
    if (password.length < 8) {
      setResetError("Password minimal 8 karakter");
      return;
    }
    if (password !== confirmPassword) {
      setResetError("Konfirmasi password tidak cocok");
      return;
    }
    setResetting(true);
    try {
      const otp = otpValues.join("");
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp, password }),
      });
      const data = await res.json();
      if (data.success) {
        setStep("done");
      } else {
        setResetError(data.error || "Gagal mereset password");
      }
    } catch {
      setResetError("Terjadi kesalahan. Coba lagi.");
    } finally {
      setResetting(false);
    }
  };

  // ── Strength indicator ──
  const getStrength = () => {
    if (!password) return { width: "0%", color: "#e5e7eb", label: "" };
    if (password.length < 6) return { width: "25%", color: "#E24B4A", label: "Lemah" };
    if (password.length < 8) return { width: "55%", color: "#EF9F27", label: "Sedang" };
    if (password.length >= 8 && /[A-Z]/.test(password) && /\d/.test(password))
      return { width: "100%", color: "#639922", label: "Kuat" };
    return { width: "75%", color: "#1a56db", label: "Cukup" };
  };
  const strength = getStrength();

  const maskedEmail = email
    ? email.replace(/(.{2}).+(@.+)/, "$1***$2")
    : "";

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      background: "linear-gradient(135deg, #1a56db 0%, #1e3a8a 50%, #f8fafc 50%)",
    }}>
      {/* Kiri */}
      <div style={{
        width: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
      }}>
        <div style={{ textAlign: "center", color: "#fff" }}>
          <div style={{
            width: 80, height: 80, borderRadius: "50%",
            background: "rgba(255,255,255,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 1rem",
          }}>
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <rect width="40" height="40" rx="8" fill="white" fillOpacity="0.3"/>
              <path d="M8 20C8 13.373 13.373 8 20 8s12 5.373 12 12-5.373 12-12 12S8 26.627 8 20z" fill="white" fillOpacity="0.5"/>
              <path d="M14 20l4 4 8-8" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 600, margin: "0 0 8px" }}>SPMT Pelindo</h1>
          <p style={{ opacity: 0.8, fontSize: 14 }}>PT Pelindo Multi Terminal</p>
        </div>
      </div>

      {/* Kanan */}
      <div style={{
        width: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        background: "#f8fafc",
      }}>
        <div style={{
          background: "#fff",
          borderRadius: 16,
          padding: "2.5rem 2rem",
          width: "100%",
          maxWidth: 380,
          boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
          border: "0.5px solid #e5e7eb",
        }}>

          {/* ── STEP EMAIL ── */}
          {step === "email" && (
            <>
              <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
                <div style={{
                  width: 48, height: 48, borderRadius: "50%", background: "#eff6ff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "0 auto 12px",
                }}>
                  <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#1a56db" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                  </svg>
                </div>
                <h2 style={{ fontSize: 20, fontWeight: 600, color: "#111827", margin: "0 0 6px" }}>Lupa sandi</h2>
                <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>
                  Masukkan email Anda dan kami akan mengirimkan kode verifikasi.
                </p>
              </div>

              {/* Step dots */}
              <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: "1.5rem" }}>
                {[0,1,2].map(i => (
                  <div key={i} style={{
                    width: 8, height: 8, borderRadius: "50%",
                    background: i === 0 ? "#1a56db" : "#e5e7eb",
                  }}/>
                ))}
              </div>

              <label style={{ fontSize: 13, color: "#374151", display: "block", marginBottom: 5, fontWeight: 500 }}>
                Alamat email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setEmailError(""); }}
                onKeyDown={e => e.key === "Enter" && handleSendOTP()}
                placeholder="contoh@email.com"
                style={{
                  width: "100%", padding: "10px 12px", fontSize: 14,
                  border: `1px solid ${emailError ? "#E24B4A" : "#d1d5db"}`,
                  borderRadius: 8, boxSizing: "border-box",
                  outline: "none", marginBottom: 6, color: "#111827",
                }}
              />
              {emailError && (
                <p style={{ color: "#E24B4A", fontSize: 12, margin: "0 0 12px" }}>{emailError}</p>
              )}
              <button
                onClick={handleSendOTP}
                disabled={sendingOTP}
                style={{
                  width: "100%", padding: "11px", background: sendingOTP ? "#93c5fd" : "#1a56db",
                  color: "#fff", border: "none", borderRadius: 8, fontSize: 14,
                  fontWeight: 500, cursor: sendingOTP ? "not-allowed" : "pointer",
                  marginTop: 8, marginBottom: 12,
                }}
              >
                {sendingOTP ? "Mengirim..." : "Kirim kode verifikasi"}
              </button>
              <button
                onClick={() => router.push("/login")}
                style={{
                  width: "100%", background: "none", border: "none",
                  color: "#1a56db", fontSize: 13, cursor: "pointer",
                }}
              >
                ← Kembali ke login
              </button>
            </>
          )}

          {/* ── STEP OTP ── */}
          {step === "otp" && (
            <>
              <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
                <div style={{
                  width: 48, height: 48, borderRadius: "50%", background: "#eff6ff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "0 auto 12px",
                }}>
                  <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#1a56db" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                  </svg>
                </div>
                <h2 style={{ fontSize: 20, fontWeight: 600, color: "#111827", margin: "0 0 6px" }}>Verifikasi kode</h2>
                <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>
                  Kode 6 digit telah dikirim ke<br />
                  <strong style={{ color: "#374151" }}>{maskedEmail}</strong>
                </p>
              </div>

              <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: "1.5rem" }}>
                {[0,1,2].map(i => (
                  <div key={i} style={{
                    width: 8, height: 8, borderRadius: "50%",
                    background: i <= 1 ? "#1a56db" : "#e5e7eb",
                  }}/>
                ))}
              </div>

              <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 12 }}>
                {otpValues.map((v, i) => (
                  <input
                    key={i}
                    id={`otp-${i}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={v}
                    onChange={e => handleOtpChange(i, e.target.value)}
                    onKeyDown={e => handleOtpKeyDown(i, e)}
                    style={{
                      width: 44, height: 48, textAlign: "center",
                      fontSize: 20, fontWeight: 600,
                      border: `1.5px solid ${otpError ? "#E24B4A" : v ? "#1a56db" : "#d1d5db"}`,
                      borderRadius: 8, outline: "none", color: "#111827",
                    }}
                  />
                ))}
              </div>

              {otpError && (
                <p style={{ color: "#E24B4A", fontSize: 12, textAlign: "center", margin: "0 0 12px" }}>{otpError}</p>
              )}

              <p style={{ fontSize: 12, color: "#6b7280", textAlign: "center", marginBottom: 16 }}>
                Tidak menerima kode?{" "}
                <span
                  onClick={handleResend}
                  style={{
                    color: resendCount > 0 ? "#9ca3af" : "#1a56db",
                    cursor: resendCount > 0 ? "default" : "pointer",
                    fontWeight: 500,
                  }}
                >
                  {resendCount > 0 ? `Kirim ulang (${resendCount}s)` : resending ? "Mengirim..." : "Kirim ulang"}
                </span>
              </p>

              <button
                onClick={handleVerifyOTP}
                disabled={verifying || otpValues.join("").length < 6}
                style={{
                  width: "100%", padding: "11px",
                  background: verifying || otpValues.join("").length < 6 ? "#93c5fd" : "#1a56db",
                  color: "#fff", border: "none", borderRadius: 8, fontSize: 14,
                  fontWeight: 500,
                  cursor: verifying || otpValues.join("").length < 6 ? "not-allowed" : "pointer",
                  marginBottom: 12,
                }}
              >
                {verifying ? "Memverifikasi..." : "Verifikasi"}
              </button>
              <button
                onClick={() => { setStep("email"); setOtpValues(["","","","","",""]); setOtpError(""); }}
                style={{ width: "100%", background: "none", border: "none", color: "#1a56db", fontSize: 13, cursor: "pointer" }}
              >
                ← Ubah email
              </button>
            </>
          )}

          {/* ── STEP RESET PASSWORD ── */}
          {step === "reset" && (
            <>
              <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
                <div style={{
                  width: 48, height: 48, borderRadius: "50%", background: "#eff6ff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "0 auto 12px",
                }}>
                  <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#1a56db" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                  </svg>
                </div>
                <h2 style={{ fontSize: 20, fontWeight: 600, color: "#111827", margin: "0 0 6px" }}>Buat sandi baru</h2>
                <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>
                  Sandi baru harus berbeda dari sebelumnya.
                </p>
              </div>

              <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: "1.5rem" }}>
                {[0,1,2].map(i => (
                  <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: "#1a56db" }}/>
                ))}
              </div>

              <label style={{ fontSize: 13, color: "#374151", display: "block", marginBottom: 5, fontWeight: 500 }}>
                Sandi baru
              </label>
              <div style={{ position: "relative", marginBottom: 8 }}>
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Min. 8 karakter"
                  style={{
                    width: "100%", padding: "10px 40px 10px 12px", fontSize: 14,
                    border: "1px solid #d1d5db", borderRadius: 8,
                    boxSizing: "border-box", outline: "none", color: "#111827",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  style={{
                    position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                    background: "none", border: "none", cursor: "pointer", color: "#9ca3af",
                  }}
                >
                  {showPw ? "🙈" : "👁"}
                </button>
              </div>

              {/* Strength bar */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <div style={{ flex: 1, height: 4, borderRadius: 2, background: "#f3f4f6" }}>
                  <div style={{ height: "100%", borderRadius: 2, width: strength.width, background: strength.color, transition: "width .3s" }}/>
                </div>
                <span style={{ fontSize: 11, color: strength.color, minWidth: 36, fontWeight: 500 }}>{strength.label}</span>
              </div>

              <label style={{ fontSize: 13, color: "#374151", display: "block", marginBottom: 5, fontWeight: 500 }}>
                Konfirmasi sandi
              </label>
              <div style={{ position: "relative", marginBottom: 6 }}>
                <input
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Ulangi sandi baru"
                  style={{
                    width: "100%", padding: "10px 40px 10px 12px", fontSize: 14,
                    border: `1px solid ${confirmPassword && confirmPassword !== password ? "#E24B4A" : "#d1d5db"}`,
                    borderRadius: 8, boxSizing: "border-box", outline: "none", color: "#111827",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  style={{
                    position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                    background: "none", border: "none", cursor: "pointer", color: "#9ca3af",
                  }}
                >
                  {showConfirm ? "🙈" : "👁"}
                </button>
              </div>

              {resetError && (
                <p style={{ color: "#E24B4A", fontSize: 12, margin: "4px 0 12px" }}>{resetError}</p>
              )}

              <button
                onClick={handleResetPassword}
                disabled={resetting}
                style={{
                  width: "100%", padding: "11px", background: resetting ? "#93c5fd" : "#1a56db",
                  color: "#fff", border: "none", borderRadius: 8, fontSize: 14,
                  fontWeight: 500, cursor: resetting ? "not-allowed" : "pointer",
                  marginTop: 8,
                }}
              >
                {resetting ? "Menyimpan..." : "Simpan sandi baru"}
              </button>
            </>
          )}

          {/* ── STEP DONE ── */}
          {step === "done" && (
            <div style={{ textAlign: "center" }}>
              <div style={{
                width: 64, height: 64, borderRadius: "50%", background: "#f0fdf4",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 1rem",
              }}>
                <svg width="30" height="30" fill="none" viewBox="0 0 24 24" stroke="#16a34a" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 600, color: "#111827", margin: "0 0 8px" }}>
                Sandi berhasil diperbarui!
              </h2>
              <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 1.5rem" }}>
                Password Anda telah berhasil diganti. Silakan login dengan sandi baru.
              </p>
              <button
                onClick={() => router.push("/login")}
                style={{
                  width: "100%", padding: "11px", background: "#1a56db",
                  color: "#fff", border: "none", borderRadius: 8, fontSize: 14,
                  fontWeight: 500, cursor: "pointer",
                }}
              >
                Ke halaman login
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}