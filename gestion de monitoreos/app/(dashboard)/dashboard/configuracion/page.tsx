import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ConfiguracionPanel from "@/components/configuracion/ConfiguracionPanel";

export default async function ConfiguracionPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("perfiles").select("rol").eq("id", user.id).single();

  if (!perfil || !["ADMIN", "SUPER_ADMIN"].includes(perfil.rol)) {
    redirect("/dashboard?acceso_denegado=1");
  }

  const { data: config } = await supabase
    .from("configuracion_sistema")
    .select("*")
    .order("clave");

  return <ConfiguracionPanel config={config || []} />;
}
