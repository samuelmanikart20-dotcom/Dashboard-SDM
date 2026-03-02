"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { FaSignOutAlt, FaUser, FaCog } from "react-icons/fa";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

export default function Navbar() {
  const [user, setUser] = useState<User | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const router = useRouter();
  const confirmBtnRef = useRef<HTMLButtonElement | null>(null);
  const cancelBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (userData) {
      setUser(JSON.parse(userData));
    }
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) =>
      e.key === "Escape" && setShowLogoutModal(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (showLogoutModal) {
      setTimeout(() => confirmBtnRef.current?.focus(), 0);
    }
  }, [showLogoutModal]);

  const handleModalKeyDown = (e: any) => {
    if (e.key !== "Tab") return;
    const first = confirmBtnRef.current;
    const last = cancelBtnRef.current ?? confirmBtnRef.current;
    if (!first || !last) return;

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const handleLogout = () => {
    setShowLogoutModal(false);
    setShowDropdown(false);
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    // Redirect setelah sedikit delay untuk memastikan modal tertutup
    setTimeout(() => {
      window.location.href = "/login";
    }, 100);
  };

  const handleProfileClick = () => setShowDropdown(!showDropdown);

  const handleSettingsClick = () => {
    if (user?.role === "admin") {
      router.push("/admin/settings");
    } else {
      router.push("/user/settings");
    }
    setShowDropdown(false);
  };

  if (!user) return null;

  return (
    <>
      {/* NAVBAR */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 
        bg-gradient-to-r from-blue-700 via-blue-800 to-blue-900 
        border-b border-blue-700 shadow-md"
      >
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo / Brand */}
            <div className="flex items-center space-x-2">
              <img
                src="/icon.jpeg"
                alt="Logo"
                className="h-8 w-8 object-contain rounded"
              />
              <h1 className="text-lg font-semibold text-white tracking-wide">
                SPMT Pelindo
              </h1>
            </div>

            {/* User Menu */}
            <div className="relative flex items-center space-x-4">
              {/* User Info */}
              <div className="hidden md:flex items-center space-x-2">
                <FaUser className="text-blue-200" />
                <span className="text-sm text-white font-medium">
                  {user.name}
                </span>
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    ["superadmin", "admin", "admin_pembelajaran"].includes(user.role)
                      ? "bg-blue-500 text-white"
                      : "bg-white text-blue-700"
                  }`}
                >
                  {user.role === "superadmin"
                    ? "Super Admin"
                    : user.role === "admin"
                    ? "Admin"
                    : user.role === "admin_pembelajaran"
                    ? "Admin Pembelajaran"
                    : "User"}
                </span>
              </div>

              {/* Dropdown Trigger */}
              <button
                onClick={handleProfileClick}
                className="flex items-center space-x-2 p-2 rounded-md hover:bg-blue-700 transition-all"
              >
                <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
                  <span className="text-blue-700 font-semibold text-sm">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <FaCog className="text-blue-100" />
              </button>

              {/* Dropdown */}
              {showDropdown && (
                <div
                  className="absolute right-0 top-full mt-6 w-52 bg-white rounded-lg shadow-lg 
                  border border-blue-200 py-1 z-50 animate-fade-in"
                >
                  <div className="px-4 py-2 border-b border-blue-100">
                    <p className="text-sm font-semibold text-blue-800">
                      {user.name}
                    </p>
                    <p className="text-xs text-gray-500">{user.email}</p>
                    <p className="text-xs text-gray-500 capitalize">
                      {user.role}
                    </p>
                  </div>

                  <button
                    onClick={handleSettingsClick}
                    className="w-full text-left px-4 py-2 text-sm text-blue-800 
                    hover:bg-blue-100 flex items-center space-x-2 transition-colors"
                  >
                    <FaCog className="text-blue-600" />
                    <span>Pengaturan</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowDropdown(false);
                      setShowLogoutModal(true);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 
                    hover:bg-red-600 hover:text-white flex items-center space-x-2 transition-colors"
                  >
                    <FaSignOutAlt />
                    <span>Logout</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* MOBILE */}
        <div className="md:hidden border-t border-blue-700">
          <div className="px-3 py-2 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <FaUser className="text-white" />
              <span className="text-sm text-white">{user.name}</span>
            </div>
            <button
              onClick={() => {
                setShowLogoutModal(true);
              }}
              className="text-red-200 hover:text-red-600 flex items-center space-x-1"
            >
              <FaSignOutAlt />
              <span className="text-sm">Logout</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Spacer */}
      <div className="h-16"></div>

      {/* LOGOUT MODAL */}
      {showLogoutModal && (
        <div className="fixed inset-0 flex items-center justify-center z-[60] pointer-events-none">
          <div
            className="bg-white rounded-xl shadow-xl p-6 w-80 border-t-4 border-blue-700 pointer-events-auto"
            onKeyDown={handleModalKeyDown}
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Konfirmasi Logout
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Apakah Anda yakin ingin keluar dari akun ini?
            </p>
            <div className="flex gap-3">
              <button
                ref={confirmBtnRef}
                onClick={handleLogout}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md 
                hover:bg-red-700 transition-all focus:ring-2 focus:ring-red-300"
              >
                Logout
              </button>
              <button
                ref={cancelBtnRef}
                onClick={() => setShowLogoutModal(false)}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-800 rounded-md 
                hover:bg-gray-400 transition-all focus:ring-2 focus:ring-gray-300"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
