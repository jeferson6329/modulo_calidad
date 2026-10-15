"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ConfiguracionSistema } from "@/types";
import { Settings, Save, Check, AlertCircle } from "lucide-react";

export default function ConfiguracionPanel({
  config: configInicial,
}: {
  config: ConfiguracionSistema[];
}) {
  const [config, setConfig]   = useState<ConfiguracionSistema[]>(configInicial);
  const [guardando, setGuardando] = useState(false);
  const [savedKey, setSavedKey]   = useState<string | null>(null);
  const [error, setError]         = useState<string | null>(null);

  const actualizarValor = (id: string, valor: string) => {
    setConfig((prev) =>
      prev.map((c) => (c.id === id ? { ...c, valor } : c))
    );
  };

  const guardar = async (item: ConfiguracionSistema) => {
    setGuardando(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase
      .from("configuracion_sistema")
      .update({ valor: item.valor })
      .eq("id", item.id);

    if (err) setError(err.message);
    else {
      setSavedKey(item.id);
      setTimeout(() => setSavedKey(null), 2000);
    }
    setGuardando(false);
  };

  // Claves con descripción amigable
  const LABELS: Record<string, { label: string; descripcion: string; tipo: "text" | "number" }> = {
    horas_laborales_limite:     { label: "Horas laborales límite",    descripcion: "Horas máximas que tiene el agente para responder un monitoreo", tipo: "number" },
    dias_expiracion_contrasena: { label: "Días vigencia contraseña",   descripcion: "Cada cuántos días deben cambiar la contraseña los usuarios",    tipo: "number" },
    max_intentos_fallidos:      { label: "Intentos fallidos máximos",  descripcion: "Bloquea la cuenta tras este número de intentos fallidos",       tipo: "number" },
    minutos_bloqueo_cuenta:     { label: "Minutos de bloqueo",         descripcion: "Duración del bloqueo tras superar intentos fallidos",           tipo: "number" },
    nombre_empresa:             { label: "Nombre de la empresa",       descripcion: "Aparece en los emails y encabezados del sistema",               tipo: "text"   },
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Settings className="text-[#003087]" size={24} />
          Configuración del Sistema
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Parámetros operativos del sistema. Los cambios aplican inmediatamente.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-2 text-red-700 text-sm">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      <div className="space-y-3">
        {config.map((item) => {
          const meta = LABELS[item.clave];
          if (!meta) return null; // No mostrar claves internas (logo_url, version, etc.)
          return (
            <div
              key={item.id}
              className="bg-white border border-gray-200 rounded-xl p-5 flex items-center gap-4"
            >
              <div className="flex-1">
                <label className="block text-sm font-semibold text-gray-900 mb-0.5">
                  {meta.label}
                </label>
                <p className="text-xs text-gray-500">{meta.descripcion}</p>
                <input
                  type={meta.tipo}
                  value={item.valor}
                  min={meta.tipo === "number" ? 1 : undefined}
                  onChange={(e) => actualizarValor(item.id, e.target.value)}
                  className="mt-2 border border-gray-300 rounded-lg px-3 py-2 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-[#003087]"
                />
              </div>
              <button
                onClick={() => guardar(item)}
                disabled={guardando}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition flex-shrink-0 ${
                  savedKey === item.id
                    ? "bg-green-100 text-green-700"
                    : "bg-[#003087] hover:bg-[#002060] text-white disabled:opacity-70"
                }`}
              >
                {savedKey === item.id
                  ? <><Check size={15} /> Guardado</>
                  : <><Save size={15} /> Guardar</>
                }
              </button>
            </div>
          );
        })}
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        <strong>Nota:</strong> Las horas laborales límite y los días de vigencia de contraseña
        también pueden configurarse individualmente por campaña y usuario desde sus respectivos módulos.
      </div>
    </div>
  );
}
