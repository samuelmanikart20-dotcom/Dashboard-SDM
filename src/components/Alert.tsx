"use client";

import { useEffect, useRef, useState } from "react";
import { FaCheckCircle, FaExclamationCircle, FaInfoCircle, FaTimesCircle, FaTimes } from "react-icons/fa";

interface AlertProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  type?: "success" | "error" | "warning" | "info";
  confirmText?: string;
  showCancel?: boolean;
  cancelText?: string;
  onConfirm?: () => void;
}

export default function Alert({
  isOpen,
  onClose,
  title,
  message,
  type = "info",
  confirmText = "OK",
  showCancel = false,
  cancelText = "Batal",
  onConfirm,
}: AlertProps) {
  const confirmBtnRef = useRef<HTMLButtonElement | null>(null);
  const cancelBtnRef = useRef<HTMLButtonElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      setTimeout(() => confirmBtnRef.current?.focus(), 100);
    } else {
      setIsVisible(false);
    }
  }, [isOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  const handleModalKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "Tab") return;
    const first = confirmBtnRef.current;
    const last = showCancel ? cancelBtnRef.current : confirmBtnRef.current;
    if (!first || !last) return;

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    }
    onClose();
  };

  if (!isOpen) return null;

  const typeConfig = {
    success: {
      icon: FaCheckCircle,
      iconColor: "text-emerald-600",
      iconBg: "bg-emerald-50",
      iconRing: "ring-emerald-100",
      gradient: "from-emerald-50 to-green-50",
      borderColor: "border-emerald-200",
      confirmButton: "bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 focus:ring-emerald-300 shadow-lg shadow-emerald-500/30",
      titleColor: "text-emerald-900",
    },
    error: {
      icon: FaTimesCircle,
      iconColor: "text-red-600",
      iconBg: "bg-red-50",
      iconRing: "ring-red-100",
      gradient: "from-red-50 to-rose-50",
      borderColor: "border-red-200",
      confirmButton: "bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 focus:ring-red-300 shadow-lg shadow-red-500/30",
      titleColor: "text-red-900",
    },
    warning: {
      icon: FaExclamationCircle,
      iconColor: "text-amber-600",
      iconBg: "bg-amber-50",
      iconRing: "ring-amber-100",
      gradient: "from-amber-50 to-yellow-50",
      borderColor: "border-amber-200",
      confirmButton: "bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-700 hover:to-yellow-700 focus:ring-amber-300 shadow-lg shadow-amber-500/30",
      titleColor: "text-amber-900",
    },
    info: {
      icon: FaInfoCircle,
      iconColor: "text-blue-600",
      iconBg: "bg-blue-50",
      iconRing: "ring-blue-100",
      gradient: "from-blue-50 to-indigo-50",
      borderColor: "border-blue-200",
      confirmButton: "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:ring-blue-300 shadow-lg shadow-blue-500/30",
      titleColor: "text-blue-900",
    },
  };

  const config = typeConfig[type];
  const Icon = config.icon;

  // Split message by newlines for better formatting
  const messageLines = message.split('\n').filter(line => line.trim() !== '');

  return (
    <div 
      className={`fixed inset-0 flex items-center justify-center z-[60] transition-all duration-300 ${
        isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      {/* Backdrop with blur */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      
      {/* Modal */}
      <div
        className={`relative bg-white rounded-2xl shadow-2xl border ${config.borderColor} pointer-events-auto transform transition-all duration-300 ${
          isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        } max-w-md w-full mx-4 overflow-hidden`}
        onKeyDown={handleModalKeyDown}
      >
        {/* Gradient header */}
        <div className={`bg-gradient-to-r ${config.gradient} px-6 py-5 border-b ${config.borderColor}`}>
          <div className="flex items-start gap-4">
            <div className={`flex-shrink-0 ${config.iconBg} ${config.iconRing} rounded-full p-3 ring-4`}>
              <Icon className={`h-7 w-7 ${config.iconColor}`} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className={`text-xl font-bold ${config.titleColor} mb-1`}>{title}</h3>
              <div className="mt-2 space-y-1">
                {messageLines.map((line, idx) => (
                  <p key={idx} className="text-sm text-gray-700 leading-relaxed">
                    {line}
                  </p>
                ))}
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-white/50"
              aria-label="Tutup"
            >
              <FaTimes className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 bg-gray-50 flex gap-3">
          {showCancel && (
            <button
              ref={cancelBtnRef}
              onClick={onClose}
              className="flex-1 px-5 py-2.5 bg-white text-gray-700 rounded-xl hover:bg-gray-100 transition-all focus:ring-2 focus:ring-gray-300 font-medium border border-gray-200 shadow-sm hover:shadow"
            >
              {cancelText}
            </button>
          )}
          <button
            ref={confirmBtnRef}
            onClick={handleConfirm}
            className={`flex-1 px-5 py-2.5 ${config.confirmButton} text-white rounded-xl transition-all focus:ring-2 font-semibold ${showCancel ? "" : "w-full"}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

