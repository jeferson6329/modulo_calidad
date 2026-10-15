import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { registrarAuditoria, extraerMetadatosRequest } from "@/lib/auditoria";
import {
  enviarEmailNuevoMonitoreo,
  enviarEmailAgenteMensaje,
  enviarEmailSupervisorRefutacion,
  enviarEmailLiderValidacionPendiente,
  enviarEmailDecisionLider,
} from "@/lib/email";
import type { EstadoMonitoreo, Monitoreo, Perfil } from "@/types";

type RouteParams = { params: Promise<{ id: string; accion: string }> };

// ============================================================
// MATRIZ DE NOTIFICACIONES
// ============================================================
// CREACIÓN DEL MONITOREO  → correo + notif al AGENTE
// REFUTACIÓN (agente)     → correo + notif al SUPERVISOR
// SUPERVISOR APRUEBA      → correo al AGENTE + LÍDER
//                           notif  al AGENTE + LÍDER
// SUPERVISOR RECHAZA      → correo al AGENTE
//                           notif  al AGENTE
// LÍDER VALIDA/RECHAZA    → correo al AGENTE + SUPERVISOR
//                           notif  al AGENTE + SUPERVISOR
// ============================================================

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id, accion } = await params;
  const supabase = await createClient();
  const { ip, userAgent } = extraerMetadatosRequest(req);

  // Auth
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: perfil } = await supabase
    .from("perfiles").select("*").eq("id", user.id).single();
  if (!perfil) return NextResponse.json({ error: "Perfil no encontrado" }, { status: 404 });

  // Cargar monitoreo con todos los participantes
  const { data: monitoreo } = await supabase
    .from("monitoreos")
    .select(`
      *,
      campana:campanas(*),
      tipo_monitoreo:tipos_monitoreo(*),
      scores:monitoreos_scores(*),
      agente:perfiles!monitoreos_agente_id_fkey(id, nombre, apellido, email),
      lider:perfiles!monitoreos_lider_id_fkey(id, nombre, apellido, email),
      supervisor:perfiles!monitoreos_supervisor_id_fkey(id, nombre, apellido, email)
    `)
    .eq("id", id)
    .single();

  if (!monitoreo) return NextResponse.json({ error: "Monitoreo no encontrado" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const estadoAnterior: EstadoMonitoreo = monitoreo.estado;
  let nuevoEstado: EstadoMonitoreo | null = null;
  let updateData: Record<string, any> = {};
  let historialComentario = "";

  // ============================================================
  // LÓGICA DE CADA ACCIÓN
  // ============================================================

  switch (accion) {
    // ----------------------------------------------------------
    // AGENTE acepta el monitoreo → proceso finalizado
    // ----------------------------------------------------------
    case "aceptar_agente": {
      if (monitoreo.estado !== "EN_REVISION_ASESOR")
        return NextResponse.json({ error: "Estado inválido para esta acción" }, { status: 400 });
      if (perfil.id !== monitoreo.agente_id)
        return NextResponse.json({ error: "Solo el agente puede aceptar" }, { status: 403 });

      nuevoEstado = "ACEPTADO";
      historialComentario = "Agente aceptó los hallazgos del monitoreo";
      break;
    }

    // ----------------------------------------------------------
    // AGENTE refuta → va al supervisor
    // ----------------------------------------------------------
    case "refutar": {
      if (monitoreo.estado !== "EN_REVISION_ASESOR")
        return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
      if (perfil.id !== monitoreo.agente_id)
        return NextResponse.json({ error: "Solo el agente puede refutar" }, { status: 403 });
      if (!body.justificacion?.trim())
        return NextResponse.json({ error: "La justificación es requerida" }, { status: 400 });

      nuevoEstado = "EN_REVISION_SUPERVISOR";
      historialComentario = body.justificacion;
      break;
    }

    // ----------------------------------------------------------
    // AGENTE registra compromiso (no cambia estado)
    // ----------------------------------------------------------
    case "compromiso": {
      if (!body.compromiso?.trim())
        return NextResponse.json({ error: "El compromiso es requerido" }, { status: 400 });

      updateData = { compromiso_agente: body.compromiso };
      historialComentario = "Compromiso registrado por el agente";
      break;
    }

    // ----------------------------------------------------------
    // SUPERVISOR aprueba → va al líder de calidad
    // ----------------------------------------------------------
    case "supervisor-aprobar": {
      if (monitoreo.estado !== "EN_REVISION_SUPERVISOR")
        return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
      if (!["SUPERVISOR", "ADMIN", "SUPER_ADMIN"].includes(perfil.rol))
        return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

      nuevoEstado = "EN_VALIDACION_LIDER";
      updateData = { supervisor_id: perfil.id };
      historialComentario = body.observaciones?.trim() || "Refutación aprobada por supervisor";
      break;
    }

    // ----------------------------------------------------------
    // SUPERVISOR rechaza → regresa al agente
    // ----------------------------------------------------------
    case "supervisor-rechazar": {
      if (monitoreo.estado !== "EN_REVISION_SUPERVISOR")
        return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
      if (!["SUPERVISOR", "ADMIN", "SUPER_ADMIN"].includes(perfil.rol))
        return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

      nuevoEstado = "EN_REVISION_ASESOR";
      updateData = { supervisor_id: perfil.id };
      historialComentario = body.observaciones?.trim() || "Refutación rechazada por supervisor";
      break;
    }

    // ----------------------------------------------------------
    // LÍDER valida → proceso cerrado
    // ----------------------------------------------------------
    case "validar": {
      if (monitoreo.estado !== "EN_VALIDACION_LIDER")
        return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
      if (!["LIDER_CALIDAD", "ADMIN", "SUPER_ADMIN"].includes(perfil.rol))
        return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

      nuevoEstado = "VALIDADO";
      historialComentario = body.observaciones?.trim() || "Proceso validado por el líder";
      break;
    }

    // ----------------------------------------------------------
    // LÍDER rechaza → regresa al agente
    // ----------------------------------------------------------
    case "rechazar": {
      if (monitoreo.estado !== "EN_VALIDACION_LIDER")
        return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
      if (!["LIDER_CALIDAD", "ADMIN", "SUPER_ADMIN"].includes(perfil.rol))
        return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

      nuevoEstado = "EN_REVISION_ASESOR";
      historialComentario = body.observaciones?.trim() || "Validación rechazada, retorna al agente";
      break;
    }

    default:
      return NextResponse.json({ error: "Acción no reconocida" }, { status: 400 });
  }

  // ============================================================
  // PERSISTIR CAMBIOS
  // ============================================================
  const dataToUpdate: Record<string, any> = { ...updateData };
  if (nuevoEstado) dataToUpdate.estado = nuevoEstado;

  if (Object.keys(dataToUpdate).length > 0) {
    await supabase.from("monitoreos").update(dataToUpdate).eq("id", id);
  }

  await supabase.from("historial_monitoreo").insert({
    monitoreo_id: id,
    usuario_id:   user.id,
    accion:       accion.toUpperCase().replace(/-/g, "_"),
    estado_anterior: estadoAnterior,
    estado_nuevo:    nuevoEstado || estadoAnterior,
    comentario:   historialComentario,
    ip_address:   ip,
    user_agent:   userAgent,
  });

  // Auditoría
  await registrarAuditoria({
    usuarioId:    user.id,
    usuarioEmail: perfil.email,
    usuarioRol:   perfil.rol,
    evento:       "CAMBIO_ESTADO_MONITOREO",
    descripcion:  `${accion} en monitoreo ${monitoreo.numero_monitoreo}: ${estadoAnterior} → ${nuevoEstado || estadoAnterior}`,
    tablaAfectada: "monitoreos",
    registroId:   id,
    datosAnteriores: { estado: estadoAnterior },
    datosNuevos:     { estado: nuevoEstado || estadoAnterior },
    ipAddress:    ip,
    userAgent,
  });

  const monitoreoActualizado: Monitoreo = {
    ...(monitoreo as Monitoreo),
    ...dataToUpdate,
    estado: nuevoEstado || monitoreo.estado,
  };

  // ============================================================
  // NOTIFICACIONES IN-APP + EMAILS
  // ============================================================
  // Se ejecutan en background — nunca bloquean la respuesta.
  enviarNotificaciones({
    supabase,
    monitoreo:    monitoreoActualizado,
    monitoreoId:  id,
    nuevoEstado,
    estadoAnterior,
    accion,
    comentario:   historialComentario,
    agente:       monitoreo.agente  as Perfil | null,
    lider:        monitoreo.lider   as Perfil | null,
    supervisor:   monitoreo.supervisor as Perfil | null,
    campanaId:    monitoreo.campana_id,
  }).catch((e) => console.error("[NOTIF]", e));

  return NextResponse.json({ monitoreo: monitoreoActualizado });
}

// ============================================================
// FUNCIÓN CENTRALIZADA DE NOTIFICACIONES
// ============================================================
async function enviarNotificaciones({
  supabase,
  monitoreo,
  monitoreoId,
  nuevoEstado,
  estadoAnterior,
  accion,
  comentario,
  agente,
  lider,
  supervisor,
  campanaId,
}: {
  supabase: any;
  monitoreo: Monitoreo;
  monitoreoId: string;
  nuevoEstado: EstadoMonitoreo | null;
  estadoAnterior: EstadoMonitoreo;
  accion: string;
  comentario: string;
  agente: Perfil | null;
  lider: Perfil | null;
  supervisor: Perfil | null;
  campanaId: string;
}) {
  const notifs: any[] = [];

  // Helper para agregar notificación in-app
  const notif = (
    usuarioId: string,
    titulo: string,
    mensaje: string,
    tipo: "INFO" | "WARNING" | "SUCCESS" | "ERROR" = "INFO"
  ) => {
    notifs.push({ usuario_id: usuarioId, monitoreo_id: monitoreoId, titulo, mensaje, tipo });
  };

  // Obtener supervisor de la campaña si no viene en el monitoreo
  let supervisorCampana = supervisor;
  if (!supervisorCampana) {
    const { data } = await supabase
      .from("perfiles")
      .select("id, nombre, apellido, email, rol")
      .eq("rol", "SUPERVISOR")
      .eq("campana_id", campanaId)
      .limit(1)
      .single();
    supervisorCampana = data || null;
  }

  // =================================================================
  // CASO 1: Monitoreo creado → solo al AGENTE
  // (manejado en /api/notificaciones/nuevo-monitoreo, no aquí)
  // =================================================================

  // =================================================================
  // CASO 2: Agente REFUTA → notificación + correo al SUPERVISOR
  // =================================================================
  if (nuevoEstado === "EN_REVISION_SUPERVISOR") {
    if (supervisorCampana) {
      notif(
        supervisorCampana.id,
        "Nueva refutación pendiente",
        `El agente ${agente?.nombre || ""} ${agente?.apellido || ""} refutó el monitoreo ${monitoreo.numero_monitoreo}. Requiere tu evaluación.`,
        "WARNING"
      );
      await enviarEmailSupervisorRefutacion({
        monitoreo,
        supervisor: supervisorCampana,
        agente,
        justificacion: comentario,
      });
    }
  }

  // =================================================================
  // CASO 3: Supervisor APRUEBA → correo + notif al AGENTE y al LÍDER
  // =================================================================
  if (nuevoEstado === "EN_VALIDACION_LIDER") {
    // Al agente
    if (agente) {
      notif(
        agente.id,
        "Tu refutación fue aprobada",
        `El supervisor aprobó tu refutación del monitoreo ${monitoreo.numero_monitoreo}. El líder de calidad realizará la validación final.`,
        "SUCCESS"
      );
      await enviarEmailAgenteMensaje({
        monitoreo,
        agente,
        asunto: "Tu refutación fue aprobada",
        titulo: "✅ Refutación aprobada",
        mensaje: `El supervisor aprobó tu refutación del monitoreo <strong>${monitoreo.numero_monitoreo}</strong>. El proceso ahora está en manos del líder de calidad para validación final.`,
        observaciones: comentario,
        color: "SUCCESS",
      });
    }
    // Al líder
    if (lider) {
      notif(
        lider.id,
        "Validación final pendiente",
        `El supervisor aprobó la refutación del monitoreo ${monitoreo.numero_monitoreo}. Requiere tu validación final.`,
        "INFO"
      );
      await enviarEmailLiderValidacionPendiente({
        monitoreo,
        lider,
        agente,
        supervisor: supervisorCampana,
        observacionesSupervisor: comentario,
      });
    }
  }

  // =================================================================
  // CASO 4: Supervisor RECHAZA → correo + notif solo al AGENTE
  // =================================================================
  if (nuevoEstado === "EN_REVISION_ASESOR" && estadoAnterior === "EN_REVISION_SUPERVISOR") {
    if (agente) {
      notif(
        agente.id,
        "Tu refutación no procedió",
        `El supervisor rechazó tu refutación del monitoreo ${monitoreo.numero_monitoreo}. El monitoreo regresa a revisión.`,
        "ERROR"
      );
      await enviarEmailAgenteMensaje({
        monitoreo,
        agente,
        asunto: "Tu refutación no procedió",
        titulo: "❌ Refutación rechazada",
        mensaje: `El supervisor rechazó tu refutación del monitoreo <strong>${monitoreo.numero_monitoreo}</strong>. El monitoreo regresa a tu revisión.`,
        observaciones: comentario,
        color: "ERROR",
      });
    }
  }

  // =================================================================
  // CASO 5: Líder VALIDA o RECHAZA
  //   → Independientemente, correo + notif al AGENTE y al SUPERVISOR
  // =================================================================
  if (
    (nuevoEstado === "VALIDADO" || nuevoEstado === "EN_REVISION_ASESOR") &&
    estadoAnterior === "EN_VALIDACION_LIDER"
  ) {
    const esValidado = nuevoEstado === "VALIDADO";

    // Al agente
    if (agente) {
      notif(
        agente.id,
        esValidado ? "Monitoreo validado ✅" : "Validación rechazada",
        esValidado
          ? `El líder de calidad validó el monitoreo ${monitoreo.numero_monitoreo}. El proceso ha finalizado.`
          : `El líder de calidad rechazó la validación del monitoreo ${monitoreo.numero_monitoreo}. Regresa a revisión.`,
        esValidado ? "SUCCESS" : "ERROR"
      );
      await enviarEmailDecisionLider({
        monitoreo,
        destinatario: agente,
        esValidado,
        observaciones: comentario,
        rol: "AGENTE",
      });
    }

    // Al supervisor (independientemente del resultado)
    if (supervisorCampana) {
      notif(
        supervisorCampana.id,
        esValidado ? "Monitoreo validado por el líder" : "El líder rechazó la validación",
        esValidado
          ? `El líder validó el monitoreo ${monitoreo.numero_monitoreo} que aprobaste.`
          : `El líder rechazó la validación del monitoreo ${monitoreo.numero_monitoreo}.`,
        esValidado ? "SUCCESS" : "WARNING"
      );
      await enviarEmailDecisionLider({
        monitoreo,
        destinatario: supervisorCampana,
        esValidado,
        observaciones: comentario,
        rol: "SUPERVISOR",
      });
    }
  }

  // Persistir notificaciones in-app
  if (notifs.length > 0) {
    await supabase.from("notificaciones").insert(notifs);
  }
}
