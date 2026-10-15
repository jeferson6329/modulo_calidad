import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import NuevoMonitoreoForm from "@/components/monitoreos/NuevoMonitoreoForm";
import type { Perfil } from "@/types";

export default async function NuevoMonitoreoPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("*, campana:campanas(*)")
    .eq("id", user.id)
    .single();

  if (!perfil || !["LIDER_CALIDAD", "ADMIN", "SUPER_ADMIN"].includes(perfil.rol)) {
    redirect("/dashboard");
  }

  return <NuevoMonitoreoForm perfil={perfil as Perfil} />;
}
