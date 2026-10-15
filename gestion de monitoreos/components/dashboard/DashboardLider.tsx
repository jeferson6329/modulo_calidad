"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Monitoreo, Perfil } from "@/types";
import { ESTADO_LABELS, ESTADO_COLORES } from "@/types";
import { formatFecha, formatScore } from "@/lib/utils";
import { bgColorScore } from "@/lib/scoring";
import { ClipboardList, Plus, Shield, AlertTriangle, CheckCircle } from "lucide-react";
import Link from "next/link";

export default function DashboardLider({ perfil }: { perfil: Perfil }) {
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
          agente:perfiles!monitoreos_agente_id_fkey(nombre, apellido),
          scores:monitoreos_scores(score_final)
        `)
        .eq("lider_id", perfil.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (data) setMonitoreos(data as Monitoreo[]);
      setLoading(false);
    };
    cargar();
  }, [perfil.id]);

  const pendientesValidacion = monitoreos.filter((m) => m.estado === "EN_VALIDACION_LIDER").length;
  const enRevision           = monitoreos.filter((m) => m.estado === "EN_REVISION_ASESOR").length;
  const finalizados          = monitoreos.filter((m) => ["ACEPTADO","VALIDADO"].includes(m.estado)).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Líder de Calidad — {perfil.nombre} {perfil.apellido}</p>
        </div>
        <Link
          href="/dashboard/monitoreos/nuevo"
          className="flex items-center gap-2 bg-[#003087] hover:bg-[#002060] text-white px-4 py-2.5 rounded-lg text-sm font-medium transition"
        >
          <Plus size={16} />
          Nuevo Monitoreo
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={<ClipboardList className="text-blue-600" />}   label="Total creados"     value={monitoreos.length}          color="bg-blue-50" />
        <StatCard icon={<AlertTriangle className="text-yellow-600" />}  label="En revisión"       value={enRevision}                 color="bg-yellow-50" />
        <StatCard icon={<Shield className="text-purple-600" />}         label="Pend. validación"  value={pendientesValidacion}       color="bg-purple-50" />
        <StatCard icon={<CheckCircle className="text-green-600" />}     label="Finalizados"       value={finalizados}                color="bg-green-50" />
      </div>

      {pendientesValidacion > 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 flex items-center gap-3">
          <Shield className="text-purple-600" size={20} />
          <p className="flex-1 font-medium text-purple-800">
            Tienes {pendientesValidacion} monitoreo{pendientesValidacion > 1 ? "s" : ""} pendiente{pendientesValidacion > 1 ? "s" : ""} de validación final
          </p>
          <Link href="/dashboard/validaciones" className="text-sm font-medium text-purple-700 hover:underline">
            Ir a validaciones
          </Link>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Monitoreos recientes</h2>
          <Link href="/dashboard/monitoreos" className="text-sm text-blue-600 hover:underline">Ver todos</Link>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">N°</th>
                  <th className="text-left px-4 py-3 font-medium">Agente</th>
                  <th className="text-left px-4 py-3 font-medium">Canal</th>
                  <th className="text-left px-4 py-3 font-medium">Fecha</th>
                  <th className="text-left px-4 py-3 font-medium">Estado</th>
                  <th className="text-left px-4 py-3 font-medium">Nota</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {monitoreos.slice(0, 15).map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-blue-700">{m.numero_monitoreo}</td>
                    <td className="px-4 py-3 text-gray-700">{m.agente?.nombre} {m.agente?.apellido}</td>
                    <td className="px-4 py-3 text-gray-600">{m.tipo_monitoreo?.nombre}</td>
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
