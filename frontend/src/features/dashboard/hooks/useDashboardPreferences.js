import { useState, useEffect, useRef } from 'react';

/**
 * Custom React Hook to load and manage per-user, per-dataset dashboard preferences
 * (hiding, pinning, reordering, and resizing widgets) with debounced backend persistence.
 *
 * @param {string} datasetId - The ID of the currently active dataset.
 */
export function useDashboardPreferences(datasetId) {
  const [hiddenWidgetIds, setHiddenWidgetIds] = useState([]);
  const [pinnedWidgetIds, setPinnedWidgetIds] = useState([]);
  const [widgetOrder, setWidgetOrder] = useState([]);
  const [widgetSizes, setWidgetSizes] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const token = localStorage.getItem('token');
  const isFirstLoad = useRef(true);

  // 1. Fetch initial preferences on active dataset change
  useEffect(() => {
    if (!datasetId) return;

    setIsLoading(true);
    isFirstLoad.current = true;
    setError(null);

    fetch(`http://localhost:5000/dashboards/${datasetId}/preferences`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to load dashboard preferences');
        return res.json();
      })
      .then(data => {
        setHiddenWidgetIds(data.hiddenWidgetIds || []);
        setPinnedWidgetIds(data.pinnedWidgetIds || []);
        setWidgetOrder(data.widgetOrder || []);
        setWidgetSizes(data.widgetSizes || {});
        setIsLoading(false);
        // Allow state setting to finish before enabling updates saving to prevent startup write triggers
        setTimeout(() => {
          isFirstLoad.current = false;
        }, 50);
      })
      .catch(err => {
        setError(err.message);
        setIsLoading(false);
      });
  }, [datasetId, token]);

  // 2. Debounced save trigger to sync layout custom preferences with the backend
  useEffect(() => {
    if (isFirstLoad.current || !datasetId) return;

    const delayDebounce = setTimeout(() => {
      fetch(`http://localhost:5000/dashboards/${datasetId}/preferences`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          hiddenWidgetIds,
          pinnedWidgetIds,
          widgetOrder,
          widgetSizes
        })
      })
        .then(res => {
          if (!res.ok) console.warn('[useDashboardPreferences] Auto-save update failed.');
        })
        .catch(err => {
          console.error('[useDashboardPreferences] Save connection error:', err);
        });
    }, 800);

    return () => clearTimeout(delayDebounce);
  }, [hiddenWidgetIds, pinnedWidgetIds, widgetOrder, widgetSizes, datasetId, token]);

  const hideWidget = (widgetId) => {
    setHiddenWidgetIds(prev => prev.includes(widgetId) ? prev : [...prev, widgetId]);
  };

  const showWidget = (widgetId) => {
    setHiddenWidgetIds(prev => prev.filter(id => id !== widgetId));
  };

  const pinWidget = (widgetId) => {
    setPinnedWidgetIds(prev => prev.includes(widgetId) ? prev : [...prev, widgetId]);
  };

  const unpinWidget = (widgetId) => {
    setPinnedWidgetIds(prev => prev.filter(id => id !== widgetId));
  };

  const reorderWidgets = (newOrder) => {
    setWidgetOrder(newOrder);
  };

  const resizeWidget = (widgetId, w, h) => {
    setWidgetSizes(prev => ({
      ...prev,
      [widgetId]: { ...prev[widgetId], w, h }
    }));
  };

  return {
    hiddenWidgetIds,
    pinnedWidgetIds,
    widgetOrder,
    widgetSizes,
    isLoading,
    error,
    hideWidget,
    showWidget,
    pinWidget,
    unpinWidget,
    reorderWidgets,
    resizeWidget
  };
}
