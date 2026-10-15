import { Resend } from "resend";
import type { Monitoreo, Perfil } from "@/types";
import { ESTADO_LABELS, CANAL_LABELS } from "@/types";
import { formatFecha } from "./utils";

const resend  = new Resend(process.env.RESEND_API_KEY);
const FROM    = process.env.RESEND_FROM_EMAIL || "noreply@gestioncalidad.com";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "Sistema de Gestión de Calidad";

// ============================================================
// UTILIDADES DE PLANTILLA
// ============================================================

function baseTemplate(contenido: string, titulo: string): string {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>${titulo}</title>
</head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f5;padding:28px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:10px;overflow:hidden;
                    box-shadow:0 2px 12px rgba(0,0,0,.10);">
        <!-- HEADER -->
        <tr>
          <td style="background:#003087;padding:22px 32px;text-align:center;">
            <h1 style="color:#fff;margin:0;font-size:19px;font-weight:700;letter-spacing:-.3px;">
              ${APP_NAME}
            </h1>
            <p style="color:#92aede;margin:4px 0 0;font-size:12px;">
              Sistema de Monitoreo de Calidad
            </p>
          </td>
        </tr>
        <!-- CONTENIDO -->
        <tr><td style="padding:32px 32px 24px;">${contenido}</td></tr>
        <!-- FOOTER -->
        <tr>
          <td style="background:#f8f9fb;padding:14px 32px;border-top:1px solid #e8eaed;
                     text-align:center;">
            <p style="color:#aaa;font-size:11px;margin:0;">
              Correo generado automáticamente por ${APP_NAME}. No responder.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();
}

function btnPrimario(texto: string, url: string): string {
  return `
  <div style="text-align:center;margin:26px 0 10px;">
    <a href="${url}"
       style="background:#003087;color:#fff;padding:12px 30px;border-radius:7px;
              text-decoration:none;font-weight:700;font-size:14px;
              display:inline-block;letter-spacing:-.2px;">
      ${texto}
    </a>
  </div>`;
}

type AlertColor = "SUCCESS" | "INFO" | "WARNING" | "ERROR";
const ALERT_STYLES: Record<AlertColor, { border: string; bg: string; text: string; icon: string }> = {
  SUCCESS: { border: "#22c55e", bg: "#f0fdf4", text: "#166534", icon: "✅" },
  INFO:    { border: "#3b82f6", bg: "#eff6ff", text: "#1e40af", icon: "ℹ️"  },
  WARNING: { border: "#f59e0b", bg: "#fffbeb", text: "#92400e", icon: "⚠️" },
  ERROR:   { border: "#ef4444", bg: "#fef2f2", text: "#991b1b", icon: "❌" },
};

function alertBox(mensaje: string, color: AlertColor): string {
  const s = ALERT_STYLES[color];
  return `
  <div style="background:${s.bg};border-left:4px solid ${s.border};
              border-radius:0 7px 7px 0;padding:14px 16px;margin:16px 0;">
    <p style="color:${s.text};font-size:13px;margin:0;font-weight:600;">
      ${s.icon}&nbsp;&nbsp;${mensaje}
    </p>
  </div>`;
}

