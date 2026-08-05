import React, { useState, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Sparkles,
  Send,
  UploadCloud,
  FileSpreadsheet,
  AlertCircle,
  RefreshCw,
  MessageSquare,
  Bot,
  User,
  CheckCircle2,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  BarChart3,
  HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import {
  useUserDatasets,
  useDatasetProfile,
  useUploadDataset,
  useAskQuestion
} from '../hooks/useAskAi';

import { DatasetProfileHeader } from './DatasetProfileHeader';
import { SuggestedQuestions } from './SuggestedQuestions';
import { AskAiChart } from './AskAiChart';

export function AskAiChatPage() {
  const [selectedDatasetId, setSelectedDatasetId] = useState('');
  const [questionInput, setQuestionInput] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [uploadError, setUploadError] = useState('');
  const [expandedAnalysisIdx, setExpandedAnalysisIdx] = useState(null);

  const chatEndRef = useRef(null);

  // Queries & Mutations
  const { data: datasets = [], isLoading: isLoadingDatasets, refetch: refetchDatasets } = useUserDatasets();
  const { data: profile, isLoading: isLoadingProfile } = useDatasetProfile(selectedDatasetId);
  const uploadMutation = useUploadDataset();
  const askMutation = useAskQuestion(selectedDatasetId);

  // Auto-select latest dataset if none selected
  useEffect(() => {
    if (datasets.length > 0 && !selectedDatasetId) {
      setSelectedDatasetId(datasets[0].id || datasets[0]._id);
    }
  }, [datasets, selectedDatasetId]);

  // Scroll to bottom of chat feed
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, askMutation.isPending]);

  // File Upload Handlers
  const handleDrop = async (acceptedFiles, fileRejections) => {
    setUploadError('');
    if (fileRejections.length > 0) {
      const err = fileRejections[0].errors[0];
      setUploadError(err?.message || 'Invalid file. Please upload a .csv, .xlsx, or .xls file (max 15MB).');
      return;
    }

    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      const ext = file.name.split('.').pop().toLowerCase();
      if (!['csv', 'xlsx', 'xls'].includes(ext)) {
        setUploadError('Only .csv, .xlsx, and .xls files are supported.');
        return;
      }

      uploadMutation.mutate(file, {
        onSuccess: (resData) => {
          const newId = resData.data?.id || resData.data?._id;
          if (newId) {
            setSelectedDatasetId(newId);
            refetchDatasets();
          }
        },
        onError: (err) => {
          setUploadError(err.response?.data?.error?.message || err.message || 'Failed to upload dataset.');
        }
      });
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleDrop,
    multiple: false,
    maxSize: 15 * 1024 * 1024, // 15MB
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    }
  });

  // Ask Question Handler
  const handleAskSubmit = (e) => {
    e?.preventDefault();
    const q = questionInput.trim();
    if (!q || !selectedDatasetId || askMutation.isPending) return;

    // Add user message to history
    const userMsg = { id: `user-${Date.now()}`, sender: 'user', text: q, timestamp: new Date() };
    setChatHistory((prev) => [...prev, userMsg]);
    setQuestionInput('');

    askMutation.mutate(q, {
      onSuccess: (resData) => {
        const aiMsg = {
          id: `ai-${Date.now()}`,
          sender: 'ai',
          data: resData.data,
          timestamp: new Date()
        };
        setChatHistory((prev) => [...prev, aiMsg]);
      },
      onError: (err) => {
        const errMsg = {
          id: `err-${Date.now()}`,
          sender: 'ai',
          error: err.response?.data?.error?.message || err.message || 'An error occurred while answering your question.',
          timestamp: new Date()
        };
        setChatHistory((prev) => [...prev, errMsg]);
      }
    });
  };

  const handleSelectSuggested = (q) => {
    setQuestionInput(q);
  };

  const toggleAnalysisView = (idx) => {
    setExpandedAnalysisIdx(expandedAnalysisIdx === idx ? null : idx);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 min-h-[calc(100vh-140px)] flex flex-col font-sans select-text">
      
      {/* Top Header / Dataset Picker Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-950/40 border border-[#1F2937]/60 px-5 py-4 rounded-2xl backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-[#8B5CF6] to-[#3B82F6] flex items-center justify-center text-white shadow-lg shadow-purple-500/20 shrink-0">
            <MessageSquare className="h-4.5 w-4.5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white font-display flex items-center gap-2">
              Ask AI About Your Data
            </h2>
            <p className="text-xs text-gray-400">
              Upload spreadsheets and get instant analytical answers with chart visualizations.
            </p>
          </div>
        </div>

        {/* Dataset Selection Dropdown */}
        <div className="flex items-center gap-3">
          {datasets.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-400 hidden md:inline">Dataset:</span>
              <select
                value={selectedDatasetId}
                onChange={(e) => setSelectedDatasetId(e.target.value)}
                className="bg-[#111827] border border-[#1F2937] text-white text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-[#8B5CF6] transition-colors cursor-pointer max-w-[200px] truncate"
              >
                {datasets.map((d) => (
                  <option key={d.id || d._id} value={d.id || d._id}>
                    {d.fileName} ({d.rowCount} rows)
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {!selectedDatasetId ? (
        /* Empty State: Drag & Drop File Upload */
        <div className="flex-1 flex flex-col items-center justify-center p-8 border border-dashed border-[#1F2937] hover:border-[#8B5CF6]/50 rounded-3xl bg-slate-900/10 backdrop-blur-md transition-all">
          <div
            {...getRootProps()}
            className="w-full flex flex-col items-center justify-center cursor-pointer text-center py-12"
          >
            <input {...getInputProps()} />
            <div className="h-16 w-16 rounded-2xl bg-[#8B5CF6]/10 border border-[#8B5CF6]/20 text-[#c084fc] flex items-center justify-center mb-4 shadow-lg shadow-purple-500/10">
              <UploadCloud className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-bold text-white font-display">
              {isDragActive ? 'Drop your spreadsheet file here' : 'Upload dataset to start asking AI'}
            </h3>
            <p className="text-xs text-gray-400 mt-2 max-w-md leading-relaxed">
              Drag & drop your <span className="text-white font-semibold">.csv</span>, <span className="text-white font-semibold">.xlsx</span>, or <span className="text-white font-semibold">.xls</span> file here, or click to browse. Max size 15MB.
            </p>
            <button
              type="button"
              className="mt-6 px-6 py-2.5 bg-[#8B5CF6] hover:bg-[#8B5CF6]/90 text-white text-xs font-bold rounded-xl transition-all cursor-pointer border-none shadow-lg shadow-purple-500/20 active:scale-95 flex items-center gap-2"
            >
              <UploadCloud className="h-4 w-4" />
              <span>Select File</span>
            </button>
          </div>

          {uploadMutation.isPending && (
            <div className="mt-4 flex items-center gap-2 text-xs text-[#c084fc] font-semibold animate-pulse">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>Parsing spreadsheet and inferring column schema...</span>
            </div>
          )}

          {uploadError && (
            <div className="mt-4 px-4 py-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{uploadError}</span>
            </div>
          )}
        </div>
      ) : (
        /* Active Dataset Chat Experience */
        <div className="flex-1 flex flex-col space-y-6">
          
          {/* Dataset Profile Header Card */}
          {isLoadingProfile ? (
            <div className="h-28 rounded-2xl bg-slate-900/20 border border-[#1F2937] animate-pulse" />
          ) : (
            <DatasetProfileHeader profile={profile} />
          )}

          {/* Chat Feed Container */}
          <div className="flex-1 bg-slate-950/20 border border-[#1F2937]/50 rounded-2xl p-5 overflow-y-auto space-y-6 min-h-[350px] max-h-[550px] custom-scrollbar">
            {chatHistory.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-gray-500 space-y-3">
                <div className="h-12 w-12 rounded-2xl bg-[#8B5CF6]/10 border border-[#8B5CF6]/20 text-[#c084fc] flex items-center justify-center">
                  <Bot className="h-6 w-6" />
                </div>
                <h4 className="text-sm font-bold text-gray-300 font-display">Ask any question about your data</h4>
                <p className="text-xs text-gray-400 max-w-sm">
                  Try asking questions like "Which region performs best?" or select from the suggested prompts below.
                </p>
              </div>
            ) : (
              chatHistory.map((msg, idx) => (
                <div key={msg.id || idx} className="space-y-4">
                  {msg.sender === 'user' ? (
                    /* User Question Message Bubble */
                    <div className="flex items-start justify-end gap-3">
                      <div className="bg-[#8B5CF6] text-white px-4 py-3 rounded-2xl rounded-tr-none text-xs font-medium max-w-xl shadow-lg shadow-purple-500/10">
                        {msg.text}
                      </div>
                      <div className="h-8 w-8 rounded-full bg-slate-800 border border-[#1F2937] flex items-center justify-center text-gray-300 shrink-0">
                        <User className="h-4 w-4" />
                      </div>
                    </div>
                  ) : msg.error ? (
                    /* Error Message Card */
                    <div className="flex items-start gap-3">
                      <div className="h-8 w-8 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                        <AlertCircle className="h-4 w-4" />
                      </div>
                      <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 px-4 py-3 rounded-2xl text-xs max-w-xl">
                        {msg.error}
                      </div>
                    </div>
                  ) : (
                    /* AI Answer Card */
                    <div className="flex items-start gap-3 w-full">
                      <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-[#8B5CF6] to-[#3B82F6] flex items-center justify-center text-white shrink-0 shadow-md">
                        <Bot className="h-4 w-4" />
                      </div>

                      <div className="flex-1 bg-[#0E1527] border border-[#1F2937] rounded-2xl p-5 space-y-4 shadow-xl text-left">
                        {/* Direct Answer Headline */}
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#8B5CF6]">
                            AI Finding
                          </span>
                          <h4 className="text-sm font-bold text-white leading-snug">
                            {msg.data?.answer}
                          </h4>
                        </div>

                        {/* Insights Bullet Points */}
                        {msg.data?.insights && msg.data.insights.length > 0 && (
                          <div className="bg-slate-900/60 border border-[#1F2937]/60 rounded-xl p-3.5 space-y-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1">
                              <Sparkles className="h-3 w-3 text-[#8B5CF6]" />
                              Key Analytical Insights
                            </span>
                            <ul className="space-y-1.5 text-xs text-gray-300">
                              {msg.data.insights.map((ins, iIdx) => (
                                <li key={iIdx} className="flex items-start gap-2">
                                  <span className="text-[#8B5CF6] font-bold">•</span>
                                  <span>{ins}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Methodology Badge */}
                        {msg.data?.methodology && (
                          <div className="text-[11px] text-gray-400 bg-slate-950/40 px-3 py-1.5 rounded-lg border border-[#1F2937]/40 flex items-center gap-2">
                            <span className="font-bold text-gray-500">Methodology:</span>
                            <span>{msg.data.methodology}</span>
                          </div>
                        )}

                        {/* Recharts Component */}
                        {msg.data?.chart && (
                          <div className="bg-slate-950/40 border border-[#1F2937]/50 rounded-xl p-3">
                            <div className="flex items-center justify-between px-2 pt-1">
                              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                                <BarChart3 className="h-3 w-3 text-[#8B5CF6]" />
                                Data Visualizer
                              </span>
                            </div>
                            <AskAiChart chartConfig={msg.data.chart} />
                          </div>
                        )}

                        {/* Raw Analysis Execution Details Toggle */}
                        {msg.data?.analysis && (
                          <div className="pt-2 border-t border-[#1F2937]/40">
                            <button
                              type="button"
                              onClick={() => toggleAnalysisView(idx)}
                              className="text-[11px] font-semibold text-gray-400 hover:text-white flex items-center gap-1 cursor-pointer bg-transparent border-none"
                            >
                              <span>{expandedAnalysisIdx === idx ? 'Hide Analysis Details' : 'Show Server Analysis Specs'}</span>
                              {expandedAnalysisIdx === idx ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                            </button>

                            {expandedAnalysisIdx === idx && (
                              <pre className="mt-2 p-3 bg-black/40 rounded-xl text-[10px] font-mono text-emerald-400 overflow-x-auto border border-[#1F2937]">
                                {JSON.stringify(msg.data.analysis, null, 2)}
                              </pre>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}

            {/* AI Answer Loading Indicator */}
            {askMutation.isPending && (
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-full bg-[#8B5CF6] flex items-center justify-center text-white shrink-0 animate-pulse">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="bg-[#0E1527] border border-[#1F2937] px-4 py-3 rounded-2xl text-xs text-[#c084fc] flex items-center gap-2 font-medium">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Analyzing question and executing server-side analysis operation...</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Suggested Questions Chips */}
          <SuggestedQuestions
            columns={profile?.columns || []}
            onSelectQuestion={handleSelectSuggested}
            disabled={askMutation.isPending}
          />

          {/* Question Input Form */}
          <form onSubmit={handleAskSubmit} className="relative flex items-center">
            <input
              type="text"
              value={questionInput}
              onChange={(e) => setQuestionInput(e.target.value)}
              placeholder="Ask a question about your dataset (e.g. Which region performs best?)..."
              disabled={askMutation.isPending}
              className="w-full bg-[#111827] border border-[#1F2937] focus:border-[#8B5CF6] text-white text-xs rounded-2xl pl-4 pr-12 py-3.5 focus:outline-none transition-all placeholder:text-gray-500 shadow-xl disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!questionInput.trim() || askMutation.isPending}
              className="absolute right-2 p-2 rounded-xl bg-[#8B5CF6] hover:bg-[#8B5CF6]/90 disabled:bg-slate-800 disabled:text-gray-600 text-white transition-all cursor-pointer border-none shadow-md"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>

        </div>
      )}
    </div>
  );
}
