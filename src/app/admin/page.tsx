  "use client";

import { useState, useEffect, useRef } from "react";
import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";

ChartJS.register(ArcElement, Tooltip, Legend, ChartDataLabels);

interface TableData {
  npp: string;
  nama: string;
  tanggal_lahir: string;
  jabatan: string;
  entitas: string;
  unit_kerja: string;
  kategori: string;
  jenis_kelamin: string;
  organik_non_organik: string;
  pusat_pelayanan: string;
  non_operasional: string;
  pendidikan?: string;
  bulan: number; // optional if you prefer
  tahun: number; // optional if you prefer
}

interface ChartData {
  organik: number;
  nonOrganik: number;
  operasional: number;
  nonOperasional: number;
  lakiLaki: number;
  perempuan: number;
  organikOperasional: number;
  organikNonOperasional: number;
  nonOrganikOperasional: number;
  nonOrganikNonOperasional: number;
  total: number;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

interface DashboardStats {
  totalEmployees: number;
  tableData: TableData[];
  chartData: ChartData;
  pagination?: PaginationInfo;
}

interface BopoData {
  bopo_ratio: number | null;
  produktivitas_efisiensi: number | null;
  rasio_beban_penghasilan_usaha: number | null;
  month: string | null;
  year: string | null;
}

interface SDMOperasionalData {
  spmt: {
    operasional: number;
    nonOperasional: number;
    total: number;
  };
  ptp: {
    operasional: number;
    nonOperasional: number;
    total: number;
  };
  ikt: {
    operasional: number;
    nonOperasional: number;
    total: number;
  };
  tcu: {
    operasional: number;
    nonOperasional: number;
    total: number;
  };
}

interface RekapSDMData {
  status: string;
  satuan: string;
  realisasiTahunLalu: number;
  revisiRKAP: number | null;
  realisasiBulanSebelumnya: number;
  realisasiBulanIni: number;
  capaianYoY: number | null;
  capaianFY: number | null;
}

interface Period {
  bulan: number | "all";
  tahun: number;
  bulanName: string;
  totalRecords: number;
  label: string;
  value: string;
  type: "month" | "consolidation";
}

export default function AdminDashboard() {
  const [, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [availablePeriods, setAvailablePeriods] = useState<Period[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage] = useState<number>(100);
  const [, setBopo] = useState<BopoData | null>(null);
  const [, setFullTableData] = useState<TableData[]>([]);
  const [role] = useState<string>("user");
  const [sdmOperasional, setSdmOperasional] =
    useState<SDMOperasionalData | null>(null);
  const [rekapSDM, setRekapSDM] = useState<RekapSDMData[]>([]);
  const [loadingRekap, setLoadingRekap] = useState<boolean>(false);
  const [exportingPDF, setExportingPDF] = useState<boolean>(false);
  const dashboardRef = useRef<HTMLDivElement>(null);
  const [editingRKAP, setEditingRKAP] = useState<{ [key: string]: string }>({});
  const [savingRKAP, setSavingRKAP] = useState<boolean>(false);

  useEffect(() => {
    fetchAvailablePeriods();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchSDMOperasionalStats = async (
    month?: string | null,
    year?: string
  ) => {
    try {
      const params = new URLSearchParams();
      if (month) params.append("bulan", month);
      if (year) params.append("tahun", year);

      const response = await fetch(
        `/api/admin/sdm-operasional-stats?${params.toString()}`
      );
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSdmOperasional(data.data);
        }
      }
    } catch (error) {
      console.error("Error fetching SDM operasional stats:", error);
    }
  };

  const fetchRekapSDM = async (month?: string | null, year?: string) => {
    if (!month || !year) {
      setRekapSDM([]);
      return;
    }

    setLoadingRekap(true);
    try {
      const params = new URLSearchParams();
      params.append("bulan", month);
      params.append("tahun", year);

      const response = await fetch(`/api/admin/rekap-sdm?${params.toString()}`);

      if (response.ok) {
        const data = await response.json();

        if (data.success) {
          setRekapSDM(data.data || []);
        } else {
          console.error("[fetchRekapSDM] API returned success=false:", data);
          setRekapSDM([]);
        }
      } else {
        const errorText = await response.text().catch(() => "Unknown error");
        console.error("[fetchRekapSDM] API error:", response.status, errorText);
        setRekapSDM([]);
      }
    } catch (error) {
      console.error("[fetchRekapSDM] Error fetching rekap SDM:", error);
      setRekapSDM([]);
    } finally {
      setLoadingRekap(false);
    }
  };

  const handleRKAPEdit = (status: string, currentValue: number | null) => {
    setEditingRKAP({
      ...editingRKAP,
      [status]: (currentValue ?? 0).toString(),
    });
  };

  const handleRKAPSave = async (status: string) => {
    if (!selectedPeriod) return;

    const bulan = parseInt(selectedPeriod.split("-")[0]);
    const tahun = parseInt(selectedPeriod.split("-")[1]);
    const nilaiStr = editingRKAP[status];

    if (!nilaiStr || nilaiStr.trim() === "") {
      setEditingRKAP({ ...editingRKAP, [status]: "" });
      return;
    }

    const nilai = parseInt(nilaiStr);

    if (isNaN(nilai) || nilai < 0) {
      alert("Nilai harus berupa angka positif");
      return;
    }

    setSavingRKAP(true);

    try {
      // Get current RKAP data for the month and year
      const getResponse = await fetch(
        `/api/admin/rkap-sdm?bulan=${bulan}&tahun=${tahun}`
      );
      const getData = await getResponse.json();

      const currentData = getData.success ? getData.data : {};
      const updatedData = { ...currentData, [status]: nilai };

      // Save updated data
      const saveResponse = await fetch("/api/admin/rkap-sdm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bulan,
          tahun,
          data: updatedData,
        }),
      });

      const saveResult = await saveResponse.json();

      if (saveResult.success) {
        // Remove from editing state
        const newEditing = { ...editingRKAP };
        delete newEditing[status];
        setEditingRKAP(newEditing);

        // Refresh rekap data
        await fetchRekapSDM(bulan.toString(), tahun.toString());
      } else {
        alert(saveResult.error || "Gagal menyimpan nilai RKAP");
      }
    } catch (error) {
      console.error("Error saving RKAP:", error);
      alert("Terjadi kesalahan saat menyimpan nilai RKAP");
    } finally {
      setSavingRKAP(false);
    }
  };

  const handleRKAPCancel = (status: string) => {
    const newEditing = { ...editingRKAP };
    delete newEditing[status];
    setEditingRKAP(newEditing);
  };

  useEffect(() => {
    if (selectedPeriod) {
      setCurrentPage(1); // Reset to first page when period changes
      fetchDashboardData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPeriod]);

  useEffect(() => {
    if (selectedPeriod) {
      fetchDashboardData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

  const fetchAvailablePeriods = async () => {
    try {
      const response = await fetch("/api/admin/combined-available-months");
      const data = await response.json();

      if (data.periods && data.periods.length > 0) {
        setAvailablePeriods(data.periods);
        // Set default to first period (most recent)
        const firstPeriod = data.periods[0].value;
        setSelectedPeriod(firstPeriod);

        // Also fetch SDM operasional stats for the default period
        const [monthPart, yearPart] = firstPeriod.split("-");
        const month = monthPart === "all" ? null : monthPart;
        const year = yearPart;
        fetchSDMOperasionalStats(month, year);
        if (month) {
          fetchRekapSDM(month, year);
        }
      }
    } catch (error) {
      console.error("Error fetching available periods:", error);
    }
  };

  const fetchDashboardData = async () => {
    if (!selectedPeriod) return;

    // Aktifkan loading sebelum mulai fetch
    setLoading(true);

    try {
      // --- Parse period ---
      const [monthPart, yearPart] = selectedPeriod.split("-");
      const month = monthPart === "all" ? null : monthPart;
      const year = yearPart;

      // Validate month and year
      if (!year) {
        console.error("Invalid period format:", selectedPeriod);
        setLoading(false);
        return;
      }

      // Validate month if provided
      if (month) {
        const monthInt = parseInt(month);
        if (isNaN(monthInt) || monthInt < 1 || monthInt > 12) {
          console.error("Invalid month value:", month);
          setLoading(false);
          return;
        }
      }

      // --- Fetch SDM Operasional Stats with period filter ---
      fetchSDMOperasionalStats(month, year);

      // --- Fetch Rekap SDM (hanya jika monthly) ---
      if (month) {
        fetchRekapSDM(month, year);
      } else {
        setRekapSDM([]);
      }

      // --- Fetch larger slice for Pendidikan aggregation ---
      try {
        const bigParams = new URLSearchParams();
        if (month) bigParams.append("month", month);
        bigParams.append("year", year);
        bigParams.append("page", "1");
        bigParams.append("limit", "10000");

        const bigResp = await fetch(
          `/api/admin/combined-table-data?${bigParams.toString()}`
        );
        if (bigResp.ok) {
          const bigJson = await bigResp.json();
          setFullTableData(bigJson.data || []);
        } else {
          setFullTableData([]);
        }
      } catch (err) {
        console.error("Error fetching big table data:", err);
        setFullTableData([]);
      }

      // --- Table params (dengan pagination) ---
      const tableParams = new URLSearchParams();
      if (month) tableParams.append("month", month);
      tableParams.append("year", year);
      tableParams.append("page", currentPage.toString());
      tableParams.append("limit", itemsPerPage.toString());

      // --- Stats params (tanpa pagination) ---
      const statsParams = new URLSearchParams();
      if (month) statsParams.append("month", month);
      statsParams.append("year", year);

      // --- Fetch BOPO (hanya jika monthly) ---
      let bopoData: BopoData | null = null;
      if (month) {
        try {
          const bopoResp = await fetch(
            `/api/admin/combined-bopo-dashboard?${statsParams.toString()}`
          );
          if (bopoResp.ok) {
            const bopoJson = await bopoResp.json();
            if (bopoJson?.success) {
              bopoData = bopoJson.data as BopoData;
            }
          }
        } catch (err) {
          console.error("Error fetching BOPO data:", err);
          bopoData = null;
        }
      }

      // --- Fetch combined table ---
      const tableResp = await fetch(
        `/api/admin/combined-table-data?${tableParams.toString()}`
      );
      const tableJson = await tableResp.json();

      // --- Fetch combined stats ---
      const statsResp = await fetch(
        `/api/admin/combined-dashboard-stats?${statsParams.toString()}`
      );
      const statsJson = await statsResp.json();

      // --- Update state ---
      if (tableJson.success && statsJson.success) {
        setStats({
          totalEmployees:
            statsJson.data.totalEmployees ??
            statsJson.data.chartData?.total ??
            0,
          tableData: tableJson.data || [],
          chartData: statsJson.data.chartData,
          pagination: tableJson.pagination,
        });

        // Simpan data BOPO jika ada
        setBopo(bopoData);
      } else {
        console.error("Failed to fetch combined data", {
          tableJson,
          statsJson,
        });
        setStats({
          totalEmployees: 0,
          tableData: [],
          chartData: defaultChartData,
        });
        setBopo(null);
      }
    } catch (error) {
      console.error("Error fetching combined dashboard data:", error);
      setStats({
        totalEmployees: 0,
        tableData: [],
        chartData: defaultChartData,
      });
      setBopo(null);
    } finally {
      setLoading(false);
    }
  };

  // Default chart data untuk fallback
  const defaultChartData = {
    organik: 0,
    nonOrganik: 0,
    operasional: 0,
    nonOperasional: 0,
    lakiLaki: 0,
    perempuan: 0,
    organikOperasional: 0,
    organikNonOperasional: 0,
    nonOrganikOperasional: 0,
    nonOrganikNonOperasional: 0,
    total: 0,
  };

  const refreshData = () => {
    fetchDashboardData();
    fetchSDMOperasionalStats();
  };

  const handlePeriodChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedPeriod(event.target.value);
  };



  const handleExportPDF = () => {
    if (!dashboardRef.current) {
      alert("Tidak ada data untuk diekspor");
      return;
    }

    try {
      setExportingPDF(true);

      // Force update semua chart sebelum print untuk memastikan canvas ter-render
      setTimeout(() => {
        const canvases = dashboardRef.current?.querySelectorAll("canvas");
        if (canvases && canvases.length > 0) {
          canvases.forEach((canvas) => {
            try {
              // Dapatkan chart instance dari Chart.js menggunakan method yang benar
              const chartInstance = ChartJS.getChart(
                canvas as HTMLCanvasElement
              );
              if (chartInstance) {
                // Update chart tanpa animasi untuk memastikan ter-render
                chartInstance.update("none");
                // Force resize untuk memastikan chart ter-render dengan baik
                chartInstance.resize();
                // Update lagi untuk memastikan
                chartInstance.update("none");
              }
            } catch (e) {
              // Ignore chart update error
              console.warn("Chart update warning:", e);
            }
          });
        }

        // Pastikan semua elemen terlihat sebelum print
        const allElements = dashboardRef.current?.querySelectorAll(
          'table, canvas, div[class*="bg-white"], div[class*="h-32"]'
        );
        if (allElements) {
          allElements.forEach((el) => {
            const htmlEl = el as HTMLElement;
            htmlEl.style.display = "";
            htmlEl.style.visibility = "";
            htmlEl.style.opacity = "";
            // Pastikan canvas memiliki ukuran yang jelas
            if (el.tagName === "CANVAS") {
              const canvasEl = el as HTMLCanvasElement;
              if (canvasEl.width === 0 || canvasEl.height === 0) {
                canvasEl.width = canvasEl.offsetWidth || 300;
                canvasEl.height = canvasEl.offsetHeight || 128;
              }
            }
          });
        }

        // Pastikan semua canvas terlihat secara eksplisit
        const allCanvases = dashboardRef.current?.querySelectorAll("canvas");
        if (allCanvases) {
          allCanvases.forEach((canvas) => {
            const canvasEl = canvas as HTMLCanvasElement;
            canvasEl.style.display = "block";
            canvasEl.style.visibility = "visible";
            canvasEl.style.opacity = "1";
            canvasEl.style.width = "100%";
            canvasEl.style.height = "128px";
            canvasEl.style.minHeight = "128px";
            // Pastikan canvas memiliki dimensi yang benar
            if (canvasEl.width === 0 || canvasEl.height === 0) {
              const parent = canvasEl.parentElement;
              if (parent) {
                canvasEl.width = parent.clientWidth || 300;
                canvasEl.height = 128;
              }
            }
            // Force re-render chart
            const chartInstance = ChartJS.getChart(canvasEl);
            if (chartInstance) {
              chartInstance.update("none");
              chartInstance.resize();
            }
          });
        }

        // Pastikan semua section pie chart terlihat
        const pieChartSections = dashboardRef.current?.querySelectorAll(
          'div[class*="bg-white"][class*="rounded-xl"][class*="shadow-lg"][class*="p-6"]'
        );
        if (pieChartSections) {
          pieChartSections.forEach((section) => {
            const sectionEl = section as HTMLElement;
            sectionEl.style.display = "block";
            sectionEl.style.visibility = "visible";
            sectionEl.style.opacity = "1";
            // Pastikan semua child terlihat
            const children = sectionEl.querySelectorAll("*");
            children.forEach((child) => {
              const childEl = child as HTMLElement;
              if (
                childEl.tagName !== "BUTTON" &&
                childEl.tagName !== "SELECT" &&
                !childEl.closest("button") &&
                !childEl.closest("select")
              ) {
                childEl.style.display = "";
                childEl.style.visibility = "";
                childEl.style.opacity = "";
              }
            });
          });
        }

        // Pastikan semua label "Operasional" dan "Non Operasional" terlihat
        const labelContainers = dashboardRef.current?.querySelectorAll(
          'div[class*="bg-blue-50"], div[class*="bg-blue-100"]'
        );
        if (labelContainers) {
          labelContainers.forEach((container) => {
            const containerEl = container as HTMLElement;
            containerEl.style.display = "flex";
            containerEl.style.visibility = "visible";
            containerEl.style.opacity = "1";
            containerEl.style.flexDirection = "row";
            containerEl.style.justifyContent = "space-between";
            containerEl.style.alignItems = "center";
            // Pastikan background color
            if (containerEl.className.includes("bg-blue-50")) {
              containerEl.style.backgroundColor = "#eff6ff";
            } else if (containerEl.className.includes("bg-blue-100")) {
              containerEl.style.backgroundColor = "#dbeafe";
            }
            // Pastikan semua child terlihat
            const children = containerEl.querySelectorAll("*");
            children.forEach((child) => {
              const childEl = child as HTMLElement;
              if (
                childEl.tagName === "DIV" &&
                childEl.className.includes("flex")
              ) {
                childEl.style.display = "flex";
                childEl.style.flexDirection = "row";
                childEl.style.alignItems = "center";
              } else if (
                childEl.tagName === "DIV" &&
                childEl.className.includes("w-4")
              ) {
                childEl.style.display = "block";
                childEl.style.width = "16px";
                childEl.style.height = "16px";
                if (childEl.className.includes("bg-blue-200")) {
                  childEl.style.backgroundColor = "#bfdbfe";
                } else if (childEl.className.includes("bg-blue-600")) {
                  childEl.style.backgroundColor = "#2563eb";
                }
              } else if (childEl.tagName === "SPAN") {
                childEl.style.display = "inline-block";
                childEl.style.color = "#000000";
              }
              childEl.style.visibility = "visible";
              childEl.style.opacity = "1";
            });
          });
        }

        // Pastikan semua span text terlihat
        const textSpans = dashboardRef.current?.querySelectorAll(
          'span[class*="text-gray-700"], span[class*="font-semibold"]'
        );
        if (textSpans) {
          textSpans.forEach((span) => {
            const spanEl = span as HTMLElement;
            spanEl.style.display = "inline-block";
            spanEl.style.visibility = "visible";
            spanEl.style.opacity = "1";
            spanEl.style.color = "#000000";
          });
        }

        // Pastikan semua icon terlihat
        const icons = dashboardRef.current?.querySelectorAll(
          'div[class*="w-4"][class*="h-4"]'
        );
        if (icons) {
          icons.forEach((icon) => {
            const iconEl = icon as HTMLElement;
            iconEl.style.display = "block";
            iconEl.style.visibility = "visible";
            iconEl.style.opacity = "1";
            iconEl.style.width = "16px";
            iconEl.style.height = "16px";
            if (iconEl.className.includes("bg-blue-200")) {
              iconEl.style.backgroundColor = "#bfdbfe";
            } else if (iconEl.className.includes("bg-blue-600")) {
              iconEl.style.backgroundColor = "#2563eb";
            }
          });
        }

        // Tunggu lebih lama untuk memastikan chart ter-render dengan baik
        setTimeout(() => {
          // Pastikan sekali lagi semua canvas terlihat
          const finalCheck = dashboardRef.current?.querySelectorAll("canvas");
          if (finalCheck) {
            finalCheck.forEach((canvas) => {
              const canvasEl = canvas as HTMLCanvasElement;
              canvasEl.style.display = "block";
              canvasEl.style.visibility = "visible";
              canvasEl.style.opacity = "1";
            });
          }

          // Gunakan window.print() untuk format print browser seperti Google Chrome
          window.print();
          setExportingPDF(false);
        }, 2000);
      }, 500);
    } catch (error) {
      console.error("Error exporting to PDF:", error);
      alert("Gagal mengekspor ke PDF. Silakan coba lagi.");
      setExportingPDF(false);
    }
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-gray-100 dashboard-container"
      ref={dashboardRef}
    >
      {/* Blue Header */}
      <div className="bg-gradient-to-r text-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">DEMOGRAFI SDM</h1>
              <p className="text-lg">PT PELINDO MULTI TERMINAL GRUP</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="bg-blue-500 px-4 py-2 rounded">
                <select
                  className="bg-transparent text-white border-none outline-none"
                  value={selectedPeriod}
                  onChange={handlePeriodChange}
                >
                  {(() => {
                    // Group periods by year
                    const periodsByYear = new Map<number, Period[]>();
                    availablePeriods.forEach((period) => {
                      const year = period.tahun;
                      if (!periodsByYear.has(year)) {
                        periodsByYear.set(year, []);
                      }
                      periodsByYear.get(year)!.push(period);
                    });

                    // Sort years descending
                    const sortedYears = Array.from(periodsByYear.keys()).sort(
                      (a, b) => b - a
                    );

                    return sortedYears.map((year) => {
                      const yearPeriods = periodsByYear.get(year)!;
                      const consolidationPeriod = yearPeriods.find(
                        (p) => p.type === "consolidation"
                      );
                      const monthPeriods = yearPeriods
                        .filter((p) => p.type === "month")
                        .sort((a, b) => {
                          const bulanA =
                            typeof a.bulan === "number" ? a.bulan : 0;
                          const bulanB =
                            typeof b.bulan === "number" ? b.bulan : 0;
                          return bulanB - bulanA; // Descending
                        });

                      return (
                        <optgroup
                          key={year}
                          label={`Total Data ${year}`}
                          className="font-bold"
                        >
                          {consolidationPeriod && (
                            <option
                              key={consolidationPeriod.value}
                              className="text-black font-bold"
                              value={consolidationPeriod.value}
                            >
                              {consolidationPeriod.label}
                            </option>
                          )}
                          {monthPeriods.map((period) => (
                            <option
                              key={period.value}
                              className="text-black"
                              value={period.value}
                            >
                              {period.label}
                            </option>
                          ))}
                        </optgroup>
                      );
                    });
                  })()}
                </select>
              </div>
              <button
                onClick={handleExportPDF}
                disabled={exportingPDF}
                className="bg-red-600 hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white px-3 sm:px-4 py-2 rounded shadow flex items-center justify-center gap-2 text-sm sm:text-base whitespace-nowrap"
                title="Export PDF"
              >
                {exportingPDF ? (
                  <>
                    <svg
                      className="animate-spin h-4 w-4"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    <span className="hidden sm:inline">Mengekspor...</span>
                    <span className="sm:hidden">...</span>
                  </>
                ) : (
                  <>
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                      />
                    </svg>
                    <span className="hidden sm:inline">Export PDF</span>
                    <span className="sm:hidden">PDF</span>
                  </>
                )}
              </button>
              <div className="text-black font-bold">
                <span>PELINDO</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabel Rekap SDM */}
        {selectedPeriod && selectedPeriod.split("-")[0] !== "all" && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-8 overflow-x-auto">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">
              {(() => {
                if (!selectedPeriod || selectedPeriod.split("-")[0] === "all") {
                  return "REKAPITULASI JUMLAH SDM PT PELINDO MULTI TERMINAL (KONSOLIDASI)";
                }
                const bulan = parseInt(selectedPeriod.split("-")[0]);
                const tahun = parseInt(selectedPeriod.split("-")[1]);
                const bulanNames = [
                  "Januari",
                  "Februari",
                  "Maret",
                  "April",
                  "Mei",
                  "Juni",
                  "Juli",
                  "Agustus",
                  "September",
                  "Oktober",
                  "November",
                  "Desember",
                ];
                const bulanName = bulanNames[bulan - 1];

                // Cari total dari baris "Jumlah"
                const totalRow = rekapSDM.find(
                  (row) => row.status === "Jumlah"
                );
                const totalKaryawan = totalRow ? totalRow.realisasiBulanIni : 0;

                return `Realisasi Jumlah SDM PT Pelindo Multi Terminal (Konsolidasi) s.d ${bulanName} ${tahun} sebesar ${totalKaryawan.toLocaleString(
                  "id-ID"
                )} Orang`;
              })()}
            </h2>

            {loadingRekap ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                <span className="ml-3 text-gray-600">Memuat data rekap...</span>
              </div>
            ) : rekapSDM.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse border border-gray-300 text-sm">
                  <thead>
                    <tr className="bg-blue-700 text-white">
                      <th className="border border-gray-300 px-4 py-3 text-left font-bold text-white min-w-[280px] w-[280px]">
                        STATUS
                      </th>
                      <th className="border border-gray-300 px-3 py-3 text-left font-bold text-white">
                        SATUAN
                      </th>
                      <th className="border border-gray-300 px-2 py-3 text-center font-bold text-white leading-tight">
                        {(() => {
                          const bulan = parseInt(selectedPeriod.split("-")[0]);
                          const tahun = parseInt(selectedPeriod.split("-")[1]);
                          const bulanNames = [
                            "JANUARI",
                            "FEBRUARI",
                            "MARET",
                            "APRIL",
                            "MEI",
                            "JUNI",
                            "JULI",
                            "AGUSTUS",
                            "SEPTEMBER",
                            "OKTOBER",
                            "NOVEMBER",
                            "DESEMBER",
                          ];
                          return (
                            <>
                              <div>REALISASI</div>
                              <div>{bulanNames[bulan - 1]}</div>
                              <div>TH. {tahun - 1}</div>
                            </>
                          );
                        })()}
                      </th>
                      <th className="border border-gray-300 px-2 py-3 text-center font-bold text-white leading-tight">
                        {(() => {
                          const tahun = parseInt(selectedPeriod.split("-")[1]);
                          return (
                            <>
                              <div>RKAP</div>
                              <div>TH. {tahun}</div>
                            </>
                          );
                        })()}
                      </th>
                      <th className="border border-gray-300 px-2 py-3 text-center font-bold text-white leading-tight">
                        {(() => {
                          const bulan = parseInt(selectedPeriod.split("-")[0]);
                          const tahun = parseInt(selectedPeriod.split("-")[1]);
                          const bulanSebelumnya = bulan === 1 ? 12 : bulan - 1;
                          const tahunSebelumnya =
                            bulan === 1 ? tahun - 1 : tahun;
                          const bulanNames = [
                            "JANUARI",
                            "FEBRUARI",
                            "MARET",
                            "APRIL",
                            "MEI",
                            "JUNI",
                            "JULI",
                            "AGUSTUS",
                            "SEPTEMBER",
                            "OKTOBER",
                            "NOVEMBER",
                            "DESEMBER",
                          ];
                          return (
                            <>
                              <div>REALISASI</div>
                              <div>{bulanNames[bulanSebelumnya - 1]}</div>
                              <div>TH. {tahunSebelumnya}</div>
                            </>
                          );
                        })()}
                      </th>
                      <th className="border border-gray-300 px-2 py-3 text-center font-bold text-white leading-tight">
                        {(() => {
                          const bulan = parseInt(selectedPeriod.split("-")[0]);
                          const tahun = parseInt(selectedPeriod.split("-")[1]);
                          const bulanNames = [
                            "JANUARI",
                            "FEBRUARI",
                            "MARET",
                            "APRIL",
                            "MEI",
                            "JUNI",
                            "JULI",
                            "AGUSTUS",
                            "SEPTEMBER",
                            "OKTOBER",
                            "NOVEMBER",
                            "DESEMBER",
                          ];
                          return (
                            <>
                              <div>REALISASI</div>
                              <div>S.D</div>
                              <div>{bulanNames[bulan - 1]}</div>
                              <div>TH. {tahun}</div>
                            </>
                          );
                        })()}
                      </th>
                      <th
                        className="border border-gray-300 px-2 py-3 text-center font-bold text-white leading-tight"
                        colSpan={2}
                      >
                        <div>CAPAIAN</div>
                        <div>(%)</div>
                      </th>
                    </tr>
                    <tr className="bg-blue-700 text-white">
                      <th className="border border-gray-300 px-3 py-2"></th>
                      <th className="border border-gray-300 px-3 py-2"></th>
                      <th className="border border-gray-300 px-3 py-2"></th>
                      <th className="border border-gray-300 px-3 py-2"></th>
                      <th className="border border-gray-300 px-3 py-2"></th>
                      <th className="border border-gray-300 px-3 py-2"></th>
                      <th className="border border-gray-300 px-3 py-2 text-center font-bold text-white">
                        YoY
                      </th>
                      <th className="border border-gray-300 px-3 py-2 text-center font-bold text-white">
                        FY {selectedPeriod.split("-")[1]}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rekapSDM.map((row, index) => {
                      const isTotal = row.status === "Jumlah";
                      return (
                        <tr
                          key={index}
                          className={
                            isTotal
                              ? "bg-gray-100 font-bold border-t-2 border-gray-400 text-black"
                              : "hover:bg-gray-50 text-black"
                          }
                        >
                          <td className="border border-gray-300 px-4 py-3 text-left text-black min-w-[280px] w-[280px]">
                            {row.status}
                          </td>
                          <td className="border border-gray-300 px-3 py-3 text-left text-black">
                            {row.satuan}
                          </td>
                          <td className="border border-gray-300 px-3 py-3 text-right text-black">
                            {row.realisasiTahunLalu > 0
                              ? row.realisasiTahunLalu.toLocaleString("id-ID")
                              : "-"}
                          </td>
                          <td
                            className={`border border-gray-300 px-3 py-3 text-right text-black ${
                              isTotal
                                ? ""
                                : "cursor-pointer hover:bg-blue-50 transition-colors"
                            }`}
                            onClick={() =>
                              !isTotal &&
                              handleRKAPEdit(row.status, row.revisiRKAP)
                            }
                            title={
                              isTotal ? "" : "Klik untuk mengedit nilai RKAP"
                            }
                          >
                            {editingRKAP[row.status] !== undefined ? (
                              <div className="flex items-center gap-2 justify-end">
                                <input
                                  type="number"
                                  value={editingRKAP[row.status]}
                                  onChange={(e) =>
                                    setEditingRKAP({
                                      ...editingRKAP,
                                      [row.status]: e.target.value,
                                    })
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      handleRKAPSave(row.status);
                                    } else if (e.key === "Escape") {
                                      handleRKAPCancel(row.status);
                                    }
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-24 px-2 py-1 border border-blue-500 rounded text-gray-900 text-right"
                                  autoFocus
                                  min="0"
                                />
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRKAPSave(row.status);
                                  }}
                                  disabled={savingRKAP}
                                  className="px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-xs"
                                  title="Simpan"
                                >
                                  ✓
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRKAPCancel(row.status);
                                  }}
                                  className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-xs"
                                  title="Batal"
                                >
                                  ✕
                                </button>
                              </div>
                            ) : row.revisiRKAP !== null &&
                              row.revisiRKAP > 0 ? (
                              row.revisiRKAP.toLocaleString("id-ID")
                            ) : (
                              "-"
                            )}
                          </td>
                          <td className="border border-gray-300 px-3 py-3 text-right text-black">
                            {row.realisasiBulanSebelumnya > 0
                              ? row.realisasiBulanSebelumnya.toLocaleString(
                                  "id-ID"
                                )
                              : "-"}
                          </td>
                          <td className="border border-gray-300 px-3 py-3 text-right text-black">
                            {row.realisasiBulanIni > 0
                              ? row.realisasiBulanIni.toLocaleString("id-ID")
                              : "-"}
                          </td>
                          <td className="border border-gray-300 px-3 py-3 text-right text-black">
                            {row.capaianYoY !== null
                              ? `${row.capaianYoY}%`
                              : "-"}
                          </td>
                          <td className="border border-gray-300 px-3 py-3 text-right text-black">
                            {row.capaianFY !== null ? `${row.capaianFY}%` : "-"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                Tidak ada data rekap untuk periode yang dipilih
              </div>
            )}
          </div>
        )}

        {/* PERSENTASE JUMLAH SDM Section */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">
            PERSENTASE JUMLAH SDM
          </h2>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              <span className="ml-3 text-gray-600">Memuat data...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* SPMT Chart */}
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <h3 className="text-lg font-bold text-gray-800 mb-4 text-center">
                  JUMLAH SDM SPMT
                </h3>
                <div className="h-32 mb-2">
                  {sdmOperasional?.spmt && sdmOperasional.spmt.total > 0 ? (
                    <Doughnut
                      data={{
                        labels: ["Non Operasional", "Operasional"],
                        datasets: [
                          {
                            data: [
                              sdmOperasional.spmt.nonOperasional,
                              sdmOperasional.spmt.operasional,
                            ],
                            backgroundColor: ["#60A5FA", "#1E40AF"],
                            borderWidth: 0,
                          },
                        ],
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: { display: false },
                          datalabels: {
                            formatter: (value: number) => {
                              const total = sdmOperasional.spmt.total;
                              const percentage =
                                total > 0
                                  ? Math.round((value / total) * 100)
                                  : 0;
                              return `${percentage}%`;
                            },
                            color: "#fff",
                            font: {
                              weight: "bold",
                              size: 12,
                            },
                            textAlign: "center",
                          },
                        },
                        cutout: "50%",
                      }}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-400">
                      No Data
                    </div>
                  )}
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-800 mb-2">
                    {sdmOperasional?.spmt?.total || 0} Org
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center bg-blue-50 px-3 py-2 rounded">
                      <div className="flex items-center">
                        <div className="w-4 h-4 bg-blue-200 rounded mr-2"></div>
                        <span className="text-gray-700">Non Operasional</span>
                      </div>
                      <span className="font-semibold text-gray-800">
                        {sdmOperasional?.spmt?.nonOperasional || 0} Org
                      </span>
                    </div>
                    <div className="flex justify-between items-center bg-blue-100 px-3 py-2 rounded">
                      <div className="flex items-center">
                        <div className="w-4 h-4 bg-blue-600 rounded mr-2"></div>
                        <span className="text-gray-700">Operasional</span>
                      </div>
                      <span className="font-semibold text-gray-800">
                        {sdmOperasional?.spmt?.operasional || 0} Org
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* PTP Chart */}
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <h3 className="text-lg font-bold text-gray-800 mb-4 text-center">
                  JUMLAH SDM PTP
                </h3>
                <div className="h-32 mb-2">
                  {sdmOperasional?.ptp && sdmOperasional.ptp.total > 0 ? (
                    <Doughnut
                      data={{
                        labels: ["Non Operasional", "Operasional"],
                        datasets: [
                          {
                            data: [
                              sdmOperasional.ptp.nonOperasional,
                              sdmOperasional.ptp.operasional,
                            ],
                            backgroundColor: ["#60A5FA", "#1E40AF"],
                            borderWidth: 0,
                          },
                        ],
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: { display: false },
                          datalabels: {
                            formatter: (value: number) => {
                              const total = sdmOperasional.ptp.total;
                              const percentage =
                                total > 0
                                  ? Math.round((value / total) * 100)
                                  : 0;
                              return `${percentage}%`;
                            },
                            color: "#fff",
                            font: {
                              weight: "bold",
                              size: 12,
                            },
                            textAlign: "center",
                          },
                        },
                        cutout: "50%",
                      }}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-400">
                      No Data
                    </div>
                  )}
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-800 mb-2">
                    {sdmOperasional?.ptp?.total || 0} Org
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center bg-blue-50 px-3 py-2 rounded">
                      <div className="flex items-center">
                        <div className="w-4 h-4 bg-blue-200 rounded mr-2"></div>
                        <span className="text-gray-700">Non Operasional</span>
                      </div>
                      <span className="font-semibold text-gray-800">
                        {sdmOperasional?.ptp?.nonOperasional || 0} Org
                      </span>
                    </div>
                    <div className="flex justify-between items-center bg-blue-100 px-3 py-2 rounded">
                      <div className="flex items-center">
                        <div className="w-4 h-4 bg-blue-600 rounded mr-2"></div>
                        <span className="text-gray-700">Operasional</span>
                      </div>
                      <span className="font-semibold text-gray-800">
                        {sdmOperasional?.ptp?.operasional || 0} Org
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* IKT Chart */}
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <h3 className="text-lg font-bold text-gray-800 mb-4 text-center">
                  JUMLAH SDM IKT
                </h3>
                <div className="h-32 mb-2">
                  {sdmOperasional?.ikt && sdmOperasional.ikt.total > 0 ? (
                    <Doughnut
                      data={{
                        labels: ["Non Operasional", "Operasional"],
                        datasets: [
                          {
                            data: [
                              sdmOperasional.ikt.nonOperasional,
                              sdmOperasional.ikt.operasional,
                            ],
                            backgroundColor: ["#60A5FA", "#1E40AF"],
                            borderWidth: 0,
                          },
                        ],
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: { display: false },
                          datalabels: {
                            formatter: (value: number) => {
                              const total = sdmOperasional.ikt.total;
                              const percentage =
                                total > 0
                                  ? Math.round((value / total) * 100)
                                  : 0;
                              return `${percentage}%`;
                            },
                            color: "#fff",
                            font: {
                              weight: "bold",
                              size: 12,
                            },
                            textAlign: "center",
                          },
                        },
                        cutout: "50%",
                      }}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-400">
                      No Data
                    </div>
                  )}
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-800 mb-2">
                    {sdmOperasional?.ikt?.total || 0} Org
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center bg-blue-50 px-3 py-2 rounded">
                      <div className="flex items-center">
                        <div className="w-4 h-4 bg-blue-200 rounded mr-2"></div>
                        <span className="text-gray-700">Non Operasional </span>
                      </div>
                      <span className="font-semibold text-gray-800">
                        {sdmOperasional?.ikt?.nonOperasional || 0} Org
                      </span>
                    </div>
                    <div className="flex justify-between items-center bg-blue-100 px-3 py-2 rounded">
                      <div className="flex items-center">
                        <div className="w-4 h-4 bg-blue-600 rounded mr-2"></div>
                        <span className="text-gray-700">Operasional</span>
                      </div>
                      <span className="font-semibold text-gray-800">
                        {sdmOperasional?.ikt?.operasional || 0} Org
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* TCU Chart */}
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <h3 className="text-lg font-bold text-gray-800 mb-4 text-center">
                  JUMLAH SDM TCU
                </h3>
                <div className="h-32 mb-2">
                  {sdmOperasional?.tcu && sdmOperasional.tcu.total > 0 ? (
                    <Doughnut
                      data={{
                        labels: ["Non Operasional", "Operasional"],
                        datasets: [
                          {
                            data: [
                              sdmOperasional.tcu.nonOperasional,
                              sdmOperasional.tcu.operasional,
                            ],
                            backgroundColor: ["#60A5FA", "#1E40AF"],
                            borderWidth: 0,
                          },
                        ],
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: { display: false },
                          datalabels: {
                            formatter: (value: number) => {
                              const total = sdmOperasional.tcu.total;
                              const percentage =
                                total > 0
                                  ? Math.round((value / total) * 100)
                                  : 0;
                              return `${percentage}%`;
                            },
                            color: "#fff",
                            font: {
                              weight: "bold",
                              size: 12,
                            },
                            textAlign: "center",
                          },
                        },
                        cutout: "50%",
                      }}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-400">
                      No Data
                    </div>
                  )}
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-800 mb-2">
                    {sdmOperasional?.tcu?.total || 0} Org
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center bg-blue-50 px-3 py-2 rounded">
                      <div className="flex items-center">
                        <div className="w-4 h-4 bg-blue-200 rounded mr-2"></div>
                        <span className="text-gray-700">Non Operasional </span>
                      </div>
                      <span className="font-semibold text-gray-800">
                        {sdmOperasional?.tcu?.nonOperasional || 0} Org
                      </span>
                    </div>
                    <div className="flex justify-between items-center bg-blue-100 px-3 py-2 rounded">
                      <div className="flex items-center">
                        <div className="w-4 h-4 bg-blue-600 rounded mr-2"></div>
                        <span className="text-gray-700">Operasional</span>
                      </div>
                      <span className="font-semibold text-gray-800">
                        {sdmOperasional?.tcu?.operasional || 0} Org
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="flex justify-center gap-6 mt-6 pt-6 border-t border-gray-200">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-200 rounded"></div>
              <span className="text-sm text-gray-700">Non Operasional </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-600 rounded"></div>
              <span className="text-sm text-gray-700">Operasional</span>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {role !== "admin_pembelajaran" && (
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h4 className="text-lg font-semibold text-gray-800 mb-4">
                Upload Data
              </h4>
              <p className="text-gray-600 mb-4">
                Upload file Excel atau CSV untuk mengupdate data dashboard.
              </p>
              <a
                href="/admin/upload-data"
                className="inline-block bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition-colors"
              >
                Upload Data
              </a>
            </div>
          )}

          <div className="bg-white p-6 rounded-lg shadow-md">
            <h4 className="text-lg font-semibold text-gray-800 mb-4">
              Kelola Akun
            </h4>
            <p className="text-gray-600 mb-4">
              Kelola pengguna sistem, tambah, edit, atau hapus akun pengguna.
            </p>
            <a
              href="/admin/users"
              className="inline-block bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 transition-colors"
            >
              Kelola Akun
            </a>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md">
            <h4 className="text-lg font-semibold text-gray-800 mb-4">
              Pengaturan Sistem
            </h4>
            <p className="text-gray-600 mb-4">
              Konfigurasi pengaturan sistem dan preferensi aplikasi.
            </p>
            <a
              href="/admin/settings"
              className="inline-block bg-purple-500 text-white px-4 py-2 rounded-md hover:bg-purple-600 transition-colors"
            >
              Pengaturan
            </a>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md">
            <h4 className="text-lg font-semibold text-gray-800 mb-4">
              Refresh Data
            </h4>
            <p className="text-gray-600 mb-4">
              Refresh dashboard untuk melihat data terbaru dari database.
            </p>
            <button
              onClick={refreshData}
              className="bg-yellow-500 text-white px-4 py-2 rounded-md hover:bg-yellow-600 transition-colors"
            >
              Refresh Dashboard
            </button>
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
      @page {
        margin: 0;
        size: auto;
      }
      @media print {
        /* Pastikan warna tetap muncul saat print */
        * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          color-adjust: exact !important;
        }
        
        /* PASTIKAN HEADER DASHBOARD TETAP MUNCUL */
        .dashboard-container > div[class*="bg-gradient-to-r"],
        .dashboard-container > div[class*="bg-gradient-to-r"][class*="text-black"],
        .dashboard-container > div[class*="bg-gradient-to-r"] *,
        .dashboard-container > div[class*="bg-gradient-to-r"] > div,
        .dashboard-container > div[class*="bg-gradient-to-r"] > div[class*="px-"],
        .dashboard-container > div[class*="bg-gradient-to-r"] > div[class*="px-"] > div,
        .dashboard-container > div[class*="bg-gradient-to-r"] > div[class*="px-"] > div > h1,
        .dashboard-container > div[class*="bg-gradient-to-r"] > div[class*="px-"] > div > p,
        .dashboard-container h1,
        .dashboard-container p {
          display: block !important;
          visibility: visible !important;
          width: 100% !important;
          height: auto !important;
          opacity: 1 !important;
          color: #000000 !important;
        }
        
        /* Sembunyikan navbar saat print */
        nav,
        nav * {
          display: none !important;
        }
        
        /* Sembunyikan sidebar */
        aside,
        [class*="sidebar"],
        [class*="Sidebar"],
        div[class*="w-64"]:not([class*="px-"]):not([class*="bg-gradient"]):not([class*="text-black"]),
        div[class*="w-16"]:not([class*="px-"]):not([class*="bg-gradient"]):not([class*="text-black"]),
        div[class*="sticky"][class*="h-screen"]:not([class*="bg-gradient"]):not([class*="text-black"]),
        div[class*="from-slate-900"]:not([class*="bg-gradient-to-r"]):not([class*="text-black"]),
        div[class*="via-blue-900"]:not([class*="bg-gradient-to-r"]):not([class*="text-black"]),
        div[class*="to-blue-700"]:not([class*="bg-gradient-to-r"]):not([class*="text-black"]) {
          display: none !important;
          visibility: hidden !important;
          width: 0 !important;
          height: 0 !important;
        }
        
        /* Sembunyikan spacer setelah navbar */
        .h-16:first-of-type:not([class*="bg-gradient"]):not([class*="text-black"]),
        div[style*="height: 4rem"]:not([class*="bg-gradient"]):not([class*="text-black"]) {
          display: none !important;
        }
        
        /* Sembunyikan container tombol-tombol dan dropdown */
        .dashboard-container > div[class*="bg-gradient-to-r"] > div[class*="px-"] > div > div:last-child,
        .dashboard-container > div[class*="bg-gradient-to-r"] > div[class*="px-"] > div > div.flex:last-child {
          display: none !important;
          visibility: hidden !important;
          width: 0 !important;
          height: 0 !important;
          opacity: 0 !important;
        }
        
        /* Sembunyikan tombol-tombol export dan dropdown */
        button[onclick*="handleExportPDF"],
        button[onclick*="handleDownloadExcel"],
        button[onclick*="handleExportStrukturPDF"],
        button[onclick*="handleExportPdf"],
        button:has(svg[width="10"]),
        button:has(svg[width="12"]),
        button:has(.h-2\.5),
        button:has(.h-3),
        button:has(.h-4),
        select,
        div[class*="bg-blue-500"]:has(select),
        input[type="number"],
        button:has-text("✓"),
        button:has-text("✕") {
          display: none !important;
          visibility: hidden !important;
          width: 0 !important;
          height: 0 !important;
          opacity: 0 !important;
        }
        
        /* Sembunyikan semua SVG icon di dalam tombol export */
        button[onclick*="handleExportPDF"] svg,
        button[onclick*="handleExportPdf"] svg,
        button[onclick*="handleDownloadExcel"] svg {
          display: none !important;
          visibility: hidden !important;
        }
        
        /* Pastikan hanya div pertama (yang berisi h1 dan p) yang muncul */
        .dashboard-container > div[class*="bg-gradient-to-r"] > div[class*="px-"] > div > div:first-child {
          display: block !important;
          visibility: visible !important;
          width: 100% !important;
        }
        
        /* Sembunyikan sidebar berdasarkan parent container */
        div.flex > div:first-child:not([class*="flex-1"]):not([class*="bg-gradient"]):not([class*="text-black"]) {
          display: none !important;
          width: 0 !important;
          height: 0 !important;
        }
        
        /* Sembunyikan Quick Actions section */
        .grid.grid-cols-1.lg\\:grid-cols-4 {
          display: none !important;
        }
        
        /* Pastikan konten tetap rapi dengan padding normal */
        body,
        html {
          background-color: #ffffff !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        
        /* Pastikan halaman print bersih */
        @page {
          margin: 0.5cm !important;
          background: white !important;
          margin-top: 0 !important;
          margin-bottom: 0 !important;
        }
        
        /* Pastikan tidak ada halaman kosong */
        .dashboard-container > div[class*="max-w-7xl"] {
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
        
        /* Pastikan header dan konten pertama muncul di halaman yang sama */
        .dashboard-container > div[class*="bg-gradient-to-r"] {
          page-break-after: avoid !important;
        }
        
        /* Pastikan section pie chart muncul langsung setelah header atau tabel */
        div[class*="max-w-7xl"] > div[class*="bg-white"][class*="rounded-xl"][class*="shadow-lg"][class*="p-6"][class*="mb-8"]:last-of-type,
        div[class*="max-w-7xl"] > div[class*="bg-white"][class*="rounded-xl"][class*="shadow-lg"][class*="p-6"][class*="mb-8"]:nth-of-type(2) {
          page-break-before: avoid !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
        
        /* Sembunyikan semua elemen yang mungkin menampilkan URL */
        header[class*="url"],
        div[class*="url"],
        span[class*="url"],
        a[href*="localhost"],
        a[href*="http"],
        a[href*="admin"],
        a[href*="regional"] {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
        }
        
        /* Pastikan semua judul dan konten tetap muncul */
        h1, h2, h3, h4, h5, h6 {
          display: block !important;
          visibility: visible !important;
        }
        
        /* Pastikan header dashboard tetap muncul */
        .dashboard-container > div[class*="bg-gradient-to-r"][class*="text-black"],
        .dashboard-container > div[class*="bg-gradient-to-r"],
        .dashboard-container div[class*="bg-gradient-to-r"][class*="text-black"],
        .dashboard-container div[class*="bg-gradient-to-r"]:first-child {
          display: block !important;
          visibility: visible !important;
          width: 100% !important;
          height: auto !important;
          opacity: 1 !important;
        }
        
        /* Pastikan judul header tetap muncul */
        .dashboard-container h1,
        .dashboard-container h2,
        .dashboard-container h3,
        .dashboard-container p,
        div[class*="px-"] h1,
        div[class*="px-"] h2,
        div[class*="px-"] p,
        .dashboard-container > div[class*="bg-gradient-to-r"] h1,
        .dashboard-container > div[class*="bg-gradient-to-r"] p,
        h1,
        h2,
        p {
          display: block !important;
          visibility: visible !important;
          color: #000000 !important;
          opacity: 1 !important;
        }
        
        /* Pastikan header container tidak disembunyikan */
        .dashboard-container > div[class*="bg-gradient-to-r"] > div,
        .dashboard-container > div[class*="bg-gradient-to-r"] > div[class*="px-"],
        .dashboard-container > div[class*="bg-gradient-to-r"] > div[class*="px-"] > div,
        div[class*="px-4"] > div,
        div[class*="px-6"] > div {
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
        }
        
        /* Pastikan dashboard tetap rapi dengan padding */
        .dashboard-container {
          width: 100% !important;
        }
        
        /* Pastikan background putih untuk body dan container */
        body,
        html,
        .dashboard-container {
          background-color: #ffffff !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        
        /* PASTIKAN SEMUA KONTEN MUNCUL - TERMASUK TABEL DAN CHART */
        div[class*="max-w-7xl"],
        div[class*="px-4"],
        div[class*="px-6"],
        div[class*="px-8"],
        div[class*="py-8"],
        div[class*="bg-white"],
        div[class*="rounded-xl"],
        div[class*="rounded-lg"],
        div[class*="shadow-lg"],
        div[class*="p-6"],
        div[class*="mb-8"],
        div[class*="mb-4"],
        div[class*="mb-6"],
        div[class*="overflow-x-auto"],
        div[class*="space-y"],
        div[class*="gap-"],
        div[class*="text-center"],
        div[class*="flex"],
        div[class*="justify-center"],
        div[class*="items-center"],
        canvas,
        span,
        h2,
        h3,
        h4 {
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
        
        /* PASTIKAN TABEL MUNCUL DENGAN BORDER DAN STYLING */
        table,
        .dashboard-container table,
        table[class*="min-w-full"],
        table[class*="border-collapse"],
        table thead,
        table tbody,
        table tr,
        table th,
        table td {
          display: table !important;
          visibility: visible !important;
          opacity: 1 !important;
          border: 1px solid #000000 !important;
          border-collapse: collapse !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
        
        table thead {
          display: table-header-group !important;
        }
        
        table tbody {
          display: table-row-group !important;
        }
        
        table tr {
          display: table-row !important;
          page-break-inside: avoid !important;
        }
        
        table th,
        table td {
          display: table-cell !important;
          padding: 8px !important;
          border: 1px solid #000000 !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        
        table th[class*="bg-blue-700"] {
          background-color: #1e40af !important;
          color: #ffffff !important;
        }
        
        table tr[class*="bg-gray-100"] {
          background-color: #f3f4f6 !important;
        }
        
        /* Pastikan grid chart container muncul dengan layout grid */
        div[class*="grid"][class*="grid-cols-1"],
        div[class*="grid"][class*="md:grid-cols-2"],
        div[class*="grid"][class*="lg:grid-cols-4"] {
          display: grid !important;
          visibility: visible !important;
          opacity: 1 !important;
          grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
          gap: 1.5rem !important;
        }
        
        /* Pastikan flex container tetap flex */
        div[class*="flex"]:not([class*="hidden"]),
        div[class*="flex"][class*="justify-between"],
        div[class*="flex"][class*="items-center"],
        div[class*="flex"][class*="justify-between"][class*="items-center"] {
          display: flex !important;
          visibility: visible !important;
          opacity: 1 !important;
          flex-direction: row !important;
          align-items: center !important;
          justify-content: space-between !important;
        }
        
        /* Pastikan flex items muncul */
        div[class*="flex"] > div,
        div[class*="flex"] > span {
          display: flex !important;
          visibility: visible !important;
          opacity: 1 !important;
        }
        
        div[class*="flex"][class*="items-center"] > div,
        div[class*="flex"][class*="items-center"] > span {
          display: flex !important;
          align-items: center !important;
        }
        
        /* PASTIKAN CANVAS CHART MUNCUL - SANGAT PENTING */
        canvas,
        .dashboard-container canvas,
        .dashboard-container div canvas,
        .dashboard-container div div canvas,
        .dashboard-container div div div canvas,
        .dashboard-container div div div div canvas,
        .dashboard-container div div div div div canvas,
        .dashboard-container div[class*="h-32"] canvas,
        .dashboard-container div[class*="bg-white"] canvas,
        div[class*="h-32"] canvas,
        div[class*="bg-white"] canvas,
        div[class*="rounded-lg"] canvas,
        div[class*="p-4"] canvas {
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
          width: 100% !important;
          height: 128px !important;
          min-height: 128px !important;
          max-width: 100% !important;
          position: relative !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          color-adjust: exact !important;
          background: transparent !important;
        }
        
        /* Pastikan container chart h-32 muncul */
        .dashboard-container div[class*="h-32"],
        div[class*="h-32"],
        div[class*="h-32"][class*="mb-2"] {
          height: 128px !important;
          min-height: 128px !important;
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
          position: relative !important;
          page-break-inside: avoid !important;
          overflow: visible !important;
        }
        
        /* Pastikan parent container chart muncul */
        div[class*="bg-white"][class*="rounded-lg"][class*="p-4"][class*="border"],
        div[class*="bg-white"][class*="rounded-lg"][class*="p-4"] {
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
        
        /* Pastikan chart wrapper muncul */
        div[class*="h-32"][class*="mb-2"] > *,
        div[class*="h-32"] > * {
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
        }
        
        /* Pastikan section PERSENTASE JUMLAH SDM muncul - HARUS MUNCUL */
        .dashboard-container div[class*="bg-white"][class*="rounded-xl"][class*="shadow-lg"][class*="p-6"][class*="mb-8"],
        div[class*="bg-white"][class*="rounded-xl"][class*="shadow-lg"][class*="p-6"][class*="mb-8"],
        div[class*="max-w-7xl"] > div[class*="bg-white"][class*="rounded-xl"][class*="shadow-lg"][class*="p-6"][class*="mb-8"] {
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
          page-break-before: auto !important;
          page-break-after: auto !important;
        }
        
        /* Pastikan h2 PERSENTASE JUMLAH SDM muncul */
        h2[class*="text-2xl"][class*="font-bold"][class*="text-gray-800"][class*="mb-6"][class*="text-center"],
        .dashboard-container h2[class*="text-2xl"][class*="font-bold"] {
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
          color: #000000 !important;
          page-break-after: avoid !important;
        }
        
        /* Pastikan grid chart container muncul - SANGAT PENTING */
        div[class*="grid"][class*="grid-cols-1"][class*="md:grid-cols-2"][class*="lg:grid-cols-4"][class*="gap-6"],
        div[class*="grid"][class*="grid-cols-1"][class*="md:grid-cols-2"][class*="lg:grid-cols-4"] {
          display: grid !important;
          visibility: visible !important;
          opacity: 1 !important;
          grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
          gap: 1.5rem !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
        
        /* Pastikan semua elemen di dalam grid chart muncul */
        div[class*="grid"] > div[class*="bg-white"][class*="rounded-lg"][class*="p-4"][class*="border"],
        div[class*="grid"] > div,
        div[class*="grid"][class*="grid-cols-1"][class*="md:grid-cols-2"][class*="lg:grid-cols-4"] > div {
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
        
        /* Pastikan semua child di dalam section pie chart muncul */
        div[class*="bg-white"][class*="rounded-xl"][class*="shadow-lg"][class*="p-6"] > *,
        div[class*="bg-white"][class*="rounded-xl"][class*="shadow-lg"][class*="p-6"] > div,
        div[class*="bg-white"][class*="rounded-xl"][class*="shadow-lg"][class*="p-6"] > div > *,
        div[class*="bg-white"][class*="rounded-xl"][class*="shadow-lg"][class*="p-6"] > div > div > *,
        div[class*="bg-white"][class*="rounded-xl"][class*="shadow-lg"][class*="p-6"] > div > div > div > *,
        div[class*="bg-white"][class*="rounded-xl"][class*="shadow-lg"][class*="p-6"] > div > div > div > div > * {
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
        }
        
        /* Pastikan semua elemen di dalam chart card muncul */
        div[class*="bg-white"][class*="rounded-lg"][class*="p-4"] > *,
        div[class*="bg-white"][class*="rounded-lg"][class*="p-4"] > div,
        div[class*="bg-white"][class*="rounded-lg"][class*="p-4"] > div > *,
        div[class*="bg-white"][class*="rounded-lg"][class*="p-4"] > div > div > *,
        div[class*="bg-white"][class*="rounded-lg"][class*="p-4"] > div > div > div > * {
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
        }
        
        /* Pastikan flex container di dalam chart card muncul */
        div[class*="bg-white"][class*="rounded-lg"][class*="p-4"] div[class*="flex"] {
          display: flex !important;
          visibility: visible !important;
          opacity: 1 !important;
        }
        
        /* Pastikan h3 judul chart muncul */
        h3[class*="text-lg"][class*="font-bold"][class*="text-gray-800"][class*="mb-4"][class*="text-center"],
        .dashboard-container h3 {
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
          color: #000000 !important;
        }
        
        /* Pastikan text-center dan mb-2 muncul */
        div[class*="text-center"],
        div[class*="mb-2"],
        div[class*="mb-4"] {
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
        }
        
        /* Pastikan chart container muncul */
        .dashboard-container div[class*="bg-white"][class*="rounded-lg"][class*="p-4"],
        .dashboard-container div[class*="bg-white"][class*="rounded-lg"][class*="border"],
        div[class*="bg-white"][class*="rounded-lg"][class*="p-4"],
        div[class*="bg-white"][class*="rounded-lg"][class*="border"] {
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
          border: 1px solid #e5e7eb !important;
        }
        
        /* Pastikan loading spinner tidak muncul saat print */
        div[class*="animate-spin"],
        div[class*="loading"],
        div[class*="spinner"],
        .dashboard-container div[class*="animate-spin"],
        .dashboard-container div[class*="loading"],
        .dashboard-container div[class*="spinner"],
        .dashboard-container div[class*="Memuat"],
        div:has-text("Memuat"),
        div:has-text("Loading") {
          display: none !important;
          visibility: hidden !important;
        }
        
        /* Pastikan semua text dan label muncul */
        span,
        p,
        div[class*="text-"],
        div[class*="font-"],
        .dashboard-container span,
        .dashboard-container p,
        .dashboard-container div[class*="text-"],
        .dashboard-container h2,
        .dashboard-container h3,
        .dashboard-container h4 {
          display: inline-block !important;
          visibility: visible !important;
          opacity: 1 !important;
          color: #000000 !important;
        }
        
        /* Pastikan span inline tetap inline */
        .dashboard-container span {
          display: inline-block !important;
        }
        
        /* Pastikan background color tetap muncul untuk elemen yang perlu */
        [class*="bg-white"],
        [class*="bg-gray"],
        [class*="bg-blue"]:not([class*="bg-blue-500"]):not([class*="bg-blue-600"]):not([class*="bg-blue-700"]):not([class*="bg-blue-800"]):not([class*="bg-blue-900"]),
        [class*="from-blue-500"],
        [class*="from-blue-600"],
        [class*="from-blue-700"],
        [class*="to-blue-500"],
        [class*="to-blue-600"],
        [class*="to-blue-700"],
        div[class*="bg-blue-50"],
        div[class*="bg-blue-100"],
        div[class*="bg-blue-200"],
        div[class*="bg-blue-600"],
        div[class*="bg-blue-700"],
        div[class*="bg-blue-800"],
        div[class*="bg-gray-100"],
        div[class*="bg-gray-50"] {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          color-adjust: exact !important;
        }
        
        /* PASTIKAN LABEL OPERASIONAL DAN NON OPERASIONAL MUNCUL - SELECTOR LEBIH SPESIFIK */
        div.flex.justify-between.items-center.bg-blue-50,
        div[class*="flex"][class*="justify-between"][class*="items-center"][class*="bg-blue-50"],
        div[class*="bg-blue-50"][class*="px-3"],
        div[class*="bg-blue-50"][class*="py-2"],
        div[class*="bg-blue-50"][class*="rounded"] {
          display: flex !important;
          visibility: visible !important;
          opacity: 1 !important;
          background-color: #eff6ff !important; /* bg-blue-50 */
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          color-adjust: exact !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
          flex-direction: row !important;
          justify-content: space-between !important;
          align-items: center !important;
          padding: 0.5rem 0.75rem !important;
          border-radius: 0.25rem !important;
        }
        
        div.flex.justify-between.items-center.bg-blue-100,
        div[class*="flex"][class*="justify-between"][class*="items-center"][class*="bg-blue-100"],
        div[class*="bg-blue-100"][class*="px-3"],
        div[class*="bg-blue-100"][class*="py-2"],
        div[class*="bg-blue-100"][class*="rounded"] {
          display: flex !important;
          visibility: visible !important;
          opacity: 1 !important;
          background-color: #dbeafe !important; /* bg-blue-100 */
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          color-adjust: exact !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
          flex-direction: row !important;
          justify-content: space-between !important;
          align-items: center !important;
          padding: 0.5rem 0.75rem !important;
          border-radius: 0.25rem !important;
        }
        
        /* Pastikan icon (w-4 h-4) muncul - SELECTOR LEBIH SPESIFIK */
        div.w-4.h-4.bg-blue-200.rounded,
        div[class*="w-4"][class*="h-4"][class*="bg-blue-200"][class*="rounded"],
        div[class*="w-4"][class*="h-4"][class*="bg-blue-200"][class*="mr-2"] {
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
          width: 16px !important;
          height: 16px !important;
          min-width: 16px !important;
          min-height: 16px !important;
          background-color: #bfdbfe !important; /* bg-blue-200 */
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          color-adjust: exact !important;
          border-radius: 0.25rem !important;
          margin-right: 0.5rem !important;
        }
        
        div.w-4.h-4.bg-blue-600.rounded,
        div[class*="w-4"][class*="h-4"][class*="bg-blue-600"][class*="rounded"],
        div[class*="w-4"][class*="h-4"][class*="bg-blue-600"][class*="mr-2"] {
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
          width: 16px !important;
          height: 16px !important;
          min-width: 16px !important;
          min-height: 16px !important;
          background-color: #2563eb !important; /* bg-blue-600 */
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          color-adjust: exact !important;
          border-radius: 0.25rem !important;
          margin-right: 0.5rem !important;
        }
        
        /* Pastikan container flex items-center muncul */
        div.flex.items-center,
        div[class*="flex"][class*="items-center"] {
          display: flex !important;
          visibility: visible !important;
          opacity: 1 !important;
          flex-direction: row !important;
          align-items: center !important;
        }
        
        /* Pastikan text "Operasional" dan "Non Operasional" muncul - SELECTOR LEBIH SPESIFIK */
        span.text-gray-700,
        span[class*="text-gray-700"],
        div[class*="bg-blue-50"] span.text-gray-700,
        div[class*="bg-blue-100"] span.text-gray-700,
        div[class*="flex"][class*="items-center"] span.text-gray-700 {
          display: inline-block !important;
          visibility: visible !important;
          opacity: 1 !important;
          color: #000000 !important;
          font-size: 0.875rem !important;
          line-height: 1.25rem !important;
        }
        
        /* Pastikan nilai "X Org" muncul */
        span.font-semibold.text-gray-800,
        span[class*="font-semibold"][class*="text-gray-800"],
        div[class*="bg-blue-50"] span[class*="font-semibold"],
        div[class*="bg-blue-100"] span[class*="font-semibold"] {
          display: inline-block !important;
          visibility: visible !important;
          opacity: 1 !important;
          color: #000000 !important;
          font-weight: 600 !important;
          font-size: 0.875rem !important;
        }
        
        /* Pastikan semua span di dalam label container muncul */
        div[class*="bg-blue-50"] span,
        div[class*="bg-blue-100"] span,
        div[class*="flex"][class*="justify-between"] span,
        div[class*="flex"][class*="items-center"] span {
          display: inline-block !important;
          visibility: visible !important;
          opacity: 1 !important;
          color: #000000 !important;
        }
        
        /* Pastikan semua elemen di dalam label container muncul */
        div[class*="bg-blue-50"] > *,
        div[class*="bg-blue-100"] > *,
        div[class*="flex"][class*="justify-between"][class*="items-center"] > *,
        div[class*="flex"][class*="items-center"] > * {
          display: flex !important;
          visibility: visible !important;
          opacity: 1 !important;
        }
        
        div[class*="flex"][class*="justify-between"][class*="items-center"] > span {
          display: inline-block !important;
        }
        
        /* Pastikan space-y-2 container muncul */
        div.space-y-2.text-sm,
        div[class*="space-y-2"][class*="text-sm"],
        div[class*="space-y-2"],
        div[class*="text-center"] > div[class*="space-y-2"] {
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
          font-size: 0.875rem !important;
        }
        
        /* Pastikan semua child di dalam space-y-2 muncul */
        div[class*="space-y-2"] > div,
        div[class*="space-y-2"] > div[class*="flex"] {
          display: flex !important;
          visibility: visible !important;
          opacity: 1 !important;
          margin-bottom: 0.5rem !important;
        }
        
        div[class*="space-y-2"] > div:last-child {
          margin-bottom: 0 !important;
        }
        
        /* Pastikan text-center container muncul */
        div[class*="text-center"] {
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
          text-align: center !important;
        }
        
        /* Pastikan total "Org" muncul */
        div[class*="text-2xl"][class*="font-bold"][class*="text-gray-800"][class*="mb-2"] {
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
          color: #000000 !important;
          font-size: 1.5rem !important;
          font-weight: bold !important;
        }
        
        /* PASTIKAN SEMUA ELEMEN DI DALAM DASHBOARD MUNCUL */
        .dashboard-container * {
          visibility: visible !important;
        }
        
        /* Override untuk elemen yang mungkin disembunyikan */
        .dashboard-container div[class*="overflow-x-auto"],
        .dashboard-container div[class*="space-y-2"],
        .dashboard-container div[class*="text-center"],
        .dashboard-container div[class*="mb-2"],
        .dashboard-container div[class*="mb-4"],
        .dashboard-container div[class*="mb-6"],
        .dashboard-container div[class*="mt-6"],
        .dashboard-container div[class*="pt-6"],
        .dashboard-container div[class*="border-t"] {
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
        }
        
        /* Pastikan legend muncul */
        .dashboard-container div[class*="flex"][class*="justify-center"][class*="gap-6"] {
          display: flex !important;
          visibility: visible !important;
          opacity: 1 !important;
        }
        
        /* ATURAN KHUSUS UNTUK MEMASTIKAN CANVAS CHART MUNCUL - OVERRIDE SEMUA */
        canvas,
        canvas[style*="display"],
        canvas[style*="visibility"],
        canvas[style*="opacity"],
        canvas[style*="none"],
        canvas[style*="hidden"] {
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
          width: 100% !important;
          height: 128px !important;
          min-height: 128px !important;
          max-width: 100% !important;
          position: relative !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          color-adjust: exact !important;
          background: transparent !important;
        }
        
        /* Pastikan semua parent dari canvas terlihat */
        div:has(> canvas),
        div:has(canvas),
        div[class*="h-32"]:has(canvas),
        div[class*="bg-white"]:has(canvas) {
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
          height: 128px !important;
          min-height: 128px !important;
        }
        
        /* Pastikan chart wrapper div terlihat */
        div[class*="h-32"][class*="mb-2"]:has(canvas),
        div[class*="h-32"]:has(canvas) {
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
          height: 128px !important;
          min-height: 128px !important;
          overflow: visible !important;
        }
        
        /* Pastikan grid container chart terlihat */
        div[class*="grid"][class*="grid-cols-1"][class*="md:grid-cols-2"][class*="lg:grid-cols-4"],
        div[class*="grid"][class*="grid-cols-1"][class*="md:grid-cols-2"][class*="lg:grid-cols-4"][class*="gap-6"] {
          display: grid !important;
          visibility: visible !important;
          opacity: 1 !important;
          grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
        }
        
        /* Pastikan setiap chart card terlihat */
        div[class*="bg-white"][class*="rounded-lg"][class*="p-4"][class*="border"][class*="border-gray-200"] {
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
      }
    `,
        }}
      />
    </div>
  );
}
