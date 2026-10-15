"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Perfil } from "@/types";
import { BarChart3, Download, TrendingUp, Users } from "lucide-react";
import Link from "next/link";

interface Stats {
  total: number;
  promedio: number;
  agentes: number;
  campanas: number;
}

export default function DashboardMinero({ perfil }: { perfil: Perfil }) {
  const [stats, setStats] = useState<Stats>({ total: 0, promedio: 0, agentes: 0, campanas: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cargar = async () => {
      const supabase = createClient();

      const [{ count: total }, { data: scores }, { count: agentes }, { count: campanas }] =
        await Promise.all([
          supabase.from("monitoreos").select("*", { count: "exact", head: true }),
          supabase.from("monitoreos").select("score_final").not("score_final", "is", null),
          supabase.from("perfiles").select("*", { count: "exact", head: true }).eq("rol", "AGENTE"),
          supabase.from("campanas").select("*", { count: "exact", head: true }).eq("activa", true),
        ]);

      const promedio =
        scores && scores.length > 0
          ? scores.reduce((acc, m) => acc + (m.score_final || 0), 0) / scores.length
          : 0;

      setStats({
        total: total || 0,
        promedio: Math.round(promedio * 100) / 100,
        agentes: agentes || 0,
        campanas: campanas || 0,
      });
      setLoading(false);
    };
    cargar();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard Minero</h1>
        <p className="text-gray-500 text-sm mt-1">
          Métricas y análisis del sistema — {perfil.nombre} {perfil.apellido}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={<BarChart3 className="text-blue-600" />} label="Total monitoreos" value={stats.total} color="bg-blue-50" />
        <StatCard icon={<TrendingUp className="text-green-600" />} label="Promedio general" value={`${stats.promedio.toFixed(1)}%`} color="bg-green-50" />
        <StatCard icon={<Users className="text-purple-600" />} label="Agentes activos" value={stats.agentes} color="bg-purple-50" />
        <StatCard icon={<BarChart3 className="text-orange-600" />} label="Campañas activas" value={stats.campanas} color="bg-orange-50" />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Link
          href="/dashboard/reportes"
          className="bg-white border border-gray-200 rounded-xl p-6 hover:border-blue-300 hover:shadow-md transition group"
        >
          <BarChart3 className="text-blue-600 mb-3 group-hover:scale-110 transition" size={28} />
          <h3 className="font-semibold text-gray-900">Ver Reportes</h3>
          <p className="text-sm text-gray-500 mt-1">
            Estadísticas por campaña, agente, período y canal
          </p>
        </Link>

        <Link
          href="/dashboard/descargas"
          className="bg-white border border-gray-200 rounded-xl p-6 hover:border-blue-300 hover:shadow-md transition group"
        >
          <Download className="text-blue-600 mb-3 group-hover:scale-110 transition" size={28} />
          <h3 className="font-semibold text-gray-900">Descargar Datos</h3>
          <p className="text-sm text-gray-500 mt-1">
            Exportar monitoreos en Excel o PDF masivo
          </p>
        </Link>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: string }) {
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
