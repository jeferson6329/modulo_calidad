import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import { es } from "date-fns/locale";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatFecha(fecha: string | Date, formato = "dd/MM/yyyy"): string {
  const date = typeof fecha === "string" ? parseISO(fecha) : fecha;
  return format(date, formato, { locale: es });
}

export function formatFechaHora(fecha: string | Date): string {
  const date = typeof fecha === "string" ? parseISO(fecha) : fecha;
  return format(date, "dd/MM/yyyy HH:mm", { locale: es });
}

export function tiempoRelativo(fecha: string | Date): string {
  const date = typeof fecha === "string" ? parseISO(fecha) : fecha;
  return formatDistanceToNow(date, { addSuffix: true, locale: es });
}

export function formatScore(score: number | null | undefined): string {
  if (score === null || score === undefined) return "—";
  return `${score.toFixed(2)}%`;
}

export function generarNumeroMonitoreo(contador: number): string {
  const year = new Date().getFullYear();
  return `MON-${year}-${String(contador).padStart(4, "0")}`;
}

export function calcularFechaLimite(
  fechaInicio: Date,
  horasLaborales: number
): Date {
  // Asume jornada laboral de 8 horas/día, L-V
  const diasLaborales = Math.floor(horasLaborales / 8);
  const horasRestantes = horasLaborales % 8;

  let fecha = new Date(fechaInicio);
  let diasContados = 0;

  while (diasContados < diasLaborales) {
    fecha.setDate(fecha.getDate() + 1);
    const diaSemana = fecha.getDay();
    if (diaSemana !== 0 && diaSemana !== 6) {
      // No es fin de semana
      diasContados++;
    }
  }

  fecha.setHours(fecha.getHours() + horasRestantes);
  return fecha;
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}
