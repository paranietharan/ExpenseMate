"use client";

import React, { useEffect } from "react";

interface CustomAlertProps {
  message: string;
  type?: "success" | "error" | "warning" | "info";
  onClose?: () => void;
  autoCloseDuration?: number; // in milliseconds
}

export default function CustomAlert({
  message,
  type = "info",
  onClose,
  autoCloseDuration = 5000,
}: CustomAlertProps) {
  useEffect(() => {
    if (onClose && autoCloseDuration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, autoCloseDuration);
      return () => clearTimeout(timer);
    }
  }, [onClose, autoCloseDuration]);

  if (!message) return null;

  const typeConfig = {
    success: {
      bgColor: "bg-emerald-950/45 border-emerald-500/30 text-emerald-300",
      icon: (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
    },
    error: {
      bgColor: "bg-rose-950/45 border-rose-500/30 text-rose-300",
      icon: (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
    },
    warning: {
      bgColor: "bg-amber-950/45 border-amber-500/30 text-amber-300",
      icon: (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      ),
    },
    info: {
      bgColor: "bg-indigo-950/45 border-indigo-500/30 text-indigo-300",
      icon: (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
    },
  };

  const config = typeConfig[type] || typeConfig.info;

  return (
    <div
      className={`flex items-start gap-3 p-4 border rounded-xl backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-top-4 ${config.bgColor}`}
      role="alert"
    >
      <div className="flex-shrink-0 mt-0.5">{config.icon}</div>
      <div className="flex-1 text-sm font-medium leading-5">{message}</div>
      {onClose && (
        <button
          onClick={onClose}
          type="button"
          className="flex-shrink-0 ml-auto inline-flex justify-center items-center h-5 w-5 rounded-md text-current hover:opacity-75 focus:outline-none transition-opacity"
        >
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      )}
    </div>
  );
}
