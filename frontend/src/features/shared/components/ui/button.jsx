import React from "react";

export function Button({
  className = "",
  variant = "default",
  size = "default",
  children,
  ...props
}) {
  const baseStyles =
    "inline-flex items-center justify-center rounded-lg font-medium text-sm transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-purple-500 disabled:opacity-50 disabled:pointer-events-none select-none active:scale-[0.98]";

  const variants = {
    default:
      "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-900/20 border border-purple-500/20",
    secondary:
      "bg-white/5 hover:bg-white/10 text-white border border-white/[0.05]",
    outline:
      "border border-white/10 hover:border-white/20 hover:bg-white/5 text-gray-200 hover:text-white bg-transparent",
    ghost:
      "hover:bg-white/5 text-gray-400 hover:text-white bg-transparent",
    destructive:
      "bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-900/20",
  };

  const sizes = {
    default: "h-10 px-4 py-2",
    sm: "h-8 rounded-md px-3 text-xs",
    lg: "h-11 rounded-xl px-8",
    icon: "h-10 w-10 p-0",
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
