"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2, ShieldAlert, CheckCircle } from "lucide-react";

const schema = z
  .object({
    password: z
      .string()
      .min(8, "Mínimo 8 caracteres")
      .regex(/[A-Z]/, "Debe tener al menos una mayúscula")
      .regex(/[0-9]/, "Debe tener al menos un número"),
    confirmar: z.string(),
  })
  .refine((d) => d.password === d.confirmar, {
    message: "Las contraseñas no coinciden",
    path: ["confirmar"],
  });

type FormData = z.infer<typeof schema>;

export default function CambiarContrasenaPage() {
  const router = useRouter();
  const [show, setShow]       = useState(false);
  const [showC, setShowC]     = useState(false);
  const [loading, setLoading] = useState(false);
  const [listo, setListo]     = useState(false);
  const [error, setError]     = useState("");

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    setError("");

    const supabase = createClient();

    // Actualizar contraseña en Supabase Auth
    const { error: authErr } = await supabase.auth.updateUser({
      password: data.password,
    });

    if (authErr) {
      setError("Error al actualizar la contraseña: " + authErr.message);
      setLoading(false);
      return;
    }

    // Actualizar política de contraseña
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const ahora = new Date();
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
        .eq("usuario_id", user.id);
    }

    setListo(true);
    setTimeout(() => router.push("/dashboard"), 2000);
  };

  const password = watch("password", "");
  const requisitos = [
    { label: "Mínimo 8 caracteres",   ok: password.length >= 8 },
    { label: "Al menos una mayúscula", ok: /[A-Z]/.test(password) },
    { label: "Al menos un número",     ok: /[0-9]/.test(password) },
  ];

  if (listo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#003087] to-[#0066CC] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-10 text-center space-y-4 w-full max-w-md">
          <CheckCircle size={52} className="text-green-500 mx-auto" />
          <h2 className="text-xl font-bold text-gray-900">¡Contraseña actualizada!</h2>
          <p className="text-gray-500 text-sm">Redirigiendo al dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#003087] via-[#0050b3] to-[#0066CC] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Cabecera */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-white rounded-2xl shadow-lg mb-3">
            <span className="text-[#003087] font-bold text-xl">BPM</span>
          </div>
          <p className="text-blue-200 text-sm">Sistema de Gestión de Calidad</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Banner de aviso */}
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
            <ShieldAlert className="text-amber-600 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="font-semibold text-amber-900 text-sm">
                Debes cambiar tu contraseña
              </p>
              <p className="text-amber-700 text-xs mt-0.5">
                Tu contraseña ha expirado o fue restablecida por un administrador.
                Debes crear una nueva antes de continuar.
              </p>
            </div>
          </div>

          <h2 className="text-xl font-bold text-gray-900 mb-1">Crear nueva contraseña</h2>
          <p className="text-gray-500 text-sm mb-6">
            Elige una contraseña segura que no hayas usado antes.
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Nueva contraseña */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nueva contraseña
              </label>
              <div className="relative">
                <input
                  {...register("password")}
                  type={show ? "text" : "password"}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#003087] pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && (
                <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>
              )}
            </div>

            {/* Indicador de requisitos */}
            {password.length > 0 && (
              <ul className="bg-gray-50 rounded-lg px-4 py-3 space-y-1.5">
                {requisitos.map((r) => (
                  <li
                    key={r.label}
                    className={`flex items-center gap-2 text-xs transition-colors ${
                      r.ok ? "text-green-600 font-medium" : "text-gray-400"
                    }`}
                  >
                    <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      r.ok ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-500"
                    }`}>
                      {r.ok ? "✓" : "○"}
                    </span>
                    {r.label}
                  </li>
                ))}
              </ul>
            )}

            {/* Confirmar */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirmar contraseña
              </label>
              <div className="relative">
                <input
                  {...register("confirmar")}
                  type={showC ? "text" : "password"}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#003087] pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowC(!showC)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showC ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.confirmar && (
                <p className="text-red-500 text-xs mt-1">{errors.confirmar.message}</p>
              )}
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#003087] hover:bg-[#002060] text-white font-semibold py-2.5 rounded-lg transition flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {loading ? "Guardando..." : "Guardar nueva contraseña"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
