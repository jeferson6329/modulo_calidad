"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Perfil } from "@/types";
import { Users, Building2, ClipboardList, Settings, Shield, BarChart3 } from "lucide-react";
import Link from "next/link";

interface Stats {
  monitoreos: number;
  usuarios: number;
  campanas: number;
  pendientes: number;
}

export default function DashboardAdmin({ perfil }: { perfil: Perfil }) {
  const [stats, setStats] = useState<Stats>({ monitoreos: 0, usuarios: 0, campanas: 0, pendientes: 0 });

  useEffect(() => {
    const cargar = async () => {
      const supabase = createClient();
      const [
        { count: monitoreos },
        { count: usuarios },
        { count: campanas },
        { count: pendientes },
      ] = await Promise.all([
        supabase.from("monitoreos").select("*", { count: "exact", head: true }),
        supabase.from("perfiles").select("*", { count: "exact", head: true }).eq("activo", true),
        supabase.from("campanas").select("*", { count: "exact", head: true }).eq("activa", true),
        supabase.from("monitoreos").select("*", { count: "exact", head: true })
          .in("estado", ["EN_REVISION_ASESOR", "EN_REVISION_SUPERVISOR", "EN_VALIDACION_LIDER"]),
      ]);
      setStats({
        monitoreos: monitoreos || 0,
        usuarios: usuarios || 0,
        campanas: campanas || 0,
        pendientes: pendientes || 0,
      });
    };
    cargar();
  }, []);

  const accesos = [
    { label: "Monitoreos", href: "/dashboard/monitoreos", icon: <ClipboardList size={20} />, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Usuarios", href: "/dashboard/usuarios", icon: <Users size={20} />, color: "text-purple-600", bg: "bg-purple-50" },
    { label: "Campañas", href: "/dashboard/campanas", icon: <Building2 size={20} />, color: "text-orange-600", bg: "bg-orange-50" },
    { label: "Reportes", href: "/dashboard/reportes", icon: <BarChart3 size={20} />, color: "text-green-600", bg: "bg-green-50" },
    { label: "Configuración", href: "/dashboard/configuracion", icon: <Settings size={20} />, color: "text-gray-600", bg: "bg-gray-100" },
    ...(perfil.rol === "SUPER_ADMIN"
      ? [{ label: "Permisos", href: "/dashboard/permisos", icon: <Shield size={20} />, color: "text-red-600", bg: "bg-red-50" }]
      : []),
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {perfil.rol === "SUPER_ADMIN" ? "Super Admin" : "Administrador"}
        </h1>
        <p className="text-gray-500 text-sm mt-1">{perfil.nombre} {perfil.apellido}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={<ClipboardList className="text-blue-600" />} label="Total monitoreos" value={stats.monitoreos} color="bg-blue-50" />
        <StatCard icon={<Users className="text-purple-600" />} label="Usuarios activos" value={stats.usuarios} color="bg-purple-50" />
        <StatCard icon={<Building2 className="text-orange-600" />} label="Campañas activas" value={stats.campanas} color="bg-orange-50" />
        <StatCard icon={<ClipboardList className="text-yellow-600" />} label="En proceso" value={stats.pendientes} color="bg-yellow-50" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {accesos.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="bg-white border border-gray-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-md transition flex items-center gap-4"
          >
            <div className={`${a.bg} w-12 h-12 rounded-xl flex items-center justify-center`}>
              <span className={a.color}>{a.icon}</span>
            </div>
            <span className="font-medium text-gray-800">{a.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
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
