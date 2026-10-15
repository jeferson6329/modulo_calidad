"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Bell, LogOut, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Perfil, Notificacion } from "@/types";
import { ROL_LABELS } from "@/types";
import { tiempoRelativo } from "@/lib/utils";
import Link from "next/link";

export default function Header({ perfil }: { perfil: Perfil }) {
  const router = useRouter();
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [showNotif, setShowNotif] = useState(false);
  const [showUser, setShowUser] = useState(false);

  useEffect(() => {
    const cargar = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("notificaciones")
        .select("*, monitoreo:monitoreos(numero_monitoreo)")
        .eq("usuario_id", perfil.id)
        .eq("leida", false)
        .order("created_at", { ascending: false })
        .limit(10);
      if (data) setNotificaciones(data);
    };
    cargar();
  }, [perfil.id]);

  const marcarLeidas = async () => {
    const supabase = createClient();
    await supabase
      .from("notificaciones")
      .update({ leida: true })
      .eq("usuario_id", perfil.id)
      .eq("leida", false);
    setNotificaciones([]);
    setShowNotif(false);
  };

  const logout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
      <div>
        <h2 className="text-sm font-medium text-gray-500">
          {ROL_LABELS[perfil.rol]}
        </h2>
      </div>

      <div className="flex items-center gap-3">
        {/* Notificaciones */}
        <div className="relative">
          <button
            onClick={() => { setShowNotif(!showNotif); setShowUser(false); }}
            className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
          >
            <Bell size={20} />
            {notificaciones.length > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                {notificaciones.length > 9 ? "9+" : notificaciones.length}
              </span>
            )}
          </button>

          {showNotif && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-gray-200 rounded-xl shadow-lg z-50">
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <h3 className="font-semibold text-sm">Notificaciones</h3>
                {notificaciones.length > 0 && (
                  <button
                    onClick={marcarLeidas}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Marcar todas como leídas
                  </button>
                )}
              </div>
              <div className="max-h-72 overflow-y-auto">
                {notificaciones.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-6">
                    Sin notificaciones nuevas
                  </p>
                ) : (
                  notificaciones.map((n) => (
                    <div
                      key={n.id}
                      className="px-4 py-3 border-b hover:bg-gray-50 last:border-0"
                    >
                      <p className="text-sm font-medium text-gray-800">{n.titulo}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{n.mensaje}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {tiempoRelativo(n.created_at)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Usuario */}
        <div className="relative">
          <button
            onClick={() => { setShowUser(!showUser); setShowNotif(false); }}
            className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 rounded-lg transition"
          >
            <div className="w-8 h-8 bg-[#003087] rounded-full flex items-center justify-center text-white text-sm font-bold">
              {perfil.nombre[0]}{perfil.apellido[0]}
            </div>
            <div className="hidden md:block text-left">
              <p className="text-sm font-medium text-gray-800 leading-tight">
                {perfil.nombre} {perfil.apellido}
              </p>
              <p className="text-xs text-gray-500">{ROL_LABELS[perfil.rol]}</p>
            </div>
          </button>

          {showUser && (
            <div className="absolute right-0 top-full mt-2 w-52 bg-white border border-gray-200 rounded-xl shadow-lg z-50 py-1">
              <Link
                href="/dashboard/perfil"
                className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                onClick={() => setShowUser(false)}
              >
                <User size={16} />
                Mi perfil
              </Link>
              <hr className="my-1" />
              <button
                onClick={logout}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
              >
                <LogOut size={16} />
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
