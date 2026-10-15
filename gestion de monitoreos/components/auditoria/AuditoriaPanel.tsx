"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Perfil } from "@/types";
import { formatFechaHora } from "@/lib/utils";
import { Shield, Download, Search, Filter, CheckCircle, XCircle } from "lucide-react";

interface RegistroAuditoria {
  id: string;
  usuario_id: string | null;
  usuario_email: string | null;
  usuario_rol: string | null;
  evento: string;
  descripcion: string;
  tabla_afectada: string | null;
  registro_id: string | null;
  datos_anteriores: any;
  datos_nuevos: any;
  ip_address: string | null;
  user_agent: string | null;
  exito: boolean;
  created_at: string;
}

const EVENTOS_FILTRO = [
  { value: "", label: "Todos los eventos" },
  { value: "LOGIN", label: "Login" },
  { value: "LOGOUT", label: "Logout" },
  { value: "LOGIN_FALLIDO", label: "Login fallido" },
  { value: "CAMBIO_CONTRASENA", label: "Cambio contraseña" },
  { value: "RESTABLECIMIENTO_CONTRASENA", label: "Restablecimiento contraseña" },
  { value: "CREACION_USUARIO", label: "Creación usuario" },
  { value: "ACTUALIZACION_USUARIO", label: "Actualización usuario" },
  { value: "CAMBIO_ROL", label: "Cambio de rol" },
  { value: "DESACTIVACION_USUARIO", label: "Desactivación usuario" },
  { value: "CARGA_MASIVA_AGENTES", label: "Carga masiva agentes" },
  { value: "CREACION_MONITOREO", label: "Creación monitoreo" },
  { value: "CAMBIO_ESTADO_MONITOREO", label: "Cambio estado monitoreo" },
  { value: "DESCARGA_PDF", label: "Descarga PDF" },
  { value: "EXPORTACION_DATOS", label: "Exportación datos" },
  { value: "CAMBIO_PERMISO", label: "Cambio permiso" },
  { value: "CAMBIO_CONFIGURACION", label: "Cambio configuración" },
];

const EVENTO_COLOR: Record<string, string> = {
  LOGIN: "bg-green-100 text-green-800",
  LOGOUT: "bg-gray-100 text-gray-700",
  LOGIN_FALLIDO: "bg-red-100 text-red-800",
  CAMBIO_CONTRASENA: "bg-yellow-100 text-yellow-800",
  RESTABLECIMIENTO_CONTRASENA: "bg-orange-100 text-orange-800",
  CONTRASENA_EXPIRADA: "bg-red-100 text-red-800",
  CREACION_USUARIO: "bg-blue-100 text-blue-800",
  ACTUALIZACION_USUARIO: "bg-blue-50 text-blue-700",
  CAMBIO_ROL: "bg-purple-100 text-purple-800",
  DESACTIVACION_USUARIO: "bg-red-50 text-red-700",
  CARGA_MASIVA_AGENTES: "bg-indigo-100 text-indigo-800",
  CREACION_MONITOREO: "bg-teal-100 text-teal-800",
  CAMBIO_ESTADO_MONITOREO: "bg-teal-50 text-teal-700",
  DESCARGA_PDF: "bg-gray-100 text-gray-700",
  EXPORTACION_DATOS: "bg-gray-100 text-gray-700",
  CAMBIO_PERMISO: "bg-purple-50 text-purple-700",
  CAMBIO_CONFIGURACION: "bg-amber-100 text-amber-800",
  ACCESO_REPORTE: "bg-sky-100 text-sky-800",
};

