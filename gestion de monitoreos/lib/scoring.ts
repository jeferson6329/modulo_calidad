import type {
  CategoriaItem,
  ResultadoItemMonitoreo,
  ScoreMonitoreo,
} from "@/types";

/**
 * Calcula el score de un monitoreo a partir de sus resultados_items.
 * Esta es la fuente canónica — el resultado se persiste en monitoreos_scores.
 *
 * Reglas de ponderación (3FN: los scores NO viven en monitoreos):
 *   ERROR_NO_CRITICO          25% → promedio de ítems cumplidos
 *   ERROR_CRITICO_NEGOCIO     30% → si cualquier ítem falla → 0
 *   ERROR_CRITICO_USUARIO_FINAL 30% → si cualquier ítem falla → 0
 *   ERROR_CRITICO_CUMPLIMIENTO 15% → promedio de ítems cumplidos
 */
export function calcularScore(
  resultados: ResultadoItemMonitoreo[]
): Omit<ScoreMonitoreo, "monitoreo_id" | "calculado_en"> {
  const porCategoria: Record<
    CategoriaItem,
    { total: number; cumple: number }
  > = {
    ERROR_NO_CRITICO:           { total: 0, cumple: 0 },
    ERROR_CRITICO_NEGOCIO:      { total: 0, cumple: 0 },
    ERROR_CRITICO_USUARIO_FINAL:{ total: 0, cumple: 0 },
    ERROR_CRITICO_CUMPLIMIENTO: { total: 0, cumple: 0 },
  };

  for (const resultado of resultados) {
    if (!resultado.item) continue;
    const cat = resultado.item.categoria;
    porCategoria[cat].total++;
    if (resultado.resultado === "CUMPLE") porCategoria[cat].cumple++;
  }

  const calcScore = (cat: CategoriaItem): number => {
    const { total, cumple } = porCategoria[cat];
    if (total === 0) return 100;
    // Categorías críticas: cualquier fallo → 0
    if (cat === "ERROR_CRITICO_NEGOCIO" || cat === "ERROR_CRITICO_USUARIO_FINAL") {
      return cumple === total ? 100 : 0;
    }
    return Math.round((cumple / total) * 10000) / 100; // 2 decimales
  };

  const score_ecnc  = calcScore("ERROR_NO_CRITICO");
  const score_ecneg = calcScore("ERROR_CRITICO_NEGOCIO");
  const score_ecuf  = calcScore("ERROR_CRITICO_USUARIO_FINAL");
  const score_ecc   = calcScore("ERROR_CRITICO_CUMPLIMIENTO");
  const score_final =
    Math.round(
      (score_ecnc * 0.25 + score_ecneg * 0.30 + score_ecuf * 0.30 + score_ecc * 0.15) * 100
    ) / 100;

  return { score_ecnc, score_ecneg, score_ecuf, score_ecc, score_final };
}

/**
 * Extrae el score_final desde la relación scores (tabla monitoreos_scores).
 * Devuelve null si aún no se ha calculado.
 */
export function getScoreFinal(
  scores: ScoreMonitoreo | null | undefined
): number | null {
  return scores?.score_final ?? null;
}

/** Color de texto para score */
export function colorScore(score: number): string {
  if (score >= 90) return "text-green-600";
  if (score >= 70) return "text-yellow-600";
  return "text-red-600";
}

/** Color de badge (bg + text) para score */
export function bgColorScore(score: number): string {
  if (score >= 90) return "bg-green-100 text-green-800";
  if (score >= 70) return "bg-yellow-100 text-yellow-800";
  return "bg-red-100 text-red-800";
}
