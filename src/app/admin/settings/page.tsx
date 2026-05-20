"use client";

import { useState, useEffect } from "react";

import {
  FaCog,
  FaDatabase,
  FaShieldAlt,
  FaBell,
  FaPalette,
  FaUser,
  FaEye,
  FaEyeSlash,
} from "react-icons/fa";

// =========================
// TRANSLATIONS
// =========================
const translations = {
  id: {
    pageTitle: "Pengaturan Sistem",
    pageSubtitle: "Kelola konfigurasi sistem SPMT",
    tabs: {
      general: "Umum",
      database: "Database",
      security: "Keamanan",
      notifications: "Notifikasi",
      appearance: "Tampilan",
      account: "Akun",
    },
    general: {
      title: "Pengaturan Umum",
      systemName: "Nama Sistem",
      systemVersion: "Versi Sistem",
    },
    database: {
      title: "Pengaturan Database",
      status: "Database Aktif",
      connected: "Database berhasil terhubung.",
      tables: "Total tabel: users, spmt_data, drive_files",
    },
    security: {
      title: "Pengaturan Keamanan",
      twoFactor: "Autentikasi 2 Faktor",
      twoFactorDesc: "Aktifkan verifikasi tambahan",
      activityLog: "Log Aktivitas",
      activityLogDesc: "Simpan aktivitas user",
    },
    notifications: {
      title: "Pengaturan Notifikasi",
      email: "Email Notifikasi",
      emailDesc: "Kirim email otomatis",
    },
    appearance: {
      title: "Pengaturan Tampilan",
      theme: "Tema",
      language: "Bahasa",
      light: "Light",
      dark: "Dark",
      saved: "Pengaturan tampilan disimpan!",
    },
    account: {
      title: "Pengaturan Akun",
      fullName: "Nama Lengkap",
      email: "Email",
      oldPassword: "Password Lama",
      newPassword: "Password Baru",
      confirmPassword: "Konfirmasi Password",
      save: "Simpan Perubahan",
      passwordMismatch: "Konfirmasi password tidak cocok",
      success: "Profil berhasil diperbarui",
      error: "Terjadi kesalahan server",
    },
  },
  en: {
    pageTitle: "System Settings",
    pageSubtitle: "Manage SPMT system configuration",
    tabs: {
      general: "General",
      database: "Database",
      security: "Security",
      notifications: "Notifications",
      appearance: "Appearance",
      account: "Account",
    },
    general: {
      title: "General Settings",
      systemName: "System Name",
      systemVersion: "System Version",
    },
    database: {
      title: "Database Settings",
      status: "Database Active",
      connected: "Database connected successfully.",
      tables: "Total tables: users, spmt_data, drive_files",
    },
    security: {
      title: "Security Settings",
      twoFactor: "Two-Factor Authentication",
      twoFactorDesc: "Enable additional verification",
      activityLog: "Activity Log",
      activityLogDesc: "Save user activity",
    },
    notifications: {
      title: "Notification Settings",
      email: "Email Notifications",
      emailDesc: "Send automatic emails",
    },
    appearance: {
      title: "Appearance Settings",
      theme: "Theme",
      language: "Language",
      light: "Light",
      dark: "Dark",
      saved: "Appearance settings saved!",
    },
    account: {
      title: "Account Settings",
      fullName: "Full Name",
      email: "Email",
      oldPassword: "Current Password",
      newPassword: "New Password",
      confirmPassword: "Confirm Password",
      save: "Save Changes",
      passwordMismatch: "Passwords do not match",
      success: "Profile updated successfully",
      error: "Server error occurred",
    },
  },
};

