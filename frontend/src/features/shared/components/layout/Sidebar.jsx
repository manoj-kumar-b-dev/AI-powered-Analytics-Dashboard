import React, { useState } from "react";
import {
  LayoutDashboard,
  UploadCloud,
  LineChart,
  Sparkles,
  MessageSquare,
  Settings,
  ChevronLeft,
  ChevronRight,
  Crown,
  LogOut,
  BrainCircuit
} from "lucide-react";
import { motion } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { useAuth } from "../../../authentication/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "../ui/dropdown-menu";
import logoImg from "../../../../Images/Logo.png";

export function Sidebar({
  activeTab = "Dashboard",
  onTabChange,
  isCollapsed = false,
  onToggleCollapse,
  onSwitchToLegacy
}) {
  const { user, logout } = useAuth();

  const handleToggle = () => {
    if (onToggleCollapse) {
      onToggleCollapse(!isCollapsed);
    }
  };

  const sections = [
    {
      title: "Core",
      items: [
        { name: "Dashboard", icon: LayoutDashboard },
        { name: "Upload Data", icon: UploadCloud },
        { name: "Analytics", icon: LineChart }
      ]
    },
    {
      title: "AI Intelligence",
      items: [
        { name: "AI Insights", icon: Sparkles },
        { name: "AI Chat", icon: MessageSquare }
      ]
    },
    {
      title: "System",
      items: [
        { name: "Settings", icon: Settings }
      ]
    }
  ];

  return (
    <motion.aside
      animate={{ width: isCollapsed ? 76 : 260 }}
      transition={{ duration: 0.25, ease: "easeInOut" }}
      className="fixed top-0 left-0 h-screen bg-white dark:bg-[#050810] border-r border-slate-200 dark:border-[#1F2937]/50 flex flex-col justify-between z-30 select-none shadow-xl transition-colors duration-300"
    >
      {/* Sidebar Header / Brand */}
      <div>
        <div className="p-4 flex items-center justify-between min-h-[73px] border-b border-slate-200 dark:border-[#1F2937]/30">
          {!isCollapsed ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="flex items-center gap-3 w-full"
            >
              <img src={logoImg} alt="Vizora Logo" className="h-11 w-11 object-contain rounded-lg shrink-0 shadow-md" />
              <div className="flex flex-col text-left truncate">
                <span className="font-display font-bold text-base bg-gradient-to-r from-purple-600 to-indigo-600 dark:from-[#a78bfa] dark:to-[#06b6d4] bg-clip-text text-transparent tracking-tight leading-tight">
                  Vizora
                </span>
                <span className="text-[9px] text-[#8B5CF6] dark:text-[#a78bfa] font-semibold mt-0.5 tracking-wider uppercase">AI Analytics</span>
              </div>
            </motion.div>
          ) : (
            <div className="mx-auto">
              <img src={logoImg} alt="Vizora Logo" className="h-11 w-11 object-contain rounded-lg shrink-0 shadow-md" />
            </div>
          )}

          <button
            onClick={handleToggle}
            className="hidden md:flex absolute top-[24px] -right-[12px] h-6 w-6 rounded-full border border-slate-200 dark:border-[#1F2937] bg-white dark:bg-[#070B14] items-center justify-center text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-400 dark:hover:border-gray-500 transition-all z-50 shadow-lg cursor-pointer"
            aria-label="Toggle Sidebar"
          >
            {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
          </button>
        </div>

        {/* Navigation items grouped by sections */}
        <nav className="px-3 py-3 space-y-4 overflow-y-auto max-h-[calc(100vh-200px)] custom-scrollbar">
          {sections.map((section) => (
            <div key={section.title} className="space-y-1">
              {!isCollapsed ? (
                <div className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider px-3.5 py-1 select-none">
                  {section.title}
                </div>
              ) : (
                <div className="h-[1px] bg-slate-200 dark:bg-[#1F2937]/30 my-2" />
              )}

              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.name;

                return (
                  <button
                    key={item.name}
                    onClick={() => onTabChange && onTabChange(item.name)}
                    className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-xs transition-all duration-200 group relative border-none cursor-pointer ${isActive
                      ? "bg-[#8B5CF6] text-white font-bold shadow-lg shadow-purple-500/25"
                      : "bg-transparent text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900/40"
                      }`}
                    title={isCollapsed ? item.name : undefined}
                  >
                    {/* Active Pill Glow */}
                    {isActive && !isCollapsed && (
                      <span className="absolute left-0 top-[20%] w-[3px] h-[60%] bg-white rounded-r" />
                    )}

                    <motion.div whileTap={{ scale: 0.9 }}>
                      <Icon className={`h-4.5 w-4.5 shrink-0 transition-transform duration-200 ${isActive ? "text-white" : "text-slate-500 dark:text-gray-400 group-hover:text-slate-900 dark:group-hover:text-white"
                        }`} />
                    </motion.div>

                    {!isCollapsed && (
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.1 }}
                        className={isActive ? "text-white font-bold" : "text-slate-600 dark:text-gray-400 group-hover:text-slate-900 dark:group-hover:text-white"}
                      >
                        {item.name}
                      </motion.span>
                    )}

                    {/* Collapsed Hover Tooltip */}
                    {isCollapsed && (
                      <span className="absolute left-16 scale-0 rounded-lg bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#1F2937] p-2 text-[10px] font-bold text-slate-900 dark:text-white shadow-2xl transition-all duration-200 group-hover:scale-100 z-40 whitespace-nowrap">
                        {item.name}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
      </div>

      {/* Sidebar Footer */}
      <div className="p-3 space-y-3">

        {/* User Profile */}
        <div className="border-t border-slate-200 dark:border-[#1F2937]/30 pt-3 flex items-center justify-between min-h-[52px]">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <Avatar className="h-9 w-9 shrink-0 border border-slate-200 dark:border-[#1f2937]">
              <AvatarImage src={user?.avatarUrl || localStorage.getItem('userAvatarUrl') || ''} alt={user?.name || "User Avatar"} />
              <AvatarFallback>{user?.name ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : "JD"}</AvatarFallback>
            </Avatar>
            {!isCollapsed && (
              <div className="flex flex-col text-left truncate">
                <span className="text-xs font-bold text-slate-900 dark:text-white truncate leading-none">{user?.name || "John Doe"}</span>
                <span className="text-[9px] text-slate-400 dark:text-gray-500 truncate mt-1">{user?.email || "john@example.com"}</span>
              </div>
            )}
          </div>
          {!isCollapsed && (
            <button
              className="text-slate-400 dark:text-gray-500 hover:text-rose-500 dark:hover:text-rose-400 transition-colors p-1.5 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-lg border-none bg-transparent cursor-pointer"
              title="Logout"
              onClick={logout}
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </motion.aside>
  );
}
