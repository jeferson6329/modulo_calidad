"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Perfil, Monitoreo } from "@/types";
import { CANAL_LABELS, ESTADO_LABELS } from "@/types";
import { formatFecha } from "@/lib/utils";
import { Download, FileSpreadsheet, Filter, Loader2, CheckSquare } from "lucide-react";

export default function DescargasPanel({ perfil }: { perfil: Perfil }) {
  const [campanas, setCampanas]       = useState<{ id: string; nombre: string }[]>([]);
  const [campanaFiltro, setCampana]   = useState("");
  const [fechaDesde, setFechaDesde]   = useState("");
  const [fechaHasta, setFechaHasta]   = useState("");
  const [estado, setEstado]           = useState("");
  const [cargando, setCargando]       = useState(false);
  const [total, setTotal]             = useState<number | null>(null);

  useEffect(() => {
    createClient()
      .from("campanas").select("id, nombre").eq("activa", true)
      .then(({ data }) => { if (data) setCampanas(data); });
  }, []);

  // Contar registros antes de descargar
  const contarRegistros = async () => {
    const supabase = createClient();
    let q = supabase.from("monitoreos").select("*", { count: "exact", head: true });
    if (campanaFiltro) q = q.eq("campana_id", campanaFiltro);
    if (fechaDesde)    q = q.gte("fecha_monitoreo", fechaDesde);
    if (fechaHasta)    q = q.lte("fecha_monitoreo", fechaHasta);
    if (estado)        q = q.eq("estado", estado);
    const { count } = await q;
    setTotal(count ?? 0);
  };

  const descargarExcel = async () => {
    setCargando(true);
    try {
      const supabase = createClient();
      let q = supabase
        .from("monitoreos")
        .select(`
          numero_monitoreo, estado, fecha_llamada, fecha_monitoreo,
          fecha_coaching, antiguedad, descripcion_llamada,
          aspectos_positivos, aspectos_mejorar, compromiso_agente,
          campana:campanas(nombre),
          tipo_monitoreo:tipos_monitoreo(canal, nombre),
          agente:perfiles!monitoreos_agente_id_fkey(nombre, apellido, cedula, id_agente),
          lider:perfiles!monitoreos_lider_id_fkey(nombre, apellido),
          scores:monitoreos_scores(score_ecnc, score_ecneg, score_ecuf, score_ecc, score_final)
        `)
        .order("fecha_monitoreo", { ascending: false });

      if (campanaFiltro) q = q.eq("campana_id", campanaFiltro);
      if (fechaDesde)    q = q.gte("fecha_monitoreo", fechaDesde);
      if (fechaHasta)    q = q.lte("fecha_monitoreo", fechaHasta);
      if (estado)        q = q.eq("estado", estado);

      const { data, error } = await q.limit(5000);
      if (error) throw error;
      if (!data || data.length === 0) { alert("No hay datos para los filtros seleccionados."); return; }

      const XLSX = await import("xlsx");

      const filas = data.map((m: any) => ({
        "N° Monitoreo":       m.numero_monitoreo,
        "Agente":             `${m.agente?.nombre || ""} ${m.agente?.apellido || ""}`.trim(),
        "Cédula":             m.agente?.cedula || m.agente?.id_agente || "",
        "Campaña":            m.campana?.nombre || "",
        "Canal":              m.tipo_monitoreo ? CANAL_LABELS[m.tipo_monitoreo.canal as any] : "",
        "Tipo Monitoreo":     m.tipo_monitoreo?.nombre || "",
        "Antigüedad":         m.antiguedad,
        "Fecha Llamada":      m.fecha_llamada  ? formatFecha(m.fecha_llamada) : "",
        "Fecha Monitoreo":    m.fecha_monitoreo ? formatFecha(m.fecha_monitoreo) : "",
        "Fecha Coaching":     m.fecha_coaching ? formatFecha(m.fecha_coaching) : "",
        "Líder Calidad":      `${m.lider?.nombre || ""} ${m.lider?.apellido || ""}`.trim(),
        "Estado":             ESTADO_LABELS[m.estado as any] || m.estado,
        "Descripción":        m.descripcion_llamada || "",
        "Aspectos a Mejorar": m.aspectos_mejorar || "",
        "Aspectos Positivos": m.aspectos_positivos || "",
        "Compromiso Agente":  m.compromiso_agente || "",
        "ECN (25%)":          m.scores?.score_ecnc  ?? "",
        "ECNEG (30%)":        m.scores?.score_ecneg ?? "",
        "ECUF (30%)":         m.scores?.score_ecuf  ?? "",
        "ECC (15%)":          m.scores?.score_ecc   ?? "",
        "Nota Final":         m.scores?.score_final ?? "",
      }));

      const ws = XLSX.utils.json_to_sheet(filas);

      // Ancho de columnas
      ws["!cols"] = [
        { wch: 18 }, { wch: 25 }, { wch: 14 }, { wch: 28 }, { wch: 14 },
        { wch: 18 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
        { wch: 25 }, { wch: 22 }, { wch: 40 }, { wch: 35 }, { wch: 35 },
        { wch: 35 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 11 },
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Monitoreos");

      // Hoja de resumen
      const resumen = [
        ["REPORTE DE MONITOREOS"],
        ["Generado por:", `${perfil.nombre} ${perfil.apellido}`],
        ["Fecha generación:", formatFecha(new Date().toISOString())],
        ["Total registros:", filas.length],
        campanaFiltro ? ["Campaña filtro:", campanas.find(c => c.id === campanaFiltro)?.nombre || ""] : [],
        fechaDesde ? ["Desde:", fechaDesde] : [],
        fechaHasta ? ["Hasta:", fechaHasta] : [],
        estado ? ["Estado:", ESTADO_LABELS[estado as any] || estado] : [],
      ].filter(r => r.length > 0);

      const wsResumen = XLSX.utils.aoa_to_sheet(resumen);
      wsResumen["!cols"] = [{ wch: 22 }, { wch: 30 }];
      XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen");

      const nombreArchivo = `monitoreos_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, nombreArchivo);

    } catch (e: any) {
      alert("Error al generar el archivo: " + e.message);
    } finally {
      setCargando(false);
    }
  };

  const descargarCSV = async () => {
    setCargando(true);
    try {
      const supabase = createClient();
      let q = supabase
        .from("monitoreos")
        .select(`
          numero_monitoreo, estado, fecha_llamada, fecha_monitoreo,
          campana:campanas(nombre),
          tipo_monitoreo:tipos_monitoreo(canal),
          agente:perfiles!monitoreos_agente_id_fkey(nombre, apellido, cedula),
          scores:monitoreos_scores(score_final)
        `)
        .order("fecha_monitoreo", { ascending: false });

      if (campanaFiltro) q = q.eq("campana_id", campanaFiltro);
      if (fechaDesde)    q = q.gte("fecha_monitoreo", fechaDesde);
      if (fechaHasta)    q = q.lte("fecha_monitoreo", fechaHasta);
      if (estado)        q = q.eq("estado", estado);

      const { data, error } = await q.limit(5000);
      if (error) throw error;
      if (!data || data.length === 0) { alert("No hay datos."); return; }

      const headers = ["N° Monitoreo","Agente","Cédula","Campaña","Canal","Fecha","Estado","Nota Final"];
      const rows = (data as any[]).map((m) => [
        m.numero_monitoreo,
        `${m.agente?.nombre || ""} ${m.agente?.apellido || ""}`.trim(),
        m.agente?.cedula || "",
        m.campana?.nombre || "",
        m.tipo_monitoreo ? CANAL_LABELS[m.tipo_monitoreo.canal as any] : "",
        m.fecha_monitoreo ? formatFecha(m.fecha_monitoreo) : "",
        ESTADO_LABELS[m.estado as any] || m.estado,
        m.scores?.score_final ?? "",
      ]);

      const csv  = [headers, ...rows].map((r) => r.map(String).join(",")).join("\n");
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `monitoreos_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Descargas</h1>
        <p className="text-gray-500 text-sm mt-1">
          Exporta monitoreos con los filtros que necesites
        </p>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
          <Filter size={16} className="text-gray-400" />
          Filtros (opcionales)
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Campaña</label>
            <select
              value={campanaFiltro}
              onChange={(e) => { setCampana(e.target.value); setTotal(null); }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]"
            >
              <option value="">Todas las campañas</option>
              {campanas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Estado</label>
            <select
              value={estado}
              onChange={(e) => { setEstado(e.target.value); setTotal(null); }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]"
            >
              <option value="">Todos los estados</option>
              {Object.entries(ESTADO_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Desde</label>
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => { setFechaDesde(e.target.value); setTotal(null); }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Hasta</label>
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => { setFechaHasta(e.target.value); setTotal(null); }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]"
            />
          </div>
        </div>

        {/* Contar registros */}
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={contarRegistros}
            className="flex items-center gap-2 text-sm text-gray-600 border border-gray-300 hover:bg-gray-50 px-4 py-2 rounded-lg transition"
          >
            <CheckSquare size={15} />
            Contar registros
          </button>
          {total !== null && (
            <span className="text-sm font-medium text-gray-700">
              {total.toLocaleString()} monitoreo{total !== 1 ? "s" : ""} encontrado{total !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* Botones de descarga */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Excel completo */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-green-50 rounded-xl flex items-center justify-center">
              <FileSpreadsheet className="text-green-600" size={22} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Excel completo</h3>
              <p className="text-xs text-gray-500">Todos los campos + hoja de resumen</p>
            </div>
          </div>
          <p className="text-xs text-gray-400">
            Incluye descripción, aspectos, compromisos, scores por categoría y nota final.
            Máximo 5,000 registros.
          </p>
          <button
            onClick={descargarExcel}
            disabled={cargando}
            className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition disabled:opacity-70"
          >
            {cargando
              ? <><Loader2 size={15} className="animate-spin" /> Generando...</>
              : <><Download size={15} /> Descargar .xlsx</>
            }
          </button>
        </div>

        {/* CSV liviano */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-blue-50 rounded-xl flex items-center justify-center">
              <Download className="text-blue-600" size={22} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">CSV liviano</h3>
              <p className="text-xs text-gray-500">Campos esenciales para análisis</p>
            </div>
          </div>
          <p className="text-xs text-gray-400">
            N° monitoreo, agente, cédula, campaña, canal, fecha, estado y nota final.
            Ideal para importar a Excel o herramientas de BI.
          </p>
          <button
            onClick={descargarCSV}
            disabled={cargando}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition disabled:opacity-70"
          >
            {cargando
              ? <><Loader2 size={15} className="animate-spin" /> Generando...</>
              : <><Download size={15} /> Descargar .csv</>
            }
          </button>
        </div>
      </div>

      <p className="text-xs text-gray-400 text-center">
        Los archivos se descargan directamente en tu computador. No se almacenan en el servidor.
      </p>
    </div>
  );
}
