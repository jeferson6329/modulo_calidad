import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import DetalleMonitoreo from "@/components/monitoreos/DetalleMonitoreo";
import type { Perfil, Monitoreo } from "@/types";

export default async function DetalleMonitoreoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: perfil }, { data: monitoreo }] = await Promise.all([
    supabase.from("perfiles").select("*, campana:campanas(*)").eq("id", user.id).single(),
    supabase
      .from("monitoreos")
      .select(`
        *,
        campana:campanas(*),
        tipo_monitoreo:tipos_monitoreo(*),
        agente:perfiles!monitoreos_agente_id_fkey(id, nombre, apellido, email, id_agente, cedula),
        lider:perfiles!monitoreos_lider_id_fkey(id, nombre, apellido, email),
        supervisor:perfiles!monitoreos_supervisor_id_fkey(id, nombre, apellido, email),
        scores:monitoreos_scores(*),
        resultados_items(
          *,
          item:items_evaluacion(*)
        ),
        historial:historial_monitoreo(
          *,
          usuario:perfiles(nombre, apellido, rol)
        ),
        archivos:archivos_evidencia(*)
      `)
      .eq("id", id)
      .single(),
  ]);

  if (!perfil) redirect("/login");
  if (!monitoreo) notFound();

  return (
    <DetalleMonitoreo
      monitoreo={monitoreo as Monitoreo}
      perfil={perfil as Perfil}
    />
  );
}