function infoMonitoreo(monitoreo: Monitoreo): string {
  const score = monitoreo.scores?.score_final;
  const scoreColor = score == null ? "#555"
    : score >= 90 ? "#166534"
    : score >= 70 ? "#854d0e"
    : "#991b1b";

  return `
  <table width="100%" cellpadding="9" cellspacing="0"
         style="background:#f5f7ff;border-radius:8px;border:1px solid #dde3f7;margin:16px 0;">
    <tr>
      <td style="color:#5a6a8a;font-size:12px;font-weight:700;
                 text-transform:uppercase;letter-spacing:.5px;" colspan="2">
        Detalle del Monitoreo
      </td>
    </tr>
    <tr style="background:#fff;">
      <td style="color:#888;font-size:13px;width:45%;">N° Monitoreo</td>
      <td style="color:#003087;font-size:13px;font-weight:700;">${monitoreo.numero_monitoreo}</td>
    </tr>
    <tr>
      <td style="color:#888;font-size:13px;">Agente</td>
      <td style="color:#222;font-size:13px;">
        ${monitoreo.agente?.nombre || "—"} ${monitoreo.agente?.apellido || ""}
      </td>
    </tr>
    <tr style="background:#fff;">
      <td style="color:#888;font-size:13px;">Campaña</td>
      <td style="color:#222;font-size:13px;">${(monitoreo as any).campana?.nombre || "—"}</td>
    </tr>
    <tr>
      <td style="color:#888;font-size:13px;">Canal</td>
      <td style="color:#222;font-size:13px;">
        ${monitoreo.tipo_monitoreo ? CANAL_LABELS[monitoreo.tipo_monitoreo.canal] : "—"}
      </td>
    </tr>
    <tr style="background:#fff;">
      <td style="color:#888;font-size:13px;">Fecha monitoreo</td>
      <td style="color:#222;font-size:13px;">${formatFecha(monitoreo.fecha_monitoreo)}</td>
    </tr>
    <tr>
      <td style="color:#888;font-size:13px;">Estado</td>
      <td style="color:#003087;font-size:13px;font-weight:700;">
        ${ESTADO_LABELS[monitoreo.estado]}
      </td>
    </tr>
    ${score != null ? `
    <tr style="background:#fff;">
      <td style="color:#888;font-size:13px;">Nota final</td>
      <td style="color:${scoreColor};font-size:15px;font-weight:700;">${score.toFixed(2)}%</td>
    </tr>` : ""}
  </table>`;
}

function comentarioBox(label: string, texto: string): string {
  if (!texto?.trim()) return "";
  return `
  <div style="background:#f9fafb;border-left:3px solid #cbd5e1;
              border-radius:0 6px 6px 0;padding:12px 14px;margin:14px 0;">
    <p style="color:#64748b;font-size:11px;font-weight:700;
              text-transform:uppercase;letter-spacing:.5px;margin:0 0 5px;">${label}</p>
    <p style="color:#1e293b;font-size:13px;margin:0;line-height:1.5;">${texto}</p>
  </div>`;
}

// ============================================================
// EMAIL 1: Nuevo monitoreo creado → al AGENTE
// ============================================================
export async function enviarEmailNuevoMonitoreo(
  monitoreo: Monitoreo,
  agente: Perfil
): Promise<void> {
  const url = `${APP_URL}/dashboard/monitoreos/${monitoreo.id}`;

  const contenido = `
    <h2 style="color:#003087;font-size:17px;margin:0 0 6px;">
      📋 Se te ha asignado un nuevo monitoreo
    </h2>
    <p style="color:#555;font-size:14px;margin:0 0 4px;">
      Hola <strong>${agente.nombre}</strong>,
    </p>
    <p style="color:#555;font-size:14px;">
      El analista de calidad ha creado un monitoreo para ti.
      Por favor, revísalo y registra tu compromiso dentro del plazo establecido.
    </p>
    ${infoMonitoreo(monitoreo)}
    ${monitoreo.fecha_limite_agente
      ? alertBox(`Fecha límite para responder: ${formatFecha(monitoreo.fecha_limite_agente, "dd/MM/yyyy HH:mm")}`, "WARNING")
      : ""}
    ${btnPrimario("Ver mi monitoreo", url)}`;

  await resend.emails.send({
    from: FROM,
    to: agente.email,
    subject: `[Monitoreo] Nuevo monitoreo asignado — ${monitoreo.numero_monitoreo}`,
    html: baseTemplate(contenido, "Nuevo Monitoreo"),
  });
}

