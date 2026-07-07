import React, { useState } from "react";
import {
  Settings,
  Copy,
  Trash2,
  GripHorizontal,
  MoreVertical,
  RefreshCw,
  Maximize2,
  Download,
  Activity,
  DollarSign,
  TrendingUp,
  BarChart3,
  ShoppingBag,
  Clock,
  X
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "../../shared/components/ui/dropdown-menu";

export function WidgetWrapper({
  title = "Untitled Widget",
  type = "line-chart",
  widgetData = null,
  onEdit,
  onDuplicate,
  onDelete,
  isEditMode = true,
  children
}) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [lastUpdated, setLastUpdated] = useState("Updated just now");

  // Determine top border color and icon based on title
  const getWidgetTheme = () => {
    const t = title.toLowerCase();
    if (t.includes("revenue")) {
      return { color: "border-t-purple-500", glow: "card-glow-purple", icon: DollarSign };
    }
    if (t.includes("sales") || t.includes("weekly")) {
      return { color: "border-t-blue-500", glow: "card-glow-blue", icon: BarChart3 };
    }
    if (t.includes("product") || t.includes("distribution")) {
      return { color: "border-t-green-500", glow: "card-glow-green", icon: ShoppingBag };
    }
    if (type === "kpi-card") {
      return { color: "border-t-orange-500", glow: "card-glow-orange", icon: Activity };
    }
    return { color: "border-t-purple-500", glow: "card-glow-purple", icon: TrendingUp };
  };

  const theme = getWidgetTheme();
  const IconComponent = theme.icon;

  // Refresh trigger simulation
  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setLastUpdated(`Updated at ${time}`);
    }, 850);
  };

  // CSV Data Exporter
  const handleExportCSV = () => {
    if (!widgetData) {
      alert("No data available to export.");
      return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    
    // Parse depending on structure
    if (Array.isArray(widgetData)) {
      csvContent += "Dimension (X),Value (Y)\n";
      widgetData.forEach((row) => {
        csvContent += `${row.x || row.month || row.day || row.name},${row.y || row.revenue || row.sales || 0}\n`;
      });
    } else if (typeof widgetData === "object") {
      csvContent += "Metric,Value\n";
      csvContent += `${title},${widgetData.value || 0}\n`;
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${title.toLowerCase().replace(/ /g, "_")}_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      <motion.div
        whileHover={{ y: isEditMode ? 0 : -3 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        className={`h-full w-full rounded-2xl border border-[#1F2937]/50 bg-gradient-to-b from-[#111827]/75 to-[#0F172A]/75 backdrop-blur-md flex flex-col overflow-hidden group relative border-t-2 ${theme.color} ${theme.glow} transition-all duration-300 shadow-lg`}
      >
        {/* Widget Header Bar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1F2937]/30 bg-slate-950/20 select-none">
          <div className="flex items-center gap-2.5 overflow-hidden mr-2">
            {isEditMode ? (
              <div className="drag-handle cursor-grab active:cursor-grabbing p-1 text-gray-500 hover:text-white rounded transition-colors shrink-0">
                <GripHorizontal className="h-4 w-4" />
              </div>
            ) : (
              <IconComponent className="h-4 w-4 text-[#8B5CF6] shrink-0" />
            )}
            <div className="flex flex-col text-left truncate">
              <span className="text-xs font-bold text-gray-200 truncate font-display tracking-wide">
                {title}
              </span>
              <span className="text-[9px] text-gray-500 flex items-center gap-1 mt-0.5 font-sans">
                <Clock className="h-2.5 w-2.5" />
                {lastUpdated}
              </span>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Quick Refresh Action */}
            <button
              onClick={handleRefresh}
              className={`p-1.5 text-gray-500 hover:text-white hover:bg-white/5 rounded-lg transition-colors cursor-pointer border-none bg-transparent ${
                isRefreshing ? "animate-spin text-[#8B5CF6]" : ""
              }`}
              title="Refresh Data"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>

            {/* Config & Operations Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="p-1.5 text-gray-500 hover:text-white hover:bg-white/5 rounded-lg transition-colors cursor-pointer border-none bg-transparent"
                  aria-label="Actions"
                >
                  <MoreVertical className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="right" className="w-48 bg-[#111827] border border-[#1F2937] text-gray-300 rounded-xl p-1 shadow-2xl">
                <DropdownMenuItem
                  className="hover:bg-slate-800 cursor-pointer flex items-center gap-2 py-2 text-xs"
                  onClick={() => setIsFullscreen(true)}
                >
                  <Maximize2 className="h-3.5 w-3.5 text-gray-400" />
                  <span>Fullscreen Zoom</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="hover:bg-slate-800 cursor-pointer flex items-center gap-2 py-2 text-xs"
                  onClick={handleExportCSV}
                >
                  <Download className="h-3.5 w-3.5 text-gray-400" />
                  <span>Export to CSV</span>
                </DropdownMenuItem>

                {isEditMode && (onEdit || onDuplicate || onDelete) && (
                  <>
                    <div className="h-[1px] bg-[#1F2937]/50 my-1" />
                    {onEdit && (
                      <DropdownMenuItem
                        className="hover:bg-slate-800 cursor-pointer flex items-center gap-2 py-2 text-xs"
                        onClick={onEdit}
                      >
                        <Settings className="h-3.5 w-3.5 text-gray-400" />
                        <span>Edit Settings</span>
                      </DropdownMenuItem>
                    )}
                    {onDuplicate && (
                      <DropdownMenuItem
                        className="hover:bg-slate-800 cursor-pointer flex items-center gap-2 py-2 text-xs"
                        onClick={onDuplicate}
                      >
                        <Copy className="h-3.5 w-3.5 text-gray-400" />
                        <span>Duplicate Card</span>
                      </DropdownMenuItem>
                    )}
                    {onDelete && (
                      <DropdownMenuItem
                        className="hover:bg-rose-950/20 text-rose-400 hover:text-rose-300 cursor-pointer flex items-center gap-2 py-2 text-xs"
                        onClick={onDelete}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Delete Card</span>
                      </DropdownMenuItem>
                    )}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Card Body */}
        <div className="flex-1 p-5 relative overflow-hidden flex flex-col justify-between select-text">
          {isRefreshing ? (
            /* Card Loading State (Skeleton Grid) */
            <div className="flex-1 flex flex-col gap-3 py-2 animate-pulse">
              <div className="h-5 bg-slate-800/60 rounded-lg w-1/3 skeleton" />
              <div className="flex-1 bg-slate-800/40 rounded-xl skeleton min-h-[140px]" />
            </div>
          ) : (
            children
          )}
        </div>
      </motion.div>

      {/* Fullscreen Overlay Modal */}
      <AnimatePresence>
        {isFullscreen && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-6 md:p-12">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="bg-[#111827] border border-[#1F2937] w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col"
              style={{ maxHeight: "85vh" }}
            >
              {/* Modal Header */}
              <div className="p-5 border-b border-[#1F2937]/50 flex items-center justify-between bg-slate-950/40 select-none">
                <div className="flex items-center gap-3">
                  <IconComponent className="h-5 w-5 text-[#8B5CF6]" />
                  <div>
                    <h3 className="text-sm font-bold text-white font-display tracking-wide uppercase">
                      {title} (Fullscreen)
                    </h3>
                    <p className="text-[10px] text-gray-500 mt-0.5">{lastUpdated}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExportCSV}
                    className="p-2 rounded-xl bg-slate-800 text-gray-300 hover:text-white hover:bg-slate-700 cursor-pointer border-none flex items-center gap-1.5 text-xs font-bold transition-all"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Download CSV</span>
                  </button>
                  <button
                    onClick={() => setIsFullscreen(false)}
                    className="p-2 rounded-xl bg-slate-800 text-gray-400 hover:text-white hover:bg-slate-750 cursor-pointer border-none"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="flex-1 p-6 md:p-8 overflow-y-auto select-text flex flex-col justify-center min-h-[350px]">
                {children}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
