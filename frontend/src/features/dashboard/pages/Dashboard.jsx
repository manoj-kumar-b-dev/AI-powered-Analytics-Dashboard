import React, { useMemo } from "react";
import { Sidebar } from "../../shared/components/layout/Sidebar";
import { Topbar } from "../../shared/components/layout/Topbar";
import { DashboardCanvas } from "../components/DashboardCanvas";
import { useDataSources } from "../../upload/hooks/useDataSources";
import { DatasetUploadManager } from "../../upload/components/DatasetUploadManager";
import { AIInsightsPanel } from "../components/AIInsightsPanel";
import { AutoVisualizationContainer } from "../../analytics/components/AutoVisualizationContainer";
import { useDashboardStore } from "../store/dashboardStore";
import { useDashboard } from "../hooks/useDashboard";
import { useFilters } from "../hooks/useFilters";
import { ReportsTab } from "../components/ReportsTab";
import { DashboardFilters } from "../components/DashboardFilters";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, ArrowRight } from "lucide-react";

export default function Dashboard() {
  const { isLoading: isStoreLoading } = useDashboardStore();

  const {
    showToast,
    activeTab,
    setActiveTab,
    isSidebarCollapsed,
    widgets,
    setWidgets,
    isEditing,
    setIsEditing,
    lastRefreshed,
    handleSidebarToggle,
    handleUploadClick,
    handleSearchAction,
    handleLayoutChange,
    handleSaveLayout,
    handleResetLayout,
    handleUploadSuccess
  } = useDashboard();

  const {
    filters,
    isLoadingFilters,
    isAnyFilterActive,
    handleFilterChange,
    handleClearFilters
  } = useFilters();

  const dataSources = useDataSources({
    onUploadSuccess: handleUploadSuccess
  });

  const hasDatasets = dataSources.dataSources.length > 0;

  // Sync active dataset selection when none is loaded
  React.useEffect(() => {
    if (dataSources.dataSources.length > 0 && !dataSources.selectedDSId) {
      dataSources.selectDataSourceForPreview(dataSources.dataSources[0]._id);
    }
  }, [dataSources.dataSources, dataSources.selectedDSId]);

  // Sync dashboard store active dataset
  const { fetchDashboard } = useDashboardStore();
  React.useEffect(() => {
    if (dataSources.selectedDSId) {
      fetchDashboard();
    }
  }, [dataSources.selectedDSId, fetchDashboard]);

  const aiInsights = useMemo(() => {
    const { dashboard } = useDashboardStore.getState();
    if (!dashboard || !dashboard.insights) return [];
    return dashboard.insights;
  }, [isStoreLoading]);

  const invalidateAndReload = React.useCallback(() => {
    fetchDashboard();
    handleResetLayout();
  }, [fetchDashboard, handleResetLayout]);

  const recentUploadsList = useMemo(() => {
    return dataSources.dataSources.map(ds => ({
      id: ds._id,
      fileName: ds.fileName,
      rows: ds.rowCount.toLocaleString(),
      columns: ds.schema.length.toString(),
      uploadedOn: new Date(ds.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }),
      status: ds.status === 'confirmed' ? 'Processed' : 'Pending'
    }));
  }, [dataSources.dataSources]);

  const handleCustomSearchAction = (action) => {
    if (action.type === "clearFilters") {
      handleClearFilters();
    } else {
      handleSearchAction(action);
    }
  };

  const currentDashboard = useDashboardStore((state) => state.dashboard);

  return (
    <div className="min-h-screen bg-[#070B14] text-white flex select-none font-sans antialiased overflow-x-hidden max-w-[100vw]">
      
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={handleSidebarToggle}
      />

      <div className={`flex-1 flex flex-col min-h-screen bg-[#070B14] transition-all duration-300 min-w-0 overflow-x-hidden max-w-full ${
        isSidebarCollapsed ? "pl-[76px]" : "pl-[260px]"
      }`}>
        
        <Topbar
          title={activeTab}
          onUploadClick={handleUploadClick}
          onSearchAction={handleCustomSearchAction}
          currentDateRange={filters.date === "7days" ? "Last 7 Days" : filters.date === "30days" ? "Last 30 Days" : filters.date === "today" ? "Today" : "All Time"}
          onDateChange={(val) => handleFilterChange("date", val)}
          dataSources={dataSources.dataSources}
          selectedDSId={dataSources.selectedDSId}
          onDatasetChange={dataSources.selectDataSourceForPreview}
        />

        <main className="flex-1 p-6 md:p-8 overflow-y-auto space-y-6 select-text custom-scrollbar min-w-0 max-w-full overflow-x-hidden">
          {activeTab === "Dashboard" ? (
            <div className="space-y-6 w-full min-w-0 max-w-full overflow-x-hidden">
              
              {!hasDatasets ? (
                <div className="h-[50vh] rounded-3xl border border-dashed border-[#1F2937] bg-slate-900/10 flex flex-col items-center justify-center text-center p-8 backdrop-blur-md">
                  <div className="h-16 w-16 rounded-2xl bg-[#8B5CF6]/10 border border-[#8B5CF6]/20 text-[#c084fc] flex items-center justify-center mb-4 shadow-lg shadow-purple-500/5">
                    <span className="text-3xl">📊</span>
                  </div>
                  <h3 className="text-lg font-bold text-white font-display">No datasets uploaded yet</h3>
                  <p className="text-gray-400 text-xs mt-1.5 max-w-sm leading-relaxed">
                    Import your sales, revenue, or customer spreadsheets to automatically generate dashboards, KPIs, charts, and AI insights.
                  </p>
                  <button
                    onClick={() => setActiveTab("Upload Data")}
                    className="mt-6 px-5 py-2.5 bg-[#8B5CF6] hover:bg-[#8B5CF6]/90 text-white text-xs font-bold rounded-xl transition-all cursor-pointer border-none shadow-lg shadow-purple-500/10 active:scale-[0.98]"
                  >
                    Upload Your First Dataset
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-slate-900/30 border border-[#1F2937]/40 px-5 py-3 rounded-2xl gap-3 backdrop-blur-md relative overflow-hidden">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-2 w-2 rounded-full bg-emerald-500 pulse-indicator shrink-0" />
                      <div>
                        <h2 className="text-xs font-bold text-white tracking-wide uppercase font-display flex items-center gap-1.5">
                          Dashboard Workspace
                        </h2>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {isEditing 
                            ? "Layout modification unlocked. Drag or resize cards." 
                            : `Previewing live operations (${widgets.length} Active Widgets)`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <div className="text-[10px] text-gray-500 hidden md:block">
                        Refreshed: <span className="text-[#8B5CF6] font-mono">{lastRefreshed}</span>
                      </div>
                      
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleSaveLayout}
                            className="h-8 text-[10px] font-bold px-3.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-all cursor-pointer border-none shadow-md shadow-emerald-950/20"
                          >
                            Save Layout
                          </button>
                          <button
                            onClick={() => setIsEditing(false)}
                            className="h-8 text-[10px] font-bold px-3.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-gray-300 transition-all cursor-pointer border border-[#1F2937]/50"
                          >
                            Exit
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setIsEditing(true)}
                            className="h-8 text-[10px] font-bold px-3.5 rounded-lg bg-[#8B5CF6]/15 hover:bg-[#8B5CF6]/25 border border-[#8B5CF6]/35 text-[#c084fc] transition-all cursor-pointer"
                          >
                            Edit Layout
                          </button>
                          <button
                            onClick={handleResetLayout}
                            className="h-8 text-[10px] font-bold px-3.5 rounded-lg bg-slate-900/40 hover:bg-slate-800/40 border border-[#1F2937]/50 text-gray-400 hover:text-white transition-all cursor-pointer"
                          >
                            Reset
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <DashboardFilters
                    filters={filters}
                    dashboard={currentDashboard}
                    isAnyFilterActive={isAnyFilterActive}
                    onFilterChange={handleFilterChange}
                    onClearFilters={handleClearFilters}
                  />

                  <div className="w-full">
                    {isLoadingFilters || isStoreLoading ? (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        <div className="h-32 rounded-2xl skeleton border border-white/[0.03]" />
                        <div className="h-32 rounded-2xl skeleton border border-white/[0.03]" />
                        <div className="h-32 rounded-2xl skeleton border border-white/[0.03]" />
                        <div className="md:col-span-2 h-80 rounded-2xl skeleton border border-white/[0.03]" />
                        <div className="h-80 rounded-2xl skeleton border border-white/[0.03]" />
                      </div>
                    ) : widgets.length > 0 ? (
                      <DashboardCanvas
                        widgets={widgets}
                        onLayoutChange={handleLayoutChange}
                        isEditMode={isEditing}
                        onEditWidget={(widget) => alert(`Configuring settings for: ${widget.title}`)}
                        onDuplicateWidget={(widget) => {
                          const newId = `widget-dup-${Date.now()}`;
                          setWidgets((prev) => [...prev, { ...widget, id: newId, layout: { ...widget.layout, y: widget.layout.y + 2, x: 0 } }]);
                        }}
                        onDeleteWidget={(widget) => {
                          if (window.confirm(`Delete widget "${widget.title}"?`)) {
                            setWidgets((prev) => prev.filter((w) => w.id !== widget.id));
                          }
                        }}
                        onAddFirstWidget={() => alert("Drag a widget from the configuration toolbox.")}
                      />
                    ) : (
                      <div className="h-[40vh] rounded-2xl border border-dashed border-[#1F2937] bg-[#111827]/10 flex flex-col items-center justify-center text-center p-8 backdrop-blur-md">
                        <div className="h-16 w-16 rounded-full bg-slate-900 border border-[#1F2937] text-gray-500 flex items-center justify-center shrink-0 mb-4 animate-pulse">
                          <span className="text-2xl font-bold">📊</span>
                        </div>
                        <h3 className="text-base font-bold text-white font-display">No operational widgets</h3>
                        <p className="text-gray-400 text-xs mt-1 max-w-sm">
                          It seems there are no indicators present. Please click below to reload layout.
                        </p>
                        <button
                          onClick={invalidateAndReload}
                          className="mt-4 px-4 py-2 bg-[#8B5CF6] hover:bg-[#8B5CF6]/90 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer border-none shadow-md shadow-purple-500/10"
                        >
                          Refresh Dashboard Metrics
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}

            </div>
          ) : activeTab === "Upload Data" ? (
            <DatasetUploadManager
              dataSources={dataSources.dataSources}
              selectedDSId={dataSources.selectedDSId}
              dsPreview={dataSources.dsPreview}
              kpiData={dataSources.kpiData}
              suggestedCharts={dataSources.suggestedCharts}
              mappingInput={dataSources.mappingInput}
              uploadLoading={dataSources.uploadLoading}
              loadDataSources={dataSources.loadDataSources}
              selectDataSourceForPreview={dataSources.selectDataSourceForPreview}
              confirmDataSource={dataSources.confirmDataSource}
              deleteDataSource={dataSources.deleteDataSource}
              handleKpiMappingChange={dataSources.handleKpiMappingChange}
              saveKpiMappings={dataSources.saveKpiMappings}
              onUploadSuccess={handleUploadSuccess}
            />
          ) : activeTab === "Analytics" ? (
            <div className="space-y-6 w-full text-left">
              {dataSources.selectedDSId ? (
                <AutoVisualizationContainer dsId={dataSources.selectedDSId} />
              ) : (
                <div className="h-[50vh] rounded-3xl border border-dashed border-[#1F2937] bg-slate-900/10 flex flex-col items-center justify-center text-center p-8 backdrop-blur-md">
                  <div className="h-14 w-14 rounded-full bg-[#8B5CF6]/10 border border-[#8B5CF6]/20 text-[#c084fc] flex items-center justify-center mb-4">
                    <span className="text-lg font-bold">📈</span>
                  </div>
                  <h3 className="text-lg font-bold text-white font-display">No active dataset</h3>
                  <p className="text-gray-400 text-xs mt-1.5 max-w-sm">
                    Select a dataset from the top bar dropdown or upload one under 'Upload Data' to view analytics visualization.
                  </p>
                </div>
              )}
            </div>
          ) : activeTab === "AI Insights" ? (
            <div className="max-w-4xl mx-auto space-y-6 w-full text-left font-semibold">
              <AIInsightsPanel data={aiInsights} />
            </div>
          ) : activeTab === "Reports" ? (
            <div className="w-full text-left">
              <ReportsTab dashboard={currentDashboard} recentUploadsList={recentUploadsList} />
            </div>
          ) : (
            <div className="min-h-[70vh] rounded-2xl border border-[#1F2937]/50 bg-slate-900/10 flex flex-col items-center justify-center text-center p-8 backdrop-blur-sm">
              <div className="h-14 w-14 rounded-full bg-[#8B5CF6]/10 border border-[#8B5CF6]/20 text-[#c084fc] flex items-center justify-center shrink-0 mb-4 animate-pulse">
                <span className="text-lg font-bold">✨</span>
              </div>
              <h3 className="text-lg font-bold text-white font-display">View: {activeTab}</h3>
              <p className="text-gray-400 text-xs mt-2 max-w-sm leading-relaxed">
                This screen represents the static context of "{activeTab}". Interactive analysis is fully operational within the main "Dashboard" tab.
              </p>
              <button
                onClick={() => setActiveTab("Dashboard")}
                className="mt-5 text-xs font-semibold text-[#8B5CF6] hover:text-[#a78bfa] transition-all flex items-center gap-1 cursor-pointer bg-transparent border-none"
              >
                <span>Return to Analytics Workspace</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </main>
      </div>

      <AnimatePresence>
        {showToast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ type: "spring", damping: 15 }}
            className="fixed bottom-6 right-6 bg-[#0E1527] border border-emerald-500/35 text-white px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 z-60 backdrop-blur-md"
          >
            <div className="h-8 w-8 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <CheckCircle className="h-4.5 w-4.5 text-emerald-400 shrink-0" />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-xs font-bold text-white">Upload Complete</span>
              <span className="text-[10px] text-gray-400 mt-0.5 font-medium">Dashboard updated successfully.</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
