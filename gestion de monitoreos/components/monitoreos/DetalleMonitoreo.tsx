"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Monitoreo, Perfil, CategoriaItem } from "@/types";
import {
  ESTADO_LABELS, ESTADO_COLORES, CATEGORIA_LABELS,
  CANAL_LABELS,
} from "@/types";
import { formatFecha, formatFechaHora, formatScore } from "@/lib/utils";
import { bgColorScore } from "@/lib/scoring";
import { generarPDFMonitoreo } from "@/lib/pdf-generator";
import { createClient } from "@/lib/supabase/client";
import {
  ChevronLeft, Download, CheckCircle, XCircle, AlertTriangle,
  Clock, FileText, History,
} from "lucide-react";
import Link from "next/link";

const CATEGORIAS: CategoriaItem[] = [
  "ERROR_NO_CRITICO",
  "ERROR_CRITICO_NEGOCIO",
  "ERROR_CRITICO_USUARIO_FINAL",
  "ERROR_CRITICO_CUMPLIMIENTO",
];

const CATEGORIA_COLOR: Record<CategoriaItem, string> = {
  ERROR_NO_CRITICO: "bg-blue-600",
  ERROR_CRITICO_NEGOCIO: "bg-red-600",
  ERROR_CRITICO_USUARIO_FINAL: "bg-orange-500",
  ERROR_CRITICO_CUMPLIMIENTO: "bg-yellow-600",
};

