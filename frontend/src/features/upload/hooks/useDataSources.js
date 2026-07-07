import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../authentication/contexts/AuthContext';
import { logGroqResult } from '../../../utils/groqDebugLogger';

export const useDataSources = ({ onDeleteSuccess, onUploadSuccess } = {}) => {
  const { user, activeOrgId, apiRequest } = useAuth();

  const [dataSources, setDataSources] = useState([]);
  const [selectedDSId, setSelectedDSId] = useState(null);
  const [dsPreview, setDsPreview] = useState(null);
  const [kpiData, setKpiData] = useState([]);
  const [suggestedCharts, setSuggestedCharts] = useState([]);
  const [mappingInput, setMappingInput] = useState({});

  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadLoading, setUploadLoading] = useState(false);

  const fileInputRef = useRef(null);

  // Load baseline data sources
  useEffect(() => {
    if (user && activeOrgId) {
      loadDataSources();
    } else {
      setDataSources([]);
      setSelectedDSId(null);
      setDsPreview(null);
      setKpiData([]);
      setSuggestedCharts([]);
      setMappingInput({});
    }
  }, [user, activeOrgId]);

  const loadDataSources = async () => {
    try {
      const res = await apiRequest('/datasources');
      if (res.ok) {
        const data = await res.json();
        setDataSources(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const selectDataSourceForPreview = async (dsId) => {
    setSelectedDSId(dsId);
    try {
      const res = await apiRequest(`/datasources/${dsId}/preview`);
      if (res.ok) {
        const data = await res.json();
        setDsPreview(data);
        setMappingInput(data.dataSource.kpiMapping || {});
        // Fetch KPIs
        const kpisRes = await apiRequest(`/analytics/${dsId}/kpis`);
        if (kpisRes.ok) {
          const kpis = await kpisRes.json();
          setKpiData(kpis);
          // ── Browser console: Groq KPI response ─────────────────────────────
          logGroqResult('KPI Recommendation', { success: true, data: kpis, attempts: 1 });
          // ────────────────────────────────────────────────────────────────────
        }
        // Fetch Suggested Charts
        const suggestionsRes = await apiRequest(`/analytics/${dsId}/suggest-charts`);
        if (suggestionsRes.ok) {
          const suggestions = await suggestionsRes.json();
          setSuggestedCharts(suggestions);
          // ── Browser console: Groq chart suggestion response ─────────────────
          logGroqResult('Chart Recommendation', { success: true, data: suggestions, attempts: 1 });
          // ────────────────────────────────────────────────────────────────────
        }
      }
    } catch (err) {
      console.error('Staging Preview Error:', err);
    }
  };

  const confirmDataSource = async (dsId) => {
    try {
      const res = await apiRequest(`/datasources/${dsId}/confirm`, { method: 'POST' });
      if (res.ok) {
        await loadDataSources();
        selectDataSourceForPreview(dsId);
      }
    } catch (err) {
      console.error('Confirm error:', err);
    }
  };

  const deleteDataSource = async (dsId) => {
    if (!window.confirm('Are you sure you want to delete this dataset? All charts dependent on it will display a warning.')) return;
    try {
      const res = await apiRequest(`/datasources/${dsId}`, { method: 'DELETE' });
      if (res.ok) {
        setDataSources(prev => prev.filter(ds => ds._id !== dsId));
        setSelectedDSId(null);
        setDsPreview(null);
        setKpiData([]);
        setSuggestedCharts([]);
        loadDataSources();
        if (onDeleteSuccess) onDeleteSuccess();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleFileUpload = async (file) => {
    if (!file) return;
    setUploadLoading(true);
    setUploadError('');
    const formData = new FormData();
    formData.append('file', file);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:5000/datasources/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.error?.message || 'File parsing failed');
      } else {
        await loadDataSources();
        selectDataSourceForPreview(data.dataSourceId);
        if (onUploadSuccess) onUploadSuccess();
      }
    } catch (err) {
      console.error(err);
      setUploadError('Network error uploading file');
    } finally {
      setUploadLoading(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleKpiMappingChange = (kpiKey, colName) => {
    setMappingInput(prev => ({
      ...prev,
      [kpiKey]: colName === 'none' ? null : colName
    }));
  };

  const saveKpiMappings = async () => {
    try {
      const res = await apiRequest(`/analytics/${selectedDSId}/kpi-mapping`, {
        method: 'POST',
        body: JSON.stringify({ mappings: mappingInput })
      });
      if (res.ok) {
        alert('KPI mappings updated successfully.');
        selectDataSourceForPreview(selectedDSId);
      } else {
        const data = await res.json();
        alert(data.error?.message || 'Failed to update KPI mappings');
      }
    } catch (err) {
      console.error(err);
    }
  };

  return {
    dataSources,
    selectedDSId,
    setSelectedDSId,
    dsPreview,
    setDsPreview,
    kpiData,
    setKpiData,
    suggestedCharts,
    setSuggestedCharts,
    mappingInput,
    isDragging,
    uploadError,
    uploadLoading,
    fileInputRef,
    loadDataSources,
    selectDataSourceForPreview,
    confirmDataSource,
    deleteDataSource,
    handleFileUpload,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleKpiMappingChange,
    saveKpiMappings
  };
};
