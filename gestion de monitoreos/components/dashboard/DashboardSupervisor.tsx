"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Monitoreo, Perfil } from "@/types";
import { ESTADO_LABELS, ESTADO_COLORES } from "@/types";
import { formatFecha, formatScore } from "@/lib/utils";
import { bgColorScore } from "@/lib/scoring";
import { FileSearch, CheckCircle, XCircle, Clock } from "lucide-react";
import Link from "next/link";

export default function DashboardSupervisor({ perfil }: { perfil: Perfil }) {
  const [refutaciones, setRefutaciones] = useState<Monitoreo[]>([]);
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
          agente:perfiles!monitoreos_agente_id_fkey(nombre, apellido),
          lider:perfiles!monitoreos_lider_id_fkey(nombre, apellido),
          scores:monitoreos_scores(score_final)
        `)
        .eq("campana_id", perfil.campana_id || "")
        .in("estado", [
          "EN_REVISION_SUPERVISOR",
          "REFUTACION_APROBADA",
          "REFUTACION_RECHAZADA",
        ])
        .order("created_at", { ascending: false });
      if (data) setRefutaciones(data as Monitoreo[]);
      setLoading(false);
    };
    if (perfil.campana_id) cargar();
    else setLoading(false);
  }, [perfil.campana_id]);

  const pendientes  = refutaciones.filter((m) => m.estado === "EN_REVISION_SUPERVISOR").length;
  const aprobadas   = refutaciones.filter((m) => m.estado === "REFUTACION_APROBADA").length;
  const rechazadas  = refutaciones.filter((m) => m.estado === "REFUTACION_RECHAZADA").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard Supervisor</h1>
        <p className="text-gray-500 text-sm mt-1">{perfil.nombre} {perfil.apellido}</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard icon={<Clock className="text-yellow-600" />}       label="Pendientes" value={pendientes} color="bg-yellow-50" />
        <StatCard icon={<CheckCircle className="text-green-600" />}   label="Aprobadas"  value={aprobadas}  color="bg-green-50" />
        <StatCard icon={<XCircle className="text-red-600" />}         label="Rechazadas" value={rechazadas} color="bg-red-50" />
      </div>

      {pendientes > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center gap-3">
          <FileSearch className="text-orange-600" size={20} />
          <p className="flex-1 font-medium text-orange-800">
            {pendientes} refutación{pendientes > 1 ? "es" : ""} pendiente{pendientes > 1 ? "s" : ""} de tu evaluación
          </p>
          <Link href="/dashboard/refutaciones" className="text-sm font-medium text-orange-700 hover:underline">
            Evaluar ahora
          </Link>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Refutaciones de tu campaña</h2>
          <Link href="/dashboard/refutaciones" className="text-sm text-blue-600 hover:underline">Ver todas</Link>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : refutaciones.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <FileSearch size={40} className="mx-auto mb-3 opacity-40" />
            <p>No hay refutaciones en tu campaña</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">N°</th>
                  <th className="text-left px-4 py-3 font-medium">Agente</th>
                  <th className="text-left px-4 py-3 font-medium">Fecha</th>
                  <th className="text-left px-4 py-3 font-medium">Estado</th>
                  <th className="text-left px-4 py-3 font-medium">Nota</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {refutaciones.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-blue-700">{m.numero_monitoreo}</td>
                    <td className="px-4 py-3">{m.agente?.nombre} {m.agente?.apellido}</td>
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
                      ) : "—"}
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
  icon: React.ReactNode; label: string; value: number; color: string;
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
