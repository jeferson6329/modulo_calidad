"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Monitoreo, Perfil, EstadoMonitoreo, CanalTipo } from "@/types";
import { ESTADO_LABELS, ESTADO_COLORES, CANAL_LABELS } from "@/types";
import { formatFecha, formatScore } from "@/lib/utils";
import { bgColorScore } from "@/lib/scoring";
import { Search, Filter, Plus, Download } from "lucide-react";
import Link from "next/link";
import { generarPDFMonitoreo } from "@/lib/pdf-generator";

const ESTADOS_FILTRO: { value: EstadoMonitoreo | ""; label: string }[] = [
  { value: "", label: "Todos los estados" },
  { value: "CREADO", label: "Creado" },
  { value: "EN_REVISION_ASESOR", label: "En revisión asesor" },
  { value: "ACEPTADO", label: "Aceptado" },
  { value: "REFUTADO", label: "Refutado" },
  { value: "EN_REVISION_SUPERVISOR", label: "En revisión supervisor" },
  { value: "REFUTACION_APROBADA", label: "Refutación aprobada" },
  { value: "REFUTACION_RECHAZADA", label: "Refutación rechazada" },
  { value: "EN_VALIDACION_LIDER", label: "En validación líder" },
  { value: "VALIDADO", label: "Validado" },
  { value: "RECHAZADO", label: "Rechazado" },
];

export default function MonitoreosLista({ perfil }: { perfil: Perfil }) {
  const [monitoreos, setMonitoreos] = useState<Monitoreo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoMonitoreo | "">("");
  const [campanaFiltro, setCampanaFiltro] = useState("");
  const [campanas, setCampanas] = useState<{ id: string; nombre: string }[]>([]);

  const esLider = perfil.rol === "LIDER_CALIDAD";
  const esAdmin = ["ADMIN", "SUPER_ADMIN"].includes(perfil.rol);

  const cargar = useCallback(async () => {
    const supabase = createClient();
    let query = supabase
      .from("monitoreos")
      .select(`
        *,
        campana:campanas(id, nombre),
        tipo_monitoreo:tipos_monitoreo(canal, nombre),
        agente:perfiles!monitoreos_agente_id_fkey(nombre, apellido, id_agente, cedula),
        lider:perfiles!monitoreos_lider_id_fkey(nombre, apellido),
        scores:monitoreos_scores(score_final)
      `)
      .order("created_at", { ascending: false });

    // Filtros por rol
    if (perfil.rol === "AGENTE") {
      query = query.eq("agente_id", perfil.id);
    } else if (perfil.rol === "LIDER_CALIDAD") {
      query = query.eq("lider_id", perfil.id);
    } else if (perfil.rol === "SUPERVISOR") {
      query = query.eq("campana_id", perfil.campana_id || "");
    }

    if (estadoFiltro) query = query.eq("estado", estadoFiltro);
    if (campanaFiltro) query = query.eq("campana_id", campanaFiltro);

    const { data } = await query.limit(100);
    if (data) setMonitoreos(data as Monitoreo[]);
    setLoading(false);
  }, [perfil, estadoFiltro, campanaFiltro]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    const cargarCampanas = async () => {
      const supabase = createClient();
      const { data } = await supabase.from("campanas").select("id, nombre").eq("activa", true);
      if (data) setCampanas(data);
    };
    cargarCampanas();
  }, []);

  const monitoreosFiltrados = monitoreos.filter((m) => {
    if (!busqueda) return true;
    const b = busqueda.toLowerCase();
    return (
      m.numero_monitoreo.toLowerCase().includes(b) ||
      `${m.agente?.nombre} ${m.agente?.apellido}`.toLowerCase().includes(b) ||
      m.campana?.nombre?.toLowerCase().includes(b)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Monitoreos</h1>
          <p className="text-gray-500 text-sm mt-1">
            {monitoreosFiltrados.length} resultado{monitoreosFiltrados.length !== 1 ? "s" : ""}
          </p>
        </div>
        {(esLider || esAdmin) && (
          <Link
            href="/dashboard/monitoreos/nuevo"
            className="flex items-center gap-2 bg-[#003087] hover:bg-[#002060] text-white px-4 py-2.5 rounded-lg text-sm font-medium transition"
          >
            <Plus size={16} />
            Nuevo Monitoreo
          </Link>
        )}
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-48">
          <Search size={16} className="text-gray-400 flex-shrink-0" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por número, agente, campaña..."
            className="w-full text-sm outline-none"
          />
        </div>

        <select
          value={estadoFiltro}
          onChange={(e) => setEstadoFiltro(e.target.value as EstadoMonitoreo | "")}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {ESTADOS_FILTRO.map((e) => (
            <option key={e.value} value={e.value}>{e.label}</option>
          ))}
        </select>

        {(esAdmin || esLider) && (
          <select
            value={campanaFiltro}
            onChange={(e) => setCampanaFiltro(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Todas las campañas</option>
            {campanas.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        )}
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : monitoreosFiltrados.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Filter size={40} className="mx-auto mb-3 opacity-40" />
            <p>No se encontraron monitoreos</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">N° Monitoreo</th>
                  <th className="text-left px-4 py-3 font-medium">Agente</th>
                  <th className="text-left px-4 py-3 font-medium">Campaña</th>
                  <th className="text-left px-4 py-3 font-medium">Canal</th>
                  <th className="text-left px-4 py-3 font-medium">Fecha</th>
                  <th className="text-left px-4 py-3 font-medium">Estado</th>
                  <th className="text-left px-4 py-3 font-medium">Nota Final</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {monitoreosFiltrados.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 font-medium text-blue-700">
                      {m.numero_monitoreo}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {m.agente?.nombre} {m.agente?.apellido}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {m.campana?.nombre || "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {m.tipo_monitoreo ? CANAL_LABELS[m.tipo_monitoreo.canal] : "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {formatFecha(m.fecha_monitoreo)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${ESTADO_COLORES[m.estado]}`}>
                        {ESTADO_LABELS[m.estado]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {(m as any).scores?.score_final != null ? (
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${bgColorScore((m as any).scores.score_final)}`}>
                          {formatScore((m as any).scores.score_final)}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/dashboard/monitoreos/${m.id}`}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          Ver
                        </Link>
                        {(esLider || esAdmin) && (m as any).scores?.score_final != null && (
                          <button
                            onClick={() => generarPDFMonitoreo(m)}
                            className="text-xs text-gray-500 hover:text-gray-700"
                            title="Descargar PDF"
                          >
                            <Download size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
