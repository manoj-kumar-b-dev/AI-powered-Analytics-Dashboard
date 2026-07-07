import React, { useState } from "react";

export function Avatar({ className = "", children, ...props }) {
  return (
    <div
      className={`relative flex h-9 w-9 shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/5 select-none ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function AvatarImage({ className = "", src, alt = "avatar", ...props }) {
  const [hasError, setHasError] = useState(false);

  if (hasError || !src) {
    return null;
  }

  return (
    <img
      src={src}
      alt={alt}
      onError={() => setHasError(true)}
      className={`aspect-square h-full w-full object-cover ${className}`}
      {...props}
    />
  );
}

export function AvatarFallback({ className = "", children, ...props }) {
  return (
    <div
      className={`flex h-full w-full items-center justify-center rounded-full bg-purple-900/30 text-purple-300 text-xs font-semibold uppercase ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
