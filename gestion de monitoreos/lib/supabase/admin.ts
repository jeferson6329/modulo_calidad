import { createClient } from "@supabase/supabase-js";

/**
 * Cliente de Supabase con service_role.
 * Solo usar en API Routes del servidor (nunca en el cliente).
 * Bypasea RLS — usar con cuidado.
 */
export function createAdminClient() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL no está definida");
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY no está definida. " +
      "Configúrala en Vercel → Settings → Environment Variables."
    );
  }

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession:   false,
      },
    }
  );
}
