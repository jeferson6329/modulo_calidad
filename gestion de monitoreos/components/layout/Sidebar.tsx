"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ClipboardList,
  Users,
  BarChart3,
  Settings,
  Shield,
  CheckSquare,
  FileSearch,
  Download,
  Building2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Perfil, RolUsuario } from "@/types";
import { ROL_LABELS } from "@/types";
import { useState } from "react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  roles: RolUsuario[];
}

const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: <LayoutDashboard size={18} />,
    roles: ["AGENTE", "SUPERVISOR", "LIDER_CALIDAD", "MINERO", "ADMIN", "SUPER_ADMIN"],
  },
  {
    label: "Mis Monitoreos",
    href: "/dashboard/monitoreos",
    icon: <ClipboardList size={18} />,
    roles: ["AGENTE"],
  },
  {
    label: "Monitoreos",
    href: "/dashboard/monitoreos",
    icon: <ClipboardList size={18} />,
    roles: ["LIDER_CALIDAD", "SUPERVISOR", "ADMIN", "SUPER_ADMIN"],
  },
  {
    label: "Crear Monitoreo",
    href: "/dashboard/monitoreos/nuevo",
    icon: <CheckSquare size={18} />,
    roles: ["LIDER_CALIDAD"],
  },
  {
    label: "Refutaciones",
    href: "/dashboard/refutaciones",
    icon: <FileSearch size={18} />,
    roles: ["SUPERVISOR"],
  },
  {
    label: "Validaciones",
    href: "/dashboard/validaciones",
    icon: <Shield size={18} />,
    roles: ["LIDER_CALIDAD"],
  },
  {
    label: "Reportes",
    href: "/dashboard/reportes",
    icon: <BarChart3 size={18} />,
    roles: ["MINERO", "ADMIN", "SUPER_ADMIN", "LIDER_CALIDAD", "SUPERVISOR"],
  },
  {
    label: "Descargas",
    href: "/dashboard/descargas",
    icon: <Download size={18} />,
    roles: ["MINERO"],
  },
  {
    label: "Usuarios",
    href: "/dashboard/usuarios",
    icon: <Users size={18} />,
    roles: ["ADMIN", "SUPER_ADMIN"],
  },
  {
    label: "Campañas",
    href: "/dashboard/campanas",
    icon: <Building2 size={18} />,
    roles: ["ADMIN", "SUPER_ADMIN"],
  },
  {
    label: "Configuración",
    href: "/dashboard/configuracion",
    icon: <Settings size={18} />,
    roles: ["ADMIN", "SUPER_ADMIN"],
  },
  {
    label: "Permisos",
    href: "/dashboard/permisos",
    icon: <Shield size={18} />,
    roles: ["SUPER_ADMIN"],
  },
  {
    label: "Auditoría",
    href: "/dashboard/auditoria",
    icon: <Shield size={18} />,
    roles: ["ADMIN", "SUPER_ADMIN"],
  },
  {
    label: "Carga Masiva",
    href: "/dashboard/usuarios/carga-masiva",
    icon: <Users size={18} />,
    roles: ["ADMIN", "SUPER_ADMIN"],
  },
];

export default function Sidebar({ perfil }: { perfil: Perfil }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const navFiltrado = NAV_ITEMS.filter((item) =>
    item.roles.includes(perfil.rol)
  );

  return (
    <aside
      className={cn(
        "bg-[#003087] text-white flex flex-col transition-all duration-300 relative",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-white/10">
        <div className="flex-shrink-0 w-8 h-8 bg-white rounded-lg flex items-center justify-center">
          <span className="text-[#003087] font-bold text-xs">BPM</span>
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="font-bold text-sm leading-tight">Gestión Calidad</p>
            <p className="text-blue-300 text-xs truncate">
              {ROL_LABELS[perfil.rol]}
            </p>
          </div>
        )}
      </div>

      {/* Navegación */}
      <nav className="flex-1 py-4 overflow-y-auto">
        <ul className="space-y-1 px-2">
          {navFiltrado.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));

            return (
              <li key={item.href + item.label}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all",
                    isActive
                      ? "bg-white/20 text-white font-medium"
                      : "text-blue-100 hover:bg-white/10 hover:text-white"
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  <span className="flex-shrink-0">{item.icon}</span>
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Perfil del usuario */}
      {!collapsed && (
        <div className="px-4 py-4 border-t border-white/10">
          <p className="text-white font-medium text-sm truncate">
            {perfil.nombre} {perfil.apellido}
          </p>
          <p className="text-blue-300 text-xs truncate">{perfil.email}</p>
        </div>
      )}

      {/* Botón colapsar */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-[#003087] border border-white/20 rounded-full flex items-center justify-center text-white hover:bg-[#0044aa] transition z-10"
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>
    </aside>
  );
}
