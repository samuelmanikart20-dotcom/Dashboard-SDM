"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { FaCheckCircle, FaExclamationCircle, FaInfoCircle, FaTimes, FaTimesCircle } from 'react-icons/fa';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
  details?: string[];
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType, duration?: number, details?: string[]) => void;
  showSuccess: (message: string, duration?: number) => void;
  showError: (message: string, duration?: number, details?: string[]) => void;
  showInfo: (message: string, duration?: number) => void;
  showWarning: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = 'info', duration: number = 5000, details?: string[]) => {
      const id = Math.random().toString(36).substring(7);
      const newToast: Toast = { id, message, type, duration, details };
      
      setToasts((prev) => [...prev, newToast]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  const showSuccess = useCallback((message: string, duration?: number) => {
    showToast(message, 'success', duration);
  }, [showToast]);

  const showError = useCallback((message: string, duration?: number, details?: string[]) => {
    showToast(message, 'error', duration || 7000, details);
  }, [showToast]);

  const showInfo = useCallback((message: string, duration?: number) => {
    showToast(message, 'info', duration);
  }, [showToast]);

  const showWarning = useCallback((message: string, duration?: number) => {
    showToast(message, 'warning', duration);
  }, [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, showSuccess, showError, showInfo, showWarning }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
};

interface ToastContainerProps {
  toasts: Toast[];
  removeToast: (id: string) => void;
}

const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, removeToast }) => {
  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 max-w-md w-full sm:w-auto">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
      ))}
    </div>
  );
};

interface ToastItemProps {
  toast: Toast;
  onClose: () => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Trigger entrance animation
    setTimeout(() => setIsVisible(true), 10);
  }, []);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      onClose();
    }, 300);
  };

  const getToastStyles = () => {
    switch (toast.type) {
      case 'success':
        return {
          bg: 'bg-green-50 border-green-200',
          text: 'text-green-800',
          icon: <FaCheckCircle className="text-green-600" />,
          iconBg: 'bg-green-100',
        };
      case 'error':
        return {
          bg: 'bg-red-50 border-red-200',
          text: 'text-red-800',
          icon: <FaTimesCircle className="text-red-600" />,
          iconBg: 'bg-red-100',
        };
      case 'warning':
        return {
          bg: 'bg-yellow-50 border-yellow-200',
          text: 'text-yellow-800',
          icon: <FaExclamationCircle className="text-yellow-600" />,
          iconBg: 'bg-yellow-100',
        };
      default:
        return {
          bg: 'bg-blue-50 border-blue-200',
          text: 'text-blue-800',
          icon: <FaInfoCircle className="text-blue-600" />,
          iconBg: 'bg-blue-100',
        };
    }
  };

  const styles = getToastStyles();

  return (
    <div
      className={`
        ${styles.bg} ${styles.text} border rounded-lg shadow-lg p-4 
        transform transition-all duration-300 ease-in-out
        ${isVisible && !isExiting ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
        flex items-start gap-3 min-w-[320px] max-w-md
      `}
      role="alert"
    >
      <div className={`${styles.iconBg} rounded-full p-2 flex-shrink-0`}>
        {styles.icon}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm mb-1">{toast.message}</div>
        {toast.details && toast.details.length > 0 && (
          <div className="mt-2 space-y-1">
            {toast.details.slice(0, 5).map((detail, idx) => (
              <div key={idx} className="text-xs opacity-90 pl-2 border-l-2 border-current">
                {detail}
              </div>
            ))}
            {toast.details.length > 5 && (
              <div className="text-xs opacity-75 pl-2">
                ... dan {toast.details.length - 5} item lainnya
              </div>
            )}
          </div>
        )}
      </div>
      
      <button
        onClick={handleClose}
        className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
        aria-label="Tutup"
      >
        <FaTimes className="w-4 h-4" />
      </button>
    </div>
  );
};













