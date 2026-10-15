"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Perfil, PoliticaContrasena } from "@/types";
import { ROL_LABELS } from "@/types";
import { formatFecha } from "@/lib/utils";
import {
  User, Shield, Key, CheckCircle, AlertTriangle,
  Eye, EyeOff, Loader2, Save,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const schemaPerfil = z.object({
  nombre:   z.string().min(1, "Requerido"),
  apellido: z.string().min(1, "Requerido"),
});

const schemaPassword = z
  .object({
    actual:    z.string().min(1, "Requerida"),
    nueva:     z.string()
      .min(8, "Mínimo 8 caracteres")
      .regex(/[A-Z]/, "Debe tener al menos una mayúscula")
      .regex(/[0-9]/, "Debe tener al menos un número"),
    confirmar: z.string(),
  })
  .refine((d) => d.nueva === d.confirmar, {
    message: "Las contraseñas no coinciden",
    path: ["confirmar"],
  });

type PerfilForm    = z.infer<typeof schemaPerfil>;
type PasswordForm  = z.infer<typeof schemaPassword>;

export default function PerfilPanel({
  perfil,
  politica,
}: {
  perfil:   Perfil;
  politica: PoliticaContrasena | null;
}) {
  const [tab, setTab] = useState<"info" | "seguridad">("info");

  // ── Estado tab info ──
  const [guardandoInfo, setGuardandoInfo]   = useState(false);
  const [okInfo, setOkInfo]                 = useState(false);
  const [errorInfo, setErrorInfo]           = useState("");

  // ── Estado tab seguridad ──
  const [showActual, setShowActual]         = useState(false);
  const [showNueva, setShowNueva]           = useState(false);
  const [showConf, setShowConf]             = useState(false);
  const [guardandoPwd, setGuardandoPwd]     = useState(false);
  const [okPwd, setOkPwd]                   = useState(false);
  const [errorPwd, setErrorPwd]             = useState("");

  const formInfo = useForm<PerfilForm>({
    resolver: zodResolver(schemaPerfil),
    defaultValues: { nombre: perfil.nombre, apellido: perfil.apellido },
  });

  const formPwd = useForm<PasswordForm>({ resolver: zodResolver(schemaPassword) });

  // Días para expiración
  const diasExpiracion = politica?.expira_en
    ? Math.max(0, Math.floor(
        (new Date(politica.expira_en).getTime() - Date.now()) / 86_400_000
      ))
    : null;

  const contrasenaExpirando = diasExpiracion != null && diasExpiracion <= 15;
  const contrasenaExpirada  = diasExpiracion != null && diasExpiracion <= 0;

  // ── Guardar nombre/apellido ──────────────────────────────────
  const onGuardarInfo = async (data: PerfilForm) => {
    setGuardandoInfo(true);
    setErrorInfo("");
    const supabase = createClient();
    const { error } = await supabase
      .from("perfiles")
      .update({ nombre: data.nombre, apellido: data.apellido })
      .eq("id", perfil.id);

    if (error) setErrorInfo("Error al guardar: " + error.message);
    else setOkInfo(true);
    setGuardandoInfo(false);
  };

  // ── Cambiar contraseña ───────────────────────────────────────
  const onCambiarPwd = async (data: PasswordForm) => {
    setGuardandoPwd(true);
    setErrorPwd("");
    const supabase = createClient();

    // Verificar contraseña actual reautenticando
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) { setErrorPwd("Sesión inválida"); setGuardandoPwd(false); return; }

    const { error: signErr } = await supabase.auth.signInWithPassword({
      email:    user.email,
      password: data.actual,
    });

    if (signErr) {
      setErrorPwd("La contraseña actual es incorrecta.");
      setGuardandoPwd(false);
      return;
    }

    // Actualizar contraseña
    const { error: updErr } = await supabase.auth.updateUser({
      password: data.nueva,
    });

    if (updErr) {
      setErrorPwd("Error al actualizar: " + updErr.message);
      setGuardandoPwd(false);
      return;
    }

    // Actualizar política
    const ahora  = new Date();
    const expira = new Date(ahora);
    expira.setDate(expira.getDate() + 90);

    await supabase
      .from("politica_contrasena_usuario")
      .update({
        debe_cambiar:         false,
        ultima_actualizacion: ahora.toISOString(),
        expira_en:            expira.toISOString(),
        intentos_fallidos:    0,
        bloqueado_hasta:      null,
      })
      .eq("usuario_id", perfil.id);

    formPwd.reset();
    setOkPwd(true);
    setGuardandoPwd(false);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mi Perfil</h1>
        <p className="text-gray-500 text-sm mt-1">
          Gestiona tu información personal y seguridad
        </p>
      </div>

      {/* Tarjeta de identidad */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 flex items-center gap-5">
        <div className="w-16 h-16 bg-[#003087] rounded-2xl flex items-center justify-center
                        text-white text-2xl font-bold flex-shrink-0">
          {perfil.nombre[0]}{perfil.apellido[0]}
        </div>
        <div className="flex-1">
          <p className="text-lg font-bold text-gray-900">
            {perfil.nombre} {perfil.apellido}
          </p>
          <p className="text-gray-500 text-sm">{perfil.email}</p>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
              {ROL_LABELS[perfil.rol]}
            </span>
            {perfil.cedula && (
              <span className="text-gray-400 text-xs">CC: {perfil.cedula}</span>
            )}
            {(perfil as any).campana?.nombre && (
              <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">
                {(perfil as any).campana.nombre}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Alerta de contraseña */}
      {contrasenaExpirada && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="text-red-600" size={18} />
          <p className="text-red-800 text-sm font-medium">
            Tu contraseña ha expirado. Cámbiala ahora para mantener el acceso.
          </p>
        </div>
      )}
      {contrasenaExpirando && !contrasenaExpirada && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="text-amber-600" size={18} />
          <p className="text-amber-800 text-sm">
            Tu contraseña expira en <strong>{diasExpiracion} días</strong>. Te recomendamos cambiarla pronto.
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex border-b border-gray-200">
          {[
            { key: "info",      label: "Información",  icon: <User size={15} /> },
            { key: "seguridad", label: "Seguridad",     icon: <Shield size={15} /> },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as any)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition ${
                tab === t.key
                  ? "border-b-2 border-[#003087] text-[#003087]"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* ── Tab: Información ── */}
          {tab === "info" && (
            <form onSubmit={formInfo.handleSubmit(onGuardarInfo)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                  <input
                    {...formInfo.register("nombre")}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]"
                  />
                  {formInfo.formState.errors.nombre && (
                    <p className="text-red-500 text-xs mt-1">{formInfo.formState.errors.nombre.message}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Apellido</label>
                  <input
                    {...formInfo.register("apellido")}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]"
                  />
                  {formInfo.formState.errors.apellido && (
                    <p className="text-red-500 text-xs mt-1">{formInfo.formState.errors.apellido.message}</p>
                  )}
                </div>
              </div>

              {/* Campos de solo lectura */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  value={perfil.email}
                  disabled
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-gray-50 text-gray-500 cursor-not-allowed"
                />
                <p className="text-xs text-gray-400 mt-1">El email no puede modificarse desde aquí.</p>
              </div>

              {errorInfo && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
                  {errorInfo}
                </div>
              )}

              {okInfo ? (
                <div className="flex items-center gap-2 text-green-600 text-sm">
                  <CheckCircle size={16} /> Información guardada correctamente
                </div>
              ) : (
                <button
                  type="submit"
                  disabled={guardandoInfo}
                  className="flex items-center gap-2 bg-[#003087] hover:bg-[#002060] text-white px-5 py-2.5 rounded-lg text-sm font-medium transition disabled:opacity-70"
                >
                  {guardandoInfo
                    ? <><Loader2 size={15} className="animate-spin" /> Guardando...</>
                    : <><Save size={15} /> Guardar cambios</>
                  }
                </button>
              )}
            </form>
          )}

          {/* ── Tab: Seguridad ── */}
          {tab === "seguridad" && (
            <div className="space-y-6">
              {/* Info de política */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2 mb-3">
                  <Key size={16} className="text-gray-500" />
                  <span className="text-sm font-semibold text-gray-700">Estado de tu contraseña</span>
                </div>
                {politica && (
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-gray-500 text-xs">Última actualización</p>
                      <p className="font-medium text-gray-800">
                        {formatFecha(politica.ultima_actualizacion)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Expira el</p>
                      <p className={`font-medium ${contrasenaExpirada ? "text-red-600" : contrasenaExpirando ? "text-amber-600" : "text-gray-800"}`}>
                        {formatFecha(politica.expira_en)}
                        {diasExpiracion != null && diasExpiracion > 0
                          ? ` (${diasExpiracion} días)`
                          : diasExpiracion === 0 ? " (hoy)" : " (expirada)"}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Formulario de cambio */}
              <form onSubmit={formPwd.handleSubmit(onCambiarPwd)} className="space-y-4">
                <h3 className="font-semibold text-gray-900 text-sm">Cambiar contraseña</h3>

                {/* Contraseña actual */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Contraseña actual
                  </label>
                  <div className="relative">
                    <input
                      {...formPwd.register("actual")}
                      type={showActual ? "text" : "password"}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#003087] pr-10"
                    />
                    <button type="button" onClick={() => setShowActual(!showActual)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                      {showActual ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {formPwd.formState.errors.actual && (
                    <p className="text-red-500 text-xs mt-1">{formPwd.formState.errors.actual.message}</p>
                  )}
                </div>

                {/* Nueva contraseña */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nueva contraseña
                  </label>
                  <div className="relative">
                    <input
                      {...formPwd.register("nueva")}
                      type={showNueva ? "text" : "password"}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#003087] pr-10"
                    />
                    <button type="button" onClick={() => setShowNueva(!showNueva)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                      {showNueva ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {formPwd.formState.errors.nueva && (
                    <p className="text-red-500 text-xs mt-1">{formPwd.formState.errors.nueva.message}</p>
                  )}
                </div>

                {/* Confirmar */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Confirmar nueva contraseña
                  </label>
                  <div className="relative">
                    <input
                      {...formPwd.register("confirmar")}
                      type={showConf ? "text" : "password"}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#003087] pr-10"
                    />
                    <button type="button" onClick={() => setShowConf(!showConf)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                      {showConf ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {formPwd.formState.errors.confirmar && (
                    <p className="text-red-500 text-xs mt-1">{formPwd.formState.errors.confirmar.message}</p>
                  )}
                </div>

                {errorPwd && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
                    {errorPwd}
                  </div>
                )}

                {okPwd ? (
                  <div className="flex items-center gap-2 text-green-600 text-sm">
                    <CheckCircle size={16} /> Contraseña actualizada. Vigente 90 días.
                  </div>
                ) : (
                  <button
                    type="submit"
                    disabled={guardandoPwd}
                    className="flex items-center gap-2 bg-[#003087] hover:bg-[#002060] text-white px-5 py-2.5 rounded-lg text-sm font-medium transition disabled:opacity-70"
                  >
                    {guardandoPwd
                      ? <><Loader2 size={15} className="animate-spin" /> Actualizando...</>
                      : <><Key size={15} /> Actualizar contraseña</>
                    }
                  </button>
                )}
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
