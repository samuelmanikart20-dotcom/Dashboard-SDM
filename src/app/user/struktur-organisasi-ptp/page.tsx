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
  const [selectedDirektorat, setSelectedDirektorat] = useState<string>("");
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
      const response = await fetch("/api/admin/ptp-struktur-organisasi/available-periods", {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      });
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error(`[ViewStrukturOrganisasi PTP User] API error: ${response.status} - ${errorText}`);
        
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
        console.error(`[ViewStrukturOrganisasi PTP User] API returned error:`, result.error);
        throw new Error(result.error || 'Failed to fetch data');
      }
      
      if (result.data) {
        const periods = result.data.periods || [];
        const directorates = (result.data.directorates || []) as Direktorat[];
        
        console.log(`[ViewStrukturOrganisasi PTP User] Received ${periods.length} periods and ${directorates.length} directorates from API`);
        
        setAvailablePeriods(periods);
        setDirektoratList(directorates);
        
        if (periods.length > 0) {
          const latestPeriod = periods[0].value;
          if (!selectedPeriod || selectedPeriod !== latestPeriod) {
            setSelectedPeriod(latestPeriod);
            console.log(`[ViewStrukturOrganisasi PTP User] Set default period to: ${latestPeriod}`);
          }
        }
        
        if (directorates.length > 0) {
          const firstDirektorat = directorates[0].value;
          if (!selectedDirektorat || selectedDirektorat !== firstDirektorat) {
            setSelectedDirektorat(firstDirektorat);
            console.log(`[ViewStrukturOrganisasi PTP User] Set default directorate to: ${firstDirektorat}`);
          }
        }
        
        console.log(`[ViewStrukturOrganisasi PTP User] Loaded ${periods.length} periods and ${directorates.length} directorates`);
      } else {
        console.warn(`[ViewStrukturOrganisasi PTP User] No data in response`);
        setAvailablePeriods([]);
        setDirektoratList([]);
      }
    } catch (error: any) {
      console.error("Error fetching available periods and daerah:", error);
      const errorMessage = error.message || 'Unknown error';
      console.error(`[ViewStrukturOrganisasi PTP User] Error details:`, errorMessage);
      setAvailablePeriods([]);
      setDirektoratList([]);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    if (!selectedDirektorat || selectedDirektorat === "") {
      alert("Pilih direktorat terlebih dahulu");
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
      : (direktoratList.find(d => d.value === selectedDirektorat)?.label || "Direktorat");
    
    const printHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Struktur Organisasi PTP - ${printTitle}</title>
          <style>
            ${styles}
            @page {
              size: auto;
              margin: 1cm;
            }
            @media print {
              * {
                box-shadow: none !important;
              }
              *::before,
              *::after {
                display: none !important;
                content: none !important;
              }
              html, body {
                margin: 0;
                padding: 0;
                background: white;
                width: 100%;
                max-width: 100%;
                overflow: visible !important;
              }
              /* Ensure all parent containers allow overflow */
              body > * {
                overflow: visible !important;
              }
              .print-header {
                text-align: center;
                margin-bottom: 20px;
                padding-bottom: 10px;
                border-bottom: 2px solid #1E40AF;
                page-break-after: avoid;
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
                max-width: 100%;
                overflow: visible !important;
                transform-origin: top left;
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                gap: 20px;
              }
              /* Ensure print container doesn't clip content */
              .print-container > * {
                overflow: visible !important;
              }
              @media print and (orientation: landscape) {
                .print-container {
                  grid-template-columns: repeat(3, 1fr);
                }
              }
              @media print and (orientation: portrait) {
                .print-container {
                  grid-template-columns: repeat(2, 1fr);
                }
                @media (max-width: 21cm) {
                  .print-container {
                    grid-template-columns: 1fr;
                  }
                }
              }
              .react-flow {
                transform: scale(0.6) !important;
                transform-origin: top left !important;
                width: 166.67% !important;
                height: 166.67% !important;
                page-break-inside: avoid;
                overflow: visible !important;
              }
              /* Ensure ReactFlow viewport doesn't clip edges */
              .react-flow__viewport {
                overflow: visible !important;
              }
              .react-flow__renderer {
                overflow: visible !important;
              }
              .react-flow__container {
                overflow: visible !important;
              }
              .react-flow__controls,
              .react-flow__background {
                display: none !important;
              }
              .react-flow__node {
                opacity: 1 !important;
                visibility: visible !important;
                display: block !important;
                page-break-inside: avoid !important;
                break-inside: avoid !important;
                margin: 10px !important;
              }
              .react-flow__node > div {
                box-shadow: none !important;
                border: 1px solid #d1d5db !important;
                background: white !important;
                gap: 12px !important;
                padding: 16px !important;
                min-width: 280px !important;
                page-break-inside: avoid !important;
                break-inside: avoid !important;
              }
              .react-flow__node > div::before,
              .react-flow__node > div::after {
                display: none !important;
                content: none !important;
              }
              /* Ensure all edges are visible */
              .react-flow__edge {
                opacity: 1 !important;
                visibility: visible !important;
                display: block !important;
                pointer-events: none !important;
              }
              .react-flow__edge path {
                stroke: #374151 !important;
                stroke-width: 3 !important;
                fill: none !important;
                opacity: 1 !important;
                visibility: visible !important;
                display: block !important;
              }
              .react-flow__edge-path {
                stroke: #374151 !important;
                stroke-width: 3 !important;
                fill: none !important;
                opacity: 1 !important;
                visibility: visible !important;
                display: block !important;
              }
              .react-flow__edge-text {
                opacity: 1 !important;
                visibility: visible !important;
              }
              /* Ensure all SVG elements are visible */
              svg {
                overflow: visible !important;
              }
              svg.react-flow__arrowhead {
                opacity: 1 !important;
                visibility: visible !important;
                display: block !important;
                overflow: visible !important;
              }
              .react-flow__arrowhead {
                fill: #374151 !important;
                stroke: #374151 !important;
                opacity: 1 !important;
                visibility: visible !important;
                display: block !important;
              }
              /* Ensure all markers are visible */
              marker {
                opacity: 1 !important;
                visibility: visible !important;
                display: block !important;
                overflow: visible !important;
                overflow-x: visible !important;
                overflow-y: visible !important;
              }
              marker path {
                fill: #374151 !important;
                stroke: #374151 !important;
                stroke-width: 1 !important;
                opacity: 1 !important;
                visibility: visible !important;
                display: block !important;
              }
              /* Ensure markers are positioned correctly and not clipped */
              marker[markerWidth][markerHeight] {
                overflow: visible !important;
                viewBox: 0 0 25 25 !important;
              }
              /* Ensure ReactFlow SVG container is visible */
              .react-flow__edges {
                opacity: 1 !important;
                visibility: visible !important;
                display: block !important;
                overflow: visible !important;
                width: 100% !important;
                height: 100% !important;
              }
              /* Ensure SVG elements don't clip markers */
              .react-flow__edges svg {
                overflow: visible !important;
                width: 100% !important;
                height: 100% !important;
              }
              /* Ensure markers are not clipped */
              .react-flow__edges svg defs {
                overflow: visible !important;
              }
              /* Ensure edge paths extend beyond node boundaries */
              .react-flow__edge path {
                vector-effect: non-scaling-stroke !important;
              }
              .react-flow__edge.selected {
                opacity: 1 !important;
                visibility: visible !important;
              }
              /* Ensure step edges (orthogonal) are visible */
              .react-flow__edge-step {
                opacity: 1 !important;
                visibility: visible !important;
              }
              .react-flow__edge-step path {
                stroke: #374151 !important;
                stroke-width: 3 !important;
                fill: none !important;
                opacity: 1 !important;
                visibility: visible !important;
              }
              .react-flow__handle {
                width: 0 !important;
                height: 0 !important;
                opacity: 0 !important;
                background: transparent !important;
                border: none !important;
                display: none !important;
              }
              .react-flow__handle-top,
              .react-flow__handle-bottom,
              .react-flow__handle-left,
              .react-flow__handle-right {
                width: 0 !important;
                height: 0 !important;
                opacity: 0 !important;
                background: transparent !important;
                border: none !important;
                display: none !important;
              }
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
              .print-daerah-section {
                page-break-after: always !important;
                margin-bottom: 40px !important;
                page-break-inside: avoid;
              }
              .print-daerah-section:last-child {
                page-break-after: auto !important;
              }
            }
            body {
              font-family: Arial, Helvetica, sans-serif;
              background: white;
              padding: 20px;
              width: 100%;
              max-width: 100%;
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
              max-width: 100%;
              overflow: hidden;
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
              gap: 20px;
            }
            .react-flow {
              transform: scale(0.6) !important;
              transform-origin: top left !important;
              width: 166.67% !important;
              height: 166.67% !important;
            }
            .react-flow__controls,
            .react-flow__background {
              display: none !important;
            }
            .react-flow__node > div {
              box-shadow: none !important;
              border: 1px solid #d1d5db !important;
              background: white !important;
            }
            .react-flow__node > div::before,
            .react-flow__node > div::after {
              display: none !important;
              content: none !important;
            }
            .react-flow__handle {
              width: 0 !important;
              height: 0 !important;
              opacity: 0 !important;
              background: transparent !important;
              border: none !important;
              display: none !important;
            }
            .react-flow__handle-top,
            .react-flow__handle-bottom,
            .react-flow__handle-left,
            .react-flow__handle-right {
              width: 0 !important;
              height: 0 !important;
              opacity: 0 !important;
              background: transparent !important;
              border: none !important;
              display: none !important;
            }
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
            .react-flow__node {
              margin: 15px !important;
            }
            .react-flow__node > div {
              gap: 12px !important;
            }
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
                Lihat bagan struktur organisasi berdasarkan periode dan direktorat yang dipilih (Mode View Only)
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
                disabled={!selectedDirektorat || selectedDirektorat === "" || !selectedPeriod}
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
        {selectedDirektorat && selectedDirektorat !== "" && selectedPeriod ? (
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
                        readOnly={true}
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
                  readOnly={true}
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

