import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import CampanasPanel from "@/components/campanas/CampanasPanel";
import type { Perfil } from "@/types";

export default async function CampanasPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase.from("perfiles").select("*").eq("id", user.id).single();
  if (!perfil || !["ADMIN", "SUPER_ADMIN"].includes(perfil.rol)) redirect("/dashboard");

  return <CampanasPanel />;
}
