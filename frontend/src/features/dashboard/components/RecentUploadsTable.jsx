import React, { useState } from "react";
import { FileSpreadsheet, ChevronRight, ChevronLeft, ArrowUpDown, ChevronUp, ChevronDown } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "../../shared/components/ui/card";

export function RecentUploadsTable({ data }) {
  // Map status to corresponding color classes
  const statusColors = {
    Processed: "text-[#22C55E]",
    Pending: "text-[#F59E0B]",
    Failed: "text-[#EF4444]"
  };

  // State for sorting
  const [sortField, setSortField] = useState(null);
  const [sortDirection, setSortDirection] = useState("asc"); // 'asc' or 'desc'

  // State for pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 3;

  // Sorting handler
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
    setCurrentPage(1); // Reset to first page on sort
  };

  // Process data (Sort)
  const sortedData = [...data].sort((a, b) => {
    if (!sortField) return 0;
    let aVal = a[sortField];
    let bVal = b[sortField];

    // For rows and columns, parse as number if needed
    if (sortField === "rows" || sortField === "columns") {
      const numA = parseInt(String(aVal).replace(/,/g, ""), 10);
      const numB = parseInt(String(bVal).replace(/,/g, ""), 10);
      return sortDirection === "asc" ? numA - numB : numB - numA;
    }

    // For date sorting, parse to date
    if (sortField === "uploadedOn") {
      const dateA = new Date(aVal);
      const dateB = new Date(bVal);
      return sortDirection === "asc" ? dateA - dateB : dateB - dateA;
    }

    // String comparison
    aVal = String(aVal).toLowerCase();
    bVal = String(bVal).toLowerCase();
    if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
    if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  // Process data (Paginate)
  const totalRows = sortedData.length;
  const totalPages = Math.ceil(totalRows / pageSize);
  const paginatedData = sortedData.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const renderSortIcon = (field) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-3 w-3 text-slate-500 opacity-60 group-hover/th:opacity-100 transition-opacity ml-1.5 inline-block shrink-0" />;
    }
    return sortDirection === "asc" ? (
      <ChevronUp className="h-3 w-3 text-[#8B5CF6] ml-1.5 inline-block shrink-0" />
    ) : (
      <ChevronDown className="h-3 w-3 text-[#8B5CF6] ml-1.5 inline-block shrink-0" />
    );
  };

  return (
    <Card className="flex flex-col min-h-[340px] h-auto border border-[#1F2937] bg-[#111827]/70 backdrop-blur-md rounded-2xl transition-all duration-300 hover:border-slate-700 hover:shadow-xl hover:shadow-[#8B5CF6]/5 overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between p-6 pb-2">
        <div>
          <CardTitle className="text-lg font-bold text-white tracking-tight">Recent Data Uploads</CardTitle>
        </div>
        <button 
          onClick={() => alert("Showing all uploads...")}
          className="text-xs font-semibold text-[#8B5CF6] hover:text-[#8B5CF6]/85 transition-colors flex items-center gap-0.5 select-none cursor-pointer"
        >
          <span>View All</span>
        </button>
      </CardHeader>
      
      <CardContent className="flex-1 p-6 pt-0 overflow-x-auto overflow-y-auto scrollbar-thin max-w-full w-full">
        <div className="w-full min-w-[500px]">
          <table className="w-full text-left border-separate border-spacing-y-2.5">
            <thead>
              <tr className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                <th 
                  className="pb-1.5 pl-4 font-bold text-left min-w-[160px] cursor-pointer group/th select-none hover:text-white transition-colors"
                  onClick={() => handleSort("fileName")}
                >
                  File Name {renderSortIcon("fileName")}
                </th>
                <th 
                  className="pb-1.5 pr-2 font-bold text-right min-w-[80px] cursor-pointer group/th select-none hover:text-white transition-colors"
                  onClick={() => handleSort("rows")}
                >
                  Rows {renderSortIcon("rows")}
                </th>
                <th 
                  className="pb-1.5 pr-2 font-bold text-right min-w-[90px] cursor-pointer group/th select-none hover:text-white transition-colors"
                  onClick={() => handleSort("columns")}
                >
                  Columns {renderSortIcon("columns")}
                </th>
                <th 
                  className="pb-1.5 pl-6 font-bold text-left min-w-[120px] cursor-pointer group/th select-none hover:text-white transition-colors"
                  onClick={() => handleSort("uploadedOn")}
                >
                  Uploaded On {renderSortIcon("uploadedOn")}
                </th>
                <th 
                  className="pb-1.5 pl-6 pr-4 font-bold text-left min-w-[100px] cursor-pointer group/th select-none hover:text-white transition-colors"
                  onClick={() => handleSort("status")}
                >
                  Status {renderSortIcon("status")}
                </th>
              </tr>
            </thead>
            <tbody className="text-xs font-semibold">
              {paginatedData.map((file) => {
                const textClass = statusColors[file.status] || "text-gray-400";
                
                return (
                  <tr key={file.id} className="group cursor-pointer">
                    {/* File Name Cell */}
                    <td className="py-3 pl-4 rounded-l-xl bg-slate-800/10 border-y border-l border-white/[0.01] group-hover:bg-slate-800/25 group-hover:border-white/[0.03] transition-all text-gray-200 align-middle">
                      <div className="flex items-center gap-2 max-w-[200px] truncate">
                        <FileSpreadsheet className="h-4 w-4 text-[#8B5CF6] shrink-0" />
                        <span className="truncate">{file.fileName}</span>
                      </div>
                    </td>
                    
                    {/* Rows Cell */}
                    <td className="py-3 pr-2 text-right bg-slate-800/10 border-y border-white/[0.01] group-hover:bg-slate-800/25 group-hover:border-white/[0.03] transition-all text-gray-300 align-middle">
                      {file.rows}
                    </td>
                    
                    {/* Columns Cell */}
                    <td className="py-3 pr-2 text-right bg-slate-800/10 border-y border-white/[0.01] group-hover:bg-slate-800/25 group-hover:border-white/[0.03] transition-all text-gray-300 align-middle">
                      {file.columns}
                    </td>
                    
                    {/* Uploaded On Cell */}
                    <td className="py-3 pl-6 bg-slate-800/10 border-y border-white/[0.01] group-hover:bg-slate-800/25 group-hover:border-white/[0.03] transition-all text-gray-400 align-middle">
                      {file.uploadedOn}
                    </td>
                    
                    {/* Status Cell */}
                    <td className={`py-3 pl-6 pr-4 rounded-r-xl bg-slate-800/10 border-y border-r border-white/[0.01] group-hover:bg-slate-800/25 group-hover:border-white/[0.03] transition-all text-left align-middle ${textClass}`}>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] scale-90">●</span>
                        <span>{file.status}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#1F2937]/50 bg-slate-900/10 select-none text-xs text-gray-400 font-semibold mt-auto shrink-0">
          <div>
            Showing <span className="text-white">{(currentPage - 1) * pageSize + 1}</span> to{" "}
            <span className="text-white">{Math.min(currentPage * pageSize, totalRows)}</span> of{" "}
            <span className="text-white">{totalRows}</span> uploads
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="h-8 w-8 rounded-lg border border-[#1F2937] bg-[#111827]/70 hover:border-gray-600 disabled:opacity-40 disabled:hover:border-[#1F2937] flex items-center justify-center text-gray-400 hover:text-white transition-all cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span>
              Page <span className="text-white">{currentPage}</span> of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="h-8 w-8 rounded-lg border border-[#1F2937] bg-[#111827]/70 hover:border-gray-600 disabled:opacity-40 disabled:hover:border-[#1F2937] flex items-center justify-center text-gray-400 hover:text-white transition-all cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}
