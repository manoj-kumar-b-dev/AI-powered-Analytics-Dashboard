import React, { forwardRef } from "react";

export function Card({ className = "", children, ...props }) {
  return (
    <div
      className={`bg-[#13131A] border border-white/[0.08] rounded-xl overflow-hidden shadow-xl ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className = "", children, ...props }) {
  return (
    <div className={`p-5 flex flex-col gap-1.5 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ className = "", children, ...props }) {
  return (
    <h3
      className={`text-white font-semibold font-display text-base tracking-tight ${className}`}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardDescription({ className = "", children, ...props }) {
  return (
    <p className={`text-gray-400 text-xs ${className}`} {...props}>
      {children}
    </p>
  );
}

export const CardContent = forwardRef(({ className = "", children, ...props }, ref) => {
  return (
    <div ref={ref} className={`p-5 pt-0 ${className}`} {...props}>
      {children}
    </div>
  );
});

export function CardFooter({ className = "", children, ...props }) {
  return (
    <div className={`p-5 pt-0 flex items-center ${className}`} {...props}>
      {children}
    </div>
  );
}
