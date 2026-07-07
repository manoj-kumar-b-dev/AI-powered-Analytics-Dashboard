import React, { useState, useEffect, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { parseFileClientSide, readWorkbookSheets } from "../../shared/utils/fileParser";
import { detectColumnTypes, validateDataset, calculateSummary } from "../../shared/utils/schemaValidator";
import { useAuth } from "../../authentication/contexts/AuthContext";
import { KPI_SYNONYMS } from "../../shared/constants/kpiSynonyms";

import { DatasetSidebar } from "./DatasetSidebar";
import { UploadDropzone } from "./UploadDropzone";
import { UploadProgressPanel } from "./UploadProgressPanel";
import { ClientPreviewWizard } from "./ClientPreviewWizard";
import { DatabasePreviewPanel } from "./DatabasePreviewPanel";

export function DatasetUploadManager({
  dataSources = [],
  selectedDSId,
  dsPreview,
  kpiData = [],
  suggestedCharts = [],
  mappingInput = {},
  uploadLoading,
  loadDataSources,
  selectDataSourceForPreview,
  confirmDataSource,
  deleteDataSource,
  handleKpiMappingChange,
  saveKpiMappings,
  onUploadSuccess
}) {
  const { token } = useAuth();

  // Local state for active upload wizard
  const [activeFile, setActiveFile] = useState(null);
  const [excelSheets, setExcelSheets] = useState([]);
  const [selectedSheet, setSelectedSheet] = useState("");
  
  // Client-side parsing results
  const [parsedData, setParsedData] = useState(null);
  const [detectedTypes, setDetectedTypes] = useState({});
  const [validationErrors, setValidationErrors] = useState([]);
  const [summaryData, setSummaryData] = useState(null);
  const [parseError, setParseError] = useState("");

  // UI state for local parsing/uploading
  const [isParsingClientSide, setIsParsingClientSide] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadState, setUploadState] = useState("idle"); // 'idle', 'uploading', 'saving', 'success', 'error'
  const [networkError, setNetworkError] = useState("");
  const xhrRef = useRef(null);

  // Import Action settings
  const [importAction, setImportAction] = useState("confirm"); // 'confirm', 'replace', 'append'
  const [targetDatasetId, setTargetDatasetId] = useState("");

  // Reset local parsing state
  const resetUploadWizard = () => {
    if (xhrRef.current) {
      xhrRef.current.abort();
    }
    setActiveFile(null);
    setExcelSheets([]);
    setSelectedSheet("");
    setParsedData(null);
    setDetectedTypes({});
    setValidationErrors([]);
    setSummaryData(null);
    setParseError("");
    setUploadProgress(0);
    setUploadState("idle");
    setNetworkError("");
  };

  // Run client-side parsing whenever file or selected sheet changes
  useEffect(() => {
    if (!activeFile) return;

    const parseFile = async () => {
      setIsParsingClientSide(true);
      setParseError("");
      try {
        const result = await parseFileClientSide(activeFile, selectedSheet);
        setParsedData({ headers: result.headers, rows: result.rows });
        setSelectedSheet(result.activeSheet || "");

        const columnTypes = detectColumnTypes(result.rows, result.headers);
        setDetectedTypes(columnTypes);

        const errors = validateDataset(result.rows, result.headers, columnTypes);
        setValidationErrors(errors);

        const summary = calculateSummary(activeFile, result.rows, result.headers, errors, result.activeSheet);
        setSummaryData(summary);
      } catch (err) {
        console.error(err);
        setParseError(err.message || "Failed to parse file client-side.");
      } finally {
        setIsParsingClientSide(false);
      }
    };

    parseFile();
  }, [activeFile, selectedSheet]);

  // Extract sheet names on file load
  const handleFileDrop = async (files) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    
    if (file.size > 25 * 1024 * 1024) {
      setParseError("File size exceeds the maximum limit of 25MB.");
      return;
    }

    const ext = file.name.split(".").pop().toLowerCase();
    if (!["csv", "xlsx", "xls"].includes(ext)) {
      setParseError("Unsupported file type. Please upload a .csv, .xlsx, or .xls file.");
      return;
    }

    resetUploadWizard();
    setActiveFile(file);

    try {
      const sheets = await readWorkbookSheets(file);
      setExcelSheets(sheets);
      if (sheets.length > 0) {
        setSelectedSheet(sheets[0]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleFileDrop,
    multiple: false,
    noClick: false
  });

  const handleUploadAndSave = () => {
    if (!activeFile) return;

    setUploadState("uploading");
    setUploadProgress(0);
    setNetworkError("");

    const formData = new FormData();
    formData.append("file", activeFile);
    if (selectedSheet) formData.append("sheetName", selectedSheet);
    formData.append("action", importAction);
    if (importAction !== "confirm" && targetDatasetId) {
      formData.append("targetDataSourceId", targetDatasetId);
    }

    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        setUploadProgress(pct);
        if (pct >= 100) {
          setUploadState("saving");
        }
      }
    };

    xhr.onload = async () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const resData = JSON.parse(xhr.responseText);
          setUploadState("success");
          setTimeout(async () => {
            await loadDataSources();
            await selectDataSourceForPreview(resData.dataSourceId);
            if (onUploadSuccess) {
              onUploadSuccess(resData.dataSourceId);
            }
            resetUploadWizard();
          }, 1200);
        } catch (err) {
          setUploadState("error");
          setNetworkError("Failed to parse upload confirmation.");
        }
      } else {
        setUploadState("error");
        try {
          const errData = JSON.parse(xhr.responseText);
          setNetworkError(errData.error?.message || "Database import failed.");
        } catch (err) {
          setNetworkError(`Server returned error code: ${xhr.status}`);
        }
      }
    };

    xhr.onerror = () => {
      setUploadState("error");
      setNetworkError("Network error uploading file.");
    };

    xhr.open("POST", "http://localhost:5000/datasources/upload");
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.send(formData);
  };

  const downloadErrorsCsv = () => {
    if (validationErrors.length === 0) return;
    
    let csvContent = "Row,Column,Value,Error Type,Message\r\n";
    validationErrors.forEach((err) => {
      const rowVal = `"${(err.row || "").toString().replace(/"/g, '""')}"`;
      const colVal = `"${(err.column || "").toString().replace(/"/g, '""')}"`;
      const cellVal = `"${(err.value || "").toString().replace(/"/g, '""')}"`;
      const typeVal = `"${(err.type || "").toString().replace(/"/g, '""')}"`;
      const msgVal = `"${(err.message || "").toString().replace(/"/g, '""')}"`;
      csvContent += `${rowVal},${colVal},${cellVal},${typeVal},${msgVal}\r\n`;
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `validation_errors_${activeFile.name}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const confirmedDataSources = dataSources.filter(ds => ds.status === "confirmed");

  useEffect(() => {
    if ((importAction === "replace" || importAction === "append") && confirmedDataSources.length > 0 && !targetDatasetId) {
      setTargetDatasetId(confirmedDataSources[0]._id);
    }
  }, [importAction, confirmedDataSources, targetDatasetId]);

  return (
    <div className="flex flex-col lg:flex-row gap-6 w-full min-h-[calc(100vh-120px)] relative items-stretch min-w-0">
      <DatasetSidebar
        dataSources={dataSources}
        selectedDSId={selectedDSId}
        activeFile={activeFile}
        resetUploadWizard={resetUploadWizard}
        selectDataSourceForPreview={selectDataSourceForPreview}
        deleteDataSource={deleteDataSource}
      />

      <div className="flex-1 flex flex-col bg-slate-950/10 border border-[#1F2937]/40 rounded-2xl overflow-x-hidden backdrop-blur-md min-w-0">
        {uploadState !== "idle" && (
          <UploadProgressPanel
            uploadState={uploadState}
            activeFile={activeFile}
            uploadProgress={uploadProgress}
            networkError={networkError}
            handleUploadAndSave={handleUploadAndSave}
            resetUploadWizard={resetUploadWizard}
          />
        )}

        {!activeFile && !dsPreview && (
          <UploadDropzone
            getRootProps={getRootProps}
            getInputProps={getInputProps}
            isDragActive={isDragActive}
            parseError={parseError}
          />
        )}

        {activeFile && parsedData && (
          <ClientPreviewWizard
            activeFile={activeFile}
            excelSheets={excelSheets}
            selectedSheet={selectedSheet}
            setSelectedSheet={setSelectedSheet}
            resetUploadWizard={resetUploadWizard}
            parsedData={parsedData}
            isParsingClientSide={isParsingClientSide}
            summaryData={summaryData}
            validationErrors={validationErrors}
            downloadErrorsCsv={downloadErrorsCsv}
            importAction={importAction}
            setImportAction={setImportAction}
            confirmedDataSources={confirmedDataSources}
            targetDatasetId={targetDatasetId}
            setTargetDatasetId={setTargetDatasetId}
            handleUploadAndSave={handleUploadAndSave}
          />
        )}

        {!activeFile && dsPreview && (
          <DatabasePreviewPanel
            dsPreview={dsPreview}
            confirmDataSource={confirmDataSource}
            deleteDataSource={deleteDataSource}
            kpiData={kpiData}
            KPI_SYNONYMS={KPI_SYNONYMS}
            mappingInput={mappingInput}
            handleKpiMappingChange={handleKpiMappingChange}
            saveKpiMappings={saveKpiMappings}
            suggestedCharts={suggestedCharts}
          />
        )}
      </div>
    </div>
  );
}