// ============================================================
// EMAIL 2: Agente refuta → al SUPERVISOR
// ============================================================
export async function enviarEmailSupervisorRefutacion({
  monitoreo,
  supervisor,
  agente,
  justificacion,
}: {
  monitoreo:     Monitoreo;
  supervisor:    Perfil;
  agente:        Perfil | null;
  justificacion: string;
}): Promise<void> {
  const url = `${APP_URL}/dashboard/monitoreos/${monitoreo.id}`;

  const contenido = `
    <h2 style="color:#003087;font-size:17px;margin:0 0 6px;">
      🔔 Nueva refutación — requiere tu evaluación
    </h2>
    <p style="color:#555;font-size:14px;margin:0 0 4px;">
      Hola <strong>${supervisor.nombre}</strong>,
    </p>
    <p style="color:#555;font-size:14px;">
      El agente <strong>${agente?.nombre || ""} ${agente?.apellido || ""}</strong>
      ha refutado el siguiente monitoreo. Debes evaluar si la refutación procede o no.
    </p>
    ${infoMonitoreo(monitoreo)}
    ${comentarioBox("Justificación del agente", justificacion)}
    ${alertBox("Debes aprobar o rechazar esta refutación para continuar el flujo.", "WARNING")}
    ${btnPrimario("Evaluar refutación", url)}`;

  await resend.emails.send({
    from: FROM,
    to: supervisor.email,
    subject: `[Monitoreo] Nueva refutación — ${monitoreo.numero_monitoreo}`,
    html: baseTemplate(contenido, "Nueva Refutación"),
  });
}

// ============================================================
// EMAIL 3: Supervisor aprueba → al LÍDER (validación pendiente)
// ============================================================
export async function enviarEmailLiderValidacionPendiente({
  monitoreo,
  lider,
  agente,
  supervisor,
  observacionesSupervisor,
}: {
  monitoreo:               Monitoreo;
  lider:                   Perfil;
  agente:                  Perfil | null;
  supervisor:              Perfil | null;
  observacionesSupervisor: string;
}): Promise<void> {
  const url = `${APP_URL}/dashboard/monitoreos/${monitoreo.id}`;

  const contenido = `
    <h2 style="color:#003087;font-size:17px;margin:0 0 6px;">
      🔍 Validación final pendiente
    </h2>
    <p style="color:#555;font-size:14px;margin:0 0 4px;">
      Hola <strong>${lider.nombre}</strong>,
    </p>
    <p style="color:#555;font-size:14px;">
      El supervisor <strong>${supervisor?.nombre || ""} ${supervisor?.apellido || ""}</strong>
      aprobó la refutación del agente
      <strong>${agente?.nombre || ""} ${agente?.apellido || ""}</strong>.
      El monitoreo requiere tu validación final.
    </p>
    ${infoMonitoreo(monitoreo)}
    ${comentarioBox("Observaciones del supervisor", observacionesSupervisor)}
    ${alertBox("El proceso espera tu validación final para cerrarse.", "INFO")}
    ${btnPrimario("Realizar validación final", url)}`;

  await resend.emails.send({
    from: FROM,
    to: lider.email,
    subject: `[Monitoreo] Validación pendiente — ${monitoreo.numero_monitoreo}`,
    html: baseTemplate(contenido, "Validación Pendiente"),
  });
}

// ============================================================
// EMAIL 4: Mensaje genérico al agente (supervisor aprueba/rechaza)
// ============================================================
export async function enviarEmailAgenteMensaje({
  monitoreo,
  agente,
  asunto,
  titulo,
  mensaje,
  observaciones,
  color,
}: {
  monitoreo:     Monitoreo;
  agente:        Perfil;
  asunto:        string;
  titulo:        string;
  mensaje:       string;
  observaciones?: string;
  color:         AlertColor;
}): Promise<void> {
  const url = `${APP_URL}/dashboard/monitoreos/${monitoreo.id}`;

  const contenido = `
    <h2 style="color:#003087;font-size:17px;margin:0 0 6px;">${titulo}</h2>
    <p style="color:#555;font-size:14px;margin:0 0 4px;">
      Hola <strong>${agente.nombre}</strong>,
    </p>
    <p style="color:#555;font-size:14px;">${mensaje}</p>
    ${infoMonitoreo(monitoreo)}
    ${comentarioBox("Observaciones", observaciones || "")}
    ${btnPrimario("Ver monitoreo", url)}`;

  await resend.emails.send({
    from: FROM,
    to: agente.email,
    subject: `[Monitoreo] ${asunto} — ${monitoreo.numero_monitoreo}`,
    html: baseTemplate(contenido, asunto),
  });
}

