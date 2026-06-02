"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import CloudflareCaptcha from "@/components/CloudflareCaptcha";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [captchaVerified, setCaptchaVerified] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    setMounted(true);
    setCaptchaVerified(false);
    setTurnstileToken(null);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!captchaVerified) {
      setMessage("Silakan verifikasi CAPTCHA terlebih dahulu");
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, turnstileToken }),
      });

      const data = await res.json();

      // OTP FLOW
      if (data?.requireOTP) {
        localStorage.setItem("email", data.email);
        setMessage("Kode OTP telah dikirim ke email");
        router.push("/verify-otp");
        return;
      }

      // LOGIN NORMAL
      if (data?.success) {
        localStorage.setItem("user", JSON.stringify(data.user));
        localStorage.setItem("token", data.token || "logged-in");

        const role = data?.user?.role ?? "user";
        const adminRoles = ["superadmin", "admin", "admin_pembelajaran"];

        await new Promise((resolve) => setTimeout(resolve, 300));

        if (adminRoles.includes(role)) {
          router.push("/admin");
        } else {
          router.push("/user");
        }
        return;
      }

      setMessage(data?.message || "Login gagal");
    } catch (error) {
      console.error("Login error:", error);
      setMessage("Terjadi kesalahan saat login");
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-blue-100 to-blue-200 flex">
      {/* ── Kiri ── */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 items-center justify-center p-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-blue-900/20"></div>
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-transparent via-white/5 to-transparent"></div>
        <div className="text-center text-white relative z-10">
          <div className="w-48 h-48 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto shadow-2xl p-6 border border-white/20">
            <Image
              src="/icon.jpeg"
              alt="Pelindo Logo"
              width={144}
              height={144}
              className="rounded-full object-cover"
            />
          </div>
        </div>
      </div>

      {/* ── Kanan ── */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 relative">
        <div className="absolute inset-0 bg-gradient-to-br from-white/80 via-white/90 to-blue-50/50"></div>

        <div className="w-full max-w-md relative z-10">
          {/* Logo mobile */}
          <div className="lg:hidden text-center mb-8">
            <div className="w-24 h-24 bg-gradient-to-br from-blue-600 to-blue-700 rounded-full flex items-center justify-center mx-auto mb-4 p-3 shadow-lg border border-blue-500/20">
              <Image
                src="/icon.jpeg"
                alt="Pelindo Logo"
                width={72}
                height={72}
                className="rounded-full object-cover"
              />
            </div>
            <h1 className="text-2xl font-bold text-blue-800 mb-2">SPMT Pelindo</h1>
            <p className="text-blue-600">Sistem Informasi Pelabuhan</p>
          </div>

          <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-2xl p-8 border border-white/50">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-blue-800 mb-2">Login</h2>
              <p className="text-blue-600">Silakan masuk ke akun Anda</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Email */}
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full px-4 py-3 border-2 border-blue-200 rounded-lg focus:outline-none focus:border-blue-500"
              />

              {/* Password */}
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-4 py-3 border-2 border-blue-200 rounded-lg pr-12 focus:outline-none focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-400 hover:text-blue-600 transition-colors"
                  aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>

              {/* Link Lupa Sandi — di bawah password, di atas captcha */}
              <div className="flex justify-end -mt-3">
                <Link
                  href="/forgot-password"
                  className="text-sm text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                >
                  Lupa sandi?
                </Link>
              </div>

              {/* Captcha */}
              <CloudflareCaptcha
                onVerify={(verified, token) => {
                  setCaptchaVerified(verified);
                  setTurnstileToken(token || null);
                }}
              />

              {/* Tombol Masuk */}
              <button
                type="submit"
                disabled={loading || !captchaVerified}
                className="w-full bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 disabled:cursor-not-allowed text-white py-3 rounded-lg font-medium transition-colors"
              >
                {loading ? "Memproses..." : "Masuk"}
              </button>
            </form>

            {message && (
              <p className={`mt-4 text-center text-sm ${message.includes("gagal") || message.includes("kesalahan") || message.includes("verifikasi") ? "text-red-500" : "text-green-600"}`}>
                {message}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}