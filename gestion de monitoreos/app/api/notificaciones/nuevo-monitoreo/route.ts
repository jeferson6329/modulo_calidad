import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enviarEmailNuevoMonitoreo } from "@/lib/email";
import { registrarAuditoria, extraerMetadatosRequest } from "@/lib/auditoria";
import type { Monitoreo, Perfil } from "@/types";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { ip, userAgent } = extraerMetadatosRequest(req);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { monitoreoId } = await req.json();

  // Cargar monitoreo con agente
  const { data: monitoreo } = await supabase
    .from("monitoreos")
    .select(`
      *,
      campana:campanas(*),
      tipo_monitoreo:tipos_monitoreo(*),
      scores:monitoreos_scores(*),
      agente:perfiles!monitoreos_agente_id_fkey(id, nombre, apellido, email),
      lider:perfiles!monitoreos_lider_id_fkey(id, nombre, apellido, email)
    `)
    .eq("id", monitoreoId)
    .single();

  if (!monitoreo || !monitoreo.agente) {
    return NextResponse.json({ error: "Monitoreo o agente no encontrado" }, { status: 404 });
  }

  const agente = monitoreo.agente as Perfil;

  // Notificación in-app al agente
  await supabase.from("notificaciones").insert({
    usuario_id:   agente.id,
    monitoreo_id: monitoreoId,
    titulo:       "Nuevo monitoreo asignado",
    mensaje:      `Se te ha asignado el monitoreo ${monitoreo.numero_monitoreo}. Tienes un plazo de ${(monitoreo as any).campana?.horas_laborales_limite || 48} horas laborales para responder.`,
    tipo:         "INFO",
  });

  // Email al agente
  try {
    await enviarEmailNuevoMonitoreo(monitoreo as Monitoreo, agente);
  } catch (e: any) {
    console.error("[EMAIL] Error enviando email nuevo monitoreo:", e);
    // No bloqueamos la respuesta por errores de email
  }

  // Auditoría
  await registrarAuditoria({
    usuarioId:    user.id,
    usuarioEmail: (monitoreo.lider as any)?.email,
    evento:       "CREACION_MONITOREO",
    descripcion:  `Monitoreo ${monitoreo.numero_monitoreo} notificado al agente ${agente.email}`,
    tablaAfectada: "monitoreos",
    registroId:   monitoreoId,
    ipAddress:    ip,
    userAgent,
  });

  return NextResponse.json({ ok: true });
}
