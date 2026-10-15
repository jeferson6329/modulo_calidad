import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AuditoriaPanel from "@/components/auditoria/AuditoriaPanel";
import type { Perfil } from "@/types";

export default async function AuditoriaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase.from("perfiles").select("*").eq("id", user.id).single();
  if (!perfil || !["ADMIN", "SUPER_ADMIN"].includes(perfil.rol)) redirect("/dashboard");

  return <AuditoriaPanel perfil={perfil as Perfil} />;
}
