import React, { useState, useEffect, useRef } from "react";
import {
  Calendar,
  ChevronDown,
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
  Building,
  RefreshCw,
  FilterX,
  X,
  Database
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { useAuth } from "../../../authentication/contexts/AuthContext";
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
  onDateChange,
  currentDateRange = "May 10, 2024 - Jun 10, 2024",
  onSearchAction,
  dataSources = [],
  selectedDSId = null,
  onDatasetChange
}) {
  const { user, organisations, activeOrgId, switchOrg, logout } = useAuth();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [notifications, setNotifications] = useState([
    {
      id: 1,
      title: "CSV Processed Successfully",
      desc: "File `sales_may_jun.csv` has been validated and imported.",
      time: "10m ago",
      unread: true,
      type: "success"
    },
    {
      id: 2,
      title: "Expense Ratio Alert",
      desc: "Expense ratio is marked as Critical. Optimize costs.",
      time: "2h ago",
      unread: true,
      type: "critical"
    },
    {
      id: 3,
      title: "Sarah Connor joined",
      desc: "Sarah has accepted your invitation and joined the team.",
      time: "1d ago",
      unread: false,
      type: "info"
    }
  ]);

  const [notificationCount, setNotificationCount] = useState(initialNotificationCount);
  const [isThemeDark, setIsThemeDark] = useState(true);

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
      prev.map((n) => {
        if (n.id === id && n.unread) {
          setNotificationCount((c) => Math.max(0, c - 1));
          return { ...n, unread: false };
        }
        return n;
      })
    );
  };

  const activeOrg = organisations?.find((org) => (org.orgId || org._id) === activeOrgId) || {
    name: "Acme SaaS Workspace"
  };

  // Commands available in Ctrl+K search menu
  const searchCommands = [
    { category: "Navigation", label: "Go to Dashboard", icon: Sparkles, action: () => onSearchAction?.({ type: "tab", value: "Dashboard" }) },
    { category: "Navigation", label: "Go to Upload Data", icon: Plus, action: () => onSearchAction?.({ type: "tab", value: "Upload Data" }) },
    { category: "Navigation", label: "Go to AI Chat", icon: Sparkles, action: () => onSearchAction?.({ type: "tab", value: "AI Chat" }) },
    { category: "Actions", label: "Upload New CSV Dataset", icon: Plus, action: () => onUploadClick?.() },
    { category: "Actions", label: "Clear Active Filters", icon: FilterX, action: () => onSearchAction?.({ type: "clearFilters" }) },
    { category: "Actions", label: "Trigger Layout Editing", icon: Settings, action: () => onSearchAction?.({ type: "toggleEdit" }) },
    ...(organisations || []).map((org) => {
      const orgId = org.orgId || org._id;
      return {
        category: "Switch Workspace",
        label: `Switch to ${org.name}`,
        icon: Building,
        action: () => switchOrg(orgId)
      };
    })
  ];

  const filteredCommands = searchCommands.filter((cmd) =>
    cmd.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cmd.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <header className="h-[90px] bg-[#070B14]/85 border-b border-[#1F2937]/50 px-6 md:px-8 flex items-center justify-between sticky top-0 z-50 w-full max-w-full min-w-0 overflow-visible backdrop-blur-xl gap-4 select-none">
        
        {/* Title, Workspace Info & Welcome */}
        <div className="flex-1 min-w-0 flex items-center gap-3">
          <div className="hidden lg:flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-[#1F2937] bg-slate-900/40 hover:bg-slate-800/60 hover:border-gray-600 transition-all text-xs font-semibold text-gray-300 cursor-pointer">
                  <Building className="h-3.5 w-3.5 text-[#8B5CF6]" />
                  <span>{activeOrg.name}</span>
                  <ChevronDown className="h-3 w-3 text-gray-500" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56 bg-[#111827] border border-[#1F2937] text-gray-300">
                <div className="px-2.5 py-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                  Select Workspace
                </div>
                {(organisations || []).map((org) => {
                  const orgId = org.orgId || org._id;
                  return (
                    <DropdownMenuItem
                      key={orgId}
                      className="hover:bg-slate-800 cursor-pointer flex items-center justify-between text-xs py-2 "
                      onClick={() => switchOrg(orgId)}
                    >
                      <div className="flex items-center gap-2">
                        <Building className="h-3.5 w-3.5 text-[#8B5CF6]" />
                        <span>{org.name}</span>
                      </div>
                      {orgId === activeOrgId && <Check className="h-3.5 w-3.5 text-[#22C55E]" />}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
            <div className="h-4 w-[1px] bg-[#1F2937]" />

            {/* Active Dataset Selector Dropdown */}
            {dataSources && dataSources.length > 0 && (
              <>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-[#1F2937] bg-slate-900/40 hover:bg-slate-800/60 hover:border-gray-600 transition-all text-xs font-semibold text-gray-300 cursor-pointer max-w-[200px]">
                      <Database className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                      <span className="truncate">
                        {dataSources.find(ds => ds._id === selectedDSId)?.fileName || "Select Dataset..."}
                      </span>
                      <ChevronDown className="h-3 w-3 text-gray-500 shrink-0" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-64 bg-[#111827] border border-[#1F2937] text-gray-300 rounded-xl p-1 shadow-2xl">
                    <div className="px-2.5 py-1.5 text-[9px] font-bold text-gray-500 uppercase tracking-wider">
                      Select Dataset
                    </div>
                    {dataSources.map((ds) => (
                      <DropdownMenuItem
                        key={ds._id}
                        className="hover:bg-slate-800 cursor-pointer flex items-center justify-between text-xs py-2 px-2.5 rounded-lg"
                        onClick={() => onDatasetChange?.(ds._id)}
                      >
                        <div className="flex items-center gap-2 truncate font-semibold">
                          <Database className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                          <span className="truncate text-gray-200">{ds.fileName}</span>
                        </div>
                        {ds._id === selectedDSId && <Check className="h-3.5 w-3.5 text-[#22C55E] shrink-0" />}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <div className="h-4 w-[1px] bg-[#1F2937]" />
              </>
            )}
          </div>

          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-bold font-display text-white tracking-tight truncate flex items-center gap-2">
              {title}
            </h1>
            {title === "Dashboard" && (
              <p className="text-gray-400 text-[11px] mt-0.5 font-medium truncate hidden sm:block">
                Welcome back, {user?.name || "John"}! Here's your workspace overview.
              </p>
            )}
          </div>
        </div>

        {/* Global Search Bar (Trigger) */}
        <div className="hidden md:flex items-center flex-1 max-w-xs relative">
          <button
            onClick={() => setIsSearchOpen(true)}
            className="w-full flex items-center justify-between h-10 px-4 rounded-xl border border-[#1F2937] bg-[#111827]/40 hover:bg-[#111827]/60 hover:border-gray-600 text-xs text-gray-400 hover:text-white transition-all text-left cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-gray-500" />
              <span>Search dashboard...</span>
            </div>
            <div className="flex items-center gap-0.5 bg-[#1F2937] px-1.5 py-0.5 rounded text-[10px] font-bold text-gray-400">
              <Command className="h-2.5 w-2.5" />
              <span>K</span>
            </div>
          </button>
        </div>

        {/* Action Items */}
        <div className="flex items-center gap-3 shrink-0">
          
          {/* Calendar Date Picker */}
          <div className="hidden lg:block">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 h-10 px-4 rounded-xl border border-[#1F2937] bg-[#111827]/40 hover:bg-[#111827]/60 hover:border-gray-600 text-xs font-semibold text-gray-300 hover:text-white transition-all cursor-pointer">
                  <Calendar className="h-4 w-4 text-[#8B5CF6]" />
                  <span>{currentDateRange}</span>
                  <ChevronDown className="h-3 w-3 text-gray-500" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="right" className="w-48 bg-[#111827] border border-[#1F2937] text-gray-300">
                <DropdownMenuItem className="hover:bg-slate-800 cursor-pointer" onClick={() => onDateChange?.("today")}>Today</DropdownMenuItem>
                <DropdownMenuItem className="hover:bg-slate-800 cursor-pointer" onClick={() => onDateChange?.("7days")}>Last 7 Days</DropdownMenuItem>
                <DropdownMenuItem className="hover:bg-slate-800 cursor-pointer" onClick={() => onDateChange?.("30days")}>Last 30 Days</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Upload Data Button */}
          <button
            onClick={onUploadClick}
            className="h-10 px-3 md:px-4 gap-1.5 font-semibold text-xs text-white bg-[#8B5CF6] hover:bg-[#8B5CF6]/90 rounded-xl transition-all cursor-pointer flex items-center shadow-lg shadow-purple-500/10 active:scale-[0.98] border border-purple-500/20"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Upload Data</span>
          </button>

          <div className="h-5 w-[1px] bg-[#1F2937] hidden sm:block shrink-0" />

          {/* Dark Mode Theme Toggle */}
          <button
            onClick={() => {
              setIsThemeDark(!isThemeDark);
              alert(isThemeDark ? "Theme switched (SaaS Dashboard optimized for dark mode)" : "Already in Dark Mode");
            }}
            className="hidden sm:flex h-10 w-10 items-center justify-center rounded-xl border border-[#1F2937] bg-[#111827]/40 hover:bg-[#111827]/60 hover:border-gray-600 text-gray-400 hover:text-white transition-all cursor-pointer"
            aria-label="Toggle Theme"
          >
            {isThemeDark ? (
              <motion.div whileTap={{ rotate: 180, scale: 0.8 }}>
                <Moon className="h-4.5 w-4.5 text-[#8B5CF6]" />
              </motion.div>
            ) : (
              <motion.div whileTap={{ rotate: -180, scale: 0.8 }}>
                <Sun className="h-4.5 w-4.5 text-amber-400" />
              </motion.div>
            )}
          </button>

          {/* Notification Bell Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="relative h-10 w-10 flex items-center justify-center rounded-xl border border-[#1F2937] bg-[#111827]/40 hover:bg-[#111827]/60 hover:border-gray-600 text-gray-400 hover:text-white transition-all cursor-pointer"
                aria-label="Notifications"
              >
                <Bell className="h-4.5 w-4.5" />
                {notificationCount > 0 && (
                  <span className="absolute top-[2px] right-[2px] h-4.5 w-4.5 rounded-full bg-rose-500 border border-[#070B14] text-[9px] font-bold text-white flex items-center justify-center shadow-lg">
                    {notificationCount}
                  </span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="right" className="w-80 bg-[#111827] border border-[#1F2937] text-gray-300 p-2 shadow-2xl rounded-2xl max-h-[400px] overflow-y-auto custom-scrollbar">
              <div className="px-2 py-2 border-b border-[#1F2937]/50 flex items-center justify-between select-none">
                <span className="text-xs font-bold text-white">Recent Notifications</span>
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
                    className={`flex flex-col items-start gap-1 p-2.5 rounded-xl cursor-pointer transition-all ${
                      notif.unread ? "bg-[#1E293B]/20 hover:bg-[#1E293B]/40" : "hover:bg-white/5"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 w-full">
                      {notif.unread && (
                        <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                          notif.type === "critical" ? "bg-rose-500" : notif.type === "success" ? "bg-green-500" : "bg-blue-500"
                        }`} />
                      )}
                      <span className="text-[11px] font-bold text-white truncate max-w-[190px]">
                        {notif.title}
                      </span>
                      <span className="text-[9px] text-gray-500 ml-auto shrink-0">{notif.time}</span>
                    </div>
                    <p className="text-[10px] text-gray-400 leading-normal pl-3 font-medium">
                      {notif.desc}
                    </p>
                  </DropdownMenuItem>
                ))}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="h-5 w-[1px] bg-[#1F2937] shrink-0" />

          {/* User profile avatar dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Avatar className="h-10 w-10 border border-[#1F2937] cursor-pointer hover:border-[#8B5CF6] hover:shadow-lg hover:shadow-purple-500/10 transition-all shrink-0">
                <AvatarImage src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=256&auto=format&fit=crop" />
                <AvatarFallback>{user?.name ? user.name.slice(0, 2).toUpperCase() : "JD"}</AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="right" className="w-56 bg-[#111827] border border-[#1F2937] text-gray-300 p-2 rounded-2xl shadow-2xl">
              <div className="px-2.5 py-3 border-b border-[#1F2937]/50">
                <div className="text-xs font-bold text-white">{user?.name || "John Doe"}</div>
                <div className="text-[10px] text-gray-500 mt-0.5 truncate">{user?.email || "john@example.com"}</div>
              </div>
              <div className="mt-1">
                <DropdownMenuItem
                  className="hover:bg-slate-800 cursor-pointer flex items-center gap-2 py-2 text-xs"
                  onClick={() => alert("Settings configuration modal...")}
                >
                  <User className="h-4 w-4 text-gray-400" />
                  <span>My Profile</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="hover:bg-slate-800 cursor-pointer flex items-center gap-2 py-2 text-xs"
                  onClick={() => alert("Settings panel...")}
                >
                  <Settings className="h-4 w-4 text-gray-400" />
                  <span>Account Settings</span>
                </DropdownMenuItem>
                <div className="h-[1px] bg-[#1F2937]/50 my-1" />
                <DropdownMenuItem
                  className="hover:bg-rose-950/20 text-rose-400 hover:text-rose-300 cursor-pointer flex items-center gap-2 py-2 text-xs"
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
              className="bg-[#111827] border border-[#1F2937] w-full max-w-xl rounded-2xl shadow-2xl shadow-black/80 overflow-hidden"
            >
              {/* Search input header */}
              <div className="p-4 border-b border-[#1F2937]/50 flex items-center gap-3">
                <Search className="h-5 w-5 text-gray-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Type a command or widget name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent border-none text-white text-sm outline-none w-full font-sans"
                  autoFocus
                />
                <button
                  onClick={() => setIsSearchOpen(false)}
                  className="p-1 rounded bg-slate-800 text-gray-400 hover:text-white cursor-pointer"
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
                        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider px-3 py-1">
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
                                  className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs text-gray-300 hover:text-white hover:bg-[#1E293B]/50 transition-colors cursor-pointer border-none bg-transparent"
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
                  <div className="p-8 text-center text-gray-500 text-xs">
                    No results found for "{searchQuery}"
                  </div>
                )}
              </div>

              {/* Search Footer */}
              <div className="p-3 border-t border-[#1F2937]/50 bg-slate-950/20 text-[10px] text-gray-500 flex items-center justify-between px-4 select-none">
                <span className="flex items-center gap-1.5">
                  <span className="bg-slate-800 px-1 py-0.5 rounded font-mono">ESC</span> to close
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="bg-slate-800 px-1 py-0.5 rounded font-mono">↵ Enter</span> to select
                </span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
