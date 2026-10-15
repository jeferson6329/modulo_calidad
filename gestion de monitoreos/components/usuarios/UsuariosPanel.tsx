"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Perfil, RolUsuario } from "@/types";
import { ROL_LABELS } from "@/types";
import { Users, Edit2, X, Check, Search, Key, Loader2, ShieldOff, ShieldCheck } from "lucide-react";

export default function UsuariosPanel({ perfil: adminPerfil }: { perfil: Perfil }) {
  const [usuarios, setUsuarios]       = useState<Perfil[]>([]);
  const [campanas, setCampanas]       = useState<{ id: string; nombre: string }[]>([]);
  const [loading, setLoading]         = useState(true);
  const [busqueda, setBusqueda]       = useState("");
  const [editando, setEditando]       = useState<Perfil | null>(null);
  const [guardando, setGuardando]     = useState(false);
  // Restablecimiento de contraseña
  const [modalReset, setModalReset]   = useState<Perfil | null>(null);
  const [motivoReset, setMotivoReset] = useState("");
  const [resetLoading, setResetLoad]  = useState(false);
  const [resetOk, setResetOk]         = useState(false);

  const cargar = async () => {
    const supabase = createClient();
    const [{ data: u }, { data: c }] = await Promise.all([
      supabase
        .from("perfiles")
        .select("*, campana:campanas(nombre)")
        .order("created_at", { ascending: false }),
      supabase.from("campanas").select("id, nombre").eq("activa", true),
    ]);
    if (u) setUsuarios(u as Perfil[]);
    if (c) setCampanas(c);
    setLoading(false);
  };

  useEffect(() => { cargar(); }, []);

  const usuariosFiltrados = usuarios.filter((u) => {
    if (!busqueda) return true;
    const b = busqueda.toLowerCase();
    return (
      u.nombre.toLowerCase().includes(b) ||
      u.apellido.toLowerCase().includes(b) ||
      u.email.toLowerCase().includes(b) ||
      (u.cedula || "").includes(b) ||
      (u.id_agente || "").includes(b)
    );
  });

  const guardarCambios = async () => {
    if (!editando) return;
    setGuardando(true);
    const supabase = createClient();
    await supabase
      .from("perfiles")
      .update({
        rol:        editando.rol,
        campana_id: editando.campana_id || null,
        activo:     editando.activo,
      })
      .eq("id", editando.id);
    setEditando(null);
    setGuardando(false);
    cargar();
  };

  const toggleActivo = async (usuario: Perfil) => {
    const supabase = createClient();
    await supabase
      .from("perfiles")
      .update({ activo: !usuario.activo })
      .eq("id", usuario.id);
    cargar();
  };

  const confirmarReset = async () => {
    if (!modalReset) return;
    setResetLoad(true);
    try {
      const res = await fetch("/api/auth/restablecer-contrasena", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          usuarioId: modalReset.id,
          motivo:    motivoReset || "Restablecimiento solicitado por administrador",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al restablecer");
      setResetOk(true);
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setResetLoad(false);
    }
  };

  const cerrarModalReset = () => {
    setModalReset(null);
    setMotivoReset("");
    setResetOk(false);
  };

  const ROLES: RolUsuario[] = [
    "AGENTE", "SUPERVISOR", "LIDER_CALIDAD", "MINERO", "ADMIN", "SUPER_ADMIN",
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Usuarios</h1>
          <p className="text-gray-500 text-sm mt-1">
            {usuariosFiltrados.length} usuario{usuariosFiltrados.length !== 1 ? "s" : ""}
          </p>
        </div>
        <a
          href="/dashboard/usuarios/carga-masiva"
          className="flex items-center gap-2 bg-[#003087] hover:bg-[#002060] text-white px-4 py-2.5 rounded-lg text-sm font-medium transition"
        >
          <Users size={15} />
          Carga masiva
        </a>
      </div>

      {/* Búsqueda */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-2">
        <Search size={16} className="text-gray-400 flex-shrink-0" />
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre, email, cédula o ID agente..."
          className="flex-1 text-sm outline-none"
        />
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-14">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-600">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Usuario</th>
                  <th className="text-left px-4 py-3 font-medium">Email</th>
                  <th className="text-left px-4 py-3 font-medium">Rol</th>
                  <th className="text-left px-4 py-3 font-medium">Campaña</th>
                  <th className="text-left px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {usuariosFiltrados.map((u) => (
                  <tr
                    key={u.id}
                    className={`hover:bg-gray-50 transition ${!u.activo ? "opacity-50" : ""}`}
                  >
                    {/* Usuario */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-[#003087] rounded-full flex items-center justify-center
                                        text-white text-xs font-bold flex-shrink-0">
                          {u.nombre[0]}{u.apellido[0]}
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">
                            {u.nombre} {u.apellido}
                          </p>
                          {(u.cedula || u.id_agente) && (
                            <p className="text-xs text-gray-400">
                              {u.cedula || u.id_agente}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Email */}
                    <td className="px-4 py-3 text-gray-600 text-xs">{u.email}</td>

                    {/* Rol */}
                    <td className="px-4 py-3">
                      {editando?.id === u.id ? (
                        <select
                          value={editando.rol}
                          onChange={(e) =>
                            setEditando({ ...editando, rol: e.target.value as RolUsuario })
                          }
                          className="border border-gray-300 rounded px-2 py-1 text-xs"
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>{ROL_LABELS[r]}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                          {ROL_LABELS[u.rol]}
                        </span>
                      )}
                    </td>

                    {/* Campaña */}
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {editando?.id === u.id ? (
                        <select
                          value={editando.campana_id || ""}
                          onChange={(e) =>
                            setEditando({ ...editando, campana_id: e.target.value })
                          }
                          className="border border-gray-300 rounded px-2 py-1 text-xs"
                        >
                          <option value="">Sin campaña</option>
                          {campanas.map((c) => (
                            <option key={c.id} value={c.id}>{c.nombre}</option>
                          ))}
                        </select>
                      ) : (
                        (u as any).campana?.nombre || (
                          <span className="text-gray-400">—</span>
                        )
                      )}
                    </td>

                    {/* Estado */}
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        u.activo
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-600"
                      }`}>
                        {u.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>

                    {/* Acciones */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 justify-end">
                        {editando?.id === u.id ? (
                          <>
                            <button
                              onClick={guardarCambios}
                              disabled={guardando}
                              className="p-1.5 bg-green-100 text-green-700 rounded hover:bg-green-200 transition"
                              title="Guardar"
                            >
                              {guardando
                                ? <Loader2 size={13} className="animate-spin" />
                                : <Check size={13} />
                              }
                            </button>
                            <button
                              onClick={() => setEditando(null)}
                              className="p-1.5 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition"
                              title="Cancelar"
                            >
                              <X size={13} />
                            </button>
                          </>
                        ) : (
                          <>
                            {/* Editar rol/campaña */}
                            <button
                              onClick={() => setEditando({ ...u })}
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition"
                              title="Editar"
                            >
                              <Edit2 size={13} />
                            </button>

                            {/* Restablecer contraseña */}
                            <button
                              onClick={() => setModalReset(u)}
                              className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded transition"
                              title="Restablecer contraseña"
                            >
                              <Key size={13} />
                            </button>

                            {/* Activar / Desactivar */}
                            <button
                              onClick={() => toggleActivo(u)}
                              className={`p-1.5 rounded transition ${
                                u.activo
                                  ? "text-gray-400 hover:text-red-600 hover:bg-red-50"
                                  : "text-gray-400 hover:text-green-600 hover:bg-green-50"
                              }`}
                              title={u.activo ? "Desactivar usuario" : "Activar usuario"}
                            >
                              {u.activo
                                ? <ShieldOff size={13} />
                                : <ShieldCheck size={13} />
                              }
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {usuariosFiltrados.length === 0 && !loading && (
              <div className="text-center py-12 text-gray-400">
                <Users size={36} className="mx-auto mb-3 opacity-40" />
                <p className="text-sm">No se encontraron usuarios</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal restablecimiento de contraseña */}
      {modalReset && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            {resetOk ? (
              <div className="text-center space-y-4 py-2">
                <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <Check className="text-green-600" size={28} />
                </div>
                <h3 className="text-lg font-bold text-gray-900">Contraseña restablecida</h3>
                <p className="text-gray-500 text-sm">
                  Se envió un email a <strong>{modalReset.email}</strong> con la
                  contraseña temporal. El usuario deberá cambiarla al iniciar sesión.
                </p>
                <button
                  onClick={cerrarModalReset}
                  className="w-full bg-[#003087] text-white py-2.5 rounded-lg text-sm font-medium"
                >
                  Entendido
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                    <Key className="text-amber-600" size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">Restablecer contraseña</h3>
                    <p className="text-gray-500 text-xs">
                      {modalReset.nombre} {modalReset.apellido} · {modalReset.email}
                    </p>
                  </div>
                </div>

                <p className="text-sm text-gray-600 mb-4">
                  Se generará una contraseña temporal y se enviará por email al usuario.
                  Deberá cambiarla al iniciar sesión.
                </p>

                <div className="mb-5">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Motivo (opcional)
                  </label>
                  <input
                    value={motivoReset}
                    onChange={(e) => setMotivoReset(e.target.value)}
                    placeholder="Ej: Solicitud del agente, olvidó contraseña..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={cerrarModalReset}
                    className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg text-sm hover:bg-gray-50 transition"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={confirmarReset}
                    disabled={resetLoading}
                    className="flex-1 bg-amber-500 hover:bg-amber-600 text-white py-2.5 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2 disabled:opacity-70"
                  >
                    {resetLoading
                      ? <><Loader2 size={15} className="animate-spin" /> Procesando...</>
                      : <><Key size={15} /> Restablecer</>
                    }
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