// ============================================================
// EMAIL 5: Decisión del líder → al AGENTE y al SUPERVISOR
//          (independientemente si valida o rechaza)
// ============================================================
export async function enviarEmailDecisionLider({
  monitoreo,
  destinatario,
  esValidado,
  observaciones,
  rol,
}: {
  monitoreo:    Monitoreo;
  destinatario: Perfil;
  esValidado:   boolean;
  observaciones: string;
  rol: "AGENTE" | "SUPERVISOR";
}): Promise<void> {
  const url = `${APP_URL}/dashboard/monitoreos/${monitoreo.id}`;

  const tituloEmail = esValidado
    ? "✅ Monitoreo validado exitosamente"
    : "🔄 Validación rechazada — monitoreo en revisión";

  const mensajeRol: Record<typeof rol, string> = {
    AGENTE: esValidado
      ? `El líder de calidad validó el monitoreo <strong>${monitoreo.numero_monitoreo}</strong>. El proceso ha concluido exitosamente.`
      : `El líder de calidad rechazó la validación del monitoreo <strong>${monitoreo.numero_monitoreo}</strong>. El proceso regresa a revisión.`,
    SUPERVISOR: esValidado
      ? `El líder de calidad validó el monitoreo <strong>${monitoreo.numero_monitoreo}</strong> que aprobaste previamente.`
      : `El líder de calidad rechazó la validación del monitoreo <strong>${monitoreo.numero_monitoreo}</strong>.`,
  };

  const contenido = `
    <h2 style="color:#003087;font-size:17px;margin:0 0 6px;">${tituloEmail}</h2>
    <p style="color:#555;font-size:14px;margin:0 0 4px;">
      Hola <strong>${destinatario.nombre}</strong>,
    </p>
    <p style="color:#555;font-size:14px;">${mensajeRol[rol]}</p>
    ${infoMonitoreo(monitoreo)}
    ${comentarioBox("Observaciones del líder de calidad", observaciones)}
    ${esValidado
      ? alertBox("El proceso de monitoreo ha finalizado correctamente.", "SUCCESS")
      : alertBox(
          rol === "AGENTE"
            ? "El monitoreo regresa a tu bandeja para revisión."
            : "El proceso continúa en revisión.",
          "WARNING"
        )
    }
    ${btnPrimario("Ver detalle del monitoreo", url)}`;

  await resend.emails.send({
    from: FROM,
    to: destinatario.email,
    subject: `[Monitoreo] ${esValidado ? "Validado" : "Rechazado"} — ${monitoreo.numero_monitoreo}`,
    html: baseTemplate(contenido, tituloEmail),
  });
}

// ============================================================
// EMAIL 6: Recordatorio de plazo al agente
// ============================================================
export async function enviarEmailRecordatorioPlazo(
  monitoreo: Monitoreo,
  agente: Perfil,
  horasRestantes: number
): Promise<void> {
  const url = `${APP_URL}/dashboard/monitoreos/${monitoreo.id}`;

  const contenido = `
    <h2 style="color:#c8102e;font-size:17px;margin:0 0 6px;">
      ⏰ Tu plazo está próximo a vencer
    </h2>
    <p style="color:#555;font-size:14px;margin:0 0 4px;">
      Hola <strong>${agente.nombre}</strong>,
    </p>
    <p style="color:#555;font-size:14px;">
      Te quedan aproximadamente
      <strong style="color:#c8102e;">${horasRestantes} horas laborales</strong>
      para registrar tu respuesta en el monitoreo
      <strong>${monitoreo.numero_monitoreo}</strong>.
    </p>
    ${infoMonitoreo(monitoreo)}
    ${alertBox("El plazo vence pronto. Accede al sistema para responder.", "ERROR")}
    ${btnPrimario("Responder ahora", url)}`;

  await resend.emails.send({
    from: FROM,
    to: agente.email,
    subject: `[URGENTE] Plazo próximo a vencer — ${monitoreo.numero_monitoreo}`,
    html: baseTemplate(contenido, "Recordatorio de Plazo"),
  });
}

