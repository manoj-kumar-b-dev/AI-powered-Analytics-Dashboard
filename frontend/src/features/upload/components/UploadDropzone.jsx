import React from "react";
import { UploadCloud, AlertCircle } from "lucide-react";

export function UploadDropzone({ getRootProps, getInputProps, isDragActive, parseError }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 select-text">
      <div
        {...getRootProps()}
        className={`max-w-xl w-full border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer ${
          isDragActive
            ? "border-[#8B5CF6] bg-[#8B5CF6]/5 glow-purple shadow-xl"
            : "border-[#1F2937] hover:border-gray-500 bg-slate-950/20"
        }`}
      >
        <input {...getInputProps()} />
        <div className="h-14 w-14 mx-auto rounded-full bg-slate-900 border border-[#1F2937] flex items-center justify-center text-gray-400 group hover:scale-105 transition-transform">
          <UploadCloud className="h-7 w-7 text-gray-400 hover:text-white" />
        </div>
        <h3 className="text-sm font-bold text-white mt-4 font-display uppercase tracking-wide">
          Drag & Drop Dataset
        </h3>
        <p className="text-xs text-gray-400 mt-2 max-w-sm mx-auto leading-relaxed">
          Drop your CSV or Excel spreadsheets here, or click to browse files from your local system.
        </p>
        <button className="mt-5 text-xs font-semibold px-4 py-2 rounded-xl bg-slate-900 border border-[#1F2937] text-white hover:bg-slate-800 transition-all cursor-pointer">
          Select File
        </button>
        <div className="text-[10px] text-gray-500 font-mono mt-6 flex justify-center gap-3">
          <span>CSV</span>
          <span>•</span>
          <span>XLSX</span>
          <span>•</span>
          <span>XLS</span>
          <span>•</span>
          <span>Max 25MB</span>
        </div>
      </div>

      {parseError && (
        <div className="mt-4 max-w-md p-3.5 rounded-xl border border-rose-500/20 bg-rose-500/5 text-rose-400 text-xs flex gap-2.5 items-start">
          <AlertCircle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
          <span>{parseError}</span>
        </div>
      )}
    </div>
  );
}
