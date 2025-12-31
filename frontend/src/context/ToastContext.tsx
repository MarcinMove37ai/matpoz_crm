// src/context/ToastContext.tsx
"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { X } from "lucide-react";

type ToastMessage = {
  id: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
  type?: "success" | "error" | "info";
  position?: { x: number; y: number }; // Nowe pole dla współrzędnych
};

type ToastContextType = {
  toast: (props: Omit<ToastMessage, "id">) => void;
};

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const toast = useCallback(({ title, description, className, type = "info", position }: Omit<ToastMessage, "id">) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, title, description, className, type, position }]);

    setTimeout(() => {
      removeToast(id);
    }, 3000);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Oddzielamy toasty zwykłe od tych przy kursurze
  const standardToasts = toasts.filter((t) => !t.position);
  const positionedToasts = toasts.filter((t) => t.position);

  // Wspólna funkcja renderująca wygląd
  const renderToastContent = (t: ToastMessage) => (
    <div
      key={t.id}
      className={`
        min-w-[300px] p-4 rounded-lg shadow-lg border animate-in fade-in zoom-in-95 duration-200
        flex justify-between items-start
        ${t.className ? t.className : "bg-white text-gray-900 border-gray-200"}
        ${!t.className && t.type === 'success' ? 'border-l-4 border-l-green-500' : ''}
        ${!t.className && t.type === 'error' ? 'border-l-4 border-l-red-500' : ''}
      `}
      style={t.position ? {
        position: 'fixed',
        left: t.position.x + 15, // Przesunięcie, żeby nie zasłaniać kursora
        top: t.position.y + 15,
        zIndex: 9999
      } : {}}
    >
      <div className="grid gap-1">
        <div className="font-semibold text-sm">{t.title}</div>
        {t.description && <p className="text-sm opacity-90 mt-1">{t.description}</p>}
      </div>
      <button onClick={() => removeToast(t.id)} className="text-inherit opacity-50 hover:opacity-100 ml-4">
        <X size={16} />
      </button>
    </div>
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}

      {/* Kontener dla standardowych toastów (Prawy Dolny Róg) */}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2">
        {standardToasts.map(t => (
           <div key={t.id} className="animate-in slide-in-from-right-full duration-300">
             {renderToastContent(t)}
           </div>
        ))}
      </div>

      {/* Toasty przy kursurze (renderowane bezpośrednio w body/root) */}
      {positionedToasts.map(t => renderToastContent(t))}

    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
};