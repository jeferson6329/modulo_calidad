"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Perfil, Monitoreo } from "@/types";
import { ESTADO_LABELS, CANAL_LABELS } from "@/types";
import { formatFecha } from "@/lib/utils";
import { bgColorScore } from "@/lib/scoring";
import { BarChart3, Download, TrendingUp, Users, Filter } from "lucide-react";

interface Metricas {
  total: number;
  aceptados: number;
  refutados: number;
  validados: number;
  promedioGeneral: number;
  porCanal: Record<string, { total: number; promedio: number }>;
  porMes: Record<string, { total: number; promedio: number }>;
  top5Agentes: { nombre: string; total: number; promedio: number }[];
}

export default function ReportesPanel({ perfil }: { perfil: Perfil }) {
  const [monitoreos, setMonitoreos] = useState<Monitoreo[]>([]);
  const [metricas, setMetricas]     = useState<Metricas | null>(null);
  const [loading, setLoading]       = useState(true);
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [campanaFiltro, setCampanaFiltro] = useState("");
  const [campanas, setCampanas]     = useState<{ id: string; nombre: string }[]>([]);

  useEffect(() => {
    createClient()
      .from("campanas").select("id, nombre").eq("activa", true)
      .then(({ data }) => { if (data) setCampanas(data); });
  }, []);

  const cargar = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    let query = supabase
      .from("monitoreos")
      .select(`
        id, numero_monitoreo, estado, fecha_monitoreo, agente_id,
        campana:campanas(nombre),
        tipo_monitoreo:tipos_monitoreo(canal, nombre),
        agente:perfiles!monitoreos_agente_id_fkey(nombre, apellido),
        scores:monitoreos_scores(score_final, score_ecnc, score_ecneg, score_ecuf, score_ecc)
      `)
      .order("fecha_monitoreo", { ascending: false });

    if (fechaDesde)   query = query.gte("fecha_monitoreo", fechaDesde);
    if (fechaHasta)   query = query.lte("fecha_monitoreo", fechaHasta);
    if (campanaFiltro) query = query.eq("campana_id", campanaFiltro);

    if (perfil.rol === "SUPERVISOR")    query = query.eq("campana_id", perfil.campana_id || "");
    else if (perfil.rol === "LIDER_CALIDAD") query = query.eq("lider_id", perfil.id);

    const { data } = await query.limit(500);
    if (data) {
      setMonitoreos(data as Monitoreo[]);
      buildMetricas(data as Monitoreo[]);
    }
    setLoading(false);
  }, [fechaDesde, fechaHasta, campanaFiltro, perfil]);

  useEffect(() => { cargar(); }, [cargar]);

  const buildMetricas = (data: Monitoreo[]) => {
    const conScore = data.filter((m) => m.scores?.score_final != null);
    const promedioGeneral = conScore.length > 0
      ? conScore.reduce((s, m) => s + m.scores!.score_final, 0) / conScore.length
      : 0;

    const porCanal: Record<string, { total: number; scores: number[] }> = {};
    data.forEach((m) => {
      const c = m.tipo_monitoreo?.canal || "DESCONOCIDO";
      if (!porCanal[c]) porCanal[c] = { total: 0, scores: [] };
      porCanal[c].total++;
      if (m.scores?.score_final != null) porCanal[c].scores.push(m.scores.score_final);
    });

    const porMes: Record<string, { total: number; scores: number[] }> = {};
    data.forEach((m) => {
      const mes = m.fecha_monitoreo?.slice(0, 7) || "";
      if (!porMes[mes]) porMes[mes] = { total: 0, scores: [] };
      porMes[mes].total++;
      if (m.scores?.score_final != null) porMes[mes].scores.push(m.scores.score_final);
    });

    const agentesMap: Record<string, { nombre: string; scores: number[] }> = {};
    data.forEach((m) => {
      const k = m.agente_id;
      const nombre = `${m.agente?.nombre || ""} ${m.agente?.apellido || ""}`.trim();
      if (!agentesMap[k]) agentesMap[k] = { nombre, scores: [] };
      if (m.scores?.score_final != null) agentesMap[k].scores.push(m.scores.score_final);
    });

    const avg = (arr: number[]) =>
      arr.length > 0 ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 100) / 100 : 0;

    setMetricas({
      total:            data.length,
      aceptados:        data.filter((m) => m.estado === "ACEPTADO").length,
      refutados:        data.filter((m) => ["REFUTADO","EN_REVISION_SUPERVISOR"].includes(m.estado)).length,
      validados:        data.filter((m) => m.estado === "VALIDADO").length,
      promedioGeneral:  Math.round(promedioGeneral * 100) / 100,
      porCanal: Object.fromEntries(
        Object.entries(porCanal).map(([k, v]) => [k, { total: v.total, promedio: avg(v.scores) }])
      ),
      porMes: Object.fromEntries(
        Object.entries(porMes)
          .sort(([a], [b]) => b.localeCompare(a))
          .slice(0, 6)
          .map(([k, v]) => [k, { total: v.total, promedio: avg(v.scores) }])
      ),
      top5Agentes: Object.values(agentesMap)
        .map((a) => ({ nombre: a.nombre, total: a.scores.length, promedio: avg(a.scores) }))
        .sort((a, b) => b.promedio - a.promedio)
        .slice(0, 5),
    });
  };

  const exportarCSV = () => {
    const headers = ["N° Monitoreo","Agente","Campaña","Canal","Fecha","Estado",
                     "ECN","ECNEG","ECUF","ECC","Nota Final"];
    const rows = monitoreos.map((m) => [
      m.numero_monitoreo,
      `${m.agente?.nombre || ""} ${m.agente?.apellido || ""}`.trim(),
      (m as any).campana?.nombre || "",
      m.tipo_monitoreo ? CANAL_LABELS[m.tipo_monitoreo.canal] : "",
      formatFecha(m.fecha_monitoreo),
      ESTADO_LABELS[m.estado],
      m.scores?.score_ecnc  ?? "",
      m.scores?.score_ecneg ?? "",
      m.scores?.score_ecuf  ?? "",
      m.scores?.score_ecc   ?? "",
      m.scores?.score_final ?? "",
    ]);
    const csv  = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `reporte_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reportes y Métricas</h1>
          <p className="text-gray-500 text-sm mt-1">Análisis del sistema de calidad</p>
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
        <Filter size={15} className="text-gray-400" />
        <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        {["ADMIN","SUPER_ADMIN","MINERO"].includes(perfil.rol) && (
          <select value={campanaFiltro} onChange={(e) => setCampanaFiltro(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
            <option value="">Todas las campañas</option>
            {campanas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : metricas ? (
        <div className="space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <KPICard label="Total"      value={metricas.total}      icon={<BarChart3 size={18} />} color="bg-blue-50 text-blue-600" />
            <KPICard label="Aceptados"  value={metricas.aceptados}  icon={<TrendingUp size={18} />} color="bg-green-50 text-green-600" />
            <KPICard label="Refutados"  value={metricas.refutados}  icon={<Users size={18} />} color="bg-orange-50 text-orange-600" />
            <KPICard label="Validados"  value={metricas.validados}  icon={<TrendingUp size={18} />} color="bg-purple-50 text-purple-600" />
            <KPICard
              label="Promedio"
              value={`${metricas.promedioGeneral.toFixed(1)}%`}
              icon={<BarChart3 size={18} />}
              color={
                metricas.promedioGeneral >= 90 ? "bg-green-50 text-green-600" :
                metricas.promedioGeneral >= 70 ? "bg-yellow-50 text-yellow-600" :
                "bg-red-50 text-red-600"
              }
            />
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Por canal */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Por Canal</h3>
              <div className="space-y-3">
                {Object.entries(metricas.porCanal).map(([canal, data]) => (
                  <div key={canal}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-700">{CANAL_LABELS[canal as any] || canal}</span>
                      <span className="text-gray-500">{data.total} · <strong>{data.promedio.toFixed(1)}%</strong></span>
                    </div>
                    <div className="bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${data.promedio >= 90 ? "bg-green-500" : data.promedio >= 70 ? "bg-yellow-500" : "bg-red-500"}`}
                        style={{ width: `${Math.min(data.promedio, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top agentes */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Top Agentes</h3>
              <div className="space-y-3">
                {metricas.top5Agentes.map((agente, i) => (
                  <div key={agente.nombre} className="flex items-center gap-3">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                      ${i === 0 ? "bg-yellow-100 text-yellow-800" : "bg-gray-100 text-gray-600"}`}>
                      {i + 1}
                    </span>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800">{agente.nombre}</p>
                      <p className="text-xs text-gray-500">{agente.total} monitoreos</p>
                    </div>
                    <span className={`text-sm font-bold px-2 py-0.5 rounded-full ${bgColorScore(agente.promedio)}`}>
                      {agente.promedio.toFixed(1)}%
                    </span>
                  </div>
                ))}
                {metricas.top5Agentes.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-4">Sin datos suficientes</p>
                )}
              </div>
            </div>
          </div>

          {/* Tendencia mensual */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Tendencia Mensual</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-2 text-gray-600 font-medium">Período</th>
                    <th className="text-left px-4 py-2 text-gray-600 font-medium">Monitoreos</th>
                    <th className="text-left px-4 py-2 text-gray-600 font-medium">Promedio</th>
                    <th className="text-left px-4 py-2 text-gray-600 font-medium">Barra</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {Object.entries(metricas.porMes).map(([mes, data]) => (
                    <tr key={mes}>
                      <td className="px-4 py-2 font-medium text-gray-800">{mes}</td>
                      <td className="px-4 py-2 text-gray-600">{data.total}</td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${bgColorScore(data.promedio)}`}>
                          {data.promedio.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${data.promedio >= 90 ? "bg-green-500" : data.promedio >= 70 ? "bg-yellow-500" : "bg-red-500"}`}
                            style={{ width: `${Math.min(data.promedio, 100)}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function KPICard({ label, value, icon, color }: {
  label: string; value: string | number; icon: React.ReactNode; color: string;
}) {
  const [bg, text] = color.split(" ");
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center mb-3`}>
        <span className={text}>{icon}</span>
      </div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-xl font-bold text-gray-900 mt-0.5">{value}</p>
    </div>
  );
}
