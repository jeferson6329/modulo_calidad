"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RolUsuario, PermisoRol } from "@/types";
import { ROL_LABELS, PERMISOS_DISPONIBLES } from "@/types";
import { Shield, Save } from "lucide-react";

type PermisoMap = Record<string, Record<string, boolean>>;

const ROLES: RolUsuario[] = ["AGENTE", "SUPERVISOR", "LIDER_CALIDAD", "MINERO", "ADMIN"];

export default function PermisosPanel() {
  const [permisos, setPermisos] = useState<PermisoMap>({});
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const cargar = async () => {
      const supabase = createClient();
      const { data } = await supabase.from("permisos_rol").select("*");

      const map: PermisoMap = {};
      ROLES.forEach((rol) => {
        map[rol] = {};
        PERMISOS_DISPONIBLES.forEach(({ clave }) => {
          map[rol][clave] = false;
        });
      });

      if (data) {
        data.forEach((p: PermisoRol) => {
          if (map[p.rol]) {
            map[p.rol][p.permiso] = p.habilitado;
          }
        });
      }

      setPermisos(map);
      setLoading(false);
    };
    cargar();
  }, []);

  const togglePermiso = (rol: RolUsuario, permiso: string) => {
    setPermisos((prev) => ({
      ...prev,
      [rol]: {
        ...prev[rol],
        [permiso]: !prev[rol]?.[permiso],
      },
    }));
  };

  const guardar = async () => {
    setGuardando(true);
    const supabase = createClient();

    const upserts: any[] = [];
    ROLES.forEach((rol) => {
      PERMISOS_DISPONIBLES.forEach(({ clave }) => {
        upserts.push({
          rol,
          permiso: clave,
          habilitado: permisos[rol]?.[clave] || false,
        });
      });
    });

    await supabase.from("permisos_rol").upsert(upserts, { onConflict: "rol,permiso" });
    setGuardando(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestión de Permisos</h1>
          <p className="text-gray-500 text-sm mt-1">
            Configura qué puede hacer cada rol en el sistema
          </p>
        </div>
        <button
          onClick={guardar}
          disabled={guardando}
          className="flex items-center gap-2 bg-[#003087] hover:bg-[#002060] text-white px-5 py-2.5 rounded-lg text-sm font-medium transition disabled:opacity-70"
        >
          <Save size={16} />
          {guardando ? "Guardando..." : saved ? "✓ Guardado" : "Guardar cambios"}
        </button>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
        <Shield className="text-amber-600" size={18} />
        <p className="text-sm text-amber-800">
          Estos permisos aplican globalmente a cada rol. El <strong>Super Admin</strong> siempre tiene acceso total y no se puede modificar.
        </p>
      </div>

      {/* Tabla de permisos */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600 w-64">Permiso</th>
                {ROLES.map((rol) => (
                  <th key={rol} className="px-4 py-3 font-medium text-gray-600 text-center">
                    {ROL_LABELS[rol]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {PERMISOS_DISPONIBLES.map(({ clave, label }) => (
                <tr key={clave} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-700 font-medium">{label}</td>
                  {ROLES.map((rol) => (
                    <td key={rol} className="px-4 py-3 text-center">
                      <button
                        onClick={() => togglePermiso(rol, clave)}
                        className={`w-11 h-6 rounded-full transition-colors relative ${
                          permisos[rol]?.[clave] ? "bg-[#003087]" : "bg-gray-300"
                        }`}
                      >
                        <span
                          className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                            permisos[rol]?.[clave] ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
