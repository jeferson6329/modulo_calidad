import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import DescargasPanel from "@/components/descargas/DescargasPanel";
import type { Perfil } from "@/types";

export default async function DescargasPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!perfil || !["MINERO", "ADMIN", "SUPER_ADMIN"].includes(perfil.rol)) {
    redirect("/dashboard?acceso_denegado=1");
  }

  return <DescargasPanel perfil={perfil as Perfil} />;
}
