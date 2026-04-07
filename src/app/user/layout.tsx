"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import UserSidebar from "@/components/UserSidebar";
import Navbar from "@/components/Navbar";

export default function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const [fadeIn, setFadeIn] = useState(false);

  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return;

    const rawUser = localStorage.getItem("user");
    const token = localStorage.getItem("token");

    // jika tidak ada user atau token
    if (!rawUser || rawUser === "undefined" || !token) {
      localStorage.removeItem("user");
      localStorage.removeItem("token");
      setIsLoading(false);
      router.push("/login");
      return;
    }

    try {
      const user = JSON.parse(rawUser);

      if (!user || typeof user !== "object" || !user.role) {
        throw new Error("User data tidak valid");
      }

      const adminRoles = ["superadmin", "admin", "admin_pembelajaran"];

      if (adminRoles.includes(user.role)) {
        setIsLoading(false);
        router.push("/admin");
        return;
      }

      setIsAuthorized(true);
    } catch (err) {
      console.error("Error parsing user data:", err);

      localStorage.removeItem("user");
      localStorage.removeItem("token");

      router.push("/login");
    } finally {
      setIsLoading(false);
    }
  }, [router, isMounted]);

  useEffect(() => {
    setFadeIn(false);
    const id = requestAnimationFrame(() => setFadeIn(true));
    return () => cancelAnimationFrame(id);
  }, [pathname]);

  if (!isMounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Memuat...</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Memverifikasi akses...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">
            Mengalihkan ke halaman login...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar />

      <div className="flex">
        <UserSidebar />

        <div
          key={pathname}
          className={`flex-1 p-6 transition-opacity duration-200 ${
            fadeIn ? "opacity-100" : "opacity-0"
          }`}
        >
          {children}
        </div>
      </div>
    </div>
  );
}