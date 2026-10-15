// ============================================================
// TIPOS CENTRALES DEL SISTEMA
// ============================================================

export type RolUsuario =
  | "AGENTE"
  | "SUPERVISOR"
  | "LIDER_CALIDAD"
  | "MINERO"
  | "ADMIN"
  | "SUPER_ADMIN";

export type CanalTipo =
  | "PRESENCIAL"
  | "INBOUND"
  | "C2C"
  | "OUT_WCB"
  | "VIDEOLLAMADA"
  | "VIRTUAL_CHAT";

export type EstadoMonitoreo =
  | "CREADO"
  | "EN_REVISION_ASESOR"
  | "ACEPTADO"
  | "REFUTADO"
  | "EN_REVISION_SUPERVISOR"
  | "REFUTACION_APROBADA"
  | "REFUTACION_RECHAZADA"
  | "EN_VALIDACION_LIDER"
  | "VALIDADO"
  | "RECHAZADO";

export type CategoriaItem =
  | "ERROR_NO_CRITICO"
  | "ERROR_CRITICO_NEGOCIO"
  | "ERROR_CRITICO_USUARIO_FINAL"
  | "ERROR_CRITICO_CUMPLIMIENTO";

export type ResultadoItem = "CUMPLE" | "NO_CUMPLE";

export type AntiguedadAgente = "NUEVO" | "ANTIGUO";

// ============================================================
// MODELOS
// ============================================================

export interface Perfil {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  cedula?: string;
  rol: RolUsuario;
  campana_id?: string;
  campana?: Campana;
  supervisor_id?: string;
  supervisor?: Perfil;
  id_agente?: string;
  activo: boolean;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
  // Relación 1:1 — puede venir en join
  politica_contrasena?: PoliticaContrasena;
}

/** Separado de Perfil (3FN) — tabla politica_contrasena_usuario */
export interface PoliticaContrasena {
  usuario_id: string;
  ultima_actualizacion: string;
  expira_en: string;
  debe_cambiar: boolean;
  intentos_fallidos: number;
  bloqueado_hasta?: string;
  updated_at: string;
}

export interface Campana {
  id: string;
  nombre: string;
  descripcion?: string;
  activa: boolean;
  horas_laborales_limite: number;
  created_at: string;
  updated_at: string;
}

export interface TipoMonitoreo {
  id: string;
  canal: CanalTipo;
  nombre: string;
  descripcion?: string;
  activo: boolean;
  created_at: string;
}

export interface ItemEvaluacion {
  id: string;
  tipo_monitoreo_id: string;
  campana_id?: string;
  categoria: CategoriaItem;
  nombre: string;
  descripcion?: string;
  orden: number;
  activo: boolean;
}

export interface ResultadoItemMonitoreo {
  id: string;
  monitoreo_id: string;
  item_id: string;
  item?: ItemEvaluacion;
  resultado: ResultadoItem;
  observacion?: string;
}

export interface Monitoreo {
  id: string;
  numero_monitoreo: string;

  // Participantes
  lider_id: string;
  lider?: Perfil;
  agente_id: string;
  agente?: Perfil;
  supervisor_id?: string;
  supervisor?: Perfil;

  // Clasificación
  campana_id: string;
  campana?: Campana;
  tipo_monitoreo_id: string;
  tipo_monitoreo?: TipoMonitoreo;

  // Fechas
  fecha_llamada: string;
  fecha_monitoreo: string;
  fecha_coaching?: string;
  fecha_limite_agente?: string;

  // Contexto del agente al momento del monitoreo
  antiguedad: AntiguedadAgente;

  // Texto libre
  descripcion_llamada?: string;
  aspectos_positivos?: string;
  aspectos_mejorar?: string;
  compromiso_agente?: string;

  // Estado
  estado: EstadoMonitoreo;

  // Scores — en tabla separada monitoreos_scores (join)
  scores?: ScoreMonitoreo;

