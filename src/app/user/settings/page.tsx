"use client";

import { useState } from "react";

export default function SettingsPage() {
  const [tab, setTab] = useState("profile");

  const tabs = [
    { id: "profile", label: "Profile" },
    { id: "security", label: "Security" },
    { id: "preferences", label: "Preferences" },
    { id: "activity", label: "Activity Log" },
    { id: "api", label: "API Key" },
  ];

  return (
    <div style={{ padding: "25px" }}>
      <h2 style={{ fontSize: "22px", fontWeight: "bold", marginBottom: "20px" }}>
        Pengaturan Akun
      </h2>

      {/* TAB MENU */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: "8px 15px",
              borderRadius: "6px",
              border: "none",
              cursor: "pointer",
              background: tab === t.id ? "#2563eb" : "#e5e7eb",
              color: tab === t.id ? "white" : "black",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* PROFILE */}
      {tab === "profile" && (
        <div className="card">
          <h3>Profil User</h3>

          <div style={{ marginTop: "15px" }}>
            <label>Nama</label>
            <input type="text" placeholder="Nama user" className="input" />
          </div>

          <div style={{ marginTop: "15px" }}>
            <label>Email</label>
            <input type="email" placeholder="Email" className="input" />
          </div>

          <div style={{ marginTop: "15px" }}>
            <label>Upload Foto</label>
            <input type="file" />
          </div>
        </div>
      )}

      {/* SECURITY */}
      {tab === "security" && (
        <div className="card">
          <h3>Security</h3>

          <div style={{ marginTop: "15px" }}>
            <label>Password Baru</label>
            <input type="password" className="input" />
          </div>

          <div style={{ marginTop: "15px" }}>
            <label>Konfirmasi Password</label>
            <input type="password" className="input" />
          </div>

          <button className="btn-primary" style={{ marginTop: "15px" }}>
            Update Password
          </button>
        </div>
      )}

      {/* PREFERENCES */}
      {tab === "preferences" && (
        <div className="card">
          <h3>Preferences</h3>

          <div style={{ marginTop: "15px" }}>
            <label>
              <input type="checkbox" /> Dark Mode
            </label>
          </div>

          <div style={{ marginTop: "15px" }}>
            <label>
              <input type="checkbox" /> Email Notification
            </label>
          </div>
        </div>
      )}

      {/* ACTIVITY LOG */}
      {tab === "activity" && (
        <div className="card">
          <h3>Activity Log</h3>

          <table style={{ width: "100%", marginTop: "15px" }}>
            <thead>
              <tr>
                <th>Waktu</th>
                <th>Aktivitas</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>2025-03-16</td>
                <td>Login Dashboard</td>
                <td>192.168.1.10</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* API KEY */}
      {tab === "api" && (
        <div className="card">
          <h3>API Key</h3>

          <input
            type="text"
            value="sk_test_123456789"
            readOnly
            style={{ width: "100%", padding: "8px", marginTop: "10px" }}
          />

          <button className="btn-primary" style={{ marginTop: "15px" }}>
            Generate API Key
          </button>
        </div>
      )}
    </div>
  );
}