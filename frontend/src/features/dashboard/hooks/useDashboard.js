import { useState, useEffect, useCallback } from 'react';
import { useDashboardStore } from '../store/dashboardStore';

export const useDashboard = () => {
  const { dashboard, invalidateAndReload } = useDashboardStore();
  const [showToast, setShowToast] = useState(false);
  const [toastConfig, setToastConfig] = useState({
    title: "Upload Complete",
    message: "Dashboard updated successfully.",
    type: "success"
  });
  const [activeTab, setActiveTab] = useState("Dashboard");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [widgets, setWidgets] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [realtimeEnabled, setRealtimeEnabled] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState("Just now");

  const triggerToast = useCallback((title = "Upload Complete", message = "Dashboard updated successfully.", type = "success") => {
    setToastConfig({ title, message, type });
    setShowToast(true);
    setTimeout(() => setShowToast(false), 4500);
  }, []);

  // Check for authToast in sessionStorage on mount (e.g. after login/register)
  useEffect(() => {
    const authToastRaw = sessionStorage.getItem('authToast');
    if (authToastRaw) {
      try {
        const parsed = JSON.parse(authToastRaw);
        triggerToast(parsed.title, parsed.message, parsed.type || 'success');
      } catch (err) {
        console.error('Failed to parse authToast:', err);
      } finally {
        sessionStorage.removeItem('authToast');
      }
    }
  }, [triggerToast]);

  const handleUploadSuccess = useCallback((dsId) => {
    triggerToast("Upload Complete", "Dashboard updated successfully.", "success");
    setActiveTab("Dashboard");
    invalidateAndReload();
  }, [invalidateAndReload, triggerToast]);

  const getStorageKey = useCallback(() => {
    return dashboard?.dataSourceId 
      ? `dashboard_widgets_layout_${dashboard.dataSourceId}`
      : "dashboard_widgets_layout";
  }, [dashboard?.dataSourceId]);

  // Sync widgets when dashboard data loads
  useEffect(() => {
    if (!dashboard) {
      setWidgets([]);
      return;
    }

    const kpiWidgets = (dashboard.kpis || []).map((kpi, idx) => ({
      id: `kpi-${kpi.kpi}`,
      type: "kpi-card",
      title: kpi.label,
      resolvedData: {
        value: kpi.value,
        formattedValue: kpi.formattedValue,
        deltaPct: kpi.deltaPct,
        deltaDirection: kpi.deltaDirection,
        period: kpi.period,
        // Gemini-assigned icon and color metadata
        meta: {
          icon: kpi.icon || null,
          color: kpi.color || null
        }
      },
      config: { kpiType: kpi.kpi },
      layout: { 
        x: (idx % 4) * 3, 
        y: Math.floor(idx / 4) * 2, 
        w: 3, 
        h: 2 
      }
    }));

    const kpiHeight = Math.ceil(kpiWidgets.length / 4) * 2;

    const chartWidgets = (dashboard.charts || []).map((chart, idx) => {
      const defaultLayout = {
        x: (idx % 2) * 6,
        y: kpiHeight + Math.floor(idx / 2) * 4,
        w: 6,
        h: 4
      };

      if (!chart.layout) {
        return { ...chart, layout: defaultLayout };
      }

      // Ensure chart layouts are placed after KPIs
      const rawLayout = chart.layout;
      const x = rawLayout.x ?? (idx % 2) * 6;
      const y = rawLayout.y >= kpiHeight ? rawLayout.y : kpiHeight + (rawLayout.y ?? 0);
      const w = rawLayout.w ?? 6;
      const h = rawLayout.h ?? 4;

      return {
        ...chart,
        layout: { x, y, w, h }
      };
    });

    const combined = [...kpiWidgets, ...chartWidgets];

    const saved = localStorage.getItem(getStorageKey());
    if (saved) {
      const savedLayouts = JSON.parse(saved);
      const merged = combined.map(w => {
        const matched = savedLayouts.find(s => s.id === w.id);
        if (matched && matched.layout) {
          return { ...w, layout: matched.layout };
        }
        return w;
      });
      setWidgets(merged);
    } else {
      setWidgets(combined);
    }
  }, [dashboard, getStorageKey]);

  // Sidebar resize auto collapse
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setIsSidebarCollapsed(true);
      } else {
        setIsSidebarCollapsed(false);
      }
    };
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Real-time updates ticker simulation
  useEffect(() => {
    if (!realtimeEnabled) return;
    const interval = setInterval(() => {
      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setLastRefreshed(time);
    }, 15000);
    return () => clearInterval(interval);
  }, [realtimeEnabled]);

  const handleSidebarToggle = useCallback((collapsed) => {
    setIsSidebarCollapsed(collapsed);
  }, []);

  const handleUploadClick = useCallback(() => {
    setActiveTab("Upload Data");
  }, []);

  const handleSearchAction = useCallback((action) => {
    if (action.type === "tab") {
      setActiveTab(action.value);
    } else if (action.type === "toggleEdit") {
      setIsEditing((prev) => !prev);
    }
  }, []);

  const handleLayoutChange = useCallback((newLayout) => {
    setWidgets((prevWidgets) => {
      const updated = prevWidgets.map((w) => {
        const matchingLayout = newLayout.find((l) => l.i === w.id);
        if (matchingLayout) {
          return {
            ...w,
            layout: {
              x: matchingLayout.x,
              y: matchingLayout.y,
              w: matchingLayout.w,
              h: matchingLayout.h
            }
          };
        }
        return w;
      });
      if (isEditing) {
        localStorage.setItem(getStorageKey(), JSON.stringify(updated));
      }
      return updated;
    });
  }, [isEditing, getStorageKey]);

  const handleSaveLayout = useCallback(() => {
    localStorage.setItem(getStorageKey(), JSON.stringify(widgets));
    setIsEditing(false);
    alert("Dashboard layout settings saved successfully.");
  }, [widgets, getStorageKey]);

  const handleResetLayout = useCallback(() => {
    if (window.confirm("Restore layout to default arrangement?")) {
      localStorage.removeItem(getStorageKey());
      invalidateAndReload();
      setIsEditing(false);
    }
  }, [invalidateAndReload, getStorageKey]);

  return {
    showToast,
    setShowToast,
    toastConfig,
    triggerToast,
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
  };
};
