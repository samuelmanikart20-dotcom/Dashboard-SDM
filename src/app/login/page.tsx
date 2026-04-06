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
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email,
          password,
          turnstileToken
        })
      });

      const data = await res.json();

      // ===============================
      // OTP FLOW
      // ===============================
      if (data?.requireOTP) {
        localStorage.setItem("email", data.email);

        setMessage("Kode OTP telah dikirim ke email");

        // 🔥 FIX: langsung redirect tanpa delay
        router.push("/verify-otp");
        return;
      }

      // ===============================
      // LOGIN NORMAL
      // ===============================
      if (data?.success) {
        localStorage.setItem("user", JSON.stringify(data.user));
        localStorage.setItem("token", data.token || "logged-in");

        const role = data?.user?.role ?? "user";
        const adminRoles = ["superadmin", "admin", "admin_pembelajaran"];

        // sedikit delay optional biar smooth UX
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

      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 relative">
        <div className="absolute inset-0 bg-gradient-to-br from-white/80 via-white/90 to-blue-50/50"></div>

        <div className="w-full max-w-md relative z-10">
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
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full px-4 py-3 border-2 border-blue-200 rounded-lg"
              />

              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-4 py-3 border-2 border-blue-200 rounded-lg"
              />

              <CloudflareCaptcha
                onVerify={(verified, token) => {
                  setCaptchaVerified(verified);
                  setTurnstileToken(token || null);
                }}
              />

              <button
                type="submit"
                disabled={loading || !captchaVerified}
                className="w-full bg-blue-700 text-white py-3 rounded-lg"
              >
                {loading ? "Memproses..." : "Masuk"}
              </button>
            </form>

            {message && <p className="mt-4 text-center">{message}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}