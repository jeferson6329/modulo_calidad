import { createClient } from "@/lib/supabase/server";
import type { RolUsuario } from "@/types";

export type AuditoriaEvento =
  | "LOGIN" | "LOGOUT" | "LOGIN_FALLIDO"
  | "CAMBIO_CONTRASENA" | "RESTABLECIMIENTO_CONTRASENA" | "CONTRASENA_EXPIRADA"
  | "CREACION_USUARIO" | "ACTUALIZACION_USUARIO" | "DESACTIVACION_USUARIO" | "CAMBIO_ROL"
  | "CARGA_MASIVA_AGENTES" | "CREACION_MONITOREO" | "ACTUALIZACION_MONITOREO"
  | "CAMBIO_ESTADO_MONITOREO" | "DESCARGA_PDF" | "EXPORTACION_DATOS"
  | "CAMBIO_PERMISO" | "CAMBIO_CONFIGURACION" | "ACCESO_REPORTE";

interface RegistrarAuditoriaParams {
  usuarioId?: string;
  usuarioEmail?: string;
  usuarioRol?: RolUsuario;
  evento: AuditoriaEvento;
  descripcion: string;
  tablaAfectada?: string;
  registroId?: string;
  datosAnteriores?: Record<string, any>;
  datosNuevos?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  exito?: boolean;
}

/**
 * Registra un evento en la tabla de auditoría.
 * Llama a la función SQL SECURITY DEFINER para saltarse RLS.
 */
export async function registrarAuditoria(params: RegistrarAuditoriaParams): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.rpc("registrar_auditoria", {
      p_usuario_id:        params.usuarioId        || null,
      p_usuario_email:     params.usuarioEmail      || null,
      p_usuario_rol:       params.usuarioRol        || null,
      p_evento:            params.evento,
      p_descripcion:       params.descripcion,
      p_tabla_afectada:    params.tablaAfectada     || null,
      p_registro_id:       params.registroId        || null,
      p_datos_anteriores:  params.datosAnteriores   || null,
      p_datos_nuevos:      params.datosNuevos       || null,
      p_ip_address:        params.ipAddress         || null,
      p_user_agent:        params.userAgent         || null,
      p_exito:             params.exito !== false,
    });
  } catch (err) {
    // Nunca rompemos el flujo por errores de auditoría
    console.error("[AUDITORIA] Error al registrar:", err);
  }
}

/**
 * Extrae IP y User-Agent de un request de Next.js
 */
export function extraerMetadatosRequest(req: Request): { ip: string; userAgent: string } {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "desconocida";
  const userAgent = req.headers.get("user-agent") || "desconocido";
  return { ip, userAgent };
}
