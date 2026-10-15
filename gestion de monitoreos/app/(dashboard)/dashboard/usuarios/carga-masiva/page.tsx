import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import CargaMasivaPanel from "@/components/usuarios/CargaMasivaPanel";
import type { Perfil } from "@/types";

export default async function CargaMasivaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase.from("perfiles").select("*").eq("id", user.id).single();
  if (!perfil || !["ADMIN", "SUPER_ADMIN"].includes(perfil.rol)) redirect("/dashboard");

  return <CargaMasivaPanel perfil={perfil as Perfil} />;
}
