import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import MonitoreosLista from "@/components/monitoreos/MonitoreosLista";
import type { Perfil } from "@/types";

export default async function MonitoreosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("*, campana:campanas(*)")
    .eq("id", user.id)
    .single();

  if (!perfil) redirect("/login");

  return <MonitoreosLista perfil={perfil as Perfil} />;
}
