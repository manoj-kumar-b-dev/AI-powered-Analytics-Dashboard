import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import { createPortal } from "react-dom";

// ─────────────────────────────────────────────────────────────────────────────
// DropdownContext
// ─────────────────────────────────────────────────────────────────────────────
const DropdownContext = React.createContext(null);

// ─────────────────────────────────────────────────────────────────────────────
// DropdownMenu
// ─────────────────────────────────────────────────────────────────────────────
export function DropdownMenu({ children, open: controlledOpen, onOpenChange }) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;

  const triggerRef = useRef(null);
  const [triggerRect, setTriggerRect] = useState(null);

  const setOpen = useCallback(
    (val) => {
      if (!isControlled) setInternalOpen(val);
      onOpenChange?.(val);
    },
    [isControlled, onOpenChange]
  );

  const toggle = useCallback(() => {
    // Always measure from the wrapper div (triggerRef always points to our own div)
    if (triggerRef.current) {
      setTriggerRect(triggerRef.current.getBoundingClientRect());
    }
    setOpen(!isOpen);
  }, [isOpen, setOpen]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    function handleClick(e) {
      if (triggerRef.current && triggerRef.current.contains(e.target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen, setOpen]);

  // Close on scroll/resize to prevent panel drifting
  useEffect(() => {
    if (!isOpen) return;
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [isOpen, setOpen]);

  return (
    <DropdownContext.Provider value={{ isOpen, toggle, setOpen, triggerRef, triggerRect }}>
      <div className="relative inline-block text-left" ref={triggerRef}>
        {children}
      </div>
    </DropdownContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DropdownMenuTrigger
// We deliberately do NOT try to forward a ref into children.
// The ref always lives on the parent <DropdownMenu> wrapper div above.
// The trigger wrapper itself is invisible (inline-block, no visual styles).
// ─────────────────────────────────────────────────────────────────────────────
export function DropdownMenuTrigger({ children, asChild }) {
  const { toggle } = React.useContext(DropdownContext);

  return (
    <div
      onClick={toggle}
      style={{ display: "contents" }} // "contents" makes this div invisible to layout
    >
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DropdownMenuContent
// Portaled to document.body — completely escapes ALL CSS stacking contexts
// (including react-grid-layout CSS transforms and backdrop-filter on header).
// ─────────────────────────────────────────────────────────────────────────────
export function DropdownMenuContent({ children, className = "", align = "right" }) {
  const { isOpen, setOpen, triggerRect } = React.useContext(DropdownContext);
  const panelRef = useRef(null);
  const [style, setStyle] = useState({
    visibility: "hidden",
    position: "fixed",
    top: 0,
    left: 0,
    zIndex: 99999,
  });

  // Synchronously position the panel right after it mounts / rect changes
  useLayoutEffect(() => {
    if (!isOpen || !triggerRect) return;
    const panel = panelRef.current;
    if (!panel) return;

    const GAP = 6;
    const panelH = panel.offsetHeight;
    const panelW = panel.offsetWidth;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Vertical: prefer below, flip above if not enough space
    let top = triggerRect.bottom + GAP;
    if (top + panelH > vh - 8) {
      top = Math.max(8, triggerRect.top - panelH - GAP);
    }

    // Horizontal alignment
    let left;
    if (align === "left" || align === "start") {
      left = triggerRect.left;
    } else {
      left = triggerRect.right - panelW;
    }

    // Clamp inside viewport
    left = Math.max(8, Math.min(left, vw - panelW - 8));

    setStyle({ position: "fixed", top, left, visibility: "visible", zIndex: 99999 });
  }, [isOpen, triggerRect, align]);

  // Reset visibility when closed so next open starts hidden (prevents flash)
  useEffect(() => {
    if (!isOpen) {
      setStyle((prev) => ({ ...prev, visibility: "hidden" }));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Auto-close the panel when a DropdownMenuItem is clicked
  const wrappedChildren = React.Children.map(children, (child, index) => {
    if (!React.isValidElement(child)) return child;
    if (child.type === DropdownMenuItem) {
      return React.cloneElement(child, {
        key: child.key ?? index,
        onClick: (e) => {
          child.props.onClick?.(e);
          setOpen(false);
        },
      });
    }
    return React.cloneElement(child, { key: child.key ?? index });
  });

  return createPortal(
    <div
      ref={panelRef}
      style={style}
      className={`rounded-xl border border-white/[0.08] bg-[#13131A] shadow-2xl p-1.5 ${className}`}
      // Stop mousedown from bubbling so the outside-click handler doesn't close us immediately
      onMouseDown={(e) => e.stopPropagation()}
    >
      {wrappedChildren}
    </div>,
    document.body
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DropdownMenuItem
// ─────────────────────────────────────────────────────────────────────────────
export function DropdownMenuItem({ className = "", children, onClick, ...props }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:text-white rounded-lg hover:bg-white/5 transition-colors duration-150 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
