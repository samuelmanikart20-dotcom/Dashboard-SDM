"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function VerifyOTP() {
  const router = useRouter();

  const [otp, setOtp] = useState<string[]>(Array(6).fill(""));
  const [loading, setLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(300);

  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  // ======================
  // TIMER OTP
  // ======================
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

  // ======================
  // INPUT OTP
  // ======================
  const handleChange = (value: string, index: number) => {
    if (!/^\d?$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // pindah ke kanan
    if (value && index < 5) {
      inputsRef.current[index + 1]?.focus();
    }

    // auto submit
    if (newOtp.join("").length === 6) {
      verifyOTP(newOtp.join(""));
    }
  };

  const handleBackspace = (
    e: React.KeyboardEvent<HTMLInputElement>,
    index: number
  ) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  // ======================
  // VERIFY OTP
  // ======================
  const verifyOTP = async (otpValue?: string) => {
    const finalOtp = otpValue || otp.join("");
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
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          otp: finalOtp,
        }),
      });

      const data = await res.json();

      if (data.success) {
        localStorage.setItem("user", JSON.stringify(data.user));
        localStorage.setItem("token", data.token);

        router.push("/user");
      } else {
        alert(data.message || "OTP salah");
      }
    } catch (error) {
      console.error(error);
      alert("Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  // ======================
  // UI
  // ======================
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 via-blue-700 to-cyan-500">
      <div className="bg-white/20 backdrop-blur-xl shadow-2xl rounded-2xl p-10 w-[380px] text-center text-white">

        <h2 className="text-2xl font-bold mb-2">Verifikasi OTP</h2>

        <p className="text-sm opacity-80 mb-2">
          Masukkan kode yang dikirim ke email kamu
        </p>

        <p className="mb-6 font-semibold">
          Sisa waktu: {formatTime(timeLeft)}
        </p>

        {/* OTP INPUT */}
        <div className="flex justify-between gap-3 mb-6">
          {otp.map((digit, index) => (
            <input
              key={index}
              ref={(el) => {
                inputsRef.current[index] = el!;
              }}
              type="text"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(e.target.value, index)}
              onKeyDown={(e) => handleBackspace(e, index)}
              className="
                w-10 h-14
                text-center text-xl font-bold
                rounded-xl
                border-2 border-white/70
                bg-white/90
                text-blue-900
                shadow-md
                hover:scale-105

                focus:border-cyan-300
                focus:ring-2 focus:ring-cyan-200
                focus:bg-white

                transition-all duration-200
              "
            />
          ))}
        </div>

        {/* BUTTON */}
        <button
          onClick={() => verifyOTP()}
          disabled={loading}
          className="
            w-full
            bg-gradient-to-r from-blue-600 to-cyan-500
            hover:from-blue-700 hover:to-cyan-600
            text-white
            py-3
            rounded-lg
            font-semibold
            shadow-lg
            transition
          "
        >
          {loading ? "Memverifikasi..." : "Verifikasi"}
        </button>

        {/* RESEND */}
        <div className="mt-6 text-sm space-y-2">
          <button
            disabled={timeLeft > 0}
            className={`underline ${
              timeLeft > 0 ? "opacity-50" : "opacity-100"
            }`}
            onClick={() => alert("Resend OTP nanti kita aktifkan")}
          >
            Kirim Ulang OTP
          </button>

          <br />

          <button
            className="underline opacity-80 hover:opacity-100"
            onClick={() => router.push("/login")}
          >
            Kembali ke Login
          </button>
        </div>

      </div>
    </div>
  );
}