// ============================================================
// EMAIL 7: Restablecimiento de contraseña por admin
// ============================================================
export async function enviarEmailRestablecimientoContrasena(
  emailDestino: string,
  contrasenaTemporal: string,
  adminNombre: string
): Promise<void> {
  const contenido = `
    <h2 style="color:#c8102e;font-size:17px;margin:0 0 6px;">
      🔐 Tu contraseña fue restablecida
    </h2>
    <p style="color:#555;font-size:14px;">
      El administrador <strong>${adminNombre}</strong> restableció tu contraseña.
    </p>
    <div style="background:#fff8e1;border:1px solid #ffe082;border-radius:8px;
                padding:18px;margin:18px 0;text-align:center;">
      <p style="color:#555;font-size:12px;margin:0 0 8px;text-transform:uppercase;
                font-weight:700;letter-spacing:.5px;">Contraseña temporal</p>
      <p style="color:#003087;font-size:24px;font-weight:700;
                letter-spacing:4px;margin:0;">${contrasenaTemporal}</p>
    </div>
    ${alertBox("Debes cambiar esta contraseña al iniciar sesión. No la compartas.", "ERROR")}
    ${btnPrimario("Iniciar sesión", APP_URL + "/login")}`;

  await resend.emails.send({
    from: FROM,
    to: emailDestino,
    subject: `[${APP_NAME}] Tu contraseña fue restablecida`,
    html: baseTemplate(contenido, "Restablecimiento de Contraseña"),
  });
}

// ============================================================
// EMAIL 8: Contraseña próxima a expirar
// ============================================================
export async function enviarEmailContrasenaProximaAExpirar(
  emailDestino: string,
  nombre: string,
  diasRestantes: number
): Promise<void> {
  const contenido = `
    <h2 style="color:#f59e0b;font-size:17px;margin:0 0 6px;">
      ⏰ Tu contraseña expira pronto
    </h2>
    <p style="color:#555;font-size:14px;">
      Hola <strong>${nombre}</strong>, tu contraseña expira en
      <strong style="color:#c8102e;">${diasRestantes} días</strong>.
    </p>
    <p style="color:#555;font-size:14px;">
      Por políticas de seguridad, las contraseñas se deben actualizar cada 90 días.
    </p>
    ${alertBox("Cambia tu contraseña antes de que expire para no perder el acceso.", "WARNING")}
    ${btnPrimario("Cambiar contraseña", APP_URL + "/dashboard/perfil")}`;

  await resend.emails.send({
    from: FROM,
    to: emailDestino,
    subject: `[${APP_NAME}] Tu contraseña expira en ${diasRestantes} días`,
    html: baseTemplate(contenido, "Contraseña próxima a expirar"),
  });
}

// ============================================================
// EMAIL 9: Bienvenida a nuevo usuario (carga masiva)
// ============================================================
export async function enviarEmailNuevoUsuario(
  emailDestino: string,
  nombre: string,
  contrasenaTemporal: string
): Promise<void> {
  const contenido = `
    <h2 style="color:#003087;font-size:17px;margin:0 0 6px;">
      👋 Bienvenido al Sistema de Gestión de Calidad
    </h2>
    <p style="color:#555;font-size:14px;">Hola <strong>${nombre}</strong>,</p>
    <p style="color:#555;font-size:14px;">Tu cuenta ha sido creada. Usa estas credenciales para ingresar:</p>
    <table width="100%" cellpadding="10" cellspacing="0"
           style="background:#f0f4ff;border-radius:8px;border:1px solid #d0dbff;margin:16px 0;">
      <tr>
        <td style="color:#666;font-size:13px;font-weight:700;width:40%;">Correo</td>
        <td style="color:#003087;font-size:13px;">${emailDestino}</td>
      </tr>
      <tr style="background:#fff;">
        <td style="color:#666;font-size:13px;font-weight:700;">Contraseña temporal</td>
        <td style="color:#003087;font-size:18px;font-weight:700;letter-spacing:3px;">
          ${contrasenaTemporal}
        </td>
      </tr>
    </table>
    ${alertBox("Debes cambiar esta contraseña al iniciar sesión. No la compartas con nadie.", "ERROR")}
    ${btnPrimario("Ingresar al sistema", APP_URL + "/login")}`;

  await resend.emails.send({
    from:    FROM,
    to:      emailDestino,
    subject: `[${APP_NAME}] Bienvenido — Credenciales de acceso`,
    html:    baseTemplate(contenido, "Bienvenido"),
  });
}
