import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Perfil } from "@/types";
import DashboardAgente from "@/components/dashboard/DashboardAgente";
import DashboardLider from "@/components/dashboard/DashboardLider";
import DashboardSupervisor from "@/components/dashboard/DashboardSupervisor";
import DashboardMinero from "@/components/dashboard/DashboardMinero";
import DashboardAdmin from "@/components/dashboard/DashboardAdmin";
import BannerAccesoDenegado from "@/components/layout/BannerAccesoDenegado";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ acceso_denegado?: string }>;
}) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("*, campana:campanas(*)")
    .eq("id", user.id)
    .single();

  if (!perfil) redirect("/login");

  const p = perfil as Perfil;
  const params = await searchParams;
  const accesoDenegado = params?.acceso_denegado === "1";

  const Dashboard = () => {
    switch (p.rol) {
      case "AGENTE":        return <DashboardAgente     perfil={p} />;
      case "SUPERVISOR":    return <DashboardSupervisor perfil={p} />;
      case "LIDER_CALIDAD": return <DashboardLider      perfil={p} />;
      case "MINERO":        return <DashboardMinero     perfil={p} />;
      case "ADMIN":
      case "SUPER_ADMIN":   return <DashboardAdmin      perfil={p} />;
      default:              return <DashboardAgente     perfil={p} />;
    }
  };

  return (
    <>
      {accesoDenegado && <BannerAccesoDenegado />}
      <Dashboard />
    </>
  );
}
