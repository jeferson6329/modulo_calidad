"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Monitoreo, CategoriaItem } from "@/types";
import { CATEGORIA_LABELS, CANAL_LABELS } from "@/types";
import { formatFecha } from "./utils";

// Colores del documento (igual al PDF de referencia)
const COLORS = {
  headerDark: [0, 48, 135] as [number, number, number],     // azul oscuro BPM
  headerRed: [200, 16, 46] as [number, number, number],     // rojo Movilidad
  headerBlue: [0, 102, 204] as [number, number, number],    // azul sección
  white: [255, 255, 255] as [number, number, number],
  lightGray: [245, 245, 245] as [number, number, number],
  darkGray: [80, 80, 80] as [number, number, number],
  black: [0, 0, 0] as [number, number, number],
  green: [0, 128, 0] as [number, number, number],
  red: [200, 16, 46] as [number, number, number],
};

export async function generarPDFMonitoreo(monitoreo: Monitoreo): Promise<void> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 10;
  let y = 10;

  // ============================================================
  // ENCABEZADO - igual al PDF de referencia
  // ============================================================
  // Título principal centrado
  doc.setFillColor(...COLORS.white);
  doc.setDrawColor(...COLORS.headerDark);
  doc.setLineWidth(0.5);

  // Texto "RETROALIMENTACIÓN MONITOREO CALIDAD"
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...COLORS.headerDark);
  doc.text("RETROALIMENTACIÓN MONITOREO CALIDAD", pageWidth / 2, y + 8, {
    align: "center",
  });

  y += 18;

  // ============================================================
  // TABLA 1: N° Monitoreo | ID Agente | Agente | Antigüedad
  // ============================================================
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["N° Monitoreo", "ID Agente", "Agente", "Antigüedad"]],
    body: [
      [
        monitoreo.numero_monitoreo,
        monitoreo.agente?.cedula || monitoreo.agente?.id_agente || "—",
        `${monitoreo.agente?.nombre || ""} ${monitoreo.agente?.apellido || ""}`.trim(),
        monitoreo.antiguedad === "ANTIGUO" ? "ANTIGUO" : "NUEVO",
      ],
    ],
    headStyles: {
      fillColor: COLORS.headerDark,
      textColor: COLORS.white,
      fontStyle: "bold",
      halign: "center",
      fontSize: 9,
    },
    bodyStyles: { halign: "center", fontSize: 9 },
    theme: "grid",
  });

  y = (doc as any).lastAutoTable.finalY + 2;

  // ============================================================
  // TABLA 2: Proyecto | Canal | Coordinador | Analista
  // ============================================================
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Proyecto", "Canal", "Coordinador de Proyecto", "Analista Monitoreo"]],
    body: [
      [
        monitoreo.campana?.nombre || "—",
        CANAL_LABELS[monitoreo.tipo_monitoreo?.canal || "PRESENCIAL"],
        // El coordinador es el líder de calidad (ya no es campo aparte)
        `${monitoreo.lider?.nombre || ""} ${monitoreo.lider?.apellido || ""}`.trim(),
        `${monitoreo.lider?.nombre || ""} ${monitoreo.lider?.apellido || ""}`.trim(),
      ],
    ],
    headStyles: {
      fillColor: COLORS.headerDark,
      textColor: COLORS.white,
      fontStyle: "bold",
      halign: "center",
      fontSize: 9,
    },
    bodyStyles: { halign: "center", fontSize: 9 },
    theme: "grid",
  });

  y = (doc as any).lastAutoTable.finalY + 2;

  // ============================================================
  // TABLA 3: Fechas y Scores
  // ============================================================
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Fecha Llamada", "Fecha Monitoreo", "Fecha Coaching", "ECN", "ECUF", "ECC", "ENC"]],
    body: [
      [
        monitoreo.fecha_llamada ? formatFecha(monitoreo.fecha_llamada) : "—",
        monitoreo.fecha_monitoreo ? formatFecha(monitoreo.fecha_monitoreo) : "—",
        monitoreo.fecha_coaching ? formatFecha(monitoreo.fecha_coaching) : "—",
        monitoreo.scores?.score_ecnc  != null ? `${monitoreo.scores.score_ecnc.toFixed(0)}%`  : "100%",
        monitoreo.scores?.score_ecuf  != null ? `${monitoreo.scores.score_ecuf.toFixed(0)}%`  : "100%",
        monitoreo.scores?.score_ecc   != null ? `${monitoreo.scores.score_ecc.toFixed(0)}%`   : "100%",
        monitoreo.scores?.score_ecneg != null ? `${monitoreo.scores.score_ecneg.toFixed(0)}%` : "100%",
      ],
    ],
    headStyles: {
      fillColor: COLORS.headerDark,
      textColor: COLORS.white,
      fontStyle: "bold",
      halign: "center",
      fontSize: 9,
    },
    bodyStyles: { halign: "center", fontSize: 9 },
    theme: "grid",
  });

  y = (doc as any).lastAutoTable.finalY + 3;

  // ============================================================
  // SECCIÓN: DESCRIPCIÓN LLAMADA (SESIÓN)
  // ============================================================
  y = addSectionHeader(doc, "DESCRIPCIÓN LLAMADA (SESIÓN)", y, pageWidth, margin);

  const descripcion = monitoreo.descripcion_llamada || "Sin descripción.";
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.black);
  const descLines = doc.splitTextToSize(descripcion, pageWidth - margin * 2 - 4);
  doc.rect(margin, y, pageWidth - margin * 2, descLines.length * 5 + 6);
  doc.text(descLines, margin + 2, y + 5);
  y += descLines.length * 5 + 10;

  // ============================================================
  // SECCIONES DE EVALUACIÓN POR CATEGORÍA
  // ============================================================
  const categorias: CategoriaItem[] = [
    "ERROR_NO_CRITICO",
    "ERROR_CRITICO_NEGOCIO",
    "ERROR_CRITICO_USUARIO_FINAL",
    "ERROR_CRITICO_CUMPLIMIENTO",
  ];

  for (const categoria of categorias) {
    const itemsCategoria = monitoreo.resultados_items?.filter(
      (ri) => ri.item?.categoria === categoria
    ) || [];

    if (itemsCategoria.length === 0) continue;

    // Verificar espacio en página
    if (y > 240) {
      doc.addPage();
      y = 15;
    }

    y = addSectionHeader(doc, CATEGORIA_LABELS[categoria], y, pageWidth, margin);

    const rows = itemsCategoria.map((ri) => [
      ri.item?.nombre || "—",
      ri.resultado === "CUMPLE" ? "CUMPLE" : "NO CUMPLE",
    ]);

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      body: rows,
      columnStyles: {
        0: { cellWidth: pageWidth - margin * 2 - 40 },
        1: {
          cellWidth: 38,
          halign: "center",
          fontStyle: "bold",
        },
      },
      didParseCell: (data) => {
        if (data.column.index === 1) {
          const val = data.cell.raw as string;
          if (val === "CUMPLE") {
            data.cell.styles.textColor = COLORS.green;
          } else {
            data.cell.styles.textColor = COLORS.red;
          }
        }
      },
      styles: { fontSize: 9, cellPadding: 2 },
      theme: "grid",
    });

    y = (doc as any).lastAutoTable.finalY + 3;
  }

  // ============================================================
  // ASPECTOS A MEJORAR
  // ============================================================
  if (y > 230) { doc.addPage(); y = 15; }
  y = addSectionHeader(doc, "ASPECTOS A MEJORAR", y, pageWidth, margin);
  y = addTextBox(doc, monitoreo.aspectos_mejorar || "—", y, pageWidth, margin, 25);

  // ============================================================
  // ASPECTOS POSITIVOS
  // ============================================================
  if (y > 230) { doc.addPage(); y = 15; }
  y = addSectionHeader(doc, "ASPECTOS POSITIVOS", y, pageWidth, margin);
  y = addTextBox(doc, monitoreo.aspectos_positivos || "—", y, pageWidth, margin, 25);

  // ============================================================
  // COMPROMISO DEL AGENTE
  // ============================================================
  if (y > 230) { doc.addPage(); y = 15; }
  y = addSectionHeader(doc, "COMPROMISO DEL AGENTE", y, pageWidth, margin);
  y = addTextBox(doc, monitoreo.compromiso_agente || "", y, pageWidth, margin, 30);

  // ============================================================
  // FIRMAS
  // ============================================================
  if (y > 240) { doc.addPage(); y = 15; }
  y += 5;
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["AGENTE", "COORDINADOR", "ANALISTA DE CALIDAD"]],
    body: [
      [
        `${monitoreo.agente?.nombre || ""} ${monitoreo.agente?.apellido || ""}`.trim(),
        `${monitoreo.lider?.nombre || ""} ${monitoreo.lider?.apellido || ""}`.trim(),
        `${monitoreo.lider?.nombre || ""} ${monitoreo.lider?.apellido || ""}`.trim(),
      ],
    ],
    headStyles: {
      fillColor: COLORS.headerDark,
      textColor: COLORS.white,
      fontStyle: "bold",
      halign: "center",
      fontSize: 9,
    },
    bodyStyles: { halign: "center", fontSize: 9, minCellHeight: 15 },
    theme: "grid",
  });

  // ============================================================
  // NOTA FINAL
  // ============================================================
  if (monitoreo.scores?.score_final != null) {
    const finalY = (doc as any).lastAutoTable.finalY + 5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...COLORS.headerDark);
    doc.text(
      `Nota Final: ${monitoreo.scores.score_final.toFixed(2)}%`,
      pageWidth / 2,
      finalY,
      { align: "center" }
    );
  }

  // Descargar
  const fileName = `Monitoreo_${monitoreo.numero_monitoreo}_${monitoreo.agente?.apellido || "agente"}.pdf`;
  doc.save(fileName);
}

// ============================================================
// HELPERS
// ============================================================

function addSectionHeader(
  doc: jsPDF,
  titulo: string,
  y: number,
  pageWidth: number,
  margin: number
): number {
  doc.setFillColor(...COLORS.headerBlue);
  doc.rect(margin, y, pageWidth - margin * 2, 7, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.white);
  doc.text(titulo, pageWidth / 2, y + 5, { align: "center" });
  return y + 9;
}

function addTextBox(
  doc: jsPDF,
  texto: string,
  y: number,
  pageWidth: number,
  margin: number,
  minHeight: number
): number {
  const lines = doc.splitTextToSize(texto, pageWidth - margin * 2 - 4);
  const boxHeight = Math.max(minHeight, lines.length * 5 + 6);
  doc.setDrawColor(150, 150, 150);
  doc.setFillColor(...COLORS.white);
  doc.rect(margin, y, pageWidth - margin * 2, boxHeight);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.black);
  doc.text(lines, margin + 2, y + 5);
  return y + boxHeight + 3;
}
