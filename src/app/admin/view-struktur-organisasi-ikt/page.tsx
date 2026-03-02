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

export default function ViewStrukturOrganisasiIKTPage() {
  const [selectedDirektorat, setSelectedDirektorat] = useState<string>("all"); // Default to "all" for IKT
  const [selectedPeriod, setSelectedPeriod] = useState<string>("");
  const [availablePeriods, setAvailablePeriods] = useState<Period[]>([]);
  const [direktoratList, setDirektoratList] = useState<Direktorat[]>([]);
  const [loading, setLoading] = useState(false);
  const strukturOrgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchAvailablePeriodsAndDaerah();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchAvailablePeriodsAndDaerah = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/ikt-struktur-organisasi/available-periods", {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      });
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error(`[ViewStrukturOrganisasi IKT] API error: ${response.status} - ${errorText}`);
        
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }
        
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        console.error(`[ViewStrukturOrganisasi IKT] API returned error:`, result.error);
        throw new Error(result.error || 'Failed to fetch data');
      }
      
      if (result.data) {
        const periods = result.data.periods || [];
        const directorates = (result.data.directorates || []) as Direktorat[];
        
        console.log(`[ViewStrukturOrganisasi IKT] Received ${periods.length} periods and ${directorates.length} directorates from API`);
        
        setAvailablePeriods(periods);
        setDirektoratList(directorates);
        
        if (periods.length > 0) {
          const latestPeriod = periods[0].value;
          if (!selectedPeriod || selectedPeriod !== latestPeriod) {
            setSelectedPeriod(latestPeriod);
            console.log(`[ViewStrukturOrganisasi IKT] Set default period to: ${latestPeriod}`);
          }
        }
        
        // Default selectedDirektorat is already "all"
        
        console.log(`[ViewStrukturOrganisasi IKT] Loaded ${periods.length} periods and ${directorates.length} directorates`);
      } else {
        console.warn(`[ViewStrukturOrganisasi IKT] No data in response`);
        setAvailablePeriods([]);
        setDirektoratList([]);
      }
      } catch (error: any) {
        console.error("Error fetching available periods and directorates:", error);
        const errorMessage = error.message || 'Unknown error';
        console.error(`[ViewStrukturOrganisasi IKT] Error details:`, errorMessage);
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

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Popup diblokir. Izinkan popup untuk mencetak.");
      return;
    }

    const periodLabel = availablePeriods.find(p => p.value === selectedPeriod)?.label || selectedPeriod;

    const orgElements: HTMLElement[] = [];
    if (selectedDirektorat === "all") {
      // Ambil semua container untuk setiap direktorat
      const allContainers = document.querySelectorAll('[data-org-chart-container]');
      allContainers.forEach((container) => {
        const cloned = container.cloneNode(true) as HTMLElement;
        orgElements.push(cloned);
      });
    } else {
      if (!strukturOrgRef.current) {
        alert("Elemen struktur organisasi tidak ditemukan");
        return;
      }
      const cloned = strukturOrgRef.current.cloneNode(true) as HTMLElement;
      orgElements.push(cloned);
    }

    let orgChartsHTML = '';
    if (selectedDirektorat === "all") {
      direktoratList.forEach((direktorat, index) => {
        if (orgElements[index]) {
          orgChartsHTML += `
            <div class="print-direktorat-section" style="page-break-after: always; margin-bottom: 40px;">
              <div class="print-header">
                <h1>STRUKTUR ORGANISASI IKT - ${direktorat.label}</h1>
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
      const direktoratLabel = direktoratList.find(d => d.value === selectedDirektorat)?.label || selectedDirektorat;
      orgChartsHTML = `
        <div class="print-header">
          <h1>STRUKTUR ORGANISASI IKT - ${direktoratLabel}</h1>
          <p>Periode: ${periodLabel}</p>
        </div>
        <div class="print-container">
          ${orgElements[0]?.innerHTML || ''}
        </div>
      `;
    }
    
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

    const printTitle = selectedDirektorat === "all" 
      ? "Semua Direktorat" 
      : (direktoratList.find(d => d.value === selectedDirektorat)?.label || selectedDirektorat);
    
    const printHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Struktur Organisasi IKT - ${printTitle}</title>
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
              /* Page break untuk setiap direktorat */
              .print-direktorat-section {
                page-break-after: always !important;
                margin-bottom: 40px !important;
              }
              .print-direktorat-section:last-child {
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
                Lihat Struktur Organisasi IKT
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
            // Tampilkan semua direktorat secara terpisah
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
                  <div className="h-[calc(100vh-120px)] w-full" data-org-chart-container data-direktorat={direktorat.value}>
                    <DashboardOrgChart
                      daerahId="all"
                      selectedPeriod={selectedPeriod}
                      divisi="IKT"
                      direktoratName={direktorat.value}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // Tampilkan satu direktorat saja - full screen
            <div className="flex-1 flex flex-col h-[calc(100vh-100px)]">
              <div className="bg-white px-4 py-2 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-800">
                  Struktur Organisasi - {direktoratList.find(d => d.value === selectedDirektorat)?.label || selectedDirektorat}
                </h2>
                <p className="text-sm text-gray-600">
                  Periode: {availablePeriods.find(p => p.value === selectedPeriod)?.label || selectedPeriod}
                </p>
              </div>
              <div ref={strukturOrgRef} className="flex-1 w-full" data-org-chart-container data-direktorat={selectedDirektorat}>
                <DashboardOrgChart
                  daerahId="all"
                  selectedPeriod={selectedPeriod}
                  divisi="IKT"
                  direktoratName={selectedDirektorat}
                />
              </div>
            </div>
          )
        ) : (
          <div className="flex-1 flex items-center justify-center bg-white">
            <p className="text-gray-500 text-lg">
              Pilih periode untuk menampilkan struktur organisasi
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

