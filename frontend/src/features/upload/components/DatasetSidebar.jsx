import React from "react";
import { Database, HardDrive, Plus, Trash2 } from "lucide-react";

export function DatasetSidebar({
  dataSources = [],
  selectedDSId,
  activeFile,
  resetUploadWizard,
  selectDataSourceForPreview,
  deleteDataSource
}) {
  return (
    <div className="w-full lg:w-[300px] bg-white/90 dark:bg-slate-950/40 border border-slate-200 dark:border-[#1F2937]/50 rounded-2xl p-4 flex flex-col gap-4 flex-shrink-0 backdrop-blur-md min-w-0 text-left shadow-sm transition-colors duration-300">
      <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-[#1F2937]/30">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-wide uppercase font-display flex items-center gap-2">
          <Database className="h-4 w-4 text-[#8B5CF6]" />
          Datasets Portal
        </h3>
        <button
          onClick={() => {
            resetUploadWizard();
            selectDataSourceForPreview(null);
          }}
          className="p-1.5 rounded-lg bg-[#8B5CF6]/15 hover:bg-[#8B5CF6]/30 border border-[#8B5CF6]/35 text-[#8B5CF6] dark:text-[#c084fc] transition-all cursor-pointer flex items-center justify-center"
          title="Import New Dataset"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2.5 custom-scrollbar pr-1">
        {dataSources.length === 0 ? (
          <div className="text-center py-10 text-slate-400 dark:text-gray-500 text-xs">
            <HardDrive className="h-8 w-8 mx-auto opacity-30 mb-2" />
            No datasets loaded.
          </div>
        ) : (
          dataSources.map((ds) => {
            const isSelected = selectedDSId === ds._id && !activeFile;
            return (
              <div
                key={ds._id}
                onClick={() => {
                  resetUploadWizard();
                  selectDataSourceForPreview(ds._id);
                }}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer group flex items-center justify-between ${
                  isSelected
                    ? "border-[#8B5CF6] bg-purple-500/10 dark:bg-[#8B5CF6]/10 shadow-lg shadow-purple-500/10"
                    : "border-slate-200 dark:border-[#1F2937]/50 bg-slate-50/70 dark:bg-slate-900/10 hover:border-purple-300 dark:hover:border-gray-700 hover:bg-slate-100 dark:hover:bg-slate-950/30"
                }`}
              >
                <div className="overflow-hidden mr-2">
                  <div className="text-xs font-bold text-slate-900 dark:text-white truncate leading-tight group-hover:text-[#8B5CF6] dark:group-hover:text-[#c084fc] transition-colors">
                    {ds.fileName}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-gray-400 mt-1 flex items-center gap-1.5 font-mono">
                    <span>{ds.rowCount} rows</span>
                    <span className="h-1 w-1 bg-slate-400 dark:bg-gray-600 rounded-full" />
                    <span className={`text-[9px] font-bold uppercase ${ds.status === "confirmed" ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                      {ds.status}
                    </span>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteDataSource(ds._id);
                  }}
                  className="opacity-0 group-hover:opacity-100 hover:text-rose-500 dark:hover:text-red-400 text-slate-400 dark:text-gray-500 p-1.5 hover:bg-slate-200 dark:hover:bg-slate-900 rounded-lg transition-all border-none bg-transparent cursor-pointer"
                  title="Delete Dataset"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
