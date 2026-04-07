"use client";

import { useState, useEffect, memo } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FaChevronDown, FaChevronRight } from "react-icons/fa";
import Image from "next/image";
import {
  LayoutDashboard,
  FolderKanban,
  Table2,
  Database,
  BarChart3,
  FileChartColumn,
  Upload,
  FileUp,
  FileSpreadsheet,
  CloudUpload,
  Network,
  Workflow,
  Server,
  Users,
  Settings,
  Layers,
  Share2,
  GitBranch,
  LogOut,
} from "lucide-react";

const navigation = [
  {
    name: "Dashboard",
    href: "/admin",
    icon: LayoutDashboard,
    description: "Lihat dashboard utama",
  },
  {
    name: "Data",
    icon: FolderKanban,
    description: "Kelola data per divisi",
    subItems: [
      {
        name: "Data SPMT",
        href: "/admin/regional",
        icon: Table2,
        description: "Lihat data per daerah SPMT",
      },
      {
        name: "Data PTP",
        href: "/admin/ptp",
        icon: Database,
        description: "Lihat data PTP per daerah",
      },
      {
        name: "Data IKT",
        href: "/admin/ikt",
        icon: BarChart3,
        description: "Lihat data IKT per daerah",
      },
      {
        name: "Data TCU",
        href: "/admin/tcu",
        icon: FileChartColumn,
        description: "Lihat data TCU per daerah",
      },
    ],
  },
  {
    name: "Upload Data",
    icon: Upload,
    description: "Upload file Excel/CSV untuk data",
    subItems: [
      {
        name: "Upload Data SPMT",
        href: "/admin/upload-data",
        icon: FileUp,
        description: "Upload file Excel/CSV untuk data SPMT",
      },
      {
        name: "Upload Data PTP",
        href: "/admin/upload-ptp-data",
        icon: FileSpreadsheet,
        description: "Upload file Excel/CSV untuk data PTP",
      },
      {
        name: "Upload Data IKT",
        href: "/admin/upload-ikt-data",
        icon: Upload,
        description: "Upload file Excel/CSV untuk data IKT",
      },
      {
        name: "Upload Data TCU",
        href: "/admin/upload-tcu-data",
        icon: FileUp,
        description: "Upload file Excel/CSV untuk data TCU",
      },
      {
      name: "Upload Data Mentah",
      href: "/admin/upload-raw-data",
      icon: CloudUpload,
      description: "Upload data mentah otomatis (multi sheet → auto proses)",
    }

    ],
  },
  {
    name: "Realisasi BOPO dll",
    icon: BarChart3,
    description: "Lihat data BOPO dan lainnya",

    subItems: [
      {
        name: "Upload BOPO SPMT",
        href: "/admin/upload-bopo-spmt",
        icon: FileUp,
        description: "Upload file Excel/CSV untuk BOPO SPMT",
      },
      {
        name: "Upload BOPO PTP",
        href: "/admin/upload-bopo-ptp",
        icon: FileSpreadsheet,
        description: "Upload file Excel/CSV untuk BOPO PTP",
      },
      {
        name: "Upload BOPO IKT",
        href: "/admin/upload-bopo-ikt",
        icon: CloudUpload,
        description: "Upload file Excel/CSV untuk BOPO IKT",
      },
      {
        name: "Upload BOPO TCU",
        href: "/admin/upload-bopo-tcu",
        icon: FileUp,
        description: "Upload file Excel/CSV untuk BOPO TCU",
      },
    ],
  },
  {
    name: "Upload Struktur Organisasi",
    icon: Network,
    description: "Upload struktur organisasi",
    subItems: [
      {
        name: "Upload Struktur Organisasi SPMT",
        href: "/admin/struktur-organisasi",
        icon: Workflow,
        description: "Upload struktur organisasi SPMT",
      },
      {
        name: "Upload Struktur Organisasi PTP",
        href: "/admin/ptp-struktur-organisasi",
        icon: Layers,
        description: "Upload struktur organisasi PTP",
      },
      {
        name: "Upload Struktur Organisasi IKT",
        href: "/admin/ikt-struktur-organisasi",
        icon: Layers,
        description: "Upload struktur organisasi IKT",
      },
      {
        name: "Upload Struktur Organisasi TCU",
        href: "/admin/tcu-struktur-organisasi",
        icon: Layers,
        description: "Upload struktur organisasi TCU",
      },
    ],
  },
  {
    name: "Lihat Struktur Organisasi",
    icon: FileChartColumn,
    description: "Lihat struktur organisasi berdasarkan periode dan daerah",
    subItems: [
      {
        name: "Lihat Struktur SPMT",
        href: "/admin/view-struktur-organisasi-spmt",
        icon: Table2,
        description: "Lihat struktur organisasi SPMT",
      },
      {
        name: "Lihat Struktur PTP",
        href: "/admin/view-struktur-organisasi-ptp",
        icon: Database,
        description: "Lihat struktur organisasi PTP",
      },
      {
        name: "Lihat Struktur IKT",
        href: "/admin/view-struktur-organisasi-ikt",
        icon: Database,
        description: "Lihat struktur organisasi IKT",
      },
      {
        name: "Lihat Struktur TCU",
        href: "/admin/view-struktur-organisasi-tcu",
        icon: Database,
        description: "Lihat struktur organisasi TCU",
      },
    ],
  },
  {
    name: "Storage",
    href: "/admin/storage",
    icon: Server,
    description: "Manajemen penyimpanan data",
  },
  {
    name: "Kelola Akun",
    href: "/admin/users",
    icon: Users,
    description: "Kelola pengguna sistem",
  },
  {
    name: "Pengaturan",
    href: "/admin/settings",
    icon: Settings,
    description: "Konfigurasi sistem",
  },
];

function AdminSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>(["Data"]);
  const [role, setRole] = useState<string>("user");
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    // load role from localStorage
    try {
      const raw = localStorage.getItem("user");
      if (raw) {
        const u = JSON.parse(raw);
        if (u?.role) setRole(u.role as string);
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      const hrefs = new Set<string>();
      navigation.forEach((item) => {
        if (item.href) hrefs.add(item.href);
        if (item.subItems) {
          item.subItems.forEach((si: any) => {
            if (si.href) hrefs.add(si.href);
          });
        }
      });
      hrefs.forEach((href) => router.prefetch(href));
    } catch {}
  }, [router]);

  const toggleExpanded = (itemName: string) => {
    setExpandedItems((prev) =>
      prev.includes(itemName)
        ? prev.filter((name) => name !== itemName)
        : [...prev, itemName]
    );
  };

  const handleLogout = () => {
    router.push("/login");
  };

  const isSubItemActive = (subItems: any[]) =>
    subItems.some((subItem) => pathname === subItem.href);

  return (
    <div
      className={`relative text-white transition-[width] duration-200 flex flex-col bg-gradient-to-b from-slate-900 via-blue-900 to-blue-700 sticky top-0 h-screen overflow-y-auto ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      {/* Background image at bottom */}
      <div className="absolute bottom-0 left-0 w-full h-40 pointer-events-none opacity-25">
        <Image
          src="/foter.png"
          alt="Pelindo background"
          fill
          className="object-cover"
          priority
        />
      </div>

      {/* Sidebar content */}
      <div className="relative z-10 flex flex-col h-full">
        {/* Header */}
        <div className="p-4 border-b border-blue-800/60 flex items-center justify-between">
          {!collapsed && (
            <h2 className="text-lg font-bold tracking-wide">Admin Panel</h2>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-2 rounded-md hover:bg-blue-700/60 transition-colors"
          >
            {collapsed ? "➡" : "⬅"}
          </button>
        </div>

        {/* Navigation */}
        <nav className="mt-4 flex-1 overflow-y-auto px-1">
          <ul className="space-y-1">
            {(() => {
              // derive visible navigation per role
              const isSuperAdmin = role === "superadmin";
              const isAdminPembelajaran = role === "admin_pembelajaran";
              // hide specific menus depending on role
              const filtered = navigation.filter((it) => {
                // Kelola Akun hanya untuk superadmin
                if (it.name === "Kelola Akun" && !isSuperAdmin) return false;
                // Batasi akses admin_pembelajaran
                if (isAdminPembelajaran) {
                  // Sembunyikan menu yang tidak boleh diakses
                  if (
                    it.name === "Upload Data" ||
                    it.name === "Realisasi BOPO dll" ||
                    it.name === "Upload Struktur Organisasi" ||
                    it.name === "Storage"
                  ) {
                    return false;
                  }
                }
                return true;
              });
              return filtered;
            })().map((item) => {
              const hasSubItems = item.subItems && item.subItems.length > 0;
              const isExpanded = expandedItems.includes(item.name);
              const isActive = item.href ? pathname === item.href : false;
              const hasActiveSubItem = hasSubItems
                ? isSubItemActive(item.subItems)
                : false;

              return (
                <li key={item.name}>
                  {hasSubItems ? (
                    <>
                      <button
                        onClick={() => !collapsed && toggleExpanded(item.name)}
                        className={`group relative w-full flex items-center pl-4 pr-0 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                          hasActiveSubItem
                            ? "bg-blue-600/80 text-white"
                            : "text-blue-100 hover:bg-blue-600/60 hover:text-white"
                        }`}
                      >
                        <item.icon className="h-5 w-5 flex-shrink-0" />
                        {!collapsed && (
                          <>
                            <span className="ml-3 flex-1 text-left">
                              {item.name}
                            </span>
                            {isExpanded ? (
                              <FaChevronDown className="h-4 w-4 mr-3" />
                            ) : (
                              <FaChevronRight className="h-4 w-4 mr-3" />
                            )}
                          </>
                        )}
                      </button>

                      {!collapsed && (
                        <div
                          className={`ml-4 overflow-hidden transition-all duration-300 ${
                            isExpanded
                              ? "max-h-[800px] opacity-100 mt-1"
                              : "max-h-0 opacity-0"
                          }`}
                        >
                          <ul className="space-y-1">
                            {item.subItems.map((subItem) => {
                              const isSubActive = pathname === subItem.href;
                              return (
                                <li key={subItem.name}>
                                  <Link
                                    href={subItem.href}
                                    scroll={false}
                                    className={`flex items-center pl-8 pr-0 py-2 text-sm rounded-lg transition-colors ${
                                      isSubActive
                                        ? "bg-blue-500 text-white"
                                        : "text-blue-100 hover:bg-blue-600/60 hover:text-white"
                                    }`}
                                  >
                                    <subItem.icon className="h-4 w-4 flex-shrink-0" />
                                    <span className="ml-3">{subItem.name}</span>
                                  </Link>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      )}
                    </>
                  ) : (
                    <Link
                      href={item.href!}
                      scroll={false}
                      className={`flex items-center px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                        isActive
                          ? "bg-blue-500 text-white"
                          : "text-blue-100 hover:bg-blue-600/60 hover:text-white"
                      }`}
                    >
                      <item.icon className="h-5 w-5" />
                      {!collapsed && <span className="ml-3">{item.name}</span>}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-blue-700">
          <button
            onClick={handleLogout}
            className={`w-full flex items-center px-4 py-2.5 text-sm font-medium rounded-lg transition-colors text-blue-200 hover:bg-blue-700 ${
              collapsed ? "justify-center" : ""
            }`}
          >
            <LogOut className="h-5 w-5" />
            {!collapsed && <span className="ml-3">Logout</span>}
          </button>
        </div>
      </div>
    </div>
  );
}

export default memo(AdminSidebar);
