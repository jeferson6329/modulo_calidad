import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { RolUsuario } from "@/types";

// ============================================================
// MAPA DE RUTAS PROTEGIDAS POR ROL
// Cualquier ruta NO listada aquí es accesible por todos
// los roles autenticados.
// ============================================================
const RUTAS_POR_ROL: Record<string, RolUsuario[]> = {
  // Solo líder, admin o super admin pueden crear monitoreos
  "/dashboard/monitoreos/nuevo":   ["LIDER_CALIDAD", "ADMIN", "SUPER_ADMIN"],

  // Solo supervisor evalúa refutaciones
  "/dashboard/refutaciones":       ["SUPERVISOR", "ADMIN", "SUPER_ADMIN"],

  // Solo líder hace validaciones finales
  "/dashboard/validaciones":       ["LIDER_CALIDAD", "ADMIN", "SUPER_ADMIN"],

  // Reportes — no para agentes
  "/dashboard/reportes":           ["LIDER_CALIDAD", "SUPERVISOR", "MINERO", "ADMIN", "SUPER_ADMIN"],

  // Descargas — solo minero y admins
  "/dashboard/descargas":          ["MINERO", "ADMIN", "SUPER_ADMIN"],

  // Gestión de usuarios
  "/dashboard/usuarios":           ["ADMIN", "SUPER_ADMIN"],
  "/dashboard/usuarios/carga-masiva": ["ADMIN", "SUPER_ADMIN"],

  // Campañas
  "/dashboard/campanas":           ["ADMIN", "SUPER_ADMIN"],

  // Configuración
  "/dashboard/configuracion":      ["ADMIN", "SUPER_ADMIN"],

  // Auditoría
  "/dashboard/auditoria":          ["ADMIN", "SUPER_ADMIN"],

  // Permisos granulares — solo super admin
  "/dashboard/permisos":           ["SUPER_ADMIN"],
};

// ============================================================
// RUTA DE INICIO POR ROL (a dónde va si intenta entrar a algo prohibido)
// ============================================================
const REDIRECT_POR_ROL: Record<RolUsuario, string> = {
  AGENTE:        "/dashboard",
  SUPERVISOR:    "/dashboard",
  LIDER_CALIDAD: "/dashboard",
  MINERO:        "/dashboard/reportes",
  ADMIN:         "/dashboard",
  SUPER_ADMIN:   "/dashboard",
};

// Rutas públicas (sin autenticación)
const RUTAS_PUBLICAS = [
  "/login",
  "/forgot-password",
  "/reset-password",
  "/cambiar-contrasena",
];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;

  const esPublica = RUTAS_PUBLICAS.some((r) => pathname.startsWith(r));

  // ── Sin sesión ──────────────────────────────────────────────
  if (!user) {
    if (esPublica) return supabaseResponse;
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // ── Con sesión en ruta pública → redirigir al dashboard ─────
  if (user && esPublica) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // ── Obtener perfil y política de contraseña ─────────────────
  const [{ data: perfil }, { data: politica }] = await Promise.all([
    supabase
      .from("perfiles")
      .select("id, rol, activo")
      .eq("id", user.id)
      .single(),
    supabase
      .from("politica_contrasena_usuario")
      .select("debe_cambiar, expira_en")
      .eq("usuario_id", user.id)
      .single(),
  ]);

  // Perfil no existe o usuario desactivado → logout
  if (!perfil || !perfil.activo) {
    await supabase.auth.signOut();
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("error", "cuenta_desactivada");
    return NextResponse.redirect(url);
  }

  const rol = perfil.rol as RolUsuario;

  // ── Contraseña expirada / debe cambiar ───────────────────────
  const debesCambiar =
    politica?.debe_cambiar ||
    (politica?.expira_en && new Date(politica.expira_en) < new Date());

  // Si debe cambiar contraseña y no está ya en esa página
  if (debesCambiar && !pathname.startsWith("/cambiar-contrasena")) {
    const url = request.nextUrl.clone();
    url.pathname = "/cambiar-contrasena";
    return NextResponse.redirect(url);
  }

  // ── Guard de rol por ruta ────────────────────────────────────
  for (const [ruta, rolesPermitidos] of Object.entries(RUTAS_POR_ROL)) {
    if (pathname.startsWith(ruta)) {
      if (!rolesPermitidos.includes(rol)) {
        const url = request.nextUrl.clone();
        url.pathname = REDIRECT_POR_ROL[rol];
        url.searchParams.set("acceso_denegado", "1");
        return NextResponse.redirect(url);
      }
      break; // La ruta más específica ya matcheó
    }
  }

  return supabaseResponse;
}
