import { useState, useEffect, useCallback } from 'react';

function ToastItem({ toast, onRemove }) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setExiting(true);
      setTimeout(() => onRemove(toast.id), 300);
    }, toast.duration || 3000);
    return () => clearTimeout(timer);
  }, [toast, onRemove]);

  const colors = {
    success: 'bg-green-50 border-green-300 text-green-800',
    error: 'bg-red-50 border-red-300 text-red-800',
    warning: 'bg-yellow-50 border-yellow-300 text-yellow-800',
    info: 'bg-blue-50 border-blue-300 text-blue-800',
  };

  return (
    <div
      className={`flex items-center gap-2 px-4 py-3 rounded-lg border shadow-md transition-all duration-300 ${
        colors[toast.type] || colors.info
      } ${exiting ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0'}`}
    >
      <span className="text-sm flex-1">{toast.message}</span>
      <button
        onClick={() => {
          setExiting(true);
          setTimeout(() => onRemove(toast.id), 300);
        }}
        className="opacity-50 hover:opacity-100 text-lg leading-none"
      >
        &times;
      </button>
    </div>
  );
}

let toastId = 0;

export function ToastContainer({ toastRef }) {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    toastRef.current = {
      success: (msg) => {
        const id = ++toastId;
        setToasts((prev) => [...prev, { id, message: msg, type: 'success', duration: 3000 }]);
      },
      error: (msg) => {
        const id = ++toastId;
        setToasts((prev) => [...prev, { id, message: msg, type: 'error', duration: 5000 }]);
      },
      warning: (msg) => {
        const id = ++toastId;
        setToasts((prev) => [...prev, { id, message: msg, type: 'warning', duration: 4000 }]);
      },
      info: (msg) => {
        const id = ++toastId;
        setToasts((prev) => [...prev, { id, message: msg, type: 'info', duration: 3000 }]);
      },
    };
  }, [toastRef]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onRemove={removeToast} />
      ))}
    </div>
  );
}
