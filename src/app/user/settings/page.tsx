"use client";

import { useState, useEffect } from "react";

// =============================================
// PasswordInput WAJIB di luar SettingsPage
// Supaya tidak di-remount setiap ketik huruf
// =============================================
const PasswordInput = ({
  label,
  value,
  onChange,
  placeholder,
  showKey,
  showPassword,
  setShowPassword,
  theme,
  inputStyle,
  labelStyle,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
  showKey: "current" | "new" | "confirm";
  showPassword: { current: boolean; new: boolean; confirm: boolean };
  setShowPassword: React.Dispatch<
    React.SetStateAction<{ current: boolean; new: boolean; confirm: boolean }>
  >;
  theme: Record<string, string>;
  inputStyle: React.CSSProperties;
  labelStyle: React.CSSProperties;
}) => {
  const isVisible = showPassword[showKey];

  return (
    <div style={{ marginBottom: "18px" }}>
      <label style={labelStyle}>{label}</label>
      <div style={{ position: "relative" }}>
        <input
          type={isVisible ? "text" : "password"}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ ...inputStyle, paddingRight: "48px" }}
          required
        />
        {/* Tombol icon mata */}
        <button
          type="button"
          onClick={() =>
            setShowPassword((prev) => ({ ...prev, [showKey]: !prev[showKey] }))
          }
          style={{
            position: "absolute",
            right: "14px",
            top: "50%",
            transform: "translateY(-50%)",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "0",
            color: theme.iconColor,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          tabIndex={-1}
          aria-label={isVisible ? "Sembunyikan password" : "Tampilkan password"}
        >
          {isVisible ? (
            // Icon mata dicoret = password sedang terlihat, klik untuk sembunyikan
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
              <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </svg>
          ) : (
            // Icon mata terbuka = password tersembunyi, klik untuk tampilkan
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
};

// =============================================
// MAIN COMPONENT
// =============================================
export default function SettingsPage() {
  const [tab, setTab] = useState("profile");

  // PROFILE FORM
  const [profileForm, setProfileForm] = useState({ name: "", email: "" });
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileMessage, setProfileMessage] = useState({ type: "", text: "" });

  // PASSWORD FORM
  const [passwordForm, setPasswordForm] = useState({
    email: "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  // SHOW/HIDE PASSWORD STATE
  const [showPassword, setShowPassword] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  const [loading, setLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [emailNotif, setEmailNotif] = useState(true);
  const [message, setMessage] = useState({ type: "", text: "" });

  // LOAD PREFERENCES
  useEffect(() => {
    const savedDark = localStorage.getItem("darkMode");
    const savedNotif = localStorage.getItem("emailNotif");
    if (savedDark === "true") setDarkMode(true);
    if (savedNotif === "false") setEmailNotif(false);
  }, []);

  // APPLY DARK MODE ke <html>
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

  // THEME COLORS
  const theme = {
    bg: darkMode ? "#0f172a" : "#f1f5f9",
    card: darkMode ? "#1e293b" : "#ffffff",
    cardBorder: darkMode ? "#334155" : "transparent",
    text: darkMode ? "#f1f5f9" : "#111827",
    textMuted: darkMode ? "#94a3b8" : "#6b7280",
    textLabel: darkMode ? "#cbd5e1" : "#374151",
    inputBg: darkMode ? "#0f172a" : "#ffffff",
    inputBorder: darkMode ? "#475569" : "#d1d5db",
    inputText: darkMode ? "#f1f5f9" : "#111827",
    inputDisabledBg: darkMode ? "#1e293b" : "#f3f4f6",
    inputDisabledText: darkMode ? "#64748b" : "#6b7280",
    tabActiveBg: "#2563eb",
    tabActiveText: "#ffffff",
    tabInactiveBg: darkMode ? "#334155" : "#e5e7eb",
    tabInactiveText: darkMode ? "#f1f5f9" : "#111827",
    divider: darkMode ? "#334155" : "#e5e7eb",
    headingH3: darkMode ? "#f8fafc" : "#111827",
    tableHead: darkMode ? "#334155" : "#f9fafb",
    tableText: darkMode ? "#cbd5e1" : "#374151",
    tableBorder: darkMode ? "#475569" : "#e5e7eb",
    apiInputBg: darkMode ? "#0f172a" : "#f9fafb",
    iconColor: darkMode ? "#94a3b8" : "#6b7280",
  };

  const tabs = [
    { id: "profile", label: "Profile" },
    { id: "security", label: "Security" },
    { id: "preferences", label: "Preferences" },
    { id: "activity", label: "Activity Log" },
    { id: "api", label: "API Key" },
  ];

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "14px",
    borderRadius: "10px",
    border: `1px solid ${theme.inputBorder}`,
    fontSize: "15px",
    background: theme.inputBg,
    color: theme.inputText,
    outline: "none",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    marginBottom: "8px",
    fontWeight: 500,
    color: theme.textLabel,
  };

  const cardStyle: React.CSSProperties = {
    background: theme.card,
    border: `1px solid ${theme.cardBorder}`,
    padding: "30px",
    borderRadius: "16px",
    boxShadow: darkMode
      ? "0 2px 12px rgba(0,0,0,0.4)"
      : "0 2px 12px rgba(0,0,0,0.08)",
    width: "100%",
    boxSizing: "border-box",
  };

  const primaryBtn: React.CSSProperties = {
    background: "#2563eb",
    color: "white",
    border: "none",
    padding: "14px 24px",
    borderRadius: "10px",
    fontWeight: "bold",
    cursor: "pointer",
    fontSize: "15px",
    boxShadow: "0 4px 10px rgba(37,99,235,0.3)",
  };

  // UPDATE PROFILE
  const handleUpdateProfile = async () => {
    setProfileLoading(true);
    setProfileMessage({ type: "", text: "" });

    try {
      const res = await fetch("/api/auth/update-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profileForm),
      });

      const data = await res.json();

      if (!res.ok) {
        setProfileMessage({ type: "error", text: data.error || "Gagal update profile" });
        return;
      }

      const oldUser = localStorage.getItem("user");
      if (oldUser) {
        const parsedUser = JSON.parse(oldUser);
        const updatedUser = { ...parsedUser, name: profileForm.name, email: profileForm.email };
        localStorage.setItem("user", JSON.stringify(updatedUser));
        window.location.reload();
      }

      setProfileMessage({ type: "success", text: "Profil berhasil diperbarui" });
    } catch {
      setProfileMessage({ type: "error", text: "Terjadi kesalahan server" });
    } finally {
      setProfileLoading(false);
    }
  };

  // CHANGE PASSWORD
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: "", text: "" });

    try {
      const res = await fetch("/api/auth/change-password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(passwordForm),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "Gagal mengubah password" });
        return;
      }

      setMessage({ type: "success", text: "Password berhasil diubah" });
      setPasswordForm({ email: "", currentPassword: "", newPassword: "", confirmPassword: "" });
      setShowPassword({ current: false, new: false, confirm: false });
    } catch {
      setMessage({ type: "error", text: "Terjadi kesalahan server" });
    } finally {
      setLoading(false);
    }
  };

  // DARK MODE TOGGLE
  const handleDarkModeToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.checked;
    setDarkMode(value);
    localStorage.setItem("darkMode", String(value));
  };

  return (
    <div
      style={{
        padding: "25px",
        minHeight: "100vh",
        background: theme.bg,
        transition: "background 0.3s ease, color 0.3s ease",
        boxSizing: "border-box",
      }}
    >
      <h2 style={{ fontSize: "30px", fontWeight: "bold", marginBottom: "25px", color: theme.text }}>
        Pengaturan Akun
      </h2>

      {/* TAB MENU */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "25px", flexWrap: "wrap" }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: "10px 18px",
              borderRadius: "10px",
              border: "none",
              cursor: "pointer",
              background: tab === t.id ? theme.tabActiveBg : theme.tabInactiveBg,
              color: tab === t.id ? theme.tabActiveText : theme.tabInactiveText,
              fontWeight: 500,
              transition: "background 0.2s ease, color 0.2s ease",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* PROFILE */}
      {tab === "profile" && (
        <div style={cardStyle}>
          <h3 style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "25px", color: theme.headingH3 }}>
            Profil User
          </h3>

          <div style={{ display: "flex", alignItems: "center", gap: "20px", marginBottom: "30px", flexWrap: "wrap" }}>
            <div
              style={{
                width: "100px", height: "100px", borderRadius: "50%",
                background: "#2563eb", color: "white",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "36px", fontWeight: "bold", flexShrink: 0,
              }}
            >
              M
            </div>
            <div>
              <p style={{ marginBottom: "10px", color: theme.textLabel, fontWeight: 500 }}>Foto Profil</p>
              <input type="file" style={{ color: theme.text }} />
              <p style={{ fontSize: "13px", color: theme.textMuted, marginTop: "8px" }}>JPG, PNG maksimal 2MB</p>
            </div>
          </div>

          <div style={{ marginBottom: "20px" }}>
            <label style={labelStyle}>Nama Lengkap</label>
            <input
              type="text"
              placeholder="Masukkan nama lengkap"
              value={profileForm.name}
              onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: "20px" }}>
            <label style={labelStyle}>Email</label>
            <input
              type="email"
              value={profileForm.email}
              onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
              style={{ ...inputStyle, background: theme.inputDisabledBg, color: theme.inputDisabledText }}
            />
          </div>

          <button onClick={handleUpdateProfile} disabled={profileLoading} style={primaryBtn}>
            {profileLoading ? "Menyimpan..." : "Simpan Perubahan"}
          </button>

          {profileMessage.text && (
            <div
              style={{
                marginTop: "15px", padding: "12px", borderRadius: "8px",
                background: profileMessage.type === "success" ? "#dcfce7" : "#fee2e2",
                color: profileMessage.type === "success" ? "#166534" : "#991b1b",
              }}
            >
              {profileMessage.text}
            </div>
          )}
        </div>
      )}

      {/* SECURITY */}
      {tab === "security" && (
        <div style={cardStyle}>
          <h3 style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "25px", color: theme.headingH3 }}>
            Keamanan Akun
          </h3>

          <form onSubmit={handleChangePassword}>
            {/* EMAIL */}
            <div style={{ marginBottom: "18px" }}>
              <label style={labelStyle}>Email</label>
              <input
                type="email"
                placeholder="Masukkan email akun"
                value={passwordForm.email}
                onChange={(e) => setPasswordForm({ ...passwordForm, email: e.target.value })}
                style={inputStyle}
                required
              />
            </div>

            {/* PASSWORD LAMA */}
            <PasswordInput
              label="Password Lama"
              value={passwordForm.currentPassword}
              onChange={(val) => setPasswordForm({ ...passwordForm, currentPassword: val })}
              placeholder="Masukkan password lama"
              showKey="current"
              showPassword={showPassword}
              setShowPassword={setShowPassword}
              theme={theme}
              inputStyle={inputStyle}
              labelStyle={labelStyle}
            />

            {/* PASSWORD BARU */}
            <PasswordInput
              label="Password Baru"
              value={passwordForm.newPassword}
              onChange={(val) => setPasswordForm({ ...passwordForm, newPassword: val })}
              placeholder="Masukkan password baru"
              showKey="new"
              showPassword={showPassword}
              setShowPassword={setShowPassword}
              theme={theme}
              inputStyle={inputStyle}
              labelStyle={labelStyle}
            />

            {/* KONFIRMASI PASSWORD BARU */}
            <PasswordInput
              label="Konfirmasi Password Baru"
              value={passwordForm.confirmPassword}
              onChange={(val) => setPasswordForm({ ...passwordForm, confirmPassword: val })}
              placeholder="Ulangi password baru"
              showKey="confirm"
              showPassword={showPassword}
              setShowPassword={setShowPassword}
              theme={theme}
              inputStyle={inputStyle}
              labelStyle={labelStyle}
            />

            {/* MESSAGE */}
            {message.text && (
              <div
                style={{
                  marginBottom: "18px", padding: "12px", borderRadius: "8px",
                  background: message.type === "success" ? "#dcfce7" : "#fee2e2",
                  color: message.type === "success" ? "#166534" : "#991b1b",
                }}
              >
                {message.text}
              </div>
            )}

            <button type="submit" disabled={loading} style={primaryBtn}>
              {loading ? "Menyimpan..." : "Update Password"}
            </button>
          </form>
        </div>
      )}

      {/* PREFERENCES */}
      {tab === "preferences" && (
        <div style={cardStyle}>
          <h3 style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "25px", color: theme.headingH3 }}>
            Preferences
          </h3>

          {/* DARK MODE */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 0", borderBottom: `1px solid ${theme.divider}` }}>
            <div>
              <h4 style={{ marginBottom: "5px", color: theme.text }}>Dark Mode</h4>
              <p style={{ color: theme.textMuted, fontSize: "14px" }}>Aktifkan tema gelap</p>
            </div>
            <label style={{ position: "relative", display: "inline-block", width: "48px", height: "26px", cursor: "pointer", flexShrink: 0 }}>
              <input type="checkbox" checked={darkMode} onChange={handleDarkModeToggle} style={{ opacity: 0, width: 0, height: 0 }} />
              <span style={{ position: "absolute", inset: 0, background: darkMode ? "#2563eb" : "#d1d5db", borderRadius: "34px", transition: "background 0.3s ease" }} />
              <span style={{ position: "absolute", top: "3px", left: darkMode ? "25px" : "3px", width: "20px", height: "20px", background: "white", borderRadius: "50%", transition: "left 0.3s ease", boxShadow: "0 1px 4px rgba(0,0,0,0.2)" }} />
            </label>
          </div>

          {/* EMAIL NOTIFICATION */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 0" }}>
            <div>
              <h4 style={{ marginBottom: "5px", color: theme.text }}>Email Notification</h4>
              <p style={{ color: theme.textMuted, fontSize: "14px" }}>Terima notifikasi email</p>
            </div>
            <label style={{ position: "relative", display: "inline-block", width: "48px", height: "26px", cursor: "pointer", flexShrink: 0 }}>
              <input
                type="checkbox"
                checked={emailNotif}
                onChange={(e) => {
                  const value = e.target.checked;
                  setEmailNotif(value);
                  localStorage.setItem("emailNotif", String(value));
                }}
                style={{ opacity: 0, width: 0, height: 0 }}
              />
              <span style={{ position: "absolute", inset: 0, background: emailNotif ? "#2563eb" : "#d1d5db", borderRadius: "34px", transition: "background 0.3s ease" }} />
              <span style={{ position: "absolute", top: "3px", left: emailNotif ? "25px" : "3px", width: "20px", height: "20px", background: "white", borderRadius: "50%", transition: "left 0.3s ease", boxShadow: "0 1px 4px rgba(0,0,0,0.2)" }} />
            </label>
          </div>
        </div>
      )}

      {/* ACTIVITY */}
      {tab === "activity" && (
        <div style={cardStyle}>
          <h3 style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "20px", color: theme.headingH3 }}>
            Activity Log
          </h3>
          <table style={{ width: "100%", marginTop: "15px", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: theme.tableHead }}>
                {["Waktu", "Aktivitas", "IP"].map((h) => (
                  <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, color: theme.textLabel, borderBottom: `1px solid ${theme.tableBorder}`, fontSize: "14px" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {["2025-03-16", "Login Dashboard", "192.168.1.10"].map((cell, i) => (
                  <td key={i} style={{ padding: "12px 16px", color: theme.tableText, borderBottom: `1px solid ${theme.tableBorder}`, fontSize: "14px" }}>
                    {cell}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* API */}
      {tab === "api" && (
        <div style={cardStyle}>
          <h3 style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "20px", color: theme.headingH3 }}>
            API Key
          </h3>
          <input
            type="text"
            value="sk_test_123456789"
            readOnly
            style={{ ...inputStyle, background: theme.apiInputBg, color: theme.textMuted, fontFamily: "monospace", letterSpacing: "0.05em" }}
          />
          <button style={{ ...primaryBtn, marginTop: "15px", display: "block" }}>
            Generate API Key
          </button>
        </div>
      )}
    </div>
  );
}