import React, { useState, useMemo } from "react";
import {
  FileSpreadsheet,
  X,
  AlertTriangle,
  Download,
  Search,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Save,
  RefreshCw
} from "lucide-react";
import { formatBytes } from "./UploadProgressPanel";
import { AutoVisualizationContainer } from "../../analytics/components/AutoVisualizationContainer";

export function ClientPreviewWizard({
  activeFile,
  excelSheets = [],
  selectedSheet,
  setSelectedSheet,
  resetUploadWizard,
  parsedData, // { headers, rows }
  isParsingClientSide,
  summaryData,
  validationErrors = [],
  downloadErrorsCsv,
  importAction,
  setImportAction,
  confirmedDataSources = [],
  targetDatasetId,
  setTargetDatasetId,
  handleUploadAndSave
}) {
  // Table search, sorting, and pagination logic
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  const handlePageChange = (dir) => {
    if (dir === "prev") {
      setCurrentPage((p) => Math.max(1, p - 1));
    } else {
      setCurrentPage((p) => p + 1);
    }
  };

  const requestSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  // Limit preview to first 20 rows to avoid DOM overload
  const previewRows = useMemo(() => {
    if (!parsedData?.rows) return [];
    return parsedData.rows.slice(0, 20);
  }, [parsedData]);

  const sortedRows = useMemo(() => {
    let rows = [...previewRows];

    // Apply local search
    if (searchTerm) {
      rows = rows.filter((row) =>
        Object.values(row).some(
          (val) =>
            val !== null &&
            val !== undefined &&
            val.toString().toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    // Apply sort
    if (sortConfig.key) {
      rows.sort((a, b) => {
        let valA = a[sortConfig.key];
        let valB = b[sortConfig.key];

        const numA = Number(valA);
        const numB = Number(valB);

        if (!isNaN(numA) && !isNaN(numB)) {
          return sortConfig.direction === "asc" ? numA - numB : numB - numA;
        }

        valA = (valA || "").toString().toLowerCase();
        valB = (valB || "").toString().toLowerCase();

        if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
        if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return rows;
  }, [previewRows, searchTerm, sortConfig]);

  const totalPages = Math.ceil(sortedRows.length / rowsPerPage);
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return sortedRows.slice(start, start + rowsPerPage);
  }, [sortedRows, currentPage]);

  if (!parsedData) return null;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header Info */}
      <div className="p-4 border-b border-[#1F2937]/40 flex flex-wrap gap-4 justify-between items-center bg-slate-950/25 text-left">
        <div>
          <h4 className="text-xs font-bold text-white flex items-center gap-1.5 truncate max-w-md">
            <FileSpreadsheet className="h-4 w-4 text-[#8B5CF6]" />
            Importing: {activeFile.name}
          </h4>
          <div className="text-[10px] text-gray-400 mt-1 font-mono">
            {formatBytes(activeFile.size)} • {excelSheets.length > 0 ? `${excelSheets.length} sheets` : "CSV Document"}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {excelSheets.length > 0 && (
            <div className="flex items-center gap-2">
              <label className="text-[10px] text-gray-400 font-bold uppercase font-mono">Sheet</label>
              <select
                value={selectedSheet}
                onChange={(e) => {
                  setSelectedSheet(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-8 bg-[#050810]/80 border border-[#1F2937] text-xs text-white rounded-xl px-2.5 outline-none font-semibold hover:border-gray-600 transition-colors"
              >
                {excelSheets.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={resetUploadWizard}
            className="p-1.5 rounded-lg border border-[#1F2937] hover:bg-slate-900 text-gray-400 hover:text-white cursor-pointer transition-colors"
            title="Discard upload"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Scrollable Preview Area */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar min-w-0 max-w-full overflow-x-hidden text-left">
        {isParsingClientSide ? (
          <div className="h-40 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="h-8 w-8 text-[#8B5CF6] animate-spin" />
            <span className="text-xs text-gray-400">Analyzing columns and formats...</span>
          </div>
        ) : (
          <>
            {/* Metadata Summary Cards */}
            {summaryData && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 select-text">
                <div className="p-3.5 bg-slate-900/10 border border-[#1F2937]/40 rounded-xl relative">
                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block font-mono">Row Count</span>
                  <span className="text-lg font-bold text-white mt-1 block">{summaryData.rowsCount}</span>
                </div>
                <div className="p-3.5 bg-slate-900/10 border border-[#1F2937]/40 rounded-xl">
                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block font-mono">Column Count</span>
                  <span className="text-lg font-bold text-white mt-1 block">{summaryData.columnsCount}</span>
                </div>
                <div className="p-3.5 bg-slate-900/10 border border-[#1F2937]/40 rounded-xl">
                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block font-mono">Validation Errors</span>
                  <span className={`text-lg font-bold mt-1 block ${validationErrors.length > 0 ? "text-rose-400" : "text-emerald-400"}`}>
                    {validationErrors.length}
                  </span>
                </div>
                <div className="p-3.5 bg-slate-900/10 border border-[#1F2937]/40 rounded-xl">
                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block font-mono">Estimated Memory</span>
                  <span className="text-lg font-bold text-white mt-1 block">{formatBytes(summaryData.estimatedMemoryBytes)}</span>
                </div>
              </div>
            )}

            {/* Cardinality Alerts */}
            {summaryData && (summaryData.duplicateRowCount > 0 || summaryData.duplicateColCount > 0) && (
              <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl text-amber-300 text-xs flex gap-2 items-center leading-normal">
                <AlertTriangle className="h-4.5 w-4.5 shrink-0" />
                <div>
                  {summaryData.duplicateRowCount > 0 && <span>Found <strong>{summaryData.duplicateRowCount} duplicate rows</strong> in dataset. </span>}
                  {summaryData.duplicateColCount > 0 && <span>Found <strong>{summaryData.duplicateColCount} duplicate columns</strong>. </span>}
                </div>
              </div>
            )}

            {/* Validation Panel */}
            {validationErrors.length > 0 && (
              <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/5 text-rose-300 text-xs space-y-3 font-semibold">
                <div className="flex justify-between items-center flex-wrap gap-2">
                  <div className="flex gap-2 items-center">
                    <AlertTriangle className="h-4.5 w-4.5 text-rose-400 shrink-0" />
                    <span className="font-bold">Schema Validation Warning: {validationErrors.length} issues identified</span>
                  </div>
                  <button
                    onClick={downloadErrorsCsv}
                    className="px-3 py-1.5 border border-rose-500/30 hover:bg-rose-500/10 rounded-lg text-[10px] font-bold cursor-pointer transition-all flex items-center gap-1 text-rose-300"
                  >
                    <Download className="h-3 w-3" />
                    Download Errors CSV
                  </button>
                </div>
                <p className="text-gray-400 text-[11px] leading-relaxed max-w-3xl">
                  Mismatches were found between values and inferred formats. Blank rows or cell values exceeding column bounds will be uploaded as NULL values in MongoDB. Verify or correct columns before committing import.
                </p>
              </div>
            )}

            {/* Local Chart Automated recommendation previews */}
            <div className="mb-2">
              <AutoVisualizationContainer
                initialRows={parsedData.rows}
                initialHeaders={parsedData.headers}
              />
            </div>

            {/* Grid Table sample */}
            <div className="bg-[#0A0E1A] border border-[#1F2937]/50 rounded-xl overflow-x-hidden flex flex-col min-w-0 max-w-full">
              <div className="p-3.5 border-b border-[#1F2937]/30 flex flex-wrap gap-3 justify-between items-center bg-slate-950/20">
                <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                  Dataset Preview (First 20 rows)
                </span>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500" />
                    <input
                      type="text"
                      placeholder="Search rows..."
                      value={searchTerm}
                      onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                      className="h-8 bg-[#050810]/80 border border-[#1F2937] rounded-xl pl-8 pr-3.5 text-xs text-white placeholder-gray-500 focus:border-gray-500 transition-colors outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto overflow-y-auto max-w-full w-full max-h-[300px] custom-scrollbar">
                <table className="w-full text-left border-collapse select-text">
                  <thead className="bg-[#050810]/95 sticky top-0 z-10 border-b border-[#1F2937]/60">
                    <tr>
                      <th className="p-2.5 text-[10px] font-bold text-gray-500 uppercase tracking-wider font-mono border-r border-[#1F2937]/30 w-[50px] text-center">#</th>
                      {parsedData.headers.map((col) => (
                        <th
                          key={col}
                          onClick={() => requestSort(col)}
                          className="p-2.5 text-[10px] font-bold text-gray-300 uppercase tracking-wider border-r border-[#1F2937]/30 cursor-pointer hover:bg-slate-900/60 transition-colors whitespace-nowrap min-w-[120px]"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span>{col}</span>
                            <ArrowUpDown className="h-3 w-3 text-gray-500 shrink-0" />
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1F2937]/30 font-mono text-[11px]">
                    {paginatedRows.length === 0 ? (
                      <tr>
                        <td colSpan={parsedData.headers.length + 1} className="p-6 text-center text-gray-500">
                          No preview rows match search.
                        </td>
                      </tr>
                    ) : (
                      paginatedRows.map((row, index) => {
                        const globalRowIndex = (currentPage - 1) * rowsPerPage + index + 2;
                        return (
                          <tr key={index} className="hover:bg-slate-900/20 transition-colors">
                            <td className="p-2.5 text-center text-gray-500 border-r border-[#1F2937]/30 select-none bg-[#050810]/30">{globalRowIndex}</td>
                            {parsedData.headers.map((col) => {
                              const cellVal = row[col];
                              const cellError = validationErrors.find((e) => e.row === globalRowIndex && e.column === col);
                              return (
                                <td
                                  key={col}
                                  className={`p-2.5 border-r border-[#1F2937]/20 truncate ${
                                    cellError ? "bg-rose-500/10 border-rose-500/35 text-rose-300 font-bold" : "text-gray-300"
                                  }`}
                                  title={cellError ? cellError.message : (cellVal !== null ? cellVal.toString() : "—")}
                                >
                                  {cellVal !== null && cellVal !== undefined ? cellVal.toString() : "—"}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Table pagination */}
              {totalPages > 1 && (
                <div className="p-3 border-t border-[#1F2937]/30 bg-slate-950/20 flex justify-between items-center select-none">
                  <span className="text-[10px] text-gray-400 font-mono">
                    Showing {Math.min(sortedRows.length, (currentPage - 1) * rowsPerPage + 1)}-{Math.min(sortedRows.length, currentPage * rowsPerPage)} of {sortedRows.length} rows (limit 20)
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handlePageChange("prev")}
                      disabled={currentPage === 1}
                      className="h-8 w-8 rounded-lg bg-slate-900 border border-[#1F2937] hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-all flex items-center justify-center cursor-pointer text-white"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="h-8 px-3 rounded-lg bg-[#8B5CF6]/15 border border-[#8B5CF6]/35 flex items-center justify-center text-xs font-bold text-[#c084fc] font-mono">
                      {currentPage} / {totalPages}
                    </span>
                    <button
                      onClick={() => handlePageChange("next")}
                      disabled={currentPage === totalPages}
                      className="h-8 w-8 rounded-lg bg-slate-900 border border-[#1F2937] hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-all flex items-center justify-center cursor-pointer text-white"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Actions Panel Footer */}
            <div className="p-5 bg-[#0A0E1A]/40 border border-[#1F2937] rounded-xl space-y-4">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono border-b border-[#1F2937]/30 pb-2">
                Import Configuration
              </h4>
              
              <div className="flex flex-col md:flex-row md:items-center gap-5 justify-between select-none">
                <div className="flex flex-wrap gap-4 items-center">
                  <span className="text-xs text-gray-400 font-medium">Action:</span>
                  
                  <label className="flex items-center gap-2 text-xs text-gray-300 font-semibold cursor-pointer">
                    <input
                      type="radio"
                      name="importAction"
                      value="confirm"
                      checked={importAction === "confirm"}
                      onChange={() => setImportAction("confirm")}
                      className="accent-[#8B5CF6]"
                    />
                    <span>Create New Dataset</span>
                  </label>

                  {confirmedDataSources.length > 0 && (
                    <>
                      <label className="flex items-center gap-2 text-xs text-gray-300 font-semibold cursor-pointer">
                        <input
                          type="radio"
                          name="importAction"
                          value="replace"
                          checked={importAction === "replace"}
                          onChange={() => setImportAction("replace")}
                          className="accent-[#8B5CF6]"
                        />
                        <span>Replace Existing</span>
                      </label>

                      <label className="flex items-center gap-2 text-xs text-gray-300 font-semibold cursor-pointer">
                        <input
                          type="radio"
                          name="importAction"
                          value="append"
                          checked={importAction === "append"}
                          onChange={() => setImportAction("append")}
                          className="accent-[#8B5CF6]"
                        />
                        <span>Append Existing</span>
                      </label>
                    </>
                  )}
                </div>

                {(importAction === "replace" || importAction === "append") && confirmedDataSources.length > 0 && (
                  <div className="flex items-center gap-2 min-w-0 max-w-full flex-wrap">
                    <label className="text-xs text-gray-400 font-medium shrink-0">Target Dataset:</label>
                    <select
                      value={targetDatasetId}
                      onChange={(e) => setTargetDatasetId(e.target.value)}
                      className="flex-1 min-w-0 max-w-full h-9 bg-[#050810]/80 border border-[#1F2937] text-xs text-white rounded-xl px-2.5 outline-none font-semibold focus:border-gray-500 transition-colors"
                    >
                      {confirmedDataSources.map((ds) => (
                        <option key={ds._id} value={ds._id}>
                          {ds.fileName} ({ds.rowCount} rows)
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  onClick={resetUploadWizard}
                  className="px-4 py-2 border border-[#1F2937] hover:bg-slate-900 rounded-xl text-gray-300 text-xs font-bold transition-all cursor-pointer bg-transparent"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUploadAndSave}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#6366F1] hover:shadow-lg hover:shadow-purple-500/25 text-white text-xs font-bold transition-all border-none cursor-pointer flex items-center gap-1.5"
                >
                  <Save className="h-4 w-4" />
                  {importAction === "replace" ? "Replace Dataset" : importAction === "append" ? "Append to Dataset" : "Upload & Save"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