export default function AuditoriaPanel({ perfil }: { perfil: Perfil }) {
  const [registros, setRegistros] = useState<RegistroAuditoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [eventoFiltro, setEventoFiltro] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [seleccionado, setSeleccionado] = useState<RegistroAuditoria | null>(null);
  const [total, setTotal] = useState(0);

  const cargar = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    let query = supabase
      .from("auditoria")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .limit(200);

    if (eventoFiltro) query = query.eq("evento", eventoFiltro);
    if (fechaDesde)   query = query.gte("created_at", fechaDesde);
    if (fechaHasta)   query = query.lte("created_at", fechaHasta + "T23:59:59");

    const { data, count } = await query;
    if (data) setRegistros(data);
    setTotal(count || 0);
    setLoading(false);
  }, [eventoFiltro, fechaDesde, fechaHasta]);

  useEffect(() => { cargar(); }, [cargar]);

  const filtrados = registros.filter((r) => {
    if (!busqueda) return true;
    const b = busqueda.toLowerCase();
    return (
      r.descripcion.toLowerCase().includes(b) ||
      (r.usuario_email || "").toLowerCase().includes(b) ||
      (r.evento || "").toLowerCase().includes(b) ||
      (r.ip_address || "").includes(b)
    );
  });

  const exportarCSV = () => {
    const headers = ["Fecha", "Usuario", "Rol", "Evento", "Descripción", "Tabla", "IP", "Éxito"];
    const rows = filtrados.map((r) => [
      formatFechaHora(r.created_at),
      r.usuario_email || "—",
      r.usuario_rol || "—",
      r.evento,
      `"${r.descripcion.replace(/"/g, "'")}"`,
      r.tabla_afectada || "—",
      r.ip_address || "—",
      r.exito ? "Sí" : "No",
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `auditoria_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="text-[#003087]" size={24} />
            Interventoría / Auditoría
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {total.toLocaleString()} registros totales · Mostrando {filtrados.length}
          </p>
        </div>
        <button
          onClick={exportarCSV}
          className="flex items-center gap-2 border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2.5 rounded-lg text-sm transition"
        >
          <Download size={16} />
          Exportar CSV
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2 flex-1 min-w-48">
          <Search size={15} className="text-gray-400 flex-shrink-0" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por usuario, descripción, IP..."
            className="w-full text-sm outline-none"
          />
        </div>
        <select
          value={eventoFiltro}
          onChange={(e) => setEventoFiltro(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
        >
          {EVENTOS_FILTRO.map((e) => (
            <option key={e.value} value={e.value}>{e.label}</option>
          ))}
        </select>
        <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
      </div>

      <div className="flex gap-6">
        {/* Tabla principal */}
        <div className="flex-1 bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtrados.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Filter size={36} className="mx-auto mb-3 opacity-40" />
              <p>Sin registros para los filtros aplicados</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-600">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Fecha</th>
                    <th className="text-left px-4 py-3 font-medium">Usuario</th>
                    <th className="text-left px-4 py-3 font-medium">Evento</th>
                    <th className="text-left px-4 py-3 font-medium">Descripción</th>
                    <th className="text-left px-4 py-3 font-medium">IP</th>
                    <th className="text-center px-4 py-3 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtrados.map((r) => (
                    <tr
                      key={r.id}
                      onClick={() => setSeleccionado(r)}
                      className={`hover:bg-blue-50 cursor-pointer transition ${seleccionado?.id === r.id ? "bg-blue-50" : ""}`}
                    >
                      <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap text-xs">
                        {formatFechaHora(r.created_at)}
                      </td>
                      <td className="px-4 py-2.5">
                        <p className="text-xs text-gray-700 font-medium">{r.usuario_email || "Sistema"}</p>
                        {r.usuario_rol && (
                          <p className="text-xs text-gray-400">{r.usuario_rol}</p>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${EVENTO_COLOR[r.evento] || "bg-gray-100 text-gray-700"}`}>
                          {r.evento.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-600 text-xs max-w-xs truncate">
                        {r.descripcion}
                      </td>
                      <td className="px-4 py-2.5 text-gray-400 text-xs">{r.ip_address || "—"}</td>
                      <td className="px-4 py-2.5 text-center">
                        {r.exito
                          ? <CheckCircle size={15} className="text-green-500 mx-auto" />
                          : <XCircle size={15} className="text-red-500 mx-auto" />
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Panel de detalle */}
        {seleccionado && (
          <div className="w-80 bg-white rounded-xl border border-gray-200 p-5 space-y-4 self-start sticky top-6">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 text-sm">Detalle del registro</h3>
              <button onClick={() => setSeleccionado(null)} className="text-gray-400 hover:text-gray-600 text-lg">×</button>
            </div>

            <div className="space-y-3 text-sm">
              <DetalleItem label="Fecha" value={formatFechaHora(seleccionado.created_at)} />
              <DetalleItem label="Evento" value={
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${EVENTO_COLOR[seleccionado.evento] || "bg-gray-100"}`}>
                  {seleccionado.evento.replace(/_/g, " ")}
                </span>
              } />
              <DetalleItem label="Usuario" value={seleccionado.usuario_email || "Sistema"} />
              <DetalleItem label="Rol" value={seleccionado.usuario_rol || "—"} />
              <DetalleItem label="Descripción" value={seleccionado.descripcion} />
              {seleccionado.tabla_afectada && (
                <DetalleItem label="Tabla" value={`${seleccionado.tabla_afectada} / ${seleccionado.registro_id || "—"}`} />
              )}
              <DetalleItem label="IP" value={seleccionado.ip_address || "—"} />
              <DetalleItem label="Éxito" value={seleccionado.exito ? "✅ Sí" : "❌ No"} />

              {seleccionado.datos_anteriores && (
                <div>
                  <p className="text-xs text-gray-500 font-medium mb-1">Datos anteriores</p>
                  <pre className="bg-gray-50 rounded p-2 text-xs overflow-auto max-h-32">
                    {JSON.stringify(seleccionado.datos_anteriores, null, 2)}
                  </pre>
                </div>
              )}
              {seleccionado.datos_nuevos && (
                <div>
                  <p className="text-xs text-gray-500 font-medium mb-1">Datos nuevos</p>
                  <pre className="bg-gray-50 rounded p-2 text-xs overflow-auto max-h-32">
                    {JSON.stringify(seleccionado.datos_nuevos, null, 2)}
                  </pre>
                </div>
              )}
              {seleccionado.user_agent && (
                <div>
                  <p className="text-xs text-gray-500 font-medium mb-1">User Agent</p>
                  <p className="text-xs text-gray-600 break-words">{seleccionado.user_agent}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DetalleItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <div className="text-sm text-gray-800 font-medium">{value}</div>
    </div>
  );
}
