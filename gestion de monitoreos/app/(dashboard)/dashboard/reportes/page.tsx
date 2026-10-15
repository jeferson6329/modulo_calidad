import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ReportesPanel from "@/components/reportes/ReportesPanel";
import type { Perfil } from "@/types";

export default async function ReportesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("*, campana:campanas(*)")
    .eq("id", user.id)
    .single();

  if (!perfil) redirect("/login");

  const roles = ["MINERO", "ADMIN", "SUPER_ADMIN", "LIDER_CALIDAD", "SUPERVISOR"];
  if (!roles.includes(perfil.rol)) redirect("/dashboard");

  return <ReportesPanel perfil={perfil as Perfil} />;
}
