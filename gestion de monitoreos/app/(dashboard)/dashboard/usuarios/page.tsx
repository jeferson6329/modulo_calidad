import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import UsuariosPanel from "@/components/usuarios/UsuariosPanel";
import type { Perfil } from "@/types";

export default async function UsuariosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("*, campana:campanas(*)")
    .eq("id", user.id)
    .single();

  if (!perfil || !["ADMIN", "SUPER_ADMIN"].includes(perfil.rol)) {
    redirect("/dashboard");
  }

  return <UsuariosPanel perfil={perfil as Perfil} />;
}
