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
  HelpCircle,
  Plus,
  Trash2,
  PanelLeftClose,
  PanelLeftOpen,
  History,
  Database
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import {
  useUserDatasets,
  useDatasetProfile,
  useUploadDataset,
  useAskQuestion
} from '../hooks/useAskAi';

import { useChatStore } from '../store/chatStore';
import { SuggestedQuestions } from './SuggestedQuestions';
import { AskAiChart } from './AskAiChart';

export function AskAiChatPage() {
  const [selectedDatasetId, setSelectedDatasetId] = useState('');
  const [questionInput, setQuestionInput] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [expandedAnalysisIdx, setExpandedAnalysisIdx] = useState(null);
  const [isChatSidebarOpen, setIsChatSidebarOpen] = useState(true);

  const chatEndRef = useRef(null);

  // Zustand Chat Store for Multi-Session Management
  const {
    getSessions,
    getActiveSessionId,
    setActiveSessionId,
    createNewSession,
    getActiveMessages,
    addMessageToActiveSession,
    deleteSession
  } = useChatStore();

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

  const sessions = selectedDatasetId ? getSessions(selectedDatasetId) : [];
  const activeSessionId = selectedDatasetId ? getActiveSessionId(selectedDatasetId) : null;
  const chatHistory = selectedDatasetId ? getActiveMessages(selectedDatasetId) : [];

  // Scroll to bottom of chat feed
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, askMutation.isPending]);

  // Session Handlers
  const handleCreateNewChat = () => {
    if (!selectedDatasetId) return;
    createNewSession(selectedDatasetId);
  };

  const handleSelectSession = (sessId) => {
    if (!selectedDatasetId) return;
    setActiveSessionId(selectedDatasetId, sessId);
  };

  const handleDeleteSession = (sessId) => {
    if (!selectedDatasetId) return;
    deleteSession(selectedDatasetId, sessId);
  };

  // File Upload Handlers
  const handleDrop = async (acceptedFiles, fileRejections) => {
    setUploadError('');
    if (fileRejections.length > 0) {
      const err = fileRejections[0].errors[0];
      setUploadError(err?.message || 'Invalid file. Upload a .csv, .xlsx, or .xls file (max 15MB).');
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

  const { getRootProps, getInputProps, isDragActive, open: openFileSelector } = useDropzone({
    onDrop: handleDrop,
    noClick: true,
    noKeyboard: true,
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

    // Add user message to active session
    const userMsg = { id: `user-${Date.now()}`, sender: 'user', text: q, timestamp: new Date().toISOString() };
    addMessageToActiveSession(selectedDatasetId, userMsg);
    setQuestionInput('');

    askMutation.mutate({ question: q, history: chatHistory }, {
      onSuccess: (resData) => {
        const aiMsg = {
          id: `ai-${Date.now()}`,
          sender: 'ai',
          data: resData.data,
          timestamp: new Date().toISOString()
        };
        addMessageToActiveSession(selectedDatasetId, aiMsg);
      },
      onError: (err) => {
        const errMsg = {
          id: `err-${Date.now()}`,
          sender: 'ai',
          error: err.response?.data?.error?.message || err.message || 'An error occurred while answering your question.',
          timestamp: new Date().toISOString()
        };
        addMessageToActiveSession(selectedDatasetId, errMsg);
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
    <div className="max-w-6xl mx-auto h-[calc(100vh-95px)] flex flex-col font-sans select-text overflow-hidden">
      {/* Hidden Dropzone Input */}
      <input {...getInputProps()} />

      {/* Main Workspace Area */}
      {!selectedDatasetId ? (
        /* Empty State: Drag & Drop File Upload */
        <div className="flex-1 flex flex-col items-center justify-center p-8 border border-dashed border-slate-300 dark:border-[#1F2937] hover:border-[#8B5CF6]/50 rounded-3xl bg-white/70 dark:bg-slate-900/10 backdrop-blur-md transition-all">
          <div
            onClick={openFileSelector}
            className="w-full flex flex-col items-center justify-center cursor-pointer text-center py-12"
          >
            <div className="h-16 w-16 rounded-2xl bg-[#8B5CF6]/10 border border-[#8B5CF6]/20 text-[#8B5CF6] dark:text-[#c084fc] flex items-center justify-center mb-4 shadow-lg shadow-purple-500/10">
              <UploadCloud className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white font-display">
              {isDragActive ? 'Drop your spreadsheet file here' : 'Upload dataset to start asking AI'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-gray-400 mt-2 max-w-md leading-relaxed">
              Drag & drop your <span className="text-slate-800 dark:text-white font-semibold">.csv</span>, <span className="text-slate-800 dark:text-white font-semibold">.xlsx</span>, or <span className="text-slate-800 dark:text-white font-semibold">.xls</span> file here, or click to browse. Max size 15MB.
            </p>
            <button
              type="button"
              onClick={openFileSelector}
              className="mt-6 px-6 py-2.5 bg-[#8B5CF6] hover:bg-[#8B5CF6]/90 text-white text-xs font-bold rounded-xl transition-all cursor-pointer border-none shadow-lg shadow-purple-500/20 active:scale-95 flex items-center gap-2"
            >
              <UploadCloud className="h-4 w-4" />
              <span>Select File</span>
            </button>
          </div>

          {uploadMutation.isPending && (
            <div className="mt-4 flex items-center gap-2 text-xs text-[#8B5CF6] dark:text-[#c084fc] font-semibold animate-pulse">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>Parsing spreadsheet and inferring column schema...</span>
            </div>
          )}

          {uploadError && (
            <div className="mt-4 px-4 py-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-500 dark:text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{uploadError}</span>
            </div>
          )}
        </div>
      ) : (
        /* Full-Height Chat Workspace with Left Sidebar */
        <div className="flex gap-4 h-full min-h-0 flex-1 overflow-hidden">

          {/* Left Chat Sessions & Dataset Switcher Sidebar */}
          <AnimatePresence initial={false}>
            {isChatSidebarOpen && (
              <motion.aside
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 260, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="shrink-0 bg-white/90 dark:bg-[#0E1527]/90 border border-slate-200 dark:border-[#1F2937] rounded-2xl flex flex-col overflow-hidden backdrop-blur-md shadow-xl h-full transition-colors"
              >
                {/* Sidebar Top Section: Dataset Switcher & Action Buttons */}
                <div className="p-3 border-b border-slate-200 dark:border-[#1F2937]/60 space-y-2.5 bg-slate-50/70 dark:bg-slate-900/50">
                  
                  {/* Dataset Selector Header */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 dark:text-gray-400 uppercase tracking-wider">
                      <div className="flex items-center gap-1.5">
                        <Database className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                        <span>Active Dataset</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsChatSidebarOpen(false)}
                        className="p-1 text-slate-400 dark:text-gray-500 hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer border-none bg-transparent"
                        title="Collapse Sidebar"
                      >
                        <PanelLeftClose className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <select
                      value={selectedDatasetId}
                      onChange={(e) => setSelectedDatasetId(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-[#1F2937] focus:border-[#8B5CF6] text-slate-800 dark:text-white text-xs font-medium rounded-xl px-2.5 py-2 focus:outline-none transition-colors cursor-pointer truncate"
                    >
                      {datasets.map((d) => (
                        <option key={d.id || d._id} value={d.id || d._id}>
                          {d.fileName} ({d.rowCount} rows)
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Action Buttons: New Chat & Upload Dataset */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleCreateNewChat}
                      className="flex items-center justify-center gap-1.5 h-9 px-2 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] hover:from-[#8B5CF6]/90 hover:to-[#7C3AED]/90 text-white font-bold text-xs transition-all shadow-md active:scale-95 cursor-pointer border-none"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>New Chat</span>
                    </button>

                    <button
                      type="button"
                      onClick={openFileSelector}
                      disabled={uploadMutation.isPending}
                      className="flex items-center justify-center gap-1.5 h-9 px-2 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-[#1F2937] text-slate-700 dark:text-gray-200 hover:text-slate-900 dark:hover:text-white font-bold text-xs transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                      title="Upload a new .csv or .xlsx dataset"
                    >
                      {uploadMutation.isPending ? (
                        <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#8B5CF6] dark:text-[#c084fc]" />
                      ) : (
                        <UploadCloud className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      )}
                      <span>{uploadMutation.isPending ? 'Parsing...' : 'Upload'}</span>
                    </button>
                  </div>

                  {uploadError && (
                    <div className="px-2.5 py-1.5 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-500 dark:text-rose-400 text-[10px] flex items-center gap-1">
                      <AlertCircle className="h-3 w-3 shrink-0" />
                      <span className="truncate">{uploadError}</span>
                    </div>
                  )}

                </div>

                {/* Sessions List */}
                <div className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
                  <div className="px-2.5 py-1 text-[10px] font-bold text-slate-400 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                    <History className="h-3 w-3 text-[#8B5CF6]" />
                    <span>Previous Chats</span>
                  </div>

                  {sessions.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400 dark:text-gray-500 italic">
                      No previous chats. Click '+ New Chat' above to start.
                    </div>
                  ) : (
                    sessions.map((sess) => {
                      const isActive = sess.id === activeSessionId;
                      return (
                        <div
                          key={sess.id}
                          onClick={() => handleSelectSession(sess.id)}
                          className={`group flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition-all cursor-pointer ${
                            isActive
                              ? 'bg-[#8B5CF6]/15 border border-[#8B5CF6]/40 text-purple-700 dark:text-white font-semibold shadow-inner'
                              : 'hover:bg-slate-100 dark:hover:bg-slate-900/60 text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-gray-200 border border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <MessageSquare className={`h-3.5 w-3.5 shrink-0 ${isActive ? 'text-[#8B5CF6] dark:text-[#c084fc]' : 'text-slate-400 dark:text-gray-500'}`} />
                            <span className="truncate text-[11px] font-medium leading-tight">
                              {sess.title || 'New Chat'}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteSession(sess.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 dark:text-gray-500 hover:text-rose-500 dark:hover:text-rose-400 transition-opacity cursor-pointer shrink-0 border-none bg-transparent"
                            title="Delete Chat Session"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </motion.aside>
            )}
          </AnimatePresence>

          {/* Main Chat Container (ChatGPT Style: Scrollable Feed + Fixed Bottom Input Bar) */}
          <div className="flex-1 flex flex-col min-w-0 h-full bg-white/90 dark:bg-[#0E1527]/90 border border-slate-200 dark:border-[#1F2937] rounded-2xl overflow-hidden backdrop-blur-md shadow-xl relative transition-colors">

            {/* Sidebar Toggle when collapsed */}
            {!isChatSidebarOpen && (
              <div className="p-3 border-b border-slate-200 dark:border-[#1F2937]/60 bg-slate-50/70 dark:bg-slate-950/40 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setIsChatSidebarOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-[#1F2937] text-xs font-semibold text-slate-700 dark:text-gray-300 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer shadow-md"
                  title="Open Chat History Sidebar"
                >
                  <PanelLeftOpen className="h-3.5 w-3.5 text-[#8B5CF6]" />
                  <span>Open Chat Sidebar</span>
                </button>
              </div>
            )}

            {/* Scrollable Chat Feed Area (Takes 100% available space above fixed input) */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
              {chatHistory.length === 0 ? (
                /* Welcome Empty State inside active chat */
                <div className="h-full min-h-[350px] flex flex-col items-center justify-center text-center space-y-3 p-6">
                  <div className="h-12 w-12 rounded-2xl bg-[#8B5CF6]/10 border border-[#8B5CF6]/20 text-[#8B5CF6] dark:text-[#c084fc] flex items-center justify-center shadow-lg shadow-purple-500/10">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800 dark:text-gray-300 font-display">Ask any question about your data</h4>
                  <p className="text-xs text-slate-500 dark:text-gray-400 max-w-sm">
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
                        <div className="h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-[#1F2937] flex items-center justify-center text-slate-600 dark:text-gray-300 shrink-0">
                          <User className="h-4 w-4" />
                        </div>
                      </div>
                    ) : msg.error ? (
                      /* Error Message Card */
                      <div className="flex items-start gap-3">
                        <div className="h-8 w-8 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-500 dark:text-rose-400 shrink-0">
                          <AlertCircle className="h-4 w-4" />
                        </div>
                        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300 px-4 py-3 rounded-2xl text-xs max-w-xl">
                          {msg.error}
                        </div>
                      </div>
                    ) : (
                      /* AI Answer Card */
                      <div className="flex items-start gap-3 w-full">
                        <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-[#8B5CF6] to-[#3B82F6] flex items-center justify-center text-white shrink-0 shadow-md">
                          <Bot className="h-4 w-4" />
                        </div>

                        <div className="flex-1 bg-white dark:bg-[#0E1527] border border-slate-200 dark:border-[#1F2937] rounded-2xl p-5 space-y-4 shadow-xl text-left transition-colors">
                          {/* Direct Answer Headline */}
                          <div className="space-y-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#8B5CF6]">
                              AI Finding
                            </span>
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                              {msg.data?.answer}
                            </h4>
                          </div>

                          {/* Analytical Insights List */}
                          {msg.data?.insights && msg.data.insights.length > 0 && (
                            <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-[#1F2937]/80 rounded-xl p-3.5 space-y-2">
                              <div className="text-[10px] font-bold text-[#8B5CF6] dark:text-[#c084fc] uppercase tracking-wider flex items-center gap-1.5">
                                <Sparkles className="h-3 w-3" />
                                <span>Key Analytical Insights</span>
                              </div>
                              <ul className="space-y-1.5 text-xs text-slate-700 dark:text-gray-300 list-disc list-inside">
                                {msg.data.insights.map((ins, iIdx) => (
                                  <li key={iIdx} className="leading-relaxed">
                                    {ins}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Aggregation Methodology */}
                          {msg.data?.methodology && (
                            <div className="text-[11px] text-slate-500 dark:text-gray-400 bg-slate-100/70 dark:bg-slate-950/40 px-3 py-2 rounded-lg border border-slate-200 dark:border-[#1F2937]/50 font-mono">
                              <span className="font-semibold text-slate-700 dark:text-gray-300">Methodology:</span> {msg.data.methodology}
                            </div>
                          )}

                          {/* Chart Visualization */}
                          {msg.data?.chart && (
                            <div className="pt-2 border-t border-slate-200 dark:border-[#1F2937]/60">
                              <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                                <BarChart3 className="h-3.5 w-3.5 text-[#8B5CF6]" />
                                <span>Data Visualizer</span>
                              </div>
                              <AskAiChart chartConfig={msg.data.chart} />
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
                  <div className="bg-white dark:bg-[#0E1527] border border-slate-200 dark:border-[#1F2937] px-4 py-3 rounded-2xl text-xs text-[#8B5CF6] dark:text-[#c084fc] flex items-center gap-2 font-medium">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Analyzing question and executing server-side analysis operation...</span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Fixed / Sticky Bottom Input Section */}
            <div className="sticky bottom-0 z-10 px-4 py-2.5 bg-white/95 dark:bg-[#0A0F1D]/95 border-t border-slate-200 dark:border-[#1F2937]/80 backdrop-blur-xl space-y-2">
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
                  placeholder="Message AI Assistant (e.g. Which region performs best?)..."
                  disabled={askMutation.isPending}
                  className="w-full bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-[#1F2937] focus:border-[#8B5CF6] text-slate-900 dark:text-white text-xs rounded-xl pl-3.5 pr-10 py-2.5 focus:outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-gray-500 shadow-lg disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!questionInput.trim() || askMutation.isPending}
                  className="absolute right-1.5 p-1.5 rounded-lg bg-[#8B5CF6] hover:bg-[#8B5CF6]/90 disabled:bg-slate-800 disabled:text-gray-600 text-white transition-all cursor-pointer border-none shadow-md"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </form>
            </div>

          </div>

        </div>
      )}
    </div>
  );
}
