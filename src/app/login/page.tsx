"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import Image from "next/image";
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

  useEffect(() => {
    setMounted(true);
    // Reset captcha state on mount - user must click widget first
    setCaptchaVerified(false);
    setTurnstileToken(null);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validasi CAPTCHA
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
        body: JSON.stringify({ 
          email, 
          password,
          turnstileToken 
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data?.message ?? "Login gagal");
      } else {
        // Simpan data user dan token
        localStorage.setItem("user", JSON.stringify(data.user));
        localStorage.setItem("token", "logged-in");

        const role = (data?.user?.role as string) ?? "user";
        const adminRoles = ["superadmin", "admin", "admin_pembelajaran"];

        // 🕒 Tambahkan delay 2 detik biar loading kelihatan lebih lama
        await new Promise((resolve) => setTimeout(resolve, 2000));

        if (adminRoles.includes(role)) {
          router.push("/admin");
        } else {
          router.push("/user");
        }
      }
    } catch {
      setMessage("Terjadi kesalahan");
    } finally {
      // Sedikit delay tambahan agar animasi lebih smooth
      await new Promise((resolve) => setTimeout(resolve, 500));
      setLoading(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-blue-100 to-blue-200 flex">
      {/* Logo Section */}
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

      {/* Login Form Section */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 relative">
        <div className="absolute inset-0 bg-gradient-to-br from-white/80 via-white/90 to-blue-50/50"></div>

        <div className="w-full max-w-md relative z-10">
          {/* Mobile Logo */}
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

            <form onSubmit={handleSubmit} className="space-y-6" suppressHydrationWarning>
              <div>
                <label className="block text-sm font-semibold text-blue-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full px-4 py-3 border-2 border-blue-200 rounded-lg focus:border-blue-500 focus:outline-none transition-all duration-200 bg-white/80 backdrop-blur-sm text-blue-900 placeholder-blue-400 shadow-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-blue-700 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-4 py-3 border-2 border-blue-200 rounded-lg focus:border-blue-500 focus:outline-none transition-all duration-200 bg-white/80 backdrop-blur-sm text-blue-900 placeholder-blue-400 shadow-sm"
                />
              </div>


              {/* CAPTCHA */}
              <div className="mt-6 mb-4" style={{ display: 'block', visibility: 'visible', opacity: 1 }}>
                <label className="block text-sm font-semibold text-blue-700 mb-3">
                  Verifikasi
                </label>
                <div className="w-full" style={{ display: 'block' }}>
                  {mounted ? (
                    <CloudflareCaptcha 
                      onVerify={(verified, token) => {
                        setCaptchaVerified(verified);
                        setTurnstileToken(token || null);
                      }} 
                    />
                  ) : (
                    <div className="border-2 border-gray-300 bg-gray-100 rounded-lg p-4 min-h-[70px] flex items-center justify-center">
                      <span className="text-gray-500 text-sm">Memuat verifikasi...</span>
                    </div>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !captchaVerified}
                className="w-full bg-gradient-to-r from-blue-600 via-blue-700 to-blue-800 hover:from-blue-700 hover:via-blue-800 hover:to-blue-900 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-lg hover:shadow-xl"
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Memproses...
                  </div>
                ) : (
                  "Masuk"
                )}
              </button>
            </form>

            {message && (
              <div
                className={`mt-6 p-4 rounded-lg text-center font-medium backdrop-blur-sm ${
                  message.includes("berhasil")
                    ? "bg-green-100/80 text-green-700 border border-green-200/50"
                    : "bg-red-100/80 text-red-700 border border-red-200/50"
                }`}
              >
                {message}
              </div>
            )}

            <div className="mt-8 text-center">
              <p className="text-sm text-blue-600">
                © 2024 Sistem Informasi SPMT Pelindo
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
