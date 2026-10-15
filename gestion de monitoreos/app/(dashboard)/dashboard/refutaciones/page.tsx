import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import MonitoreosLista from "@/components/monitoreos/MonitoreosLista";
import type { Perfil } from "@/types";

export default async function RefutacionesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("perfiles").select("*, campana:campanas(*)").eq("id", user.id).single();

  if (!perfil || perfil.rol !== "SUPERVISOR") redirect("/dashboard");

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Refutaciones</h1>
        <p className="text-gray-500 text-sm mt-1">Monitoreos refutados que requieren tu evaluación</p>
      </div>
      <MonitoreosLista perfil={perfil as Perfil} />
    </div>
  );
}
