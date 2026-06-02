"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function VerifyOTP() {
  const router = useRouter();

  const [otp, setOtp] = useState<string[]>(Array(6).fill(""));
  const [loading, setLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(300);
  const [shake, setShake] = useState(false);
  const [success, setSuccess] = useState(false);

  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    inputsRef.current[0]?.focus();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const timerPercent = (timeLeft / 300) * 100;
  const timerColor =
    timeLeft > 120
      ? "#34d399"
      : timeLeft > 60
      ? "#fbbf24"
      : "#f87171";

  const handleChange = (value: string, index: number) => {
    if (!/^\d?$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    if (value && index < 5) {
      inputsRef.current[index + 1]?.focus();
    }
    if (newOtp.join("").length === 6) {
      verifyOTP(newOtp.join(""));
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const newOtp = Array(6).fill("");
    pasted.split("").forEach((char, i) => { newOtp[i] = char; });
    setOtp(newOtp);
    const nextEmpty = pasted.length < 6 ? pasted.length : 5;
    inputsRef.current[nextEmpty]?.focus();
    if (pasted.length === 6) verifyOTP(pasted);
  };

  const handleBackspace = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 600);
  };

  const verifyOTP = async (otpValue?: string) => {
    const finalOtp = otpValue || otp.join("");
    if (finalOtp.length < 6) { triggerShake(); return; }

    const email = localStorage.getItem("email");
    if (!email) {
      alert("Email tidak ditemukan");
      router.push("/login");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp: finalOtp }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(true);
        localStorage.setItem("user", JSON.stringify(data.user));
        localStorage.setItem("token", data.token);
        setTimeout(() => router.push("/user"), 1000);
      } else {
        triggerShake();
        alert(data.message || "OTP salah");
      }
    } catch (error) {
      console.error(error);
      triggerShake();
      alert("Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = () => {
    // aktifkan logika resend di sini
    alert("OTP baru telah dikirim");
  };

  const filled = otp.filter(Boolean).length;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        .otp-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Plus Jakarta Sans', sans-serif;
          background: #0f172a;
          position: relative;
          overflow: hidden;
        }

        .otp-bg-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.35;
          pointer-events: none;
        }
        .orb-1 { width: 500px; height: 500px; background: #3b82f6; top: -120px; left: -100px; }
        .orb-2 { width: 400px; height: 400px; background: #06b6d4; bottom: -100px; right: -80px; }
        .orb-3 { width: 300px; height: 300px; background: #8b5cf6; top: 40%; left: 55%; }

        .otp-card {
          position: relative;
          z-index: 10;
          width: 100%;
          max-width: 420px;
          margin: 1rem;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 24px;
          padding: 2.5rem 2rem;
          text-align: center;
          animation: cardIn 0.5s cubic-bezier(0.34,1.56,0.64,1) both;
        }

        @keyframes cardIn {
          from { opacity: 0; transform: translateY(32px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }

        .icon-ring {
          width: 72px;
          height: 72px;
          border-radius: 50%;
          background: rgba(59,130,246,0.2);
          border: 1.5px solid rgba(59,130,246,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 1.5rem;
          animation: pulseRing 2.5s ease-in-out infinite;
        }

        @keyframes pulseRing {
          0%, 100% { box-shadow: 0 0 0 0 rgba(59,130,246,0.3); }
          50%       { box-shadow: 0 0 0 10px rgba(59,130,246,0); }
        }

        .icon-ring svg { width: 32px; height: 32px; color: #93c5fd; }

        .otp-title {
          font-size: 22px;
          font-weight: 700;
          color: #f1f5f9;
          margin-bottom: 6px;
          letter-spacing: -0.3px;
        }

        .otp-sub {
          font-size: 13.5px;
          color: rgba(255,255,255,0.5);
          margin-bottom: 1.5rem;
          line-height: 1.6;
        }

        /* Timer */
        .timer-wrap {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          margin-bottom: 1.75rem;
        }

        .timer-bar-bg {
          flex: 1;
          height: 4px;
          border-radius: 99px;
          background: rgba(255,255,255,0.1);
          overflow: hidden;
          max-width: 80px;
        }

        .timer-bar-fill {
          height: 100%;
          border-radius: 99px;
          transition: width 1s linear, background-color 0.5s;
        }

        .timer-text {
          font-size: 13px;
          font-weight: 600;
          font-variant-numeric: tabular-nums;
          min-width: 36px;
        }

        /* OTP inputs */
        .otp-inputs {
          display: flex;
          justify-content: center;
          gap: 10px;
          margin-bottom: 1.75rem;
        }

        .otp-input {
          width: 52px;
          height: 60px;
          border-radius: 14px;
          border: 1.5px solid rgba(255,255,255,0.15);
          background: rgba(255,255,255,0.07);
          font-size: 22px;
          font-weight: 700;
          font-family: 'Plus Jakarta Sans', sans-serif;
          color: #f1f5f9;
          text-align: center;
          outline: none;
          caret-color: #60a5fa;
          transition: border-color 0.15s, background 0.15s, transform 0.1s;
        }

        .otp-input:focus {
          border-color: #60a5fa;
          background: rgba(96,165,250,0.1);
          transform: scale(1.05);
        }

        .otp-input.has-value {
          border-color: rgba(96,165,250,0.6);
          background: rgba(96,165,250,0.08);
        }

        .otp-input.success-input {
          border-color: #34d399 !important;
          background: rgba(52,211,153,0.1) !important;
          color: #34d399 !important;
        }

        @keyframes shake {
          0%,100% { transform: translateX(0); }
          20%     { transform: translateX(-6px); }
          40%     { transform: translateX(6px); }
          60%     { transform: translateX(-4px); }
          80%     { transform: translateX(4px); }
        }

        .shake .otp-input {
          animation: shake 0.5s ease;
          border-color: #f87171 !important;
        }

        /* Progress dots */
        .progress-dots {
          display: flex;
          justify-content: center;
          gap: 6px;
          margin-bottom: 1.25rem;
        }

        .progress-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: rgba(255,255,255,0.15);
          transition: background 0.2s, transform 0.2s;
        }

        .progress-dot.active {
          background: #60a5fa;
          transform: scale(1.3);
        }

        /* Button */
        .verify-btn {
          width: 100%;
          padding: 14px;
          border-radius: 14px;
          border: none;
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.15s, transform 0.1s, background 0.3s;
          margin-bottom: 1.25rem;
          position: relative;
          overflow: hidden;
        }

        .verify-btn:not(:disabled) {
          background: linear-gradient(135deg, #3b82f6, #06b6d4);
          color: #fff;
        }

        .verify-btn:disabled {
          background: rgba(255,255,255,0.1);
          color: rgba(255,255,255,0.35);
          cursor: not-allowed;
        }

        .verify-btn:not(:disabled):hover { opacity: 0.88; }
        .verify-btn:not(:disabled):active { transform: scale(0.98); }

        .verify-btn.success-btn {
          background: linear-gradient(135deg, #10b981, #34d399) !important;
        }

        /* Links */
        .otp-footer {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .text-link {
          font-size: 13px;
          color: rgba(255,255,255,0.45);
          background: none;
          border: none;
          font-family: inherit;
          cursor: pointer;
          transition: color 0.15s;
          text-decoration: underline;
          text-underline-offset: 3px;
        }

        .text-link:hover { color: rgba(255,255,255,0.85); }
        .text-link:disabled { opacity: 0.3; cursor: not-allowed; text-decoration: none; }

        /* Loading spinner */
        @keyframes spin { to { transform: rotate(360deg); } }
        .spinner {
          display: inline-block;
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          vertical-align: middle;
          margin-right: 8px;
        }
      `}</style>

      <div className="otp-page">
        <div className="otp-bg-orb orb-1" />
        <div className="otp-bg-orb orb-2" />
        <div className="otp-bg-orb orb-3" />

        <div className="otp-card">
          {/* Icon */}
          <div className="icon-ring">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect width="20" height="16" x="2" y="4" rx="3" />
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
            </svg>
          </div>

          <h1 className="otp-title">Verifikasi OTP</h1>
          <p className="otp-sub">
            Masukkan kode 6 digit yang dikirim<br />ke email kamu
          </p>

          {/* Timer */}
          <div className="timer-wrap">
            <div className="timer-bar-bg">
              <div
                className="timer-bar-fill"
                style={{ width: `${timerPercent}%`, backgroundColor: timerColor }}
              />
            </div>
            <span className="timer-text" style={{ color: timerColor }}>
              {formatTime(timeLeft)}
            </span>
          </div>

          {/* Progress dots */}
          <div className="progress-dots">
            {Array(6).fill(null).map((_, i) => (
              <div key={i} className={`progress-dot ${i < filled ? "active" : ""}`} />
            ))}
          </div>

          {/* OTP inputs */}
          <div className={`otp-inputs ${shake ? "shake" : ""}`}>
            {otp.map((digit, index) => (
              <input
                key={index}
                ref={(el) => { inputsRef.current[index] = el!; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(e.target.value, index)}
                onKeyDown={(e) => handleBackspace(e, index)}
                onPaste={index === 0 ? handlePaste : undefined}
                className={`otp-input ${digit ? "has-value" : ""} ${success ? "success-input" : ""}`}
                autoComplete="one-time-code"
              />
            ))}
          </div>

          {/* Button */}
          <button
            onClick={() => verifyOTP()}
            disabled={loading || filled < 6}
            className={`verify-btn ${success ? "success-btn" : ""}`}
          >
            {loading && <span className="spinner" />}
            {success ? "✓ Berhasil!" : loading ? "Memverifikasi..." : "Verifikasi"}
          </button>

          {/* Footer links */}
          <div className="otp-footer">
            <button
              className="text-link"
              disabled={timeLeft > 0}
              onClick={handleResend}
            >
              {timeLeft > 0
                ? `Kirim ulang dalam ${formatTime(timeLeft)}`
                : "Kirim Ulang OTP"}
            </button>
            <button className="text-link" onClick={() => router.push("/login")}>
              Kembali ke Login
            </button>
          </div>
        </div>
      </div>
    </>
  );
}