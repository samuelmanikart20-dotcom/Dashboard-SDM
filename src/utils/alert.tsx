"use client";

import { useState } from "react";
import Alert from "@/components/Alert";

interface AlertConfig {
  title: string;
  message: string;
  type?: "success" | "error" | "warning" | "info";
  onConfirm?: () => void;
}

interface ConfirmConfig {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel?: () => void;
}

export function useAlert() {
  const [alertState, setAlertState] = useState<AlertConfig & { isOpen: boolean; showCancel?: boolean }>({
    isOpen: false,
    title: "",
    message: "",
    type: "info",
    showCancel: false,
  });

  const showAlert = (config: AlertConfig & { showCancel?: boolean }) => {
    setAlertState({
      ...config,
      isOpen: true,
      type: config.type || "info",
      showCancel: config.showCancel || false,
    });
  };

  const closeAlert = () => {
    setAlertState((prev) => ({ ...prev, isOpen: false }));
  };

  const AlertComponent = () => (
    <Alert
      isOpen={alertState.isOpen}
      onClose={closeAlert}
      title={alertState.title}
      message={alertState.message}
      type={alertState.type}
      onConfirm={alertState.onConfirm}
      showCancel={alertState.showCancel}
    />
  );

  return {
    showAlert,
    closeAlert,
    AlertComponent,
    alert: (message: string, type: "success" | "error" | "warning" | "info" = "info") => {
      showAlert({
        title: type === "error" ? "Error" : type === "success" ? "Berhasil" : type === "warning" ? "Peringatan" : "Informasi",
        message,
        type,
        showCancel: false,
      });
    },
    confirm: (config: ConfirmConfig) => {
      showAlert({
        title: config.title || "Konfirmasi",
        message: config.message,
        type: "warning",
        showCancel: true,
        onConfirm: () => {
          config.onConfirm();
          closeAlert();
        },
      });
    },
  };
}

