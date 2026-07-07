import React, { useState } from "react";
import {
  LayoutDashboard,
  UploadCloud,
  LineChart,
  Sparkles,
  MessageSquare,
  FileText,
  Bell,
  Target,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
  Crown,
  LogOut,
  BrainCircuit,
  Building,
  Check,
  ChevronDown
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

export function Sidebar({
  activeTab = "Dashboard",
  onTabChange,
  isCollapsed = false,
  onToggleCollapse,
  onSwitchToLegacy
}) {
  const { user, organisations, activeOrgId, switchOrg, logout } = useAuth();
  const [isOrgDropdownOpen, setIsOrgDropdownOpen] = useState(false);

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
      title: "Management",
      items: [
        { name: "Reports", icon: FileText },
        { name: "Alerts", icon: Bell },
        { name: "Goals", icon: Target }
      ]
    },
    {
      title: "System",
      items: [
        { name: "Team", icon: Users },
        { name: "Settings", icon: Settings }
      ]
    }
  ];

  const activeOrg = organisations?.find((org) => (org.orgId || org._id) === activeOrgId) || {
    name: "Acme SaaS Workspace"
  };

  return (
    <motion.aside
      animate={{ width: isCollapsed ? 76 : 260 }}
      transition={{ duration: 0.25, ease: "easeInOut" }}
      className="fixed top-0 left-0 h-screen bg-[#050810] border-r border-[#1F2937]/50 flex flex-col justify-between z-30 select-none shadow-xl"
    >
      {/* Sidebar Header / Brand */}
      <div>
        <div className="p-4 flex items-center justify-between min-h-[73px] border-b border-[#1F2937]/30">
          {!isCollapsed ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="flex items-center gap-3 w-full"
            >
              <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-[#8B5CF6] to-[#3B82F6] flex items-center justify-center shadow-lg shadow-purple-500/25 shrink-0">
                <BrainCircuit className="h-4.5 w-4.5 text-white" />
              </div>
              <div className="flex flex-col text-left truncate">
                <span className="font-display font-bold text-sm text-white tracking-tight leading-tight">
                  AI Analytics
                </span>
                <span className="text-[9px] text-[#8B5CF6] font-semibold mt-0.5 tracking-wider uppercase">Enterprise</span>
              </div>
            </motion.div>
          ) : (
            <div className="h-8 w-8 mx-auto rounded-lg bg-gradient-to-tr from-[#8B5CF6] to-[#3B82F6] flex items-center justify-center shadow-lg shadow-purple-500/25 shrink-0">
              <BrainCircuit className="h-4.5 w-4.5 text-white" />
            </div>
          )}

          <button
            onClick={handleToggle}
            className="hidden md:flex absolute top-[24px] -right-[12px] h-6 w-6 rounded-full border border-[#1F2937] bg-[#070B14] items-center justify-center text-gray-400 hover:text-white hover:border-gray-500 transition-all z-50 shadow-lg cursor-pointer"
            aria-label="Toggle Sidebar"
          >
            {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
          </button>
        </div>

        {/* Tenant workspace selector */}
        {!isCollapsed && organisations && organisations.length > 0 && (
          <div className="px-3 pt-4">
            <DropdownMenu open={isOrgDropdownOpen} onOpenChange={setIsOrgDropdownOpen}>
              <DropdownMenuTrigger asChild>
                <button className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-slate-950/40 border border-[#1F2937]/50 text-xs font-semibold text-gray-300 hover:text-white hover:bg-slate-900/60 transition-colors cursor-pointer">
                  <div className="flex items-center gap-2 truncate">
                    <Building className="h-3.5 w-3.5 text-[#8B5CF6]" />
                    <span className="truncate">{activeOrg.name}</span>
                  </div>
                  <ChevronDown className="h-3 w-3 text-gray-500" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[236px] bg-[#111827] border border-[#1F2937] text-gray-300 rounded-xl p-1 shadow-2xl">
                <div className="px-2.5 py-1.5 text-[9px] font-bold text-gray-500 uppercase tracking-wider">
                  Workspaces
                </div>
                {organisations.map((org) => {
                  const orgId = org.orgId || org._id;
                  return (
                    <DropdownMenuItem
                      key={orgId}
                      className="hover:bg-slate-800 cursor-pointer flex items-center justify-between text-xs py-2 px-2.5 rounded-lg"
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
          </div>
        )}

        {/* Navigation items grouped by sections */}
        <nav className="px-3 py-3 space-y-4 overflow-y-auto max-h-[calc(100vh-270px)] custom-scrollbar">
          {sections.map((section) => (
            <div key={section.title} className="space-y-1">
              {!isCollapsed ? (
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider px-3.5 py-1 select-none">
                  {section.title}
                </div>
              ) : (
                <div className="h-[1px] bg-[#1F2937]/30 my-2" />
              )}

              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.name;

                return (
                  <button
                    key={item.name}
                    onClick={() => onTabChange && onTabChange(item.name)}
                    className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-xs transition-all duration-200 group relative border-none bg-transparent ${
                      isActive
                        ? "bg-[#8B5CF6] text-white font-bold shadow-lg shadow-purple-500/20"
                        : "text-gray-400 hover:text-white hover:bg-slate-900/40"
                    }`}
                    title={isCollapsed ? item.name : undefined}
                  >
                    {/* Active Pill Glow */}
                    {isActive && !isCollapsed && (
                      <span className="absolute left-0 top-[20%] w-[3px] h-[60%] bg-white rounded-r" />
                    )}

                    <motion.div whileTap={{ scale: 0.9 }}>
                      <Icon className={`h-4.5 w-4.5 shrink-0 transition-transform duration-200 ${
                        isActive ? "text-white" : "text-gray-400 group-hover:text-white"
                      }`} />
                    </motion.div>

                    {!isCollapsed && (
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.1 }}
                      >
                        {item.name}
                      </motion.span>
                    )}

                    {/* Collapsed Hover Tooltip */}
                    {isCollapsed && (
                      <span className="absolute left-16 scale-0 rounded-lg bg-[#111827] border border-[#1F2937] p-2 text-[10px] font-bold text-white shadow-2xl transition-all duration-200 group-hover:scale-100 z-40 whitespace-nowrap">
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
        
        {/* Redesigned Premium Upgrade promotion card */}
        {!isCollapsed ? (
          <div className="p-4 rounded-2xl bg-gradient-to-br from-[#1E1B4B]/80 via-[#311042]/50 to-[#0F172A]/80 border border-purple-500/25 relative overflow-hidden group shadow-xl">
            {/* Ambient Background Glow */}
            <div className="absolute top-0 right-0 h-16 w-16 bg-purple-500/10 rounded-full blur-xl group-hover:bg-purple-500/20 transition-all duration-300" />
            
            <div className="flex items-center gap-1.5 mb-2.5">
              <div className="p-1 rounded bg-[#8B5CF6]/20 text-[#c084fc] flex items-center justify-center">
                <Crown className="h-3.5 w-3.5" />
              </div>
              <span className="text-[10px] font-extrabold text-white tracking-wider uppercase bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-300">
                PRO MEMBERSHIP
              </span>
            </div>
            
            <ul className="text-[9px] text-gray-400 space-y-1 mb-3.5 leading-normal">
              <li className="flex items-center gap-1">
                <Check className="h-2.5 w-2.5 text-[#22C55E] shrink-0" /> AI Forecasting
              </li>
              <li className="flex items-center gap-1">
                <Check className="h-2.5 w-2.5 text-[#22C55E] shrink-0" /> Unlimited Reports
              </li>
              <li className="flex items-center gap-1">
                <Check className="h-2.5 w-2.5 text-[#22C55E] shrink-0" /> Team Workspaces
              </li>
              <li className="flex items-center gap-1">
                <Check className="h-2.5 w-2.5 text-[#22C55E] shrink-0" /> PDF Exports & White Labeling
              </li>
            </ul>

            <button
              onClick={() => alert("Upgrade triggered!")}
              className="w-full text-[10px] font-bold h-8.5 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#6366F1] hover:shadow-lg hover:shadow-purple-500/20 text-white transition-all cursor-pointer border-none"
            >
              Upgrade Now
            </button>
          </div>
        ) : (
          <div className="flex justify-center">
            <button
              onClick={() => alert("Upgrade triggered!")}
              className="w-full text-center text-[10px] text-[#a78bfa] hover:text-purple-300 font-bold py-2 border border-dashed border-[#8B5CF6]/30 rounded-xl hover:bg-purple-950/15 cursor-pointer bg-transparent"
              title="Upgrade Plan"
            >
              <Crown className="h-4.5 w-4.5" />
            </button>
          </div>
        )}



        {/* User Profile */}
        <div className="border-t border-[#1F2937]/30 pt-3 flex items-center justify-between min-h-[52px]">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <Avatar className="h-9 w-9 shrink-0 border border-[#1f2937]">
              <AvatarImage src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=256&auto=format&fit=crop" />
              <AvatarFallback>{user?.name ? user.name.slice(0,2).toUpperCase() : "JD"}</AvatarFallback>
            </Avatar>
            {!isCollapsed && (
              <div className="flex flex-col text-left truncate">
                <span className="text-xs font-bold text-white truncate leading-none">{user?.name || "John Doe"}</span>
                <span className="text-[9px] text-gray-500 truncate mt-1">{user?.email || "john@example.com"}</span>
              </div>
            )}
          </div>
          {!isCollapsed && (
            <button
              className="text-gray-500 hover:text-rose-400 transition-colors p-1.5 hover:bg-slate-900 rounded-lg border-none bg-transparent cursor-pointer"
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
