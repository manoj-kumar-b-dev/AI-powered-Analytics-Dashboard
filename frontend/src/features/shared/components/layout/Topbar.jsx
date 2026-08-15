import React, { useState, useEffect } from "react";
import {
  Bell,
  Sun,
  Moon,
  Plus,
  Search,
  Command,
  Sparkles,
  Settings,
  LogOut,
  User,
  Check,
  RefreshCw,
  FilterX,
  X,
  Database,
  ChevronDown
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { useAuth } from "../../../authentication/contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "../ui/dropdown-menu";

export function Topbar({
  title = "Dashboard",
  onUploadClick,
  notificationCount: initialNotificationCount = 3,
  onSearchAction,
  dataSources = [],
  selectedDSId = null,
  onDatasetChange
}) {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [notificationCount, setNotificationCount] = useState(initialNotificationCount);
  const [notifications, setNotifications] = useState([
    { id: 1, title: "Dataset processing complete", time: "2 min ago", unread: true, type: "success", desc: "Your uploaded spreadsheet was processed and insights updated." },
    { id: 2, title: "Margin Anomaly Detected", time: "1 hour ago", unread: true, type: "critical", desc: "Product cost anomaly detected in Q2 financial data." },
    { id: 3, title: "Weekly Insights Report", time: "1 day ago", unread: true, type: "info", desc: "Automated executive summary is ready for review." }
  ]);

  // Monitor Ctrl + K
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
    setNotificationCount(0);
  };

  const handleNotificationClick = (id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, unread: false } : n))
    );
    setNotificationCount((prev) => Math.max(0, prev - 1));
  };

  // Commands available in Ctrl+K search menu
  const searchCommands = [
    { category: "Navigation", label: "Go to Dashboard", icon: Sparkles, action: () => onSearchAction?.({ type: "navigate", target: "Dashboard" }) },
    { category: "Navigation", label: "Go to Upload Data", icon: Database, action: () => onSearchAction?.({ type: "navigate", target: "Upload Data" }) },
    { category: "Navigation", label: "Go to Analytics", icon: RefreshCw, action: () => onSearchAction?.({ type: "navigate", target: "Analytics" }) },
    { category: "Navigation", label: "Go to AI Insights", icon: Sparkles, action: () => onSearchAction?.({ type: "navigate", target: "AI Insights" }) },
    { category: "Actions", label: "Upload New Dataset", icon: Plus, action: () => onSearchAction?.({ type: "navigate", target: "Upload Data" }) },
    { category: "Actions", label: "Clear Active Filters", icon: FilterX, action: () => onSearchAction?.({ type: "clearFilters" }) },
    { category: "Actions", label: "Refresh Operational Analytics", icon: RefreshCw, action: () => window.location.reload() }
  ];

  const filteredCommands = searchCommands.filter((cmd) =>
    cmd.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cmd.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const avatarUrl = user?.avatarUrl || localStorage.getItem('userAvatarUrl') || '';
  const initials = user?.name
    ? user.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : 'JD';

  return (
    <>
      <header className="h-[76px] bg-white/85 dark:bg-[#070B14]/85 border-b border-slate-200 dark:border-[#1F2937]/50 px-6 md:px-8 flex items-center justify-between sticky top-0 z-50 w-full max-w-full min-w-0 overflow-visible backdrop-blur-xl gap-4 select-none transition-colors duration-300">

        {/* Title */}
        <div className="shrink-0 flex items-center">
          <h1 className="text-xl md:text-2xl font-bold font-display text-slate-900 dark:text-white tracking-tight truncate">
            {title}
          </h1>
        </div>

        {/* Center Container: Dataset Selector + Global Search Bar */}
        <div className="hidden md:flex items-center justify-center flex-1 max-w-2xl mx-4 gap-3 relative">
          
          {/* Active Dataset Selector Dropdown */}
          {dataSources && dataSources.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 h-10 px-3 rounded-xl border border-slate-200 dark:border-[#1F2937] bg-slate-100/70 dark:bg-[#111827]/40 hover:bg-slate-200/70 dark:hover:bg-[#111827]/70 hover:border-emerald-500/40 transition-all text-xs font-semibold text-slate-700 dark:text-gray-300 hover:text-slate-900 dark:hover:text-white cursor-pointer shrink-0 max-w-[180px] sm:max-w-[210px] shadow-inner">
                  <Database className="h-4 w-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
                  <span className="truncate">
                    {dataSources.find((ds) => ds._id === selectedDSId)?.fileName || "Select Dataset..."}
                  </span>
                  <ChevronDown className="h-3 w-3 text-slate-400 dark:text-gray-500 shrink-0 ml-auto" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64 bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#1F2937] text-slate-800 dark:text-gray-300 rounded-xl p-1 shadow-2xl">
                <div className="px-2.5 py-1.5 text-[9px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider">
                  Active Dataset
                </div>
                {dataSources.map((ds) => (
                  <DropdownMenuItem
                    key={ds._id}
                    className="hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer flex items-center justify-between text-xs py-2 px-2.5 rounded-lg"
                    onClick={() => onDatasetChange?.(ds._id)}
                  >
                    <div className="flex items-center gap-2 truncate font-semibold">
                      <Database className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400 shrink-0" />
                      <span className="truncate text-slate-700 dark:text-gray-200">{ds.fileName}</span>
                    </div>
                    {ds._id === selectedDSId && <Check className="h-3.5 w-3.5 text-[#22C55E] shrink-0" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Global Search Bar (Trigger) */}
          <div className="flex-1 min-w-0">
            <button
              onClick={() => setIsSearchOpen(true)}
              className="w-full flex items-center justify-between h-10 px-4 rounded-xl border border-slate-200 dark:border-[#1F2937] bg-slate-100/70 dark:bg-[#111827]/40 hover:bg-slate-200/70 dark:hover:bg-[#111827]/60 hover:border-slate-300 dark:hover:border-gray-600 text-xs text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white transition-all text-left cursor-pointer shadow-inner"
            >
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-slate-400 dark:text-gray-500" />
                <span>Search dashboard...</span>
              </div>
              <div className="flex items-center gap-0.5 bg-slate-200 dark:bg-[#1F2937] px-1.5 py-0.5 rounded text-[10px] font-bold text-slate-600 dark:text-gray-400">
                <Command className="h-2.5 w-2.5" />
                <span>K</span>
              </div>
            </button>
          </div>
        </div>

        {/* Action Items & Profile */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Upload Data Button */}
          <button
            onClick={onUploadClick}
            className="h-10 px-3 md:px-4 gap-1.5 font-semibold text-xs text-white bg-[#8B5CF6] hover:bg-[#8B5CF6]/90 rounded-xl transition-all cursor-pointer flex items-center shadow-lg shadow-purple-500/10 active:scale-[0.98] border border-purple-500/20"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Upload Data</span>
          </button>

          <div className="h-5 w-[1px] bg-slate-200 dark:bg-[#1F2937] hidden sm:block shrink-0" />

          {/* Dark / Light Mode Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="flex h-10 px-3 items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-[#1F2937] bg-white/60 dark:bg-[#111827]/40 hover:bg-slate-100 dark:hover:bg-[#111827]/60 hover:border-slate-300 dark:hover:border-gray-600 text-slate-700 dark:text-gray-300 transition-all cursor-pointer shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500/40"
            aria-label={`Current theme: ${isDark ? 'Dark' : 'Light'}. Click to toggle theme.`}
            title={isDark ? "Switch to Light Theme" : "Switch to Dark Theme"}
          >
            {isDark ? (
              <motion.div key="dark-mode" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-1.5 text-xs font-semibold text-[#8B5CF6]">
                <Moon className="h-4 w-4 text-[#8B5CF6]" />
                <span className="hidden lg:inline text-[11px]">Dark</span>
              </motion.div>
            ) : (
              <motion.div key="light-mode" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-1.5 text-xs font-semibold text-amber-500">
                <Sun className="h-4 w-4 text-amber-500" />
                <span className="hidden lg:inline text-[11px]">Light</span>
              </motion.div>
            )}
          </button>

          {/* Notification Bell Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="relative h-10 w-10 flex items-center justify-center rounded-xl border border-slate-200 dark:border-[#1F2937] bg-white/60 dark:bg-[#111827]/40 hover:bg-slate-100 dark:hover:bg-[#111827]/60 hover:border-slate-300 dark:hover:border-gray-600 text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer shadow-sm"
                aria-label="Notifications"
              >
                <Bell className="h-4.5 w-4.5" />
                {notificationCount > 0 && (
                  <span className="absolute top-[2px] right-[2px] h-4.5 w-4.5 rounded-full bg-rose-500 border border-white dark:border-[#070B14] text-[9px] font-bold text-white flex items-center justify-center shadow-lg">
                    {notificationCount}
                  </span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="right" className="w-80 bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#1F2937] text-slate-800 dark:text-gray-300 p-2 shadow-2xl rounded-2xl max-h-[400px] overflow-y-auto custom-scrollbar">
              <div className="px-2 py-2 border-b border-slate-200 dark:border-[#1F2937]/50 flex items-center justify-between select-none">
                <span className="text-xs font-bold text-slate-900 dark:text-white">Recent Notifications</span>
                <button
                  className="text-[10px] text-[#8B5CF6] hover:text-[#a78bfa] font-bold cursor-pointer transition-colors"
                  onClick={handleMarkAllRead}
                >
                  Mark all read
                </button>
              </div>
              <div className="space-y-1 mt-2">
                {notifications.map((notif) => (
                  <DropdownMenuItem
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif.id)}
                    className={`flex flex-col items-start gap-1 p-2.5 rounded-xl cursor-pointer transition-all ${notif.unread ? "bg-slate-100 dark:bg-[#1E293B]/20 hover:bg-slate-200/60 dark:hover:bg-[#1E293B]/40" : "hover:bg-slate-100/50 dark:hover:bg-white/5"
                      }`}
                  >
                    <div className="flex items-center gap-1.5 w-full">
                      {notif.unread && (
                        <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${notif.type === "critical" ? "bg-rose-500" : notif.type === "success" ? "bg-green-500" : "bg-blue-500"
                          }`} />
                      )}
                      <span className="text-[11px] font-bold text-slate-900 dark:text-white truncate max-w-[190px]">
                        {notif.title}
                      </span>
                      <span className="text-[9px] text-slate-400 dark:text-gray-500 ml-auto shrink-0">{notif.time}</span>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-gray-400 leading-normal pl-3 font-medium">
                      {notif.desc}
                    </p>
                  </DropdownMenuItem>
                ))}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="h-5 w-[1px] bg-slate-200 dark:bg-[#1F2937] shrink-0" />

          {/* User profile avatar dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Avatar className="h-10 w-10 border border-slate-200 dark:border-[#1F2937] cursor-pointer hover:border-[#8B5CF6] hover:shadow-lg hover:shadow-purple-500/10 transition-all shrink-0">
                <AvatarImage src={avatarUrl} alt={user?.name || "User Avatar"} />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="right" className="w-56 bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#1F2937] text-slate-800 dark:text-gray-300 p-2 rounded-2xl shadow-2xl">
              <div className="px-2.5 py-3 border-b border-slate-200 dark:border-[#1F2937]/50">
                <div className="text-xs font-bold text-slate-900 dark:text-white">{user?.name || "John Doe"}</div>
                <div className="text-[10px] text-slate-400 dark:text-gray-500 mt-0.5 truncate">{user?.email || "john@example.com"}</div>
              </div>
              <div className="mt-1">
                <DropdownMenuItem
                  className="hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer flex items-center gap-2 py-2 text-xs text-slate-700 dark:text-gray-300"
                  onClick={() => alert("Settings configuration modal...")}
                >
                  <User className="h-4 w-4 text-slate-400 dark:text-gray-400" />
                  <span>My Profile</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer flex items-center gap-2 py-2 text-xs text-slate-700 dark:text-gray-300"
                  onClick={() => alert("Settings panel...")}
                >
                  <Settings className="h-4 w-4 text-slate-400 dark:text-gray-400" />
                  <span>Account Settings</span>
                </DropdownMenuItem>
                <div className="h-[1px] bg-slate-200 dark:bg-[#1F2937]/50 my-1" />
                <DropdownMenuItem
                  className="hover:bg-rose-100 dark:hover:bg-rose-950/20 text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 cursor-pointer flex items-center gap-2 py-2 text-xs"
                  onClick={logout}
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sign Out</span>
                </DropdownMenuItem>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Global Search Command Menu Overlay */}
      <AnimatePresence>
        {isSearchOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-start justify-center pt-24 z-50 px-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ duration: 0.15 }}
              className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#1F2937] w-full max-w-xl rounded-2xl shadow-2xl shadow-black/80 overflow-hidden"
            >
              {/* Search input header */}
              <div className="p-4 border-b border-slate-200 dark:border-[#1F2937]/50 flex items-center gap-3">
                <Search className="h-5 w-5 text-slate-400 dark:text-gray-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Type a command or widget name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent border-none text-slate-900 dark:text-white text-sm outline-none w-full font-sans"
                  autoFocus
                />
                <button
                  onClick={() => setIsSearchOpen(false)}
                  className="p-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Commands list */}
              <div className="max-h-[320px] overflow-y-auto p-2 custom-scrollbar">
                {filteredCommands.length > 0 ? (
                  <div>
                    {/* Group by category */}
                    {Array.from(new Set(filteredCommands.map((c) => c.category))).map((category) => (
                      <div key={category} className="mb-2">
                        <div className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider px-3 py-1">
                          {category}
                        </div>
                        <div className="space-y-0.5">
                          {filteredCommands
                            .filter((c) => c.category === category)
                            .map((cmd, idx) => {
                              const CmdIcon = cmd.icon;
                              return (
                                <button
                                  key={idx}
                                  onClick={() => {
                                    cmd.action();
                                    setIsSearchOpen(false);
                                  }}
                                  className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs text-[#8B5CF6] dark:text-purple-300 hover:bg-slate-100 dark:hover:bg-[#1E293B]/50 transition-colors cursor-pointer border-none bg-transparent"
                                >
                                  <CmdIcon className="h-4 w-4 text-[#8B5CF6]" />
                                  <span>{cmd.label}</span>
                                </button>
                              );
                            })}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-slate-400 dark:text-gray-500 text-xs">
                    No results found for "{searchQuery}"
                  </div>
                )}
              </div>

              {/* Search Footer */}
              <div className="p-3 border-t border-slate-200 dark:border-[#1F2937]/50 bg-slate-50 dark:bg-slate-950/20 text-[10px] text-slate-400 dark:text-gray-500 flex items-center justify-between px-4 select-none">
                <span className="flex items-center gap-1.5">
                  <span className="bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded font-mono">ESC</span> to close
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded font-mono">↵ Enter</span> to select
                </span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
