"use client";

import { useState } from "react";
import { ShieldX, X } from "lucide-react";

export default function BannerAccesoDenegado() {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  return (
    <div className="mb-5 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 animate-in fade-in duration-300">
      <ShieldX className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
      <div className="flex-1">
        <p className="text-red-800 font-semibold text-sm">Acceso denegado</p>
        <p className="text-red-600 text-xs mt-0.5">
          No tienes permisos para acceder a esa sección. Si crees que esto es un error,
          contacta al administrador del sistema.
        </p>
      </div>
      <button
        onClick={() => setVisible(false)}
        className="text-red-400 hover:text-red-600 flex-shrink-0"
        aria-label="Cerrar"
      >
        <X size={16} />
      </button>
    </div>
  );
}
