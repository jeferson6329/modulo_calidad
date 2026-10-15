"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import type {
  Perfil,
  Campana,
  TipoMonitoreo,
  ItemEvaluacion,
  CategoriaItem,
} from "@/types";
import { CATEGORIA_LABELS, CANAL_LABELS } from "@/types";
import { calcularScore } from "@/lib/scoring";
import { calcularFechaLimite } from "@/lib/utils";
import { Save, ChevronLeft, AlertCircle } from "lucide-react";
import Link from "next/link";

const schema = z.object({
  agente_id:          z.string().min(1, "Selecciona un agente"),
  campana_id:         z.string().min(1, "Selecciona una campaña"),
  tipo_monitoreo_id:  z.string().min(1, "Selecciona un tipo"),
  fecha_llamada:      z.string().min(1, "Requerida"),
  fecha_monitoreo:    z.string().min(1, "Requerida"),
  fecha_coaching:     z.string().optional(),
  antiguedad:         z.enum(["NUEVO", "ANTIGUO"]),
  descripcion_llamada: z.string().optional(),
  aspectos_positivos:  z.string().optional(),
  aspectos_mejorar:    z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const CATEGORIAS: CategoriaItem[] = [
  "ERROR_NO_CRITICO",
  "ERROR_CRITICO_NEGOCIO",
  "ERROR_CRITICO_USUARIO_FINAL",
  "ERROR_CRITICO_CUMPLIMIENTO",
];

const CATEGORIA_HEADER_COLOR: Record<CategoriaItem, string> = {
  ERROR_NO_CRITICO: "bg-blue-600",
  ERROR_CRITICO_NEGOCIO: "bg-red-600",
  ERROR_CRITICO_USUARIO_FINAL: "bg-orange-500",
  ERROR_CRITICO_CUMPLIMIENTO: "bg-yellow-600",
};

export default function NuevoMonitoreoForm({ perfil }: { perfil: Perfil }) {
  const router = useRouter();
  const [campanas, setCampanas] = useState<Campana[]>([]);
  const [tiposMonitoreo, setTiposMonitoreo] = useState<TipoMonitoreo[]>([]);
  const [agentes, setAgentes] = useState<Perfil[]>([]);
  const [items, setItems] = useState<ItemEvaluacion[]>([]);
  const [resultados, setResultados] = useState<Record<string, "CUMPLE" | "NO_CUMPLE">>({});
  const [observaciones, setObservaciones] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { antiguedad: "ANTIGUO" },
  });

  const campanaId = watch("campana_id");
  const tipoMonitoreoId = watch("tipo_monitoreo_id");

  // Cargar datos iniciales
  useEffect(() => {
    const cargar = async () => {
      const supabase = createClient();
      const [{ data: c }, { data: t }, { data: a }] = await Promise.all([
        supabase.from("campanas").select("*").eq("activa", true),
        supabase.from("tipos_monitoreo").select("*").eq("activo", true),
        supabase.from("perfiles").select("id, nombre, apellido, id_agente, campana_id")
          .eq("rol", "AGENTE").eq("activo", true),
      ]);
      if (c) setCampanas(c);
      if (t) setTiposMonitoreo(t);
      if (a) setAgentes(a as Perfil[]);
    };
    cargar();
  }, []);

  // Cargar ítems cuando cambia el tipo de monitoreo
  useEffect(() => {
    if (!tipoMonitoreoId) return;
    const cargarItems = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("items_evaluacion")
        .select("*")
        .eq("tipo_monitoreo_id", tipoMonitoreoId)
        .eq("activo", true)
        .order("orden");

      if (data) {
        setItems(data);
        // Inicializar todos como CUMPLE
        const init: Record<string, "CUMPLE" | "NO_CUMPLE"> = {};
        data.forEach((item) => { init[item.id] = "CUMPLE"; });
        setResultados(init);
      }
    };
    cargarItems();
  }, [tipoMonitoreoId]);

  // Filtrar agentes por campaña
  const agentesFiltrados = campanaId
    ? agentes.filter((a) => a.campana_id === campanaId)
    : agentes;

  const toggleResultado = (itemId: string) => {
    setResultados((prev) => ({
      ...prev,
      [itemId]: prev[itemId] === "CUMPLE" ? "NO_CUMPLE" : "CUMPLE",
    }));
  };

  // Calcular score en tiempo real
  const scorePreview = items.length > 0
    ? calcularScore(
        items.map((item) => ({
          id: "",
          monitoreo_id: "",
          item_id: item.id,
          item,
          resultado: resultados[item.id] || "CUMPLE",
        }))
      )
    : null;

  const onSubmit = async (data: FormData) => {
    if (items.length === 0) {
      setError("Selecciona un tipo de monitoreo para cargar los ítems de evaluación.");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const supabase = createClient();

      // Calcular scores
      const resultadosArr = items.map((item) => ({
        id: "",
        monitoreo_id: "",
        item_id: item.id,
        item,
        resultado: resultados[item.id] || "CUMPLE",
      }));
      const scores = calcularScore(resultadosArr);

      // Calcular fecha límite del agente
      const campana = campanas.find((c) => c.id === data.campana_id);
      const horasLimite = campana?.horas_laborales_limite || 48;
      const fechaLimite = calcularFechaLimite(new Date(), horasLimite);

      // Crear monitoreo (sin scores — se calculan via trigger)
      const { data: monitoreo, error: errMon } = await supabase
        .from("monitoreos")
        .insert({
          lider_id:           perfil.id,
          agente_id:          data.agente_id,
          campana_id:         data.campana_id,
          tipo_monitoreo_id:  data.tipo_monitoreo_id,
          fecha_llamada:      data.fecha_llamada,
          fecha_monitoreo:    data.fecha_monitoreo,
          fecha_coaching:     data.fecha_coaching || null,
          antiguedad:         data.antiguedad,
          descripcion_llamada: data.descripcion_llamada || null,
          aspectos_positivos: data.aspectos_positivos || null,
          aspectos_mejorar:   data.aspectos_mejorar || null,
          estado:             "EN_REVISION_ASESOR",
          fecha_limite_agente: fechaLimite.toISOString(),
        })
        .select()
        .single();

      if (errMon) throw errMon;

      // Guardar resultados de ítems
      const itemsData = items.map((item) => ({
        monitoreo_id: monitoreo.id,
        item_id: item.id,
        resultado: resultados[item.id] || "CUMPLE",
        observacion: observaciones[item.id] || null,
      }));

      await supabase.from("resultados_items").insert(itemsData);

      // Historial
      await supabase.from("historial_monitoreo").insert({
        monitoreo_id: monitoreo.id,
        usuario_id: perfil.id,
        accion: "CREADO",
        estado_nuevo: "EN_REVISION_ASESOR",
        comentario: "Monitoreo creado y enviado al asesor",
      });

      // Notificación al agente
      await supabase.from("notificaciones").insert({
        usuario_id: data.agente_id,
        monitoreo_id: monitoreo.id,
        titulo: "Nuevo monitoreo asignado",
        mensaje: `Se te ha asignado el monitoreo ${monitoreo.numero_monitoreo}`,
        tipo: "INFO",
      });

      // Email via API
      await fetch("/api/notificaciones/nuevo-monitoreo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monitoreoId: monitoreo.id }),
      });

      router.push(`/dashboard/monitoreos/${monitoreo.id}`);
    } catch (e: any) {
      setError(e.message || "Error al crear el monitoreo");
      setLoading(false);
    }
  };

  const itemsPorCategoria = CATEGORIAS.map((cat) => ({
    categoria: cat,
    items: items.filter((i) => i.categoria === cat),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Encabezado */}
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/monitoreos"
          className="text-gray-400 hover:text-gray-600 transition"
        >
          <ChevronLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nuevo Monitoreo</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Completa todos los campos para crear el monitoreo
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Sección 1: Información básica */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="bg-[#003087] text-white px-6 py-4">
            <h2 className="font-semibold">Información del Monitoreo</h2>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Campaña */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Campaña <span className="text-red-500">*</span>
              </label>
              <select
                {...register("campana_id")}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]"
              >
                <option value="">Seleccionar campaña...</option>
                {campanas.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
              {errors.campana_id && <p className="text-red-500 text-xs mt-1">{errors.campana_id.message}</p>}
            </div>

            {/* Tipo de monitoreo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo / Canal <span className="text-red-500">*</span>
              </label>
              <select
                {...register("tipo_monitoreo_id")}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]"
              >
                <option value="">Seleccionar tipo...</option>
                {tiposMonitoreo.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre} ({CANAL_LABELS[t.canal]})
                  </option>
                ))}
              </select>
              {errors.tipo_monitoreo_id && <p className="text-red-500 text-xs mt-1">{errors.tipo_monitoreo_id.message}</p>}
            </div>

            {/* Agente */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Agente <span className="text-red-500">*</span>
              </label>
              <select
                {...register("agente_id")}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]"
              >
                <option value="">Seleccionar agente...</option>
                {agentesFiltrados.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nombre} {a.apellido} {a.id_agente ? `(${a.id_agente})` : ""}
                  </option>
                ))}
              </select>
              {errors.agente_id && <p className="text-red-500 text-xs mt-1">{errors.agente_id.message}</p>}
            </div>

            {/* Antigüedad */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Antigüedad del Agente
              </label>
              <select
                {...register("antiguedad")}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]"
              >
                <option value="ANTIGUO">Antiguo</option>
                <option value="NUEVO">Nuevo</option>
              </select>
            </div>

            {/* Fecha llamada */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha Llamada <span className="text-red-500">*</span>
              </label>
              <input
                {...register("fecha_llamada")}
                type="date"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]"
              />
              {errors.fecha_llamada && <p className="text-red-500 text-xs mt-1">{errors.fecha_llamada.message}</p>}
            </div>

            {/* Fecha monitoreo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha Monitoreo <span className="text-red-500">*</span>
              </label>
              <input
                {...register("fecha_monitoreo")}
                type="date"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]"
              />
              {errors.fecha_monitoreo && <p className="text-red-500 text-xs mt-1">{errors.fecha_monitoreo.message}</p>}
            </div>

            {/* Fecha coaching */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha Coaching
              </label>
              <input
                {...register("fecha_coaching")}
                type="date"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]"
              />
            </div>
          </div>
        </div>

        {/* Sección 2: Descripción */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="bg-[#003087] text-white px-6 py-4">
            <h2 className="font-semibold">Descripción de la Llamada</h2>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descripción Llamada (Sesión)
              </label>
              <textarea
                {...register("descripcion_llamada")}
                rows={4}
                placeholder="Describe brevemente lo ocurrido en la interacción..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#003087] resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Aspectos a Mejorar
              </label>
              <textarea
                {...register("aspectos_mejorar")}
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#003087] resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Aspectos Positivos
              </label>
              <textarea
                {...register("aspectos_positivos")}
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#003087] resize-none"
              />
            </div>
          </div>
        </div>

        {/* Sección 3: Evaluación de ítems */}
        {items.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Evaluación de Ítems</h2>
              {scorePreview && (
                <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-2">
                  <span className="text-sm text-gray-500">Nota estimada:</span>
                  <span className={`text-lg font-bold ${
                    scorePreview.score_final >= 90 ? "text-green-600" :
                    scorePreview.score_final >= 70 ? "text-yellow-600" : "text-red-600"
                  }`}>
                    {scorePreview.score_final.toFixed(2)}%
                  </span>
                </div>
              )}
            </div>

            {/* Pesos info */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-xs font-medium text-blue-800 mb-2">Ponderación de categorías:</p>
              <div className="flex flex-wrap gap-3">
                {[
                  { label: "Errores No Críticos", peso: "25%", color: "bg-blue-100 text-blue-800" },
                  { label: "Errores Críticos de Negocio", peso: "30%", color: "bg-red-100 text-red-800" },
                  { label: "Errores Críticos de Usuario Final", peso: "30%", color: "bg-orange-100 text-orange-800" },
                  { label: "Errores Críticos de Cumplimiento", peso: "15%", color: "bg-yellow-100 text-yellow-800" },
                ].map((p) => (
                  <span key={p.label} className={`text-xs px-2 py-1 rounded-full font-medium ${p.color}`}>
                    {p.label}: {p.peso}
                  </span>
                ))}
              </div>
              <p className="text-xs text-blue-700 mt-2">
                ⚠️ Si cualquier ítem de <strong>Errores Críticos de Negocio</strong> o <strong>Usuario Final</strong> es NO CUMPLE, esa categoría queda en 0%.
              </p>
            </div>

            {itemsPorCategoria.map(({ categoria, items: itemsCat }) => {
              const hayFallo = itemsCat.some((i) => resultados[i.id] === "NO_CUMPLE");
              const esCritica = categoria === "ERROR_CRITICO_NEGOCIO" || categoria === "ERROR_CRITICO_USUARIO_FINAL";

              return (
                <div key={categoria} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className={`${CATEGORIA_HEADER_COLOR[categoria]} text-white px-6 py-3 flex items-center justify-between`}>
                    <h3 className="font-semibold text-sm">{CATEGORIA_LABELS[categoria]}</h3>
                    {esCritica && hayFallo && (
                      <span className="flex items-center gap-1 text-xs bg-white/20 px-2 py-1 rounded-full">
                        <AlertCircle size={12} />
                        Esta categoría quedará en 0%
                      </span>
                    )}
                  </div>
                  <div className="divide-y divide-gray-100">
                    {itemsCat.map((item) => (
                      <div key={item.id} className="px-6 py-3 flex items-center gap-4">
                        <div className="flex-1">
                          <p className="text-sm text-gray-800">{item.nombre}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleResultado(item.id)}
                          className={`px-4 py-1.5 rounded-full text-xs font-bold transition ${
                            resultados[item.id] === "CUMPLE"
                              ? "bg-green-100 text-green-800 hover:bg-green-200"
                              : "bg-red-100 text-red-800 hover:bg-red-200"
                          }`}
                        >
                          {resultados[item.id] === "CUMPLE" ? "CUMPLE" : "NO CUMPLE"}
                        </button>
                        {resultados[item.id] === "NO_CUMPLE" && (
                          <input
                            value={observaciones[item.id] || ""}
                            onChange={(e) =>
                              setObservaciones((prev) => ({ ...prev, [item.id]: e.target.value }))
                            }
                            placeholder="Observación..."
                            className="border border-gray-300 rounded-lg px-2 py-1 text-xs w-48 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {items.length === 0 && tipoMonitoreoId && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-800">
            Cargando ítems de evaluación...
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 flex items-center gap-2">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {/* Botones */}
        <div className="flex items-center justify-end gap-3 pb-6">
          <Link
            href="/dashboard/monitoreos"
            className="px-5 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 bg-[#003087] hover:bg-[#002060] text-white px-6 py-2.5 rounded-lg text-sm font-medium transition disabled:opacity-70"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save size={16} />
            )}
            {loading ? "Guardando..." : "Crear Monitoreo"}
          </button>
        </div>
      </form>
    </div>
  );
}
