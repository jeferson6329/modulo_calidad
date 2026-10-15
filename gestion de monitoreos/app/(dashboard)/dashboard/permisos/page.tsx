import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import PermisosPanel from "@/components/permisos/PermisosPanel";
import type { Perfil } from "@/types";

export default async function PermisosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase.from("perfiles").select("*").eq("id", user.id).single();
  if (!perfil || perfil.rol !== "SUPER_ADMIN") redirect("/dashboard");

  return <PermisosPanel />;
}