export default function AdminSettingsPage() {
  const [activeTab, setActiveTab] = useState("general");

  const [accountForm, setAccountForm] = useState({
    name: "",
    email: "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [message, setMessage] = useState("");

  // =========================
  // PASSWORD VISIBILITY STATE
  // =========================
  const [showPasswords, setShowPasswords] = useState({
    currentPassword: false,
    newPassword: false,
    confirmPassword: false,
  });

  const togglePasswordVisibility = (field: keyof typeof showPasswords) => {
    setShowPasswords((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  // =========================
  // THEME & LANGUAGE STATE
  // =========================
  const [darkMode, setDarkMode] = useState(false);
  const [language, setLanguage] = useState<"id" | "en">("id");
  const [appearanceSaved, setAppearanceSaved] = useState(false);

  const t = translations[language];

  // =========================
  // LOAD PREFERENCES
  // =========================
  useEffect(() => {
    const user = localStorage.getItem("user");
    if (user) {
      const parsed = JSON.parse(user);
      setAccountForm((prev) => ({
        ...prev,
        name: parsed.name || "",
        email: parsed.email || "",
      }));
    }

    const savedTheme = localStorage.getItem("adminTheme");
    const savedLang = localStorage.getItem("adminLang");

    if (savedTheme === "dark") setDarkMode(true);
    if (savedLang === "en") setLanguage("en");
  }, []);

  // =========================
  // SAVE APPEARANCE
  // =========================
  const handleSaveAppearance = () => {
    localStorage.setItem("adminTheme", darkMode ? "dark" : "light");
    localStorage.setItem("adminLang", language);
    setAppearanceSaved(true);
    setTimeout(() => setAppearanceSaved(false), 2500);
  };

  // =========================
  // THEME COLORS
  // =========================
  const theme = {
    pageBg: darkMode ? "#0f172a" : "#f1f5f9",
    card: darkMode ? "#1e293b" : "#ffffff",
    cardBorder: darkMode ? "#334155" : "#e5e7eb",
    text: darkMode ? "#f1f5f9" : "#111827",
    textMuted: darkMode ? "#94a3b8" : "#6b7280",
    textLabel: darkMode ? "#cbd5e1" : "#374151",
    inputBg: darkMode ? "#0f172a" : "#ffffff",
    inputBorder: darkMode ? "#475569" : "#d1d5db",
    inputText: darkMode ? "#f1f5f9" : "#111827",
    inputDisabledBg: darkMode ? "#1e293b" : "#f3f4f6",
    divider: darkMode ? "#334155" : "#e5e7eb",
    rowBg: darkMode ? "#0f172a" : "#f9fafb",
    rowBorder: darkMode ? "#334155" : "#e5e7eb",
    tabInactiveBg: darkMode ? "#334155" : "#f3f4f6",
    tabInactiveText: darkMode ? "#f1f5f9" : "#374151",
    tabInactiveHover: darkMode ? "#475569" : "#e5e7eb",
    selectBg: darkMode ? "#0f172a" : "#ffffff",
    eyeIcon: darkMode ? "#94a3b8" : "#6b7280",
  };

  const tabs = [
    { id: "general", name: t.tabs.general, icon: FaCog },
    { id: "database", name: t.tabs.database, icon: FaDatabase },
    { id: "security", name: t.tabs.security, icon: FaShieldAlt },
    { id: "notifications", name: t.tabs.notifications, icon: FaBell },
    { id: "appearance", name: t.tabs.appearance, icon: FaPalette },
    { id: "account", name: t.tabs.account, icon: FaUser },
  ];

  // =========================
  // SAVE ACCOUNT
  // =========================
  const handleSaveAccount = async () => {
    setMessage("");

    if (
      accountForm.newPassword &&
      accountForm.newPassword !== accountForm.confirmPassword
    ) {
      setMessage(t.account.passwordMismatch);
      return;
    }

    try {
      const profileRes = await fetch("/api/auth/update-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: accountForm.name,
          email: accountForm.email,
        }),
      });

      const profileData = await profileRes.json();

      if (!profileRes.ok) {
        setMessage(profileData.error || "Gagal update profil");
        return;
      }

      const oldUser = localStorage.getItem("user");
      if (oldUser) {
        const parsed = JSON.parse(oldUser);
        localStorage.setItem(
          "user",
          JSON.stringify({
            ...parsed,
            name: accountForm.name,
            email: accountForm.email,
          })
        );
      }

      if (accountForm.currentPassword && accountForm.newPassword) {
        const passwordRes = await fetch("/api/auth/change-password", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: accountForm.email,
            currentPassword: accountForm.currentPassword,
            newPassword: accountForm.newPassword,
          }),
        });

        const passwordData = await passwordRes.json();

        if (!passwordRes.ok) {
          setMessage(passwordData.error || "Gagal update password");
          return;
        }
      }

      setMessage(t.account.success);
      window.location.reload();
    } catch (error) {
      setMessage(t.account.error);
    }
  };

  const inputClass = `w-full border rounded-lg px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500`;

  const inputStyle = {
    background: theme.inputBg,
    borderColor: theme.inputBorder,
    color: theme.inputText,
  };

  const ToggleSwitch = ({
    checked,
    onChange,
  }: {
    checked: boolean;
    onChange: () => void;
  }) => (
    <button
      onClick={onChange}
      style={{
        position: "relative",
        width: "48px",
        height: "26px",
        borderRadius: "34px",
        border: "none",
        cursor: "pointer",
        background: checked ? "#2563eb" : "#d1d5db",
        transition: "background 0.3s ease",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: "3px",
          left: checked ? "25px" : "3px",
          width: "20px",
          height: "20px",
          background: "white",
          borderRadius: "50%",
          transition: "left 0.3s ease",
          boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
          display: "block",
        }}
      />
    </button>
  );

  // =========================
  // PASSWORD FIELD COMPONENT
  // =========================
  const PasswordField = ({
    label,
    fieldKey,
  }: {
    label: string;
    fieldKey: "currentPassword" | "newPassword" | "confirmPassword";
  }) => {
    const isVisible = showPasswords[fieldKey];
    return (
      <div>
        <label
          style={{
            display: "block",
            fontSize: "14px",
            fontWeight: 500,
            marginBottom: "8px",
            color: theme.textLabel,
          }}
        >
          {label}
        </label>
        <div style={{ position: "relative" }}>
          <input
            type={isVisible ? "text" : "password"}
            value={accountForm[fieldKey]}
            onChange={(e) =>
              setAccountForm({ ...accountForm, [fieldKey]: e.target.value })
            }
            className={inputClass}
            style={{
              ...inputStyle,
              paddingRight: "44px", // ruang untuk icon
            }}
          />
          <button
            type="button"
            onClick={() => togglePasswordVisibility(fieldKey)}
            style={{
              position: "absolute",
              right: "12px",
              top: "50%",
              transform: "translateY(-50%)",
              background: "none",
              border: "none",
              cursor: "pointer",
              color: theme.eyeIcon,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "4px",
              borderRadius: "4px",
              transition: "color 0.2s ease",
            }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.color = "#2563eb")
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.color =
                theme.eyeIcon)
            }
          >
            {isVisible ? <FaEyeSlash size={16} /> : <FaEye size={16} />}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div
      style={{
        background: theme.pageBg,
        minHeight: "100vh",
        padding: "24px",
        transition: "background 0.3s ease",
        boxSizing: "border-box",
      }}
    >
      {/* HEADER */}
      <div style={{ marginBottom: "24px" }}>
        <h1
          style={{
            fontSize: "28px",
            fontWeight: "bold",
            color: theme.text,
            marginBottom: "6px",
          }}
        >
          {t.pageTitle}
        </h1>
        <p style={{ color: theme.textMuted, fontSize: "14px" }}>
          {t.pageSubtitle}
        </p>
      </div>

      {/* CARD */}
      <div
        style={{
          background: theme.card,
          border: `1px solid ${theme.cardBorder}`,
          borderRadius: "16px",
          overflow: "hidden",
          boxShadow: darkMode
            ? "0 4px 20px rgba(0,0,0,0.4)"
            : "0 2px 12px rgba(0,0,0,0.06)",
          transition: "background 0.3s ease, border-color 0.3s ease",
        }}
      >
        {/* TABS */}
        <div
          style={{
            borderBottom: `1px solid ${theme.divider}`,
            padding: "16px 24px",
            display: "flex",
            flexWrap: "wrap",
            gap: "8px",
          }}
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "8px 16px",
                  borderRadius: "8px",
                  border: "none",
                  cursor: "pointer",
                  background: isActive ? "#2563eb" : theme.tabInactiveBg,
                  color: isActive ? "#ffffff" : theme.tabInactiveText,
                  fontWeight: 500,
                  fontSize: "14px",
                  transition: "background 0.2s ease, color 0.2s ease",
                }}
              >
                <Icon />
                <span>{tab.name}</span>
              </button>
            );
          })}
        </div>

        {/* CONTENT */}
        <div style={{ padding: "24px" }}>

          {/* GENERAL */}
          {activeTab === "general" && (
            <div>
              <h3
                style={{
                  fontSize: "20px",
                  fontWeight: "600",
                  marginBottom: "24px",
                  color: theme.text,
                }}
              >
                {t.general.title}
              </h3>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                  gap: "24px",
                }}
              >
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "14px",
                      fontWeight: 500,
                      marginBottom: "8px",
                      color: theme.textLabel,
                    }}
                  >
                    {t.general.systemName}
                  </label>
                  <input
                    type="text"
                    defaultValue="SPMT Pelindo"
                    className={inputClass}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "14px",
                      fontWeight: 500,
                      marginBottom: "8px",
                      color: theme.textLabel,
                    }}
                  >
                    {t.general.systemVersion}
                  </label>
                  <input
                    type="text"
                    value="1.0.0"
                    disabled
                    className={inputClass}
                    style={{
                      ...inputStyle,
                      background: theme.inputDisabledBg,
                      color: theme.textMuted,
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* DATABASE */}
          {activeTab === "database" && (
            <div>
              <h3
                style={{
                  fontSize: "20px",
                  fontWeight: "600",
                  marginBottom: "24px",
                  color: theme.text,
                }}
              >
                {t.database.title}
              </h3>
              <div
                style={{
                  background: darkMode ? "#1e3a5f" : "#eff6ff",
                  border: `1px solid ${darkMode ? "#2563eb" : "#bfdbfe"}`,
                  borderRadius: "12px",
                  padding: "20px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "16px",
                }}
              >
                <FaDatabase
                  style={{ color: "#2563eb", fontSize: "24px", marginTop: "2px" }}
                />
                <div>
                  <h4
                    style={{
                      fontWeight: 600,
                      color: darkMode ? "#93c5fd" : "#1e40af",
                      marginBottom: "6px",
                    }}
                  >
                    {t.database.status}
                  </h4>
                  <p
                    style={{
                      color: darkMode ? "#7dd3fc" : "#1d4ed8",
                      fontSize: "14px",
                      marginBottom: "6px",
                    }}
                  >
                    {t.database.connected}
                  </p>
                  <p
                    style={{
                      color: darkMode ? "#60a5fa" : "#2563eb",
                      fontSize: "13px",
                    }}
                  >
                    {t.database.tables}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* SECURITY */}
          {activeTab === "security" && (
            <div>
              <h3
                style={{
                  fontSize: "20px",
                  fontWeight: "600",
                  marginBottom: "24px",
                  color: theme.text,
                }}
              >
                {t.security.title}
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {[
                  {
                    label: t.security.twoFactor,
                    desc: t.security.twoFactorDesc,
                    active: false,
                  },
                  {
                    label: t.security.activityLog,
                    desc: t.security.activityLogDesc,
                    active: true,
                  },
                ].map((item, i) => (
                  <div
                    key={i}
                    style={{
                      border: `1px solid ${theme.rowBorder}`,
                      borderRadius: "10px",
                      padding: "18px 20px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      background: theme.rowBg,
                    }}
                  >
                    <div>
                      <h4
                        style={{
                          fontWeight: 500,
                          color: theme.text,
                          marginBottom: "4px",
                        }}
                      >
                        {item.label}
                      </h4>
                      <p style={{ fontSize: "13px", color: theme.textMuted }}>
                        {item.desc}
                      </p>
                    </div>
                    <div
                      style={{
                        width: "48px",
                        height: "26px",
                        borderRadius: "34px",
                        background: item.active ? "#2563eb" : "#d1d5db",
                        position: "relative",
                        flexShrink: 0,
                      }}
                    >
                      <span
                        style={{
                          position: "absolute",
                          top: "3px",
                          left: item.active ? "25px" : "3px",
                          width: "20px",
                          height: "20px",
                          background: "white",
                          borderRadius: "50%",
                          boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
                          display: "block",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* NOTIFICATIONS */}
          {activeTab === "notifications" && (
            <div>
              <h3
                style={{
                  fontSize: "20px",
                  fontWeight: "600",
                  marginBottom: "24px",
                  color: theme.text,
                }}
              >
                {t.notifications.title}
              </h3>
              <div
                style={{
                  border: `1px solid ${theme.rowBorder}`,
                  borderRadius: "10px",
                  padding: "18px 20px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: theme.rowBg,
                }}
              >
                <div>
                  <h4
                    style={{
                      fontWeight: 500,
                      color: theme.text,
                      marginBottom: "4px",
                    }}
                  >
                    {t.notifications.email}
                  </h4>
                  <p style={{ fontSize: "13px", color: theme.textMuted }}>
                    {t.notifications.emailDesc}
                  </p>
                </div>
                <div
                  style={{
                    width: "48px",
                    height: "26px",
                    borderRadius: "34px",
                    background: "#2563eb",
                    position: "relative",
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      top: "3px",
                      left: "25px",
                      width: "20px",
                      height: "20px",
                      background: "white",
                      borderRadius: "50%",
                      boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
                      display: "block",
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* APPEARANCE */}
          {activeTab === "appearance" && (
            <div>
              <h3
                style={{
                  fontSize: "20px",
                  fontWeight: "600",
                  marginBottom: "24px",
                  color: theme.text,
                }}
              >
                {t.appearance.title}
              </h3>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                  gap: "24px",
                  marginBottom: "28px",
                }}
              >
                {/* TEMA */}
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "14px",
                      fontWeight: 500,
                      marginBottom: "8px",
                      color: theme.textLabel,
                    }}
                  >
                    {t.appearance.theme}
                  </label>
                  <select
                    value={darkMode ? "dark" : "light"}
                    onChange={(e) => setDarkMode(e.target.value === "dark")}
                    style={{
                      width: "100%",
                      border: `1px solid ${theme.inputBorder}`,
                      borderRadius: "8px",
                      padding: "12px 16px",
                      background: theme.selectBg,
                      color: theme.inputText,
                      fontSize: "14px",
                      cursor: "pointer",
                      outline: "none",
                    }}
                  >
                    <option value="light">{t.appearance.light}</option>
                    <option value="dark">{t.appearance.dark}</option>
                  </select>
                </div>

                {/* BAHASA */}
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "14px",
                      fontWeight: 500,
                      marginBottom: "8px",
                      color: theme.textLabel,
                    }}
                  >
                    {t.appearance.language}
                  </label>
                  <select
                    value={language}
                    onChange={(e) =>
                      setLanguage(e.target.value as "id" | "en")
                    }
                    style={{
                      width: "100%",
                      border: `1px solid ${theme.inputBorder}`,
                      borderRadius: "8px",
                      padding: "12px 16px",
                      background: theme.selectBg,
                      color: theme.inputText,
                      fontSize: "14px",
                      cursor: "pointer",
                      outline: "none",
                    }}
                  >
                    <option value="id">Indonesia</option>
                    <option value="en">English</option>
                  </select>
                </div>
              </div>

              {/* PREVIEW */}
              <div
                style={{
                  background: darkMode ? "#0f172a" : "#f8fafc",
                  border: `1px solid ${theme.inputBorder}`,
                  borderRadius: "10px",
                  padding: "16px 20px",
                  marginBottom: "20px",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                <span style={{ fontSize: "20px" }}>
                  {darkMode ? "🌙" : "☀️"}
                </span>
                <div>
                  <p
                    style={{
                      fontSize: "13px",
                      fontWeight: 500,
                      color: theme.text,
                      marginBottom: "2px",
                    }}
                  >
                    {darkMode
                      ? language === "id"
                        ? "Mode Gelap Aktif"
                        : "Dark Mode Active"
                      : language === "id"
                      ? "Mode Terang Aktif"
                      : "Light Mode Active"}
                  </p>
                  <p style={{ fontSize: "12px", color: theme.textMuted }}>
                    {language === "id"
                      ? "Klik Simpan untuk menerapkan perubahan"
                      : "Click Save to apply changes"}
                  </p>
                </div>
              </div>

              {/* SAVE BUTTON */}
              <button
                onClick={handleSaveAppearance}
                style={{
                  background: "#2563eb",
                  color: "white",
                  border: "none",
                  padding: "12px 24px",
                  borderRadius: "10px",
                  fontWeight: 600,
                  fontSize: "14px",
                  cursor: "pointer",
                  boxShadow: "0 4px 10px rgba(37,99,235,0.3)",
                  transition: "background 0.2s ease",
                }}
              >
                {language === "id" ? "Simpan Tampilan" : "Save Appearance"}
              </button>

              {/* SUCCESS MESSAGE */}
              {appearanceSaved && (
                <div
                  style={{
                    marginTop: "14px",
                    padding: "12px 16px",
                    borderRadius: "8px",
                    background: darkMode ? "#14532d" : "#dcfce7",
                    color: darkMode ? "#86efac" : "#166534",
                    fontSize: "14px",
                    fontWeight: 500,
                  }}
                >
                  ✓ {t.appearance.saved}
                </div>
              )}
            </div>
          )}

          {/* ACCOUNT */}
          {activeTab === "account" && (
            <div>
              <h3
                style={{
                  fontSize: "20px",
                  fontWeight: "600",
                  marginBottom: "24px",
                  color: theme.text,
                }}
              >
                {t.account.title}
              </h3>

              <div
                style={{
                  display: "grid",
                  gap: "18px",
                  maxWidth: "10000px",
                }}
              >
                {/* NAME */}
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "14px",
                      fontWeight: 500,
                      marginBottom: "8px",
                      color: theme.textLabel,
                    }}
                  >
                    {t.account.fullName}
                  </label>
                  <input
                    type="text"
                    value={accountForm.name}
                    onChange={(e) =>
                      setAccountForm({ ...accountForm, name: e.target.value })
                    }
                    className={inputClass}
                    style={inputStyle}
                  />
                </div>

                {/* EMAIL */}
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "14px",
                      fontWeight: 500,
                      marginBottom: "8px",
                      color: theme.textLabel,
                    }}
                  >
                    {t.account.email}
                  </label>
                  <input
                    type="email"
                    value={accountForm.email}
                    onChange={(e) =>
                      setAccountForm({ ...accountForm, email: e.target.value })
                    }
                    className={inputClass}
                    style={inputStyle}
                  />
                </div>

                {/* PASSWORD FIELDS — pakai PasswordField component */}
                <PasswordField
                  label={t.account.oldPassword}
                  fieldKey="currentPassword"
                />
                <PasswordField
                  label={t.account.newPassword}
                  fieldKey="newPassword"
                />
                <PasswordField
                  label={t.account.confirmPassword}
                  fieldKey="confirmPassword"
                />

                <button
                  onClick={handleSaveAccount}
                  style={{
                    background: "#2563eb",
                    color: "white",
                    border: "none",
                    padding: "14px",
                    borderRadius: "10px",
                    fontWeight: 600,
                    fontSize: "15px",
                    cursor: "pointer",
                    boxShadow: "0 4px 10px rgba(37,99,235,0.3)",
                  }}
                >
                  {t.account.save}
                </button>

                {message && (
                  <div
                    style={{
                      padding: "12px 16px",
                      borderRadius: "8px",
                      background:
                        message === t.account.success
                          ? darkMode
                            ? "#14532d"
                            : "#dcfce7"
                          : darkMode
                          ? "#7f1d1d"
                          : "#fee2e2",
                      color:
                        message === t.account.success
                          ? darkMode
                            ? "#86efac"
                            : "#166534"
                          : darkMode
                          ? "#fca5a5"
                          : "#991b1b",
                      fontSize: "14px",
                    }}
                  >
                    {message}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}