import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, CheckCircle, AlertCircle } from "lucide-react";

export const formatBytes = (bytes, decimals = 2) => {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

export function UploadProgressPanel({
  uploadState,
  activeFile,
  uploadProgress,
  networkError,
  handleUploadAndSave,
  resetUploadWizard
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-950/60 z-10 select-none">
      <div className="max-w-md w-full p-8 rounded-2xl border border-[#1F2937] bg-[#0A0E1A] shadow-2xl relative overflow-hidden text-left">
        <AnimatePresence mode="wait">
          {uploadState === "uploading" && (
            <motion.div
              key="uploading"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              <div className="h-16 w-16 mx-auto rounded-full bg-[#8B5CF6]/10 border border-[#8B5CF6]/20 flex items-center justify-center relative">
                <RefreshCw className="h-8 w-8 text-[#8B5CF6] animate-spin" />
              </div>
              <div className="text-center">
                <h4 className="text-sm font-bold text-white">Uploading File to Server</h4>
                <p className="text-xs text-gray-400 mt-1 truncate">{activeFile.name}</p>
              </div>
              <div className="space-y-2">
                <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden relative">
                  <motion.div
                    className="h-full bg-gradient-to-r from-purple-500 via-[#8B5CF6] to-indigo-500"
                    initial={{ width: "0%" }}
                    animate={{ width: `${uploadProgress}%` }}
                    transition={{ duration: 0.1 }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-gray-500 font-mono">
                  <span>{uploadProgress}%</span>
                  <span>{formatBytes(activeFile.size)}</span>
                </div>
              </div>
              <div className="flex justify-center">
                <button
                  onClick={resetUploadWizard}
                  className="px-4 py-2 border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/15 text-rose-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  Cancel Upload
                </button>
              </div>
            </motion.div>
          )}

          {uploadState === "saving" && (
            <motion.div
              key="saving"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              <div className="h-16 w-16 mx-auto rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                <RefreshCw className="h-8 w-8 text-indigo-400 animate-spin" />
              </div>
              <div className="text-center">
                <h4 className="text-sm font-bold text-white">Writing rows to MongoDB</h4>
                <p className="text-xs text-gray-400 mt-1">Chunked batch inserting to prevent timeouts...</p>
              </div>
            </motion.div>
          )}

          {uploadState === "success" && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-6"
            >
              <div className="h-16 w-16 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-emerald-400" />
              </div>
              <div className="text-center">
                <h4 className="text-sm font-bold text-white">Database Import Successful</h4>
                <p className="text-xs text-gray-400 mt-1">Staging analysis parameters loaded.</p>
              </div>
            </motion.div>
          )}

          {uploadState === "error" && (
            <motion.div
              key="error"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-6"
            >
              <div className="h-16 w-16 mx-auto rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                <AlertCircle className="h-8 w-8 text-rose-400" />
              </div>
              <div className="text-center font-semibold">
                <h4 className="text-sm font-bold text-white">Import Failed</h4>
                <p className="text-xs text-rose-400 font-medium mt-2 p-2 bg-rose-500/5 border border-rose-500/15 rounded-lg text-left text-xs leading-normal">
                  {networkError}
                </p>
              </div>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={handleUploadAndSave}
                  className="px-4 py-2 bg-[#8B5CF6] hover:bg-[#8B5CF6]/90 text-white text-xs font-bold rounded-xl transition-all cursor-pointer border-none"
                >
                  Try Again
                </button>
                <button
                  onClick={resetUploadWizard}
                  className="px-4 py-2 border border-[#1F2937] hover:bg-slate-900 text-gray-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  Edit Schema
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
