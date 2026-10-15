import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import type { Perfil } from "@/types";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("*, campana:campanas(*)")
    .eq("id", user.id)
    .single();

  // Segunda capa de seguridad — el middleware ya maneja esto,
  // pero lo verificamos aquí también por si hay sesiones caché.
  if (!perfil || !perfil.activo) {
    await supabase.auth.signOut();
    redirect("/login?error=cuenta_desactivada");
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar perfil={perfil as Perfil} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header perfil={perfil as Perfil} />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
