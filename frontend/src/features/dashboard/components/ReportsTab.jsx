import React from "react";
import { FileText } from "lucide-react";
import { RecentUploadsTable } from "./RecentUploadsTable";

export function ReportsTab({ dashboard, recentUploadsList }) {
  if (!dashboard || !dashboard.reports) {
    return (
      <div className="h-[50vh] rounded-3xl border border-dashed border-[#1F2937] bg-slate-900/10 flex flex-col items-center justify-center text-center p-8 backdrop-blur-md">
        <FileText className="h-16 w-16 text-gray-600 mb-4 animate-pulse" />
        <h3 className="text-lg font-bold text-white font-display">No active dataset</h3>
        <p className="text-gray-400 text-xs mt-1.5 max-w-sm">
          Please upload a dataset or select an active one to generate a comprehensive reports view.
        </p>
      </div>
    );
  }

  const { fileName, schema, rowCount, status, validation, cleanliness } = dashboard.reports;

  return (
    <div className="space-y-6 max-w-5xl mx-auto select-text text-left">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-slate-900/30 border border-[#1F2937]/40 px-6 py-4 rounded-2xl gap-4 backdrop-blur-md">
        <div>
          <h2 className="text-lg font-bold text-white font-display">Dataset Summary Report</h2>
          <p className="text-[11px] text-gray-400 mt-0.5">Comprehensive audit and statistics for {fileName}</p>
        </div>
        <button
          onClick={() => alert("Report Export triggered! PDF generation is starting...")}
          className="px-4 py-2 bg-gradient-to-r from-[#8B5CF6] to-[#6366F1] hover:shadow-lg hover:shadow-purple-500/20 text-white text-xs font-semibold rounded-xl transition-all cursor-pointer border-none"
        >
          Export Report (PDF)
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-[#111827]/40 border border-[#1F2937]/40 p-5 rounded-2xl">
          <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">File Metadata</span>
          <div className="mt-3 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Filename:</span>
              <span className="text-white font-semibold truncate max-w-[150px]">{fileName}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Total Rows:</span>
              <span className="text-white font-bold">{rowCount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Variables:</span>
              <span className="text-white font-bold">{schema.length} columns</span>
            </div>
          </div>
        </div>

        <div className="bg-[#111827]/40 border border-[#1F2937]/40 p-5 rounded-2xl">
          <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Dataset Health</span>
          <div className="mt-3 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Malformed Values:</span>
              <span className={`font-bold ${validation?.problemCount > 0 ? "text-amber-400" : "text-green-400"}`}>
                {validation?.problemCount || 0}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Data Cleanliness:</span>
              <span className="text-white font-bold">
                {cleanliness}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Status:</span>
              <span className={`font-bold uppercase text-[10px] ${status === 'confirmed' ? 'text-green-400' : 'text-amber-400'}`}>
                {status}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-[#111827]/40 border border-[#1F2937]/40 p-5 rounded-2xl flex flex-col justify-between">
          <div>
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Workspace Summary</span>
            <p className="text-[11px] text-gray-300 mt-2.5 leading-relaxed">
              Active dataset is synced with all dashboard indicators, AI chat subagents, and automated charting layouts.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-[#111827]/40 border border-[#1F2937]/40 p-6 rounded-2xl overflow-hidden">
        <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-4">Column variables & types</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-[#1F2937]/50 pb-2 text-gray-500 font-bold uppercase text-[9px] tracking-wider">
                <th className="pb-3">Column name</th>
                <th className="pb-3">Data type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1F2937]/20 font-semibold">
              {schema.map((col, idx) => (
                <tr key={idx} className="text-gray-300 hover:text-white">
                  <td className="py-3 font-mono">{col.column}</td>
                  <td className="py-3">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] text-gray-400 border border-white/[0.02]">
                      {col.type}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {recentUploadsList.length > 0 && (
        <div className="pt-2">
          <RecentUploadsTable data={recentUploadsList} />
        </div>
      )}
    </div>
  );
}
