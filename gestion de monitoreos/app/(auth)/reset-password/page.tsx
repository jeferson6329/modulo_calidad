"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2, CheckCircle, AlertCircle } from "lucide-react";

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

export default function ResetPasswordPage() {
  const router  = useRouter();
  const [show, setShow]       = useState(false);
  const [showC, setShowC]     = useState(false);
  const [loading, setLoading] = useState(false);
  const [listo, setListo]     = useState(false);
  const [error, setError]     = useState("");
  const [tokenOk, setTokenOk] = useState<boolean | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  // Supabase inyecta el token en el hash de la URL
  useEffect(() => {
    const supabase = createClient();
    const { data: listener } = supabase.auth.onAuthStateChange(
      async (event) => {
        if (event === "PASSWORD_RECOVERY") {
          setTokenOk(true);
        }
      }
    );
    // Si ya tiene sesión activa por el token del email
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setTokenOk(true);
      else setTokenOk(false);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    setError("");
    const supabase = createClient();

    const { error: err } = await supabase.auth.updateUser({
      password: data.password,
    });

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    // Limpiar flag de debe_cambiar en politica_contrasena_usuario
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
    setTimeout(() => router.push("/dashboard"), 2500);
  };

  const password = watch("password", "");
  const requisitos = [
    { label: "Mínimo 8 caracteres",       ok: password.length >= 8 },
    { label: "Al menos una mayúscula",     ok: /[A-Z]/.test(password) },
    { label: "Al menos un número",         ok: /[0-9]/.test(password) },
  ];

  // Token inválido o expirado
  if (tokenOk === false) {
    return (
      <AuthWrap>
        <div className="text-center space-y-4">
          <AlertCircle size={40} className="text-red-500 mx-auto" />
          <h2 className="text-xl font-bold text-gray-900">Enlace inválido o expirado</h2>
          <p className="text-gray-500 text-sm">
            El enlace de recuperación ya no es válido. Solicita uno nuevo.
          </p>
          <a
            href="/forgot-password"
            className="inline-block bg-[#003087] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#002060] transition"
          >
            Solicitar nuevo enlace
          </a>
        </div>
      </AuthWrap>
    );
  }

  // Contraseña actualizada
  if (listo) {
    return (
      <AuthWrap>
        <div className="text-center space-y-4">
          <CheckCircle size={48} className="text-green-500 mx-auto" />
          <h2 className="text-xl font-bold text-gray-900">¡Contraseña actualizada!</h2>
          <p className="text-gray-500 text-sm">
            Redirigiendo al dashboard...
          </p>
        </div>
      </AuthWrap>
    );
  }

  return (
    <AuthWrap>
      <h2 className="text-xl font-bold text-gray-900 mb-1">Nueva contraseña</h2>
      <p className="text-gray-500 text-sm mb-6">
        Elige una contraseña segura para tu cuenta.
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
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#003087] pr-10"
            />
            <button
              type="button"
              onClick={() => setShow(!show)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
            >
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.password && (
            <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>
          )}
        </div>

        {/* Requisitos */}
        {password.length > 0 && (
          <ul className="space-y-1">
            {requisitos.map((r) => (
              <li
                key={r.label}
                className={`flex items-center gap-2 text-xs ${
                  r.ok ? "text-green-600" : "text-gray-400"
                }`}
              >
                <span>{r.ok ? "✓" : "○"}</span>
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
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#003087] pr-10"
            />
            <button
              type="button"
              onClick={() => setShowC(!showC)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
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
          disabled={loading || tokenOk === null}
          className="w-full bg-[#003087] hover:bg-[#002060] text-white font-semibold py-2.5 rounded-lg transition flex items-center justify-center gap-2 disabled:opacity-70"
        >
          {loading && <Loader2 size={16} className="animate-spin" />}
          {loading ? "Guardando..." : "Establecer nueva contraseña"}
        </button>
      </form>
    </AuthWrap>
  );
}

function AuthWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#003087] via-[#0050b3] to-[#0066CC] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-white rounded-2xl shadow-lg mb-3">
            <span className="text-[#003087] font-bold text-xl">BPM</span>
          </div>
          <p className="text-blue-200 text-sm">Sistema de Gestión de Calidad</p>
        </div>
        <div className="bg-white rounded-2xl shadow-xl p-8">{children}</div>
      </div>
    </div>
  );
}
