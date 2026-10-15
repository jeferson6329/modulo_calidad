import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { registrarAuditoria, extraerMetadatosRequest } from "@/lib/auditoria";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { ip, userAgent } = extraerMetadatosRequest(req);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: adminPerfil } = await supabase.from("perfiles").select("*").eq("id", user.id).single();
  if (!adminPerfil || !["ADMIN", "SUPER_ADMIN", "SUPERVISOR"].includes(adminPerfil.rol)) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const { usuarioId, motivo } = await req.json();
  if (!usuarioId) return NextResponse.json({ error: "usuarioId requerido" }, { status: 400 });

  // Obtener usuario objetivo
  const { data: usuarioPerfil } = await supabase.from("perfiles").select("id, email, rol").eq("id", usuarioId).single();
  if (!usuarioPerfil) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  // Supervisores solo pueden restablecer contraseñas de agentes de su campaña
  if (adminPerfil.rol === "SUPERVISOR") {
    const { data: agente } = await supabase.from("perfiles").select("campana_id, rol").eq("id", usuarioId).single();
    if (!agente || agente.rol !== "AGENTE" || agente.campana_id !== adminPerfil.campana_id) {
      return NextResponse.json({ error: "Solo puedes restablecer contraseñas de agentes de tu campaña" }, { status: 403 });
    }
  }

  // Generar contraseña temporal aleatoria
  const contrasenaTemporal = generarContrasenaSegura();

  // Actualizar en Supabase Auth (requiere service role)
  const supabaseAdmin = createAdminClient();
  const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(usuarioId, {
    password: contrasenaTemporal,
  });

  if (authError) {
    await registrarAuditoria({
      usuarioId: user.id,
      usuarioEmail: adminPerfil.email,
      usuarioRol: adminPerfil.rol,
      evento: "RESTABLECIMIENTO_CONTRASENA",
      descripcion: `Error al restablecer contraseña de ${usuarioPerfil.email}: ${authError.message}`,
      tablaAfectada: "perfiles",
      registroId: usuarioId,
      ipAddress: ip,
      userAgent,
      exito: false,
    });
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  // Marcar que debe cambiar contraseña al siguiente login
  await supabase.from("politica_contrasena_usuario").update({
    debe_cambiar:         true,
    expira_en:            new Date().toISOString(),
    ultima_actualizacion: new Date().toISOString(),
  }).eq("usuario_id", usuarioId);

  // Registrar auditoría
  await registrarAuditoria({
    usuarioId: user.id,
    usuarioEmail: adminPerfil.email,
    usuarioRol: adminPerfil.rol,
    evento: "RESTABLECIMIENTO_CONTRASENA",
    descripcion: `${adminPerfil.email} restableció la contraseña de ${usuarioPerfil.email}. Motivo: ${motivo || "Sin motivo indicado"}`,
    tablaAfectada: "perfiles",
    registroId: usuarioId,
    ipAddress: ip,
    userAgent,
    exito: true,
  });

  // Enviar email con la contraseña temporal
  try {
    const { enviarEmailRestablecimientoContrasena } = await import("@/lib/email");
    await enviarEmailRestablecimientoContrasena(
      usuarioPerfil.email,
      contrasenaTemporal,
      `${adminPerfil.nombre || ""} ${adminPerfil.apellido || ""}`.trim()
    );
  } catch (e) {
    console.error("Error enviando email de restablecimiento:", e);
  }

  return NextResponse.json({
    ok: true,
    mensaje: "Contraseña restablecida. El usuario debe cambiarla en el próximo inicio de sesión.",
  });
}

function generarContrasenaSegura(): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$";
  let password = "";
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}
