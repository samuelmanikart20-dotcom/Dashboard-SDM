"use client";

import { useState, useEffect, useRef } from "react";
import DashboardOrgChart from "@/components/DashboardOrgChart";

interface Period {
  bulan: number;
  tahun: number;
  bulanName: string;
  label: string;
  value: string;
}

interface Direktorat {
  value: string;
  label: string;
}

export default function ViewStrukturOrganisasiPTPPage() {
  const [selectedDirektorat, setSelectedDirektorat] = useState<string>("all"); // Default to "all" like IKT
  const [selectedPeriod, setSelectedPeriod] = useState<string>("");
  const [availablePeriods, setAvailablePeriods] = useState<Period[]>([]);
  const [direktoratList, setDirektoratList] = useState<Direktorat[]>([]);
  const [loading, setLoading] = useState(false);
  const strukturOrgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchAvailablePeriodsAndDaerah();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refresh data setiap 10 detik untuk menangkap update dari upload (opsional, bisa di-disable jika tidak diperlukan)
  // useEffect(() => {
  //   const interval = setInterval(() => {
  //     fetchAvailablePeriodsAndDaerah();
  //   }, 10000);
  //   return () => clearInterval(interval);
  // }, []);

  const fetchAvailablePeriodsAndDaerah = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/ptp-struktur-organisasi/available-periods", {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      });
      
      // Cek apakah response ok
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error(`[ViewStrukturOrganisasi PTP] API error: ${response.status} - ${errorText}`);
        
        // Coba parse sebagai JSON jika mungkin
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }
        
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      // Cek apakah response success
      if (!result.success) {
        console.error(`[ViewStrukturOrganisasi PTP] API returned error:`, result.error);
        throw new Error(result.error || 'Failed to fetch data');
      }
      
      if (result.data) {
        const periods = result.data.periods || [];
        const directorates = (result.data.directorates || []) as Direktorat[];
        
        console.log(`[ViewStrukturOrganisasi PTP] Received ${periods.length} periods and ${directorates.length} directorates from API`);
        console.log(`[ViewStrukturOrganisasi PTP] Directorate list:`, directorates);
        
        setAvailablePeriods(periods);
        setDirektoratList(directorates);
        
        // Set default period (latest) - hanya jika belum ada atau berbeda
        if (periods.length > 0) {
          const latestPeriod = periods[0].value;
          if (!selectedPeriod || selectedPeriod !== latestPeriod) {
            setSelectedPeriod(latestPeriod);
            console.log(`[ViewStrukturOrganisasi PTP] Set default period to: ${latestPeriod}`);
          }
        }
        
        // Default selectedDirektorat is already "all" (like IKT)
        
        console.log(`[ViewStrukturOrganisasi PTP] Loaded ${periods.length} periods and ${directorates.length} directorates`);
      } else {
        console.warn(`[ViewStrukturOrganisasi PTP] No data in response`);
        setAvailablePeriods([]);
        setDirektoratList([]);
      }
    } catch (error: any) {
      console.error("Error fetching available periods and daerah:", error);
      // Tampilkan error message yang lebih informatif
      const errorMessage = error.message || 'Unknown error';
      console.error(`[ViewStrukturOrganisasi PTP] Error details:`, errorMessage);
      // Jangan tampilkan alert yang mengganggu, cukup log error
      // User akan melihat "Tidak ada data" di dropdown
      setAvailablePeriods([]);
      setDirektoratList([]);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    if (!selectedPeriod) {
      alert("Pilih periode terlebih dahulu");
      return;
    }

    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Popup diblokir. Izinkan popup untuk mencetak.");
      return;
    }

    const periodLabel = availablePeriods.find(p => p.value === selectedPeriod)?.label || selectedPeriod;

    // Jika "Semua Direktorat", ambil semua chart containers
    const orgElements: HTMLElement[] = [];
    if (selectedDirektorat === "all") {
      const allContainers = document.querySelectorAll('[data-org-chart-container]');
      allContainers.forEach((container) => {
        const cloned = container.cloneNode(true) as HTMLElement;
        orgElements.push(cloned);
      });
    } else {
      // Satu direktorat saja
      if (!strukturOrgRef.current) {
        alert("Elemen struktur organisasi tidak ditemukan");
        return;
      }
      const cloned = strukturOrgRef.current.cloneNode(true) as HTMLElement;
      orgElements.push(cloned);
    }

    // Build HTML untuk semua direktorat
    let orgChartsHTML = '';
    if (selectedDirektorat === "all") {
      direktoratList.forEach((direktorat, index) => {
        if (orgElements[index]) {
          orgChartsHTML += `
            <div class="print-daerah-section" style="page-break-after: always; margin-bottom: 40px;">
              <div class="print-header">
                <h1>STRUKTUR ORGANISASI PTP - ${direktorat.label}</h1>
                <p>Periode: ${periodLabel}</p>
              </div>
              <div class="print-container">
                ${orgElements[index].innerHTML}
              </div>
            </div>
          `;
        }
      });
    } else {
      const direktoratName = direktoratList.find(d => d.value === selectedDirektorat)?.label || "Direktorat";
      orgChartsHTML = `
        <div class="print-header">
          <h1>STRUKTUR ORGANISASI PTP - ${direktoratName}</h1>
          <p>Periode: ${periodLabel}</p>
        </div>
        <div class="print-container">
          ${orgElements[0]?.innerHTML || ''}
        </div>
      `;
    }
    
    // Get all styles from the current document
    const styles = Array.from(document.styleSheets)
      .map(styleSheet => {
        try {
          return Array.from(styleSheet.cssRules || [])
            .map(rule => rule.cssText)
            .join('\n');
        } catch {
          return '';
        }
      })
      .join('\n');

    // Create HTML for print window
    const printTitle = selectedDirektorat === "all" 
      ? "Semua Direktorat" 
      : (direktoratList.find(d => d.value === selectedDirektorat)?.label || "Direktorat");
    
    const printHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Struktur Organisasi PTP - ${printTitle}</title>
          <style>
            ${styles}
            @page {
              size: A3 landscape;
              margin: 15mm;
            }
            @media print {
              body {
                margin: 0;
                padding: 0;
                background: white;
              }
              .print-header {
                text-align: center;
                margin-bottom: 20px;
                padding-bottom: 10px;
                border-bottom: 2px solid #1E40AF;
              }
              .print-header h1 {
                font-size: 24px;
                font-weight: bold;
                color: #1E40AF;
                margin: 0 0 5px 0;
              }
              .print-header p {
                font-size: 14px;
                color: #666;
                margin: 0;
              }
              .print-container {
                width: 100%;
                height: 100%;
                overflow: visible;
                transform-origin: top left;
              }
              /* Scale down ReactFlow untuk fit di halaman */
              .react-flow {
                transform: scale(0.6) !important;
                transform-origin: top left !important;
                width: 166.67% !important;
                height: 166.67% !important;
              }
              /* Hide ReactFlow controls in print */
              .react-flow__controls,
              .react-flow__background {
                display: none !important;
              }
              /* Ensure all nodes are visible */
              .react-flow__node {
                opacity: 1 !important;
                visibility: visible !important;
                display: block !important;
              }
              /* Ensure all edges are visible */
              .react-flow__edge {
                opacity: 1 !important;
                visibility: visible !important;
                display: block !important;
              }
              /* Ensure profile photos are visible and larger in print */
              img {
                display: block !important;
                opacity: 1 !important;
                visibility: visible !important;
                width: 80px !important;
                height: 80px !important;
                min-width: 80px !important;
                min-height: 80px !important;
                object-fit: cover !important;
              }
              
              /* Increase spacing between nodes */
              .react-flow__node {
                margin: 15px !important;
              }
              
              /* Increase gap in node layout */
              .react-flow__node > div {
                gap: 12px !important;
              }
              
              /* Make node cards larger */
              .react-flow__node > div {
                padding: 16px !important;
                min-width: 280px !important;
              }
              /* Page break untuk setiap daerah */
              .print-daerah-section {
                page-break-after: always !important;
                margin-bottom: 40px !important;
              }
              .print-daerah-section:last-child {
                page-break-after: auto !important;
              }
            }
            body {
              font-family: Arial, Helvetica, sans-serif;
              background: white;
              padding: 20px;
            }
            .print-header {
              text-align: center;
              margin-bottom: 20px;
              padding-bottom: 10px;
              border-bottom: 2px solid #1E40AF;
            }
            .print-header h1 {
              font-size: 24px;
              font-weight: bold;
              color: #1E40AF;
              margin: 0 0 5px 0;
            }
            .print-header p {
              font-size: 14px;
              color: #666;
              margin: 0;
            }
            .print-container {
              width: 100%;
              height: 100%;
              overflow: hidden;
            }
            /* Scale down ReactFlow untuk fit di halaman */
            .react-flow {
              transform: scale(0.6) !important;
              transform-origin: top left !important;
              width: 166.67% !important;
              height: 166.67% !important;
            }
            /* Hide ReactFlow controls */
            .react-flow__controls,
            .react-flow__background {
              display: none !important;
            }
            
            /* Ensure profile photos are visible and larger */
            img {
              display: block !important;
              opacity: 1 !important;
              visibility: visible !important;
              width: 80px !important;
              height: 80px !important;
              min-width: 80px !important;
              min-height: 80px !important;
              object-fit: cover !important;
            }
            
            /* Increase spacing between nodes */
            .react-flow__node {
              margin: 15px !important;
            }
            
            /* Increase gap in node layout */
            .react-flow__node > div {
              gap: 12px !important;
            }
            
            /* Make node cards larger */
            .react-flow__node > div {
              padding: 16px !important;
              min-width: 280px !important;
            }
          </style>
        </head>
        <body>
          ${orgChartsHTML}
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
                window.onafterprint = function() {
                  window.close();
                };
              }, 500);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(printHTML);
    printWindow.document.close();
  };


  return (
    <div className="bg-gray-50 min-h-screen flex flex-col">
      <div className="w-full">
        {/* Header */}
        <div className="bg-white shadow-lg p-4 border-b border-gray-200">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-blue-900 mb-1 flex items-center gap-2">
                <span className="inline-block w-2 h-6 bg-blue-600 rounded mr-2"></span>
                Lihat Struktur Organisasi PTP
              </h1>
              <p className="text-gray-600 text-sm">
                Lihat bagan struktur organisasi berdasarkan periode dan direktorat yang dipilih
              </p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-700 font-medium">Direktorat:</label>
                <select
                  value={selectedDirektorat}
                  onChange={(e) => setSelectedDirektorat(e.target.value)}
                  className="px-3 py-2 border rounded-md text-gray-800 text-sm min-w-[200px]"
                  disabled={loading || direktoratList.length === 0}
                >
                  {loading ? (
                    <option value="">Memuat...</option>
                  ) : direktoratList.length === 0 ? (
                    <option value="">Tidak ada data</option>
                  ) : (
                    <>
                      <option value="">Pilih Direktorat...</option>
                      <option value="all">Semua Direktorat</option>
                      {direktoratList.map((d) => (
                        <option key={d.value} value={d.value}>
                          {d.label}
                        </option>
                      ))}
                    </>
                  )}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-700 font-medium">Periode:</label>
                <select
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                  className="px-3 py-2 border rounded-md text-gray-800 text-sm min-w-[200px]"
                  disabled={loading || availablePeriods.length === 0}
                >
                  {loading ? (
                    <option value="">Memuat...</option>
                  ) : availablePeriods.length === 0 ? (
                    <option value="">Tidak ada periode</option>
                  ) : (
                    <>
                      <option value="">Pilih Periode...</option>
                      {availablePeriods.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </>
                  )}
                </select>
              </div>
              <button
                onClick={handlePrint}
                disabled={!selectedPeriod}
                className="px-4 py-2 bg-green-600 text-white rounded-lg shadow hover:bg-green-700 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print
              </button>
            </div>
          </div>
        </div>

            {/* Struktur Organisasi */}
            {selectedPeriod ? (
              selectedDirektorat === "all" ? (
                direktoratList.length > 0 ? (
                  <div className="flex-1 overflow-auto">
                    {direktoratList.map((direktorat) => (
                      <div key={direktorat.value} className="h-screen w-full">
                        <div className="bg-white px-4 py-2 border-b border-gray-200">
                          <h2 className="text-lg font-semibold text-gray-800">
                            Struktur Organisasi - {direktorat.label}
                          </h2>
                          <p className="text-sm text-gray-600">
                            Periode: {availablePeriods.find(p => p.value === selectedPeriod)?.label || selectedPeriod}
                          </p>
                        </div>
                        <div className="h-[calc(100vh-120px)] w-full" data-org-chart-container>
                          <DashboardOrgChart
                            daerahId="all"
                            selectedPeriod={selectedPeriod}
                            divisi="PTP"
                            direktoratName={direktorat.value}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center bg-white">
                    <p className="text-gray-500 text-lg">
                      Tidak ada data direktorat yang tersedia
                    </p>
                  </div>
                )
              ) : (
                <div className="flex-1 flex flex-col h-[calc(100vh-100px)]">
                  <div className="bg-white px-4 py-2 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-800">
                      Struktur Organisasi - {direktoratList.find(d => d.value === selectedDirektorat)?.label || selectedDirektorat}
                    </h2>
                    <p className="text-sm text-gray-600">
                      Periode: {availablePeriods.find(p => p.value === selectedPeriod)?.label || selectedPeriod}
                    </p>
                  </div>
                  <div ref={strukturOrgRef} className="flex-1 w-full" data-org-chart-container>
                    <DashboardOrgChart
                      daerahId="all"
                      selectedPeriod={selectedPeriod}
                      divisi="PTP"
                      direktoratName={selectedDirektorat}
                    />
                  </div>
                </div>
              )
            ) : (
              <div className="flex-1 flex items-center justify-center bg-white">
                <p className="text-gray-500 text-lg">
                  Pilih direktorat dan periode untuk menampilkan struktur organisasi
                </p>
              </div>
            )}
      </div>
    </div>
  );
}



