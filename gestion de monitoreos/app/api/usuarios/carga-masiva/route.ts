import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { registrarAuditoria, extraerMetadatosRequest } from "@/lib/auditoria";

interface FilaCarga {
  cedula: string;
  nombre: string;
  apellido: string;
  correo: string;
  supervisor_id?: string;
  campana_id?: string;
  accion: "CREAR" | "ACTUALIZAR";
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { ip, userAgent } = extraerMetadatosRequest(req);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: adminPerfil } = await supabase.from("perfiles").select("*").eq("id", user.id).single();
  if (!adminPerfil || !["ADMIN", "SUPER_ADMIN"].includes(adminPerfil.rol)) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const { filas, nombreArchivo }: { filas: FilaCarga[]; nombreArchivo: string } = await req.json();

  let creados = 0, actualizados = 0, errores = 0;
  const detalle: any[] = [];

  // Cliente admin para Supabase Auth
  const supabaseAdmin = createAdminClient();

  for (const fila of filas) {
    try {
      if (fila.accion === "CREAR") {
        // Crear usuario en Supabase Auth
        const contrasenaTemporal = generarContrasena();
        const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
          email: fila.correo,
          password: contrasenaTemporal,
          email_confirm: true,
        });

        if (authErr) {
          errores++;
          detalle.push({ ...fila, resultado: "ERROR", error: authErr.message });
          continue;
        }

        // Crear perfil
        const { error: perfilErr } = await supabase.from("perfiles").insert({
          id:            authData.user.id,
          nombre:        fila.nombre,
          apellido:      fila.apellido,
          email:         fila.correo,
          cedula:        fila.cedula,
          rol:           "AGENTE",
          campana_id:    fila.campana_id || null,
          supervisor_id: fila.supervisor_id || null,
          id_agente:     fila.cedula,
        });
        // La política de contraseña se crea automáticamente via trigger
        // Forzar cambio inmediato de contraseña
        if (!perfilErr) {
          await supabase.from("politica_contrasena_usuario").update({
            debe_cambiar: true,
            expira_en:    new Date().toISOString(),
          }).eq("usuario_id", authData.user.id);
        }

        if (perfilErr) {
          // Rollback: borrar usuario de auth
          await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
          errores++;
          detalle.push({ ...fila, resultado: "ERROR", error: perfilErr.message });
          continue;
        }

        // Enviar email con credenciales
        try {
          const { enviarEmailNuevoUsuario } = await import("@/lib/email");
          await enviarEmailNuevoUsuario(fila.correo, fila.nombre, contrasenaTemporal);
        } catch (e) { /* no bloquear */ }

        creados++;
        detalle.push({ ...fila, resultado: "CREADO" });

      } else if (fila.accion === "ACTUALIZAR") {
        // Buscar perfil existente por cédula o email
        const { data: existente } = await supabase
          .from("perfiles")
          .select("id, nombre, apellido, email, campana_id, supervisor_id")
          .or(`cedula.eq.${fila.cedula},email.eq.${fila.correo}`)
          .single();

        if (!existente) {
          errores++;
          detalle.push({ ...fila, resultado: "ERROR", error: "Agente no encontrado para actualizar" });
          continue;
        }

        const { error: updErr } = await supabase.from("perfiles").update({
          nombre: fila.nombre,
          apellido: fila.apellido,
          email: fila.correo,
          cedula: fila.cedula,
          campana_id: fila.campana_id || existente.campana_id,
          supervisor_id: fila.supervisor_id || existente.supervisor_id,
        }).eq("id", existente.id);

        if (updErr) {
          errores++;
          detalle.push({ ...fila, resultado: "ERROR", error: updErr.message });
          continue;
        }

        // Actualizar email en Auth si cambió
        if (existente.email !== fila.correo) {
          await supabaseAdmin.auth.admin.updateUserById(existente.id, { email: fila.correo });
        }

        actualizados++;
        detalle.push({ ...fila, resultado: "ACTUALIZADO" });
      }
    } catch (err: any) {
      errores++;
      detalle.push({ ...fila, resultado: "ERROR", error: err.message });
    }
  }

  // Registrar en tabla cargas_masivas + detalle normalizado
  const { data: cargaRegistro } = await supabase.from("cargas_masivas").insert({
    realizada_por:  user.id,
    nombre_archivo: nombreArchivo,
    total_filas:    filas.length,
    creados,
    actualizados,
    errores,
  }).select("id").single();

  if (cargaRegistro) {
    const detalleRows = detalle.map((d, i) => ({
      carga_id:      cargaRegistro.id,
      numero_fila:   i + 1,
      cedula:        d.cedula        || null,
      nombre:        d.nombre        || null,
      apellido:      d.apellido      || null,
      correo:        d.correo        || null,
      accion:        d.resultado     as "CREADO" | "ACTUALIZADO" | "ERROR",
      mensaje_error: d.error         || null,
    }));
    await supabase.from("cargas_masivas_detalle").insert(detalleRows);
  }

  // Auditoría
  await registrarAuditoria({
    usuarioId: user.id,
    usuarioEmail: adminPerfil.email,
    usuarioRol: adminPerfil.rol,
    evento: "CARGA_MASIVA_AGENTES",
    descripcion: `Carga masiva de agentes: ${creados} creados, ${actualizados} actualizados, ${errores} errores. Archivo: ${nombreArchivo}`,
    tablaAfectada: "perfiles",
    datosNuevos: { creados, actualizados, errores, archivo: nombreArchivo },
    ipAddress: ip,
    userAgent,
  });

  return NextResponse.json({ creados, actualizados, errores, detalle });
}

function generarContrasena(): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#";
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}
