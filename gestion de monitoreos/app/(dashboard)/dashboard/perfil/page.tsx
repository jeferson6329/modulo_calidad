import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import PerfilPanel from "@/components/perfil/PerfilPanel";
import type { Perfil, PoliticaContrasena } from "@/types";

export default async function PerfilPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: perfil }, { data: politica }] = await Promise.all([
    supabase
      .from("perfiles")
      .select("*, campana:campanas(nombre)")
      .eq("id", user.id)
      .single(),
    supabase
      .from("politica_contrasena_usuario")
      .select("*")
      .eq("usuario_id", user.id)
      .single(),
  ]);

  if (!perfil) redirect("/login");

  return (
    <PerfilPanel
      perfil={perfil as Perfil}
      politica={politica as PoliticaContrasena | null}
    />
  );
}
