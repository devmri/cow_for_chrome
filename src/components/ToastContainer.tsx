import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import { cn } from "../utils/classNames";

interface ToastItem {
  id: string;
  message: string;
  type: "success" | "error";
}

declare global {
  interface Window {
    showToast?: (message: string, type?: ToastItem["type"]) => void;
  }
}

const SUCCESS_PATH =
  "M10 2.5C14.1421 2.5 17.5 5.85786 17.5 10C17.5 14.1421 14.1421 17.5 10 17.5C5.85786 17.5 2.5 14.1421 2.5 10C2.5 5.85786 5.85786 2.5 10 2.5ZM10 3.5C6.41015 3.5 3.5 6.41015 3.5 10C3.5 13.5899 6.41015 16.5 10 16.5C13.5899 16.5 16.5 13.5899 16.5 10C16.5 6.41015 13.5899 3.5 10 3.5ZM12.6094 7.1875C12.7819 6.97187 13.0969 6.93687 13.3125 7.10938C13.5281 7.28188 13.5631 7.59687 13.3906 7.8125L9.39062 12.8125C9.30178 12.9236 9.16935 12.9912 9.02734 12.999C8.92097 13.0049 8.81649 12.9768 8.72852 12.9199L8.64648 12.8535L6.64648 10.8535L6.58203 10.7754C6.45387 10.5813 6.47562 10.3173 6.64648 10.1465C6.81735 9.97562 7.08131 9.95387 7.27539 10.082L7.35352 10.1465L8.95801 11.751L12.6094 7.1875Z";

function SuccessIcon() {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 20 20"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className="text-accent-secondary-100 flex-shrink-0"
    >
      <path d={SUCCESS_PATH} />
    </svg>
  );
}

interface ToastProps {
  toast: ToastItem;
  onClose: (id: string) => void;
}

/**
 * 单条提示（重构前变量名: Wa）
 */
function Toast({ toast, onClose }: ToastProps) {
  const [hiding, setHiding] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => handleClose(), 3000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast.id]);

  const handleClose = () => {
    setHiding(true);
    setTimeout(() => onClose(toast.id), 200);
  };

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg",
        "bg-bg-000 border-[0.5px] border-border-300 min-w-[300px]",
        "transition-all duration-200 ease-out",
        hiding ? "opacity-0 translate-x-full" : "animate-toast-slide-in opacity-100 translate-x-0"
      )}
      style={{ animation: hiding ? undefined : "toast-slide-in 0.3s ease-out" }}
    >
      {toast.type === "success" && <SuccessIcon />}
      <p className="text-text-200 font-base flex-1">{toast.message}</p>
      <button
        type="button"
        onClick={handleClose}
        className="p-1 hover:bg-bg-100 rounded transition-colors flex-shrink-0"
        aria-label="Close toast"
      >
        <X size={14} className="text-text-300" />
      </button>
    </div>
  );
}

/**
 * Toast 容器（重构前变量名: Ya）
 */
export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const show = (message: string, type: ToastItem["type"] = "success") => {
      const id = Date.now().toString();
      setToasts((prev) => [...prev, { id, message, type }]);
    };
    window.showToast = show;
    return () => {
      delete window.showToast;
    };
  }, []);

  if (toasts.length === 0) return null;

  const handleClose = (id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onClose={handleClose} />
      ))}
    </div>
  );
}
