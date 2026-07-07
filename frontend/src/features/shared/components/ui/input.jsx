import React from "react";

export function Input({ className = "", type = "text", ...props }) {
  return (
    <input
      type={type}
      className={`flex h-10 w-full rounded-lg border border-white/10 bg-[#0A0A0F]/60 px-3.5 py-2 text-sm text-white placeholder-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:border-transparent disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 ${className}`}
      {...props}
    />
  );
}