export default function DetalleMonitoreo({
  monitoreo: initialMonitoreo,
  perfil,
}: {
  monitoreo: Monitoreo;
  perfil: Perfil;
}) {
  const router = useRouter();
  const [monitoreo, setMonitoreo] = useState(initialMonitoreo);
  const [tab, setTab] = useState<"evaluacion" | "historial" | "archivos">("evaluacion");
  const [modalAccion, setModalAccion] = useState<"refutar" | "rechazar_supervisor" | "aprobar_supervisor" | "validar" | "rechazar_lider" | "compromiso" | null>(null);
  const [textoModal, setTextoModal] = useState("");
  const [loading, setLoading] = useState(false);

  const esAgente = perfil.rol === "AGENTE" && perfil.id === monitoreo.agente_id;
  const esLider = perfil.rol === "LIDER_CALIDAD" && perfil.id === monitoreo.lider_id;
  const esSupervisor = perfil.rol === "SUPERVISOR";
  const esAdmin = ["ADMIN", "SUPER_ADMIN"].includes(perfil.rol);

  const ejecutarAccion = async (accion: string, payload: Record<string, any> = {}) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/monitoreos/${monitoreo.id}/${accion}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al procesar");
      setMonitoreo((prev) => ({ ...prev, ...data.monitoreo }));
      setModalAccion(null);
      setTextoModal("");
      router.refresh();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  const itemsPorCategoria = CATEGORIAS.map((cat) => ({
    categoria: cat,
    items: (monitoreo.resultados_items || []).filter((ri) => ri.item?.categoria === cat),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/monitoreos" className="text-gray-400 hover:text-gray-600">
            <ChevronLeft size={20} />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">
                {monitoreo.numero_monitoreo}
              </h1>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${ESTADO_COLORES[monitoreo.estado]}`}>
                {ESTADO_LABELS[monitoreo.estado]}
              </span>
            </div>
            <p className="text-gray-500 text-sm mt-1">
              {monitoreo.campana?.nombre} · {monitoreo.tipo_monitoreo ? CANAL_LABELS[monitoreo.tipo_monitoreo.canal] : ""} · {formatFecha(monitoreo.fecha_monitoreo)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {(esLider || esAdmin) && (
            <button
              onClick={() => generarPDFMonitoreo(monitoreo)}
              className="flex items-center gap-2 border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-lg text-sm transition"
            >
              <Download size={16} />
              Descargar PDF
            </button>
          )}
        </div>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <InfoCard label="Agente" value={`${monitoreo.agente?.nombre || ""} ${monitoreo.agente?.apellido || ""}`} />
        <InfoCard label="Líder de Calidad" value={`${monitoreo.lider?.nombre || ""} ${monitoreo.lider?.apellido || ""}`} />
        <InfoCard label="Antigüedad" value={monitoreo.antiguedad} />
        <InfoCard
          label="Nota Final"
          value={
            monitoreo.scores?.score_final != null ? (
              <span className={`font-bold text-lg ${bgColorScore(monitoreo.scores.score_final).replace("bg-", "text-").replace("100", "800")}`}>
                {formatScore(monitoreo.scores.score_final)}
              </span>
            ) : "—"
          }
        />
      </div>

      {/* Scores por categoría */}
      {monitoreo.scores?.score_final != null && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4 text-sm">Scores por categoría</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Error. No Críticos (25%)", score: monitoreo.scores.score_ecnc, color: "bg-blue-600" },
              { label: "Error. Crit. Negocio (30%)", score: monitoreo.scores.score_ecneg, color: "bg-red-600" },
              { label: "Error. Crit. Usu. Final (30%)", score: monitoreo.scores.score_ecuf, color: "bg-orange-500" },
              { label: "Error. Crit. Cumpl. (15%)", score: monitoreo.scores.score_ecc, color: "bg-yellow-600" },
            ].map((s) => (
              <div key={s.label} className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">{s.label}</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div
                      className={`${s.color} h-2 rounded-full transition-all`}
                      style={{ width: `${s.score || 0}%` }}
                    />
                  </div>
                  <span className={`text-sm font-bold ${(s.score || 0) >= 90 ? "text-green-700" : (s.score || 0) >= 70 ? "text-yellow-700" : "text-red-700"}`}>
                    {formatScore(s.score ?? null)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Acciones según estado y rol */}
      <AccionesMonitoreo
        monitoreo={monitoreo}
        perfil={perfil}
        esAgente={esAgente}
        esLider={esLider}
        esSupervisor={esSupervisor}
        onAccion={(accion) => setModalAccion(accion as any)}
      />

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex border-b border-gray-200">
          {[
            { key: "evaluacion", label: "Evaluación", icon: <CheckCircle size={15} /> },
            { key: "historial", label: "Historial", icon: <History size={15} /> },
            { key: "archivos", label: "Archivos", icon: <FileText size={15} /> },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as any)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition ${
                tab === t.key
                  ? "border-b-2 border-[#003087] text-[#003087]"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {tab === "evaluacion" && (
            <div className="space-y-6">
              {/* Descripción */}
              {monitoreo.descripcion_llamada && (
                <TextSection titulo="Descripción Llamada (Sesión)" contenido={monitoreo.descripcion_llamada} />
              )}

              {/* Ítems por categoría */}
              {itemsPorCategoria.map(({ categoria, items }) => (
                <div key={categoria}>
                  <div className={`${CATEGORIA_COLOR[categoria]} text-white px-4 py-2 rounded-t-lg`}>
                    <h3 className="text-sm font-semibold">{CATEGORIA_LABELS[categoria]}</h3>
                  </div>
                  <table className="w-full border border-t-0 border-gray-200 rounded-b-lg overflow-hidden text-sm">
                    <tbody className="divide-y divide-gray-100">
                      {items.map((ri) => (
                        <tr key={ri.id} className="bg-white">
                          <td className="px-4 py-3 text-gray-800">{ri.item?.nombre}</td>
                          <td className="px-4 py-3 text-right w-32">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                              ri.resultado === "CUMPLE"
                                ? "bg-green-100 text-green-800"
                                : "bg-red-100 text-red-800"
                            }`}>
                              {ri.resultado === "CUMPLE" ? "CUMPLE" : "NO CUMPLE"}
                            </span>
                          </td>
                          {ri.observacion && (
                            <td className="px-4 py-3 text-gray-500 text-xs w-56">{ri.observacion}</td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}

              {monitoreo.aspectos_mejorar && (
                <TextSection titulo="Aspectos a Mejorar" contenido={monitoreo.aspectos_mejorar} />
              )}
              {monitoreo.aspectos_positivos && (
                <TextSection titulo="Aspectos Positivos" contenido={monitoreo.aspectos_positivos} />
              )}
              {monitoreo.compromiso_agente && (
                <TextSection titulo="Compromiso del Agente" contenido={monitoreo.compromiso_agente} />
              )}
              {/* Historial como fuente de comentarios por fase */}
              {(() => {
                const h = monitoreo.historial || [];
                const refutacion    = h.find((e) => e.accion === "REFUTAR");
                const supervisor    = h.find((e) => e.accion === "SUPERVISOR_APROBAR" || e.accion === "SUPERVISOR_RECHAZAR" || e.accion === "DECISION_SUPERVISOR");
                const validacionFin = h.find((e) => e.accion === "VALIDAR" || e.accion === "VALIDACION_FINAL");
                return (
                  <>
                    {refutacion?.comentario && (
                      <TextSection
                        titulo="Justificación de Refutación"
                        contenido={refutacion.comentario}
                        color="bg-orange-50 border-orange-200"
                      />
                    )}
                    {supervisor?.comentario && (
                      <TextSection
                        titulo="Observaciones del Supervisor"
                        contenido={supervisor.comentario}
                        color="bg-blue-50 border-blue-200"
                      />
                    )}
                    {validacionFin?.comentario && (
                      <TextSection
                        titulo="Observaciones Validación Final"
                        contenido={validacionFin.comentario}
                        color="bg-green-50 border-green-200"
                      />
                    )}
                  </>
                );
              })()}
            </div>
          )}

          {tab === "historial" && (
            <div className="space-y-3">
              {(monitoreo.historial || []).length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-6">Sin historial</p>
              ) : (
                [...(monitoreo.historial || [])].reverse().map((h) => (
                  <div key={h.id} className="flex gap-3">
                    <div className="w-2 h-2 rounded-full bg-[#003087] mt-2 flex-shrink-0" />
                    <div className="flex-1 bg-gray-50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium text-gray-800">{h.accion}</p>
                        <span className="text-xs text-gray-400">{formatFechaHora(h.created_at)}</span>
                      </div>
                      <p className="text-xs text-gray-500">
                        Por: {h.usuario?.nombre} {h.usuario?.apellido}
                      </p>
                      {h.comentario && (
                        <p className="text-xs text-gray-600 mt-1">{h.comentario}</p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === "archivos" && (
            <div>
              {(monitoreo.archivos || []).length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-6">Sin archivos adjuntos</p>
              ) : (
                <div className="space-y-2">
                  {monitoreo.archivos!.map((a) => (
                    <a
                      key={a.id}
                      href={a.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
                    >
                      <FileText size={16} className="text-blue-600" />
                      <span className="text-sm text-blue-600 hover:underline">{a.nombre_archivo}</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal de acción */}
      {modalAccion && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              {modalAccion === "refutar" && "Refutar monitoreo"}
              {modalAccion === "aprobar_supervisor" && "Aprobar refutación"}
              {modalAccion === "rechazar_supervisor" && "Rechazar refutación"}
              {modalAccion === "validar" && "Validar monitoreo"}
              {modalAccion === "rechazar_lider" && "Rechazar validación"}
              {modalAccion === "compromiso" && "Registrar compromiso"}
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              {modalAccion === "refutar" && "Explica por qué no estás de acuerdo con los hallazgos del monitoreo."}
              {modalAccion === "aprobar_supervisor" && "Confirma la aprobación de la refutación."}
              {modalAccion === "rechazar_supervisor" && "Indica el motivo del rechazo de la refutación."}
              {modalAccion === "validar" && "Añade observaciones finales de validación."}
              {modalAccion === "rechazar_lider" && "Indica el motivo del rechazo en la validación final."}
              {modalAccion === "compromiso" && "Escribe tu compromiso de mejora."}
            </p>
            <textarea
              value={textoModal}
              onChange={(e) => setTextoModal(e.target.value)}
              rows={4}
              placeholder="Escribe aquí..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#003087] resize-none mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setModalAccion(null); setTextoModal(""); }}
                className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg text-sm hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (modalAccion === "refutar") ejecutarAccion("refutar", { justificacion: textoModal });
                  if (modalAccion === "aprobar_supervisor") ejecutarAccion("supervisor-aprobar", { observaciones: textoModal });
                  if (modalAccion === "rechazar_supervisor") ejecutarAccion("supervisor-rechazar", { observaciones: textoModal });
                  if (modalAccion === "validar") ejecutarAccion("validar", { observaciones: textoModal });
                  if (modalAccion === "rechazar_lider") ejecutarAccion("rechazar", { observaciones: textoModal });
                  if (modalAccion === "compromiso") ejecutarAccion("compromiso", { compromiso: textoModal });
                }}
                disabled={loading || !textoModal.trim()}
                className="flex-1 bg-[#003087] hover:bg-[#002060] text-white py-2.5 rounded-lg text-sm font-medium transition disabled:opacity-70"
              >
                {loading ? "Procesando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Componente de acciones según estado y rol
function AccionesMonitoreo({
  monitoreo,
  perfil,
  esAgente,
  esLider,
  esSupervisor,
  onAccion,
}: {
  monitoreo: Monitoreo;
  perfil: Perfil;
  esAgente: boolean;
  esLider: boolean;
  esSupervisor: boolean;
  onAccion: (accion: string) => void;
}) {
  const acciones: { label: string; accion: string; color: string; icon: React.ReactNode; condicion: boolean }[] = [
    // Agente: aceptar o refutar cuando está en revisión
    {
      label: "Aceptar",
      accion: "aceptar_agente",
      color: "bg-green-600 hover:bg-green-700 text-white",
      icon: <CheckCircle size={15} />,
      condicion: esAgente && monitoreo.estado === "EN_REVISION_ASESOR",
    },
    {
      label: "Refutar",
      accion: "refutar",
      color: "bg-orange-500 hover:bg-orange-600 text-white",
      icon: <XCircle size={15} />,
      condicion: esAgente && monitoreo.estado === "EN_REVISION_ASESOR",
    },
    // Agente: registrar compromiso
    {
      label: "Registrar Compromiso",
      accion: "compromiso",
      color: "bg-blue-600 hover:bg-blue-700 text-white",
      icon: <FileText size={15} />,
      condicion: esAgente && ["EN_REVISION_ASESOR", "REFUTACION_RECHAZADA", "RECHAZADO"].includes(monitoreo.estado),
    },
    // Supervisor: aprobar o rechazar refutación
    {
      label: "Aprobar Refutación",
      accion: "aprobar_supervisor",
      color: "bg-green-600 hover:bg-green-700 text-white",
      icon: <CheckCircle size={15} />,
      condicion: esSupervisor && monitoreo.estado === "EN_REVISION_SUPERVISOR",
    },
    {
      label: "Rechazar Refutación",
      accion: "rechazar_supervisor",
      color: "bg-red-600 hover:bg-red-700 text-white",
      icon: <XCircle size={15} />,
      condicion: esSupervisor && monitoreo.estado === "EN_REVISION_SUPERVISOR",
    },
    // Líder: validar o rechazar
    {
      label: "Validar",
      accion: "validar",
      color: "bg-green-600 hover:bg-green-700 text-white",
      icon: <CheckCircle size={15} />,
      condicion: esLider && monitoreo.estado === "EN_VALIDACION_LIDER",
    },
    {
      label: "Rechazar",
      accion: "rechazar_lider",
      color: "bg-red-600 hover:bg-red-700 text-white",
      icon: <XCircle size={15} />,
      condicion: esLider && monitoreo.estado === "EN_VALIDACION_LIDER",
    },
  ];

  const accionesVisibles = acciones.filter((a) => a.condicion);
  if (accionesVisibles.length === 0) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-4">
      <Clock className="text-amber-600 flex-shrink-0" size={20} />
      <div className="flex-1">
        <p className="text-sm font-medium text-amber-800">Acción requerida</p>
        <p className="text-xs text-amber-600">
          {esAgente && "Revisa el monitoreo y registra tu acción"}
          {esSupervisor && "Evalúa la refutación del agente"}
          {esLider && "Realiza la validación final del monitoreo"}
        </p>
      </div>
      <div className="flex gap-2">
        {accionesVisibles.map((a) => (
          <button
            key={a.accion}
            onClick={() => onAccion(a.accion)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${a.color}`}
          >
            {a.icon}
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="font-semibold text-gray-900 text-sm">{value}</p>
    </div>
  );
}

function TextSection({
  titulo,
  contenido,
  color = "bg-gray-50 border-gray-200",
}: {
  titulo: string;
  contenido: string;
  color?: string;
}) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-gray-700 mb-2">{titulo}</h4>
      <div className={`border rounded-lg p-4 text-sm text-gray-700 ${color}`}>
        {contenido}
      </div>
    </div>
  );
}
