import React from "react";

export function Badge({ className = "", variant = "default", children, ...props }) {
  const baseStyles =
    "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold font-sans tracking-wide transition-colors duration-200 select-none";

  const variants = {
    default:
      "border-transparent bg-purple-500/10 text-purple-400 border-purple-500/20",
    secondary:
      "border-transparent bg-white/5 text-gray-300 border-white/[0.03]",
    success:
      "border-transparent bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    warning:
      "border-transparent bg-amber-500/10 text-amber-400 border-amber-500/20",
    destructive:
      "border-transparent bg-rose-500/10 text-rose-400 border-rose-500/20",
    outline: "border-white/10 text-gray-300 bg-transparent",
  };

  return (
    <div className={`${baseStyles} ${variants[variant]} ${className}`} {...props}>
      {children}
    </div>
  );
}
