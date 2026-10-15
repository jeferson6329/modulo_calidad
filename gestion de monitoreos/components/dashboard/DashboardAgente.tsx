"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Monitoreo, Perfil } from "@/types";
import { ESTADO_LABELS, ESTADO_COLORES } from "@/types";
import { formatFecha, formatScore } from "@/lib/utils";
import { bgColorScore } from "@/lib/scoring";
import { ClipboardList, CheckCircle, Clock, AlertTriangle } from "lucide-react";
import Link from "next/link";

export default function DashboardAgente({ perfil }: { perfil: Perfil }) {
  const [monitoreos, setMonitoreos] = useState<Monitoreo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cargar = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("monitoreos")
        .select(`
          *,
          campana:campanas(nombre),
          tipo_monitoreo:tipos_monitoreo(canal, nombre),
          lider:perfiles!monitoreos_lider_id_fkey(nombre, apellido),
          scores:monitoreos_scores(score_final)
        `)
        .eq("agente_id", perfil.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (data) setMonitoreos(data as Monitoreo[]);
      setLoading(false);
    };
    cargar();
  }, [perfil.id]);

  const pendientes   = monitoreos.filter((m) => ["CREADO","EN_REVISION_ASESOR"].includes(m.estado)).length;
  const finalizados  = monitoreos.filter((m) => ["ACEPTADO","VALIDADO"].includes(m.estado)).length;
  const conScore     = monitoreos.filter((m) => m.scores?.score_final != null);
  const promedioScore = conScore.length
    ? conScore.reduce((acc, m) => acc + (m.scores!.score_final), 0) / conScore.length
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Bienvenido, {perfil.nombre} 👋
        </h1>
        <p className="text-gray-500 text-sm mt-1">Aquí tienes un resumen de tus monitoreos</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={<ClipboardList className="text-blue-600" />}   label="Total"      value={monitoreos.length}           color="bg-blue-50" />
        <StatCard icon={<Clock className="text-yellow-600" />}          label="Pendientes" value={pendientes}                  color="bg-yellow-50" />
        <StatCard icon={<CheckCircle className="text-green-600" />}     label="Finalizados" value={finalizados}                color="bg-green-50" />
        <StatCard icon={<AlertTriangle className="text-purple-600" />}  label="Promedio"   value={`${promedioScore.toFixed(1)}%`} color="bg-purple-50" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Mis Monitoreos</h2>
          <Link href="/dashboard/monitoreos" className="text-sm text-blue-600 hover:underline">
            Ver todos
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : monitoreos.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <ClipboardList size={40} className="mx-auto mb-3 opacity-40" />
            <p>No tienes monitoreos aún</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">N° Monitoreo</th>
                  <th className="text-left px-4 py-3 font-medium">Campaña</th>
                  <th className="text-left px-4 py-3 font-medium">Fecha</th>
                  <th className="text-left px-4 py-3 font-medium">Estado</th>
                  <th className="text-left px-4 py-3 font-medium">Nota</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {monitoreos.slice(0, 10).map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 font-medium text-blue-700">{m.numero_monitoreo}</td>
                    <td className="px-4 py-3 text-gray-600">{m.campana?.nombre || "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{formatFecha(m.fecha_monitoreo)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${ESTADO_COLORES[m.estado]}`}>
                        {ESTADO_LABELS[m.estado]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {m.scores?.score_final != null ? (
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${bgColorScore(m.scores.score_final)}`}>
                          {formatScore(m.scores.score_final)}
                        </span>
                      ) : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/monitoreos/${m.id}`} className="text-xs text-blue-600 hover:underline">Ver</Link>
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

function StatCard({ icon, label, value, color }: {
  icon: React.ReactNode; label: string; value: string | number; color: string;
}) {
  return (
    <div className={`${color} rounded-xl p-4 flex items-center gap-3`}>
      <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm">{icon}</div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );
}
