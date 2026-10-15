"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClient } from "@/lib/supabase/client";
import { Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";

const schema = z.object({
  email: z.string().email("Email inválido"),
});

type FormData = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSent(true);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#003087] via-[#0050b3] to-[#0066CC] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <Link href="/login" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6">
            <ArrowLeft size={16} /> Volver al login
          </Link>

          <h2 className="text-xl font-bold text-gray-900 mb-2">Recuperar contraseña</h2>
          <p className="text-gray-500 text-sm mb-6">
            Ingresa tu email y te enviaremos un enlace para restablecer tu contraseña.
          </p>

          {sent ? (
            <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-4 rounded-lg text-center">
              ✅ Revisa tu correo. Te enviamos un enlace de recuperación.
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Correo electrónico
                </label>
                <input
                  {...register("email")}
                  type="email"
                  placeholder="tu@email.com"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#003087] transition"
                />
                {errors.email && (
                  <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>
                )}
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#003087] hover:bg-[#002060] text-white font-semibold py-2.5 rounded-lg transition flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {loading && <Loader2 size={16} className="animate-spin" />}
                Enviar enlace
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