  // Relaciones
  resultados_items?: ResultadoItemMonitoreo[];
  historial?: HistorialMonitoreo[];
  archivos?: ArchivoEvidencia[];

  created_at: string;
  updated_at: string;
}

/** Tabla separada monitoreos_scores — caché de valores calculados */
export interface ScoreMonitoreo {
  monitoreo_id: string;
  score_ecnc: number;
  score_ecneg: number;
  score_ecuf: number;
  score_ecc: number;
  score_final: number;
  calculado_en: string;
}

export interface HistorialMonitoreo {
  id: string;
  monitoreo_id: string;
  usuario_id: string;
  usuario?: Perfil;
  accion: string;
  estado_anterior?: EstadoMonitoreo;
  estado_nuevo?: EstadoMonitoreo;
  comentario?: string;
  // Interventoría (en historial, no en monitoreos)
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

export interface ArchivoEvidencia {
  id: string;
  monitoreo_id: string;
  nombre_archivo: string;
  url: string;
  tipo_archivo?: string;
  tamanio_bytes?: number;   // renombrado de tamanio
  subido_por: string;
  created_at: string;
}

/** Cabecera de una importación masiva */
export interface CargaMasiva {
  id: string;
  realizada_por: string;
  nombre_archivo: string;
  total_filas: number;
  creados: number;
  actualizados: number;
  errores: number;
  created_at: string;
}

/** Detalle fila a fila de una carga masiva (antes era JSONB) */
export interface CargaMasivaDetalle {
  id: string;
  carga_id: string;
  numero_fila: number;
  cedula?: string;
  nombre?: string;
  apellido?: string;
  correo?: string;
  accion: "CREADO" | "ACTUALIZADO" | "ERROR";
  mensaje_error?: string;
  created_at: string;
}

export interface Notificacion {
  id: string;
  usuario_id: string;
  monitoreo_id?: string;
  monitoreo?: { numero_monitoreo: string };
  titulo: string;
  mensaje: string;
  leida: boolean;
  tipo: "INFO" | "WARNING" | "SUCCESS" | "ERROR";
  created_at: string;
}

export interface PermisoRol {
  id: string;
  rol: RolUsuario;
  permiso: string;
  habilitado: boolean;
  updated_by?: string;
  updated_at: string;
}

export interface ConfiguracionSistema {
  id: string;
  clave: string;
  valor: string;
  descripcion?: string;
  updated_at: string;
}

// ============================================================
// SCORES Y CÁLCULOS
// ============================================================

export const PESOS_CATEGORIA: Record<CategoriaItem, number> = {
  ERROR_NO_CRITICO: 0.25,
  ERROR_CRITICO_NEGOCIO: 0.30,
  ERROR_CRITICO_USUARIO_FINAL: 0.30,
  ERROR_CRITICO_CUMPLIMIENTO: 0.15,
};

export const CATEGORIAS_CRITICAS_CERO: CategoriaItem[] = [
  "ERROR_CRITICO_NEGOCIO",
  "ERROR_CRITICO_USUARIO_FINAL",
];

// ============================================================
// LABELS DE UI
// ============================================================

export const ESTADO_LABELS: Record<EstadoMonitoreo, string> = {
  CREADO: "Creado",
  EN_REVISION_ASESOR: "En revisión del asesor",
  ACEPTADO: "Aceptado",
  REFUTADO: "Refutado",
  EN_REVISION_SUPERVISOR: "En revisión del supervisor",
  REFUTACION_APROBADA: "Refutación aprobada",
  REFUTACION_RECHAZADA: "Refutación rechazada",
  EN_VALIDACION_LIDER: "En validación del líder",
  VALIDADO: "Validado",
  RECHAZADO: "Rechazado",
};

export const ESTADO_COLORES: Record<EstadoMonitoreo, string> = {
  CREADO: "bg-gray-100 text-gray-700",
  EN_REVISION_ASESOR: "bg-yellow-100 text-yellow-800",
  ACEPTADO: "bg-green-100 text-green-800",
  REFUTADO: "bg-orange-100 text-orange-800",
  EN_REVISION_SUPERVISOR: "bg-blue-100 text-blue-800",
  REFUTACION_APROBADA: "bg-indigo-100 text-indigo-800",
  REFUTACION_RECHAZADA: "bg-red-100 text-red-800",
  EN_VALIDACION_LIDER: "bg-purple-100 text-purple-800",
  VALIDADO: "bg-green-200 text-green-900",
  RECHAZADO: "bg-red-200 text-red-900",
};

export const ROL_LABELS: Record<RolUsuario, string> = {
  AGENTE: "Agente",
  SUPERVISOR: "Supervisor",
  LIDER_CALIDAD: "Líder de Calidad",
  MINERO: "Minero",
  ADMIN: "Administrador",
  SUPER_ADMIN: "Super Administrador",
};

export const CANAL_LABELS: Record<CanalTipo, string> = {
  PRESENCIAL: "Presencial",
  INBOUND: "Inbound",
  C2C: "C2C",
  OUT_WCB: "OUT / WCB",
  VIDEOLLAMADA: "Videollamada",
  VIRTUAL_CHAT: "Virtual Chat",
};

export const CATEGORIA_LABELS: Record<CategoriaItem, string> = {
  ERROR_NO_CRITICO: "Errores No Críticos",
  ERROR_CRITICO_NEGOCIO: "Errores Críticos de Negocio",
  ERROR_CRITICO_USUARIO_FINAL: "Errores Críticos de Usuario Final",
  ERROR_CRITICO_CUMPLIMIENTO: "Errores Críticos de Cumplimiento",
};

export const CATEGORIA_COLORES: Record<CategoriaItem, string> = {
  ERROR_NO_CRITICO: "bg-blue-50 border-blue-200",
  ERROR_CRITICO_NEGOCIO: "bg-red-50 border-red-300",
  ERROR_CRITICO_USUARIO_FINAL: "bg-orange-50 border-orange-300",
  ERROR_CRITICO_CUMPLIMIENTO: "bg-yellow-50 border-yellow-200",
};

// ============================================================
// PERMISOS DISPONIBLES
// ============================================================

export const PERMISOS_DISPONIBLES = [
  { clave: "ver_mis_monitoreos", label: "Ver sus monitoreos" },
  { clave: "ver_mi_perfil", label: "Ver su perfil" },
  { clave: "ver_monitoreos_campana", label: "Ver monitoreos de campaña" },
  { clave: "evaluar_refutaciones", label: "Evaluar refutaciones" },
  { clave: "ver_reportes_campana", label: "Ver reportes de campaña" },
  { clave: "crear_monitoreo", label: "Crear monitoreos" },
  { clave: "editar_monitoreo", label: "Editar monitoreos" },
  { clave: "validacion_final", label: "Validación final" },
  { clave: "ver_reportes", label: "Ver reportes" },
  { clave: "descargar_pdf", label: "Descargar PDF" },
  { clave: "ver_metricas", label: "Ver métricas" },
  { clave: "descargar_reportes", label: "Descargar reportes" },
  { clave: "exportar_datos", label: "Exportar datos" },
  { clave: "gestionar_usuarios", label: "Gestionar usuarios" },
  { clave: "gestionar_campanas", label: "Gestionar campañas" },
  { clave: "configurar_sistema", label: "Configurar sistema" },
  { clave: "ver_todos_monitoreos", label: "Ver todos los monitoreos" },
  { clave: "acceso_total", label: "Acceso total" },
  { clave: "gestionar_permisos", label: "Gestionar permisos" },
  { clave: "ver_auditoria", label: "Ver auditoría" },
] as const;

export type PermisoKey = (typeof PERMISOS_DISPONIBLES)[number]["clave"];
