-- ============================================================
-- SISTEMA DE GESTIÓN DE CALIDAD
-- Schema único — ejecutar UNA vez en un proyecto vacío
-- Versión 3.0 | Normalizado hasta 3FN
-- ============================================================
-- Instrucciones:
--   1. Ir a supabase.com → tu proyecto → SQL Editor
--   2. New query → pegar TODO este archivo → Run
-- ============================================================
-- Excepciones de normalización documentadas:
--   A) auditoria.usuario_email/rol  → copia defensiva para log
--      inmutable (el perfil puede eliminarse).
--   B) monitoreos_scores            → caché de valores calculados
--      desde resultados_items. Justificación: rendimiento en
--      dashboard, PDF y reportes. Fuente canónica = BD trigger.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- SECCIÓN 1: TIPOS ENUMERADOS
-- ============================================================

CREATE TYPE rol_usuario AS ENUM (
  'AGENTE',
  'SUPERVISOR',
  'LIDER_CALIDAD',
  'MINERO',
  'ADMIN',
  'SUPER_ADMIN'
);

CREATE TYPE canal_tipo AS ENUM (
  'PRESENCIAL',
  'INBOUND',
  'C2C',
  'OUT_WCB',
  'VIDEOLLAMADA',
  'VIRTUAL_CHAT'
);

CREATE TYPE estado_monitoreo AS ENUM (
  'CREADO',
  'EN_REVISION_ASESOR',
  'ACEPTADO',
  'REFUTADO',
  'EN_REVISION_SUPERVISOR',
  'REFUTACION_APROBADA',
  'REFUTACION_RECHAZADA',
  'EN_VALIDACION_LIDER',
  'VALIDADO',
  'RECHAZADO'
);

CREATE TYPE categoria_item AS ENUM (
  'ERROR_NO_CRITICO',
  'ERROR_CRITICO_NEGOCIO',
  'ERROR_CRITICO_USUARIO_FINAL',
  'ERROR_CRITICO_CUMPLIMIENTO'
);

CREATE TYPE resultado_item AS ENUM (
  'CUMPLE',
  'NO_CUMPLE'
);

CREATE TYPE antiguedad_agente AS ENUM (
  'NUEVO',
  'ANTIGUO'
);

CREATE TYPE auditoria_evento AS ENUM (
  'LOGIN',
  'LOGOUT',
  'LOGIN_FALLIDO',
  'CAMBIO_CONTRASENA',
  'RESTABLECIMIENTO_CONTRASENA',
  'CONTRASENA_EXPIRADA',
  'CREACION_USUARIO',
  'ACTUALIZACION_USUARIO',
  'DESACTIVACION_USUARIO',
  'CAMBIO_ROL',
  'CARGA_MASIVA_AGENTES',
  'CREACION_MONITOREO',
  'ACTUALIZACION_MONITOREO',
  'CAMBIO_ESTADO_MONITOREO',
  'DESCARGA_PDF',
  'EXPORTACION_DATOS',
  'CAMBIO_PERMISO',
  'CAMBIO_CONFIGURACION',
  'ACCESO_REPORTE'
);

-- ============================================================
-- SECCIÓN 2: TABLAS
-- ============================================================

-- 1. campanas
CREATE TABLE campanas (
  id                     UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre                 TEXT        NOT NULL,
  descripcion            TEXT,
  activa                 BOOLEAN     NOT NULL DEFAULT TRUE,
  horas_laborales_limite INTEGER     NOT NULL DEFAULT 48,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. perfiles (extiende auth.users)
CREATE TABLE perfiles (
  id            UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre        TEXT        NOT NULL,
  apellido      TEXT        NOT NULL,
  email         TEXT        NOT NULL UNIQUE,
  cedula        TEXT        UNIQUE,
  rol           rol_usuario NOT NULL DEFAULT 'AGENTE',
  campana_id    UUID        REFERENCES campanas(id),
  supervisor_id UUID        REFERENCES perfiles(id),
  id_agente     TEXT,
  activo        BOOLEAN     NOT NULL DEFAULT TRUE,
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. politica_contrasena_usuario (1:1 con perfiles — 3FN)
CREATE TABLE politica_contrasena_usuario (
  usuario_id           UUID        PRIMARY KEY
                                     REFERENCES perfiles(id) ON DELETE CASCADE,
  ultima_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expira_en            TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '90 days'),
  debe_cambiar         BOOLEAN     NOT NULL DEFAULT FALSE,
  intentos_fallidos    INTEGER     NOT NULL DEFAULT 0,
  bloqueado_hasta      TIMESTAMPTZ,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. tipos_monitoreo
CREATE TABLE tipos_monitoreo (
  id          UUID       PRIMARY KEY DEFAULT uuid_generate_v4(),
  canal       canal_tipo NOT NULL UNIQUE,
  nombre      TEXT       NOT NULL,
  descripcion TEXT,
  activo      BOOLEAN    NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. items_evaluacion
--    campana_id NULL = aplica a TODAS las campañas del tipo
CREATE TABLE items_evaluacion (
  id                UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
  tipo_monitoreo_id UUID           NOT NULL REFERENCES tipos_monitoreo(id) ON DELETE CASCADE,
  campana_id        UUID           REFERENCES campanas(id) ON DELETE CASCADE,
  categoria         categoria_item NOT NULL,
  nombre            TEXT           NOT NULL,
  descripcion       TEXT,
  orden             INTEGER        NOT NULL DEFAULT 0,
  activo            BOOLEAN        NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  UNIQUE NULLS NOT DISTINCT (tipo_monitoreo_id, campana_id, categoria, nombre)
);

-- 6. monitoreos
CREATE TABLE monitoreos (
  id                  UUID              PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero_monitoreo    TEXT              NOT NULL UNIQUE,
  lider_id            UUID              NOT NULL REFERENCES perfiles(id),
  agente_id           UUID              NOT NULL REFERENCES perfiles(id),
  supervisor_id       UUID              REFERENCES perfiles(id),
  campana_id          UUID              NOT NULL REFERENCES campanas(id),
  tipo_monitoreo_id   UUID              NOT NULL REFERENCES tipos_monitoreo(id),
  fecha_llamada       DATE              NOT NULL,
  fecha_monitoreo     DATE              NOT NULL,
  fecha_coaching      DATE,
  fecha_limite_agente TIMESTAMPTZ,
  antiguedad          antiguedad_agente NOT NULL DEFAULT 'NUEVO',
  descripcion_llamada TEXT,
  aspectos_positivos  TEXT,
  aspectos_mejorar    TEXT,
  compromiso_agente   TEXT,
  estado              estado_monitoreo  NOT NULL DEFAULT 'CREADO',
  created_at          TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

-- 7. monitoreos_scores (caché calculada — excepción B)
CREATE TABLE monitoreos_scores (
  monitoreo_id UUID        PRIMARY KEY REFERENCES monitoreos(id) ON DELETE CASCADE,
  score_ecnc   NUMERIC(5,2),   -- Errores No Críticos   (25%)
  score_ecneg  NUMERIC(5,2),   -- Errores Crit. Negocio (30%)
  score_ecuf   NUMERIC(5,2),   -- Errores Crit. Usu.Final (30%)
  score_ecc    NUMERIC(5,2),   -- Errores Crit. Cumpl.  (15%)
  score_final  NUMERIC(5,2),   -- Nota final ponderada
  calculado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. resultados_items
CREATE TABLE resultados_items (
  id           UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
  monitoreo_id UUID           NOT NULL REFERENCES monitoreos(id) ON DELETE CASCADE,
  item_id      UUID           NOT NULL REFERENCES items_evaluacion(id),
  resultado    resultado_item NOT NULL DEFAULT 'CUMPLE',
  observacion  TEXT,
  created_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  UNIQUE(monitoreo_id, item_id)
);

-- 9. historial_monitoreo
--    Fuente única de verdad para transiciones, refutaciones,
--    observaciones de supervisor y validación del líder.
CREATE TABLE historial_monitoreo (
  id               UUID             PRIMARY KEY DEFAULT uuid_generate_v4(),
  monitoreo_id     UUID             NOT NULL REFERENCES monitoreos(id) ON DELETE CASCADE,
  usuario_id       UUID             NOT NULL REFERENCES perfiles(id),
  accion           TEXT             NOT NULL,
  estado_anterior  estado_monitoreo,
  estado_nuevo     estado_monitoreo,
  comentario       TEXT,
  ip_address       TEXT,
  user_agent       TEXT,
  created_at       TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

-- 10. archivos_evidencia
CREATE TABLE archivos_evidencia (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  monitoreo_id   UUID        NOT NULL REFERENCES monitoreos(id) ON DELETE CASCADE,
  nombre_archivo TEXT        NOT NULL,
  url            TEXT        NOT NULL UNIQUE,
  tipo_archivo   TEXT,
  tamanio_bytes  INTEGER,
  subido_por     UUID        NOT NULL REFERENCES perfiles(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. notificaciones
CREATE TABLE notificaciones (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id   UUID        NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  monitoreo_id UUID        REFERENCES monitoreos(id) ON DELETE SET NULL,
  titulo       TEXT        NOT NULL,
  mensaje      TEXT        NOT NULL,
  leida        BOOLEAN     NOT NULL DEFAULT FALSE,
  tipo         TEXT        NOT NULL DEFAULT 'INFO'
                             CHECK (tipo IN ('INFO','WARNING','SUCCESS','ERROR')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. permisos_rol
CREATE TABLE permisos_rol (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  rol         rol_usuario NOT NULL,
  permiso     TEXT        NOT NULL,
  habilitado  BOOLEAN     NOT NULL DEFAULT TRUE,
  updated_by  UUID        REFERENCES perfiles(id),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(rol, permiso)
);

-- 13. configuracion_sistema
CREATE TABLE configuracion_sistema (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  clave       TEXT        NOT NULL UNIQUE,
  valor       TEXT        NOT NULL,
  descripcion TEXT,
  updated_by  UUID        REFERENCES perfiles(id),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14. auditoria (log inmutable — excepción A)
CREATE TABLE auditoria (
  id               UUID             PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id       UUID             REFERENCES perfiles(id) ON DELETE SET NULL,
  usuario_email    TEXT,
  usuario_rol      rol_usuario,
  evento           auditoria_evento NOT NULL,
  descripcion      TEXT             NOT NULL,
  tabla_afectada   TEXT,
  registro_id      TEXT,
  datos_anteriores JSONB,
  datos_nuevos     JSONB,
  ip_address       TEXT,
  user_agent       TEXT,
  exito            BOOLEAN          NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

-- 15. sesiones_activas
CREATE TABLE sesiones_activas (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id       UUID        NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  token_hash       TEXT        NOT NULL UNIQUE,
  ip_address       TEXT,
  user_agent       TEXT,
  iniciada_en      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ultima_actividad TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cerrada_en       TIMESTAMPTZ,
  activa           BOOLEAN     NOT NULL DEFAULT TRUE
);

-- 16. cargas_masivas
CREATE TABLE cargas_masivas (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  realizada_por  UUID        NOT NULL REFERENCES perfiles(id),
  nombre_archivo TEXT        NOT NULL,
  total_filas    INTEGER     NOT NULL DEFAULT 0,
  creados        INTEGER     NOT NULL DEFAULT 0,
  actualizados   INTEGER     NOT NULL DEFAULT 0,
  errores        INTEGER     NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 17. cargas_masivas_detalle
CREATE TABLE cargas_masivas_detalle (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  carga_id      UUID        NOT NULL REFERENCES cargas_masivas(id) ON DELETE CASCADE,
  numero_fila   INTEGER     NOT NULL,
  cedula        TEXT,
  nombre        TEXT,
  apellido      TEXT,
  correo        TEXT,
  accion        TEXT        NOT NULL CHECK (accion IN ('CREADO','ACTUALIZADO','ERROR')),
  mensaje_error TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(carga_id, numero_fila)
);

-- ============================================================
-- SECCIÓN 3: ÍNDICES
-- ============================================================

CREATE INDEX idx_perfiles_campana        ON perfiles(campana_id);
CREATE INDEX idx_perfiles_supervisor     ON perfiles(supervisor_id);
CREATE INDEX idx_perfiles_cedula         ON perfiles(cedula);
CREATE INDEX idx_perfiles_rol            ON perfiles(rol);

CREATE INDEX idx_monitoreos_agente       ON monitoreos(agente_id);
CREATE INDEX idx_monitoreos_lider        ON monitoreos(lider_id);
CREATE INDEX idx_monitoreos_estado       ON monitoreos(estado);
CREATE INDEX idx_monitoreos_campana      ON monitoreos(campana_id);
CREATE INDEX idx_monitoreos_fecha        ON monitoreos(fecha_monitoreo);
CREATE INDEX idx_monitoreos_tipo         ON monitoreos(tipo_monitoreo_id);

CREATE INDEX idx_resultados_monitoreo    ON resultados_items(monitoreo_id);
CREATE INDEX idx_resultados_item         ON resultados_items(item_id);
CREATE INDEX idx_historial_monitoreo     ON historial_monitoreo(monitoreo_id);
CREATE INDEX idx_historial_usuario       ON historial_monitoreo(usuario_id);
CREATE INDEX idx_notificaciones_usuario  ON notificaciones(usuario_id, leida);
CREATE INDEX idx_items_tipo_campana      ON items_evaluacion(tipo_monitoreo_id, campana_id);
CREATE INDEX idx_items_categoria         ON items_evaluacion(categoria);
CREATE INDEX idx_auditoria_usuario       ON auditoria(usuario_id);
CREATE INDEX idx_auditoria_evento        ON auditoria(evento);
CREATE INDEX idx_auditoria_created_at    ON auditoria(created_at DESC);
CREATE INDEX idx_auditoria_tabla         ON auditoria(tabla_afectada, registro_id);
CREATE INDEX idx_sesiones_usuario        ON sesiones_activas(usuario_id, activa);
CREATE INDEX idx_scores_final            ON monitoreos_scores(score_final);
CREATE INDEX idx_carga_detalle           ON cargas_masivas_detalle(carga_id);

-- ============================================================
-- SECCIÓN 4: FUNCIONES Y TRIGGERS
-- ============================================================

-- 4.1 updated_at automático
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_campanas_updated_at      BEFORE UPDATE ON campanas                   FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_perfiles_updated_at      BEFORE UPDATE ON perfiles                   FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_monitoreos_updated_at    BEFORE UPDATE ON monitoreos                 FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_resultados_updated_at    BEFORE UPDATE ON resultados_items            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_items_updated_at         BEFORE UPDATE ON items_evaluacion            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_politica_updated_at      BEFORE UPDATE ON politica_contrasena_usuario FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 4.2 Crear política de contraseña al crear perfil
CREATE OR REPLACE FUNCTION crear_politica_contrasena()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO politica_contrasena_usuario (usuario_id)
  VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_crear_politica_contrasena
  AFTER INSERT ON perfiles
  FOR EACH ROW EXECUTE FUNCTION crear_politica_contrasena();

-- 4.3 Generar número de monitoreo secuencial por año
CREATE OR REPLACE FUNCTION generar_numero_monitoreo()
RETURNS TRIGGER AS $$
DECLARE
  v_year  TEXT;
  v_count INTEGER;
BEGIN
  v_year := EXTRACT(YEAR FROM NOW())::TEXT;
  SELECT COUNT(*) + 1 INTO v_count
  FROM monitoreos
  WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW());
  NEW.numero_monitoreo := 'MON-' || v_year || '-' || LPAD(v_count::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_numero_monitoreo
  BEFORE INSERT ON monitoreos
  FOR EACH ROW
  WHEN (NEW.numero_monitoreo IS NULL OR NEW.numero_monitoreo = '')
  EXECUTE FUNCTION generar_numero_monitoreo();

-- 4.4 Calcular y guardar score (trigger automático)
--     Ponderación: ECN(25%) + ECNEG(30%) + ECUF(30%) + ECC(15%)
--     Regla crítica: ECNEG y ECUF → si cualquier ítem falla = 0
CREATE OR REPLACE FUNCTION calcular_y_guardar_score(p_monitoreo_id UUID)
RETURNS monitoreos_scores AS $$
DECLARE
  v_nc_total  INTEGER := 0; v_nc_cumple  INTEGER := 0;
  v_neg_total INTEGER := 0; v_neg_cumple INTEGER := 0;
  v_uf_total  INTEGER := 0; v_uf_cumple  INTEGER := 0;
  v_cc_total  INTEGER := 0; v_cc_cumple  INTEGER := 0;
  v_s_nc  NUMERIC(5,2) := 100;
  v_s_neg NUMERIC(5,2) := 100;
  v_s_uf  NUMERIC(5,2) := 100;
  v_s_cc  NUMERIC(5,2) := 100;
  v_final NUMERIC(5,2);
  v_row   monitoreos_scores;
BEGIN
  SELECT
    COUNT(*) FILTER (WHERE ie.categoria = 'ERROR_NO_CRITICO'),
    COUNT(*) FILTER (WHERE ie.categoria = 'ERROR_NO_CRITICO'            AND ri.resultado = 'CUMPLE'),
    COUNT(*) FILTER (WHERE ie.categoria = 'ERROR_CRITICO_NEGOCIO'),
    COUNT(*) FILTER (WHERE ie.categoria = 'ERROR_CRITICO_NEGOCIO'       AND ri.resultado = 'CUMPLE'),
    COUNT(*) FILTER (WHERE ie.categoria = 'ERROR_CRITICO_USUARIO_FINAL'),
    COUNT(*) FILTER (WHERE ie.categoria = 'ERROR_CRITICO_USUARIO_FINAL' AND ri.resultado = 'CUMPLE'),
    COUNT(*) FILTER (WHERE ie.categoria = 'ERROR_CRITICO_CUMPLIMIENTO'),
    COUNT(*) FILTER (WHERE ie.categoria = 'ERROR_CRITICO_CUMPLIMIENTO'  AND ri.resultado = 'CUMPLE')
  INTO v_nc_total,  v_nc_cumple,
       v_neg_total, v_neg_cumple,
       v_uf_total,  v_uf_cumple,
       v_cc_total,  v_cc_cumple
  FROM resultados_items ri
  JOIN items_evaluacion ie ON ri.item_id = ie.id
  WHERE ri.monitoreo_id = p_monitoreo_id;

  IF v_nc_total  > 0 THEN v_s_nc  := ROUND((v_nc_cumple::NUMERIC  / v_nc_total)  * 100, 2); END IF;
  IF v_cc_total  > 0 THEN v_s_cc  := ROUND((v_cc_cumple::NUMERIC  / v_cc_total)  * 100, 2); END IF;
  IF v_neg_total > 0 AND v_neg_cumple < v_neg_total THEN v_s_neg := 0; END IF;
  IF v_uf_total  > 0 AND v_uf_cumple  < v_uf_total  THEN v_s_uf  := 0; END IF;

  v_final := ROUND(v_s_nc * 0.25 + v_s_neg * 0.30 + v_s_uf * 0.30 + v_s_cc * 0.15, 2);

  INSERT INTO monitoreos_scores
    (monitoreo_id, score_ecnc, score_ecneg, score_ecuf, score_ecc, score_final, calculado_en)
  VALUES (p_monitoreo_id, v_s_nc, v_s_neg, v_s_uf, v_s_cc, v_final, NOW())
  ON CONFLICT (monitoreo_id) DO UPDATE SET
    score_ecnc   = EXCLUDED.score_ecnc,
    score_ecneg  = EXCLUDED.score_ecneg,
    score_ecuf   = EXCLUDED.score_ecuf,
    score_ecc    = EXCLUDED.score_ecc,
    score_final  = EXCLUDED.score_final,
    calculado_en = NOW()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trg_recalcular_score()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM calcular_y_guardar_score(
    CASE WHEN TG_OP = 'DELETE' THEN OLD.monitoreo_id ELSE NEW.monitoreo_id END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_score_on_resultado
  AFTER INSERT OR UPDATE OR DELETE ON resultados_items
  FOR EACH ROW EXECUTE FUNCTION trg_recalcular_score();

-- 4.5 Función de auditoría (callable desde la app vía supabase.rpc)
CREATE OR REPLACE FUNCTION registrar_auditoria(
  p_usuario_id       UUID,
  p_usuario_email    TEXT,
  p_usuario_rol      rol_usuario,
  p_evento           auditoria_evento,
  p_descripcion      TEXT,
  p_tabla_afectada   TEXT    DEFAULT NULL,
  p_registro_id      TEXT    DEFAULT NULL,
  p_datos_anteriores JSONB   DEFAULT NULL,
  p_datos_nuevos     JSONB   DEFAULT NULL,
  p_ip_address       TEXT    DEFAULT NULL,
  p_user_agent       TEXT    DEFAULT NULL,
  p_exito            BOOLEAN DEFAULT TRUE
) RETURNS UUID AS $$
DECLARE v_id UUID;
BEGIN
  INSERT INTO auditoria (
    usuario_id, usuario_email, usuario_rol, evento, descripcion,
    tabla_afectada, registro_id, datos_anteriores, datos_nuevos,
    ip_address, user_agent, exito
  ) VALUES (
    p_usuario_id, p_usuario_email, p_usuario_rol, p_evento, p_descripcion,
    p_tabla_afectada, p_registro_id, p_datos_anteriores, p_datos_nuevos,
    p_ip_address, p_user_agent, p_exito
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4.6 Auditoría automática en perfiles
CREATE OR REPLACE FUNCTION auditoria_perfiles_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM registrar_auditoria(NEW.id, NEW.email, NEW.rol, 'CREACION_USUARIO',
      'Usuario creado: ' || NEW.email, 'perfiles', NEW.id::TEXT, NULL, to_jsonb(NEW));

  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.rol IS DISTINCT FROM NEW.rol THEN
      PERFORM registrar_auditoria(NEW.id, NEW.email, NEW.rol, 'CAMBIO_ROL',
        'Cambio de rol: ' || OLD.rol || ' → ' || NEW.rol,
        'perfiles', NEW.id::TEXT,
        jsonb_build_object('rol', OLD.rol), jsonb_build_object('rol', NEW.rol));
    END IF;

    IF OLD.activo IS DISTINCT FROM NEW.activo THEN
      PERFORM registrar_auditoria(NEW.id, NEW.email, NEW.rol,
        CASE WHEN NEW.activo THEN 'ACTUALIZACION_USUARIO' ELSE 'DESACTIVACION_USUARIO' END,
        CASE WHEN NEW.activo THEN 'Usuario reactivado: ' ELSE 'Usuario desactivado: ' END || NEW.email,
        'perfiles', NEW.id::TEXT,
        jsonb_build_object('activo', OLD.activo), jsonb_build_object('activo', NEW.activo));
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_auditoria_perfiles
  AFTER INSERT OR UPDATE ON perfiles
  FOR EACH ROW EXECUTE FUNCTION auditoria_perfiles_trigger();

-- 4.7 Auditoría automática en monitoreos
CREATE OR REPLACE FUNCTION auditoria_monitoreos_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM registrar_auditoria(NEW.lider_id, NULL, NULL, 'CREACION_MONITOREO',
      'Monitoreo creado: ' || NEW.numero_monitoreo,
      'monitoreos', NEW.id::TEXT, NULL, to_jsonb(NEW));

  ELSIF TG_OP = 'UPDATE' AND OLD.estado IS DISTINCT FROM NEW.estado THEN
    PERFORM registrar_auditoria(NEW.lider_id, NULL, NULL, 'CAMBIO_ESTADO_MONITOREO',
      'Estado ' || NEW.numero_monitoreo || ': ' || OLD.estado || ' → ' || NEW.estado,
      'monitoreos', NEW.id::TEXT,
      jsonb_build_object('estado', OLD.estado), jsonb_build_object('estado', NEW.estado));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_auditoria_monitoreos
  AFTER INSERT OR UPDATE ON monitoreos
  FOR EACH ROW EXECUTE FUNCTION auditoria_monitoreos_trigger();

-- 4.8 Auditoría de cambios de contraseña
CREATE OR REPLACE FUNCTION auditoria_contrasena_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.ultima_actualizacion IS DISTINCT FROM NEW.ultima_actualizacion THEN
    PERFORM registrar_auditoria(NEW.usuario_id, NULL, NULL, 'CAMBIO_CONTRASENA',
      'Contraseña actualizada — usuario id: ' || NEW.usuario_id,
      'politica_contrasena_usuario', NEW.usuario_id::TEXT);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_auditoria_contrasena
  AFTER UPDATE ON politica_contrasena_usuario
  FOR EACH ROW EXECUTE FUNCTION auditoria_contrasena_trigger();

-- 4.9 Verificar expiración de contraseña
CREATE OR REPLACE FUNCTION verificar_contrasena_expirada(p_usuario_id UUID)
RETURNS TABLE(expirada BOOLEAN, dias_restantes INTEGER) AS $$
DECLARE v_expira TIMESTAMPTZ;
BEGIN
  SELECT expira_en INTO v_expira FROM politica_contrasena_usuario WHERE usuario_id = p_usuario_id;
  RETURN QUERY SELECT
    (v_expira < NOW()),
    GREATEST(0, EXTRACT(DAY FROM (v_expira - NOW()))::INTEGER);
END;
$$ LANGUAGE plpgsql;

-- 4.10 Forzar cambio de contraseña (admin/supervisor)
CREATE OR REPLACE FUNCTION forzar_cambio_contrasena(
  p_admin_id   UUID,
  p_usuario_id UUID,
  p_motivo     TEXT DEFAULT 'Restablecimiento por administrador'
) RETURNS VOID AS $$
DECLARE
  v_admin_rol     rol_usuario;
  v_usuario_email TEXT;
BEGIN
  SELECT rol  INTO v_admin_rol     FROM perfiles WHERE id = p_admin_id;
  SELECT email INTO v_usuario_email FROM perfiles WHERE id = p_usuario_id;

  IF v_admin_rol NOT IN ('ADMIN', 'SUPER_ADMIN', 'SUPERVISOR') THEN
    RAISE EXCEPTION 'Sin permisos para restablecer contraseñas';
  END IF;

  UPDATE politica_contrasena_usuario
  SET debe_cambiar = TRUE, expira_en = NOW()
  WHERE usuario_id = p_usuario_id;

  PERFORM registrar_auditoria(p_admin_id, NULL, NULL, 'RESTABLECIMIENTO_CONTRASENA',
    p_motivo || ' — usuario: ' || COALESCE(v_usuario_email, p_usuario_id::TEXT),
    'politica_contrasena_usuario', p_usuario_id::TEXT);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- SECCIÓN 5: ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE perfiles                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE politica_contrasena_usuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoreos                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoreos_scores           ENABLE ROW LEVEL SECURITY;
ALTER TABLE resultados_items            ENABLE ROW LEVEL SECURITY;
ALTER TABLE historial_monitoreo         ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificaciones              ENABLE ROW LEVEL SECURITY;
ALTER TABLE archivos_evidencia          ENABLE ROW LEVEL SECURITY;
ALTER TABLE campanas                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE items_evaluacion            ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracion_sistema       ENABLE ROW LEVEL SECURITY;
ALTER TABLE auditoria                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE sesiones_activas            ENABLE ROW LEVEL SECURITY;
ALTER TABLE cargas_masivas              ENABLE ROW LEVEL SECURITY;
ALTER TABLE cargas_masivas_detalle      ENABLE ROW LEVEL SECURITY;
ALTER TABLE permisos_rol                ENABLE ROW LEVEL SECURITY;

-- perfiles
CREATE POLICY "perfiles_propio"             ON perfiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "perfiles_admin"              ON perfiles FOR ALL    USING (EXISTS (SELECT 1 FROM perfiles p WHERE p.id = auth.uid() AND p.rol IN ('ADMIN','SUPER_ADMIN')));
CREATE POLICY "perfiles_supervisor_agentes" ON perfiles FOR SELECT USING (EXISTS (SELECT 1 FROM perfiles p WHERE p.id = auth.uid() AND p.rol = 'SUPERVISOR') AND supervisor_id = auth.uid());

-- politica_contrasena_usuario
CREATE POLICY "politica_propia" ON politica_contrasena_usuario FOR SELECT USING (usuario_id = auth.uid());
CREATE POLICY "politica_admin"  ON politica_contrasena_usuario FOR ALL    USING (EXISTS (SELECT 1 FROM perfiles p WHERE p.id = auth.uid() AND p.rol IN ('ADMIN','SUPER_ADMIN','SUPERVISOR')));

-- monitoreos
CREATE POLICY "monitoreos_agente"     ON monitoreos FOR SELECT USING (agente_id = auth.uid());
CREATE POLICY "monitoreos_lider"      ON monitoreos FOR ALL    USING (EXISTS (SELECT 1 FROM perfiles p WHERE p.id = auth.uid() AND p.rol IN ('LIDER_CALIDAD','ADMIN','SUPER_ADMIN')));
CREATE POLICY "monitoreos_supervisor" ON monitoreos FOR SELECT USING (EXISTS (SELECT 1 FROM perfiles p WHERE p.id = auth.uid() AND p.rol = 'SUPERVISOR' AND p.campana_id = monitoreos.campana_id));
CREATE POLICY "monitoreos_minero"     ON monitoreos FOR SELECT USING (EXISTS (SELECT 1 FROM perfiles p WHERE p.id = auth.uid() AND p.rol = 'MINERO'));

-- monitoreos_scores
CREATE POLICY "scores_acceso"  ON monitoreos_scores FOR SELECT USING (EXISTS (SELECT 1 FROM monitoreos m WHERE m.id = monitoreo_id AND (m.agente_id = auth.uid() OR EXISTS (SELECT 1 FROM perfiles p WHERE p.id = auth.uid() AND p.rol IN ('LIDER_CALIDAD','SUPERVISOR','MINERO','ADMIN','SUPER_ADMIN')))));
CREATE POLICY "scores_sistema" ON monitoreos_scores FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "scores_update"  ON monitoreos_scores FOR UPDATE USING (TRUE);

-- resultados_items
CREATE POLICY "resultados_lectura" ON resultados_items FOR SELECT USING (EXISTS (SELECT 1 FROM monitoreos m WHERE m.id = monitoreo_id AND (m.agente_id = auth.uid() OR EXISTS (SELECT 1 FROM perfiles p WHERE p.id = auth.uid() AND p.rol IN ('LIDER_CALIDAD','SUPERVISOR','MINERO','ADMIN','SUPER_ADMIN')))));
CREATE POLICY "resultados_escritura" ON resultados_items FOR ALL USING (EXISTS (SELECT 1 FROM perfiles p WHERE p.id = auth.uid() AND p.rol IN ('LIDER_CALIDAD','ADMIN','SUPER_ADMIN')));

-- historial_monitoreo
CREATE POLICY "historial_lectura" ON historial_monitoreo FOR SELECT USING (EXISTS (SELECT 1 FROM monitoreos m WHERE m.id = monitoreo_id AND (m.agente_id = auth.uid() OR m.lider_id = auth.uid() OR m.supervisor_id = auth.uid() OR EXISTS (SELECT 1 FROM perfiles p WHERE p.id = auth.uid() AND p.rol IN ('ADMIN','SUPER_ADMIN')))));
CREATE POLICY "historial_insert"  ON historial_monitoreo FOR INSERT WITH CHECK (usuario_id = auth.uid());

-- notificaciones
CREATE POLICY "notificaciones_propias" ON notificaciones FOR ALL USING (usuario_id = auth.uid());

-- campanas
CREATE POLICY "campanas_lectura" ON campanas FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "campanas_admin"   ON campanas FOR ALL    USING (EXISTS (SELECT 1 FROM perfiles p WHERE p.id = auth.uid() AND p.rol IN ('ADMIN','SUPER_ADMIN')));

-- items_evaluacion
CREATE POLICY "items_lectura" ON items_evaluacion FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "items_admin"   ON items_evaluacion FOR ALL    USING (EXISTS (SELECT 1 FROM perfiles p WHERE p.id = auth.uid() AND p.rol IN ('ADMIN','SUPER_ADMIN')));

-- permisos_rol
CREATE POLICY "permisos_lectura"    ON permisos_rol FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "permisos_superadmin" ON permisos_rol FOR ALL    USING (EXISTS (SELECT 1 FROM perfiles p WHERE p.id = auth.uid() AND p.rol = 'SUPER_ADMIN'));

-- auditoria
CREATE POLICY "auditoria_admin"  ON auditoria FOR SELECT USING (EXISTS (SELECT 1 FROM perfiles p WHERE p.id = auth.uid() AND p.rol IN ('ADMIN','SUPER_ADMIN')));
CREATE POLICY "auditoria_insert" ON auditoria FOR INSERT WITH CHECK (TRUE);

-- sesiones_activas
CREATE POLICY "sesiones_propias" ON sesiones_activas FOR SELECT USING (usuario_id = auth.uid());
CREATE POLICY "sesiones_admin"   ON sesiones_activas FOR SELECT USING (EXISTS (SELECT 1 FROM perfiles p WHERE p.id = auth.uid() AND p.rol IN ('ADMIN','SUPER_ADMIN')));

-- cargas_masivas y detalle
CREATE POLICY "cargas_admin"        ON cargas_masivas        FOR ALL USING (EXISTS (SELECT 1 FROM perfiles p WHERE p.id = auth.uid() AND p.rol IN ('ADMIN','SUPER_ADMIN')));
CREATE POLICY "cargas_detalle_admin" ON cargas_masivas_detalle FOR ALL USING (EXISTS (SELECT 1 FROM perfiles p WHERE p.id = auth.uid() AND p.rol IN ('ADMIN','SUPER_ADMIN')));

-- ============================================================
-- SECCIÓN 6: DATOS INICIALES
-- ============================================================

-- Configuración del sistema
INSERT INTO configuracion_sistema (clave, valor, descripcion) VALUES
  ('horas_laborales_limite',     '48',                  'Horas laborales máximas para respuesta del agente'),
  ('nombre_empresa',             'BPM Consulting',       'Nombre de la empresa'),
  ('logo_url',                   '/logo-bpm.png',       'URL del logo principal'),
  ('version_sistema',            '1.0.0',               'Versión del sistema'),
  ('dias_expiracion_contrasena', '90',                  'Días de vigencia de la contraseña'),
  ('max_intentos_fallidos',      '5',                   'Intentos fallidos antes de bloquear cuenta'),
  ('minutos_bloqueo_cuenta',     '30',                  'Minutos de bloqueo tras intentos fallidos');

-- Tipos de monitoreo
INSERT INTO tipos_monitoreo (canal, nombre, descripcion) VALUES
  ('PRESENCIAL',   'Presencial',          'Atención presencial en punto de servicio'),
  ('INBOUND',      'Inbound',             'Llamadas entrantes al call center'),
  ('C2C',          'C2C (Click to Call)', 'Llamadas generadas por click to call'),
  ('OUT_WCB',      'OUT / WCB',           'Llamadas salientes y web call back'),
  ('VIDEOLLAMADA', 'Videollamada',        'Atención por videollamada'),
  ('VIRTUAL_CHAT', 'Virtual Chat',        'Atención por chat virtual');

-- Campaña de ejemplo
INSERT INTO campanas (nombre, descripcion, horas_laborales_limite) VALUES
  ('Secretaría de Movilidad', 'Canal de atención Secretaría de Movilidad Bogotá', 48);

-- ============================================================
-- SECCIÓN 7: ÍTEMS DE EVALUACIÓN
-- campana_id = NULL → aplica a TODAS las campañas del tipo
-- ============================================================
DO $$
DECLARE
  v_presencial UUID; v_inbound UUID; v_c2c UUID;
  v_out_wcb    UUID; v_video   UUID; v_chat UUID;
BEGIN
  SELECT id INTO v_presencial FROM tipos_monitoreo WHERE canal = 'PRESENCIAL';
  SELECT id INTO v_inbound    FROM tipos_monitoreo WHERE canal = 'INBOUND';
  SELECT id INTO v_c2c        FROM tipos_monitoreo WHERE canal = 'C2C';
  SELECT id INTO v_out_wcb    FROM tipos_monitoreo WHERE canal = 'OUT_WCB';
  SELECT id INTO v_video      FROM tipos_monitoreo WHERE canal = 'VIDEOLLAMADA';
  SELECT id INTO v_chat       FROM tipos_monitoreo WHERE canal = 'VIRTUAL_CHAT';

  -- ==== PRESENCIAL ====
  INSERT INTO items_evaluacion (tipo_monitoreo_id, campana_id, categoria, nombre, descripcion, orden) VALUES
    (v_presencial,NULL,'ERROR_NO_CRITICO','Guiones','Hace uso correcto y completo de los guiones establecidos (bienvenida, caracterización y despedida). Si se atiende otro ciudadano en la misma interacción, se debe dar de nuevo el guion de bienvenida.',1),
    (v_presencial,NULL,'ERROR_NO_CRITICO','Tiempos de espera','Uso correcto de los tiempos establecidos: justifica la espera, brinda el guion de solicitud, agradecimiento y motivo de ausencia del puesto.',2),
    (v_presencial,NULL,'ERROR_NO_CRITICO','Etiqueta de atención presencial','Personaliza la interacción llamando al ciudadano por su nombre, apellido o título a lo largo de la atención.',3),
    (v_presencial,NULL,'ERROR_NO_CRITICO','Lenguaje adecuado','Evita muletillas, onomatopeyas (>3 veces), diminutivos, legalismos sin aclarar, calificativos, extranjerismos ni formalismos como "ayudar" o "colaborar".',4),
    (v_presencial,NULL,'ERROR_NO_CRITICO','Prestar atención','Demuestra concentración; no hace repetir información ni preguntas innecesarias. Responde puntualmente la consulta.',5),
    (v_presencial,NULL,'ERROR_NO_CRITICO','Actitud de servicio','Genera vínculo de empatía, utiliza frases de cortesía, no interrumpe abruptamente, usa tono y ritmo de voz adecuado.',6),
    (v_presencial,NULL,'ERROR_NO_CRITICO','Controlar la interacción','Demuestra control, dominio y seguridad en la interacción.',7),
    (v_presencial,NULL,'ERROR_NO_CRITICO','Estructura de la interacción','Sigue la estructura: 1.Presentación, 2.Validación datos, 3.Caracterización, 4.Preguntas filtro, 5.Respuesta, 6.Confirmar claridad, 7.Cierre.',8),
    (v_presencial,NULL,'ERROR_NO_CRITICO','Ortografía y redacción','Información tipificada correcta (nombres y apellidos). Se afecta con 3+ errores de ortografía y redacción.',9),
    (v_presencial,NULL,'ERROR_CRITICO_NEGOCIO','Tiempo de atención','Duración acorde al requerimiento; sin tiempos prolongados de espera ni tiempos muertos sin justificar.',10),
    (v_presencial,NULL,'ERROR_CRITICO_NEGOCIO','Tipificación','Registra correctamente los datos del ciudadano. La tipificación es acorde al árbol de tipificación.',11),
    (v_presencial,NULL,'ERROR_CRITICO_NEGOCIO','Presentación personal','Presentación impecable: cabello, uñas, maquillaje, vestuario. Porta carnet y chaqueta correctamente. Puesto de trabajo en orden, sin alimentos ni dispositivos no autorizados.',12),
    (v_presencial,NULL,'ERROR_CRITICO_USUARIO_FINAL','Brinda información completa y concreta','Entrega información completa, oportuna, clara, correcta y veraz. Cumple políticas de la Entidad. Evita información adicional no requerida.',13),
    (v_presencial,NULL,'ERROR_CRITICO_USUARIO_FINAL','Hace uso correcto de las herramientas de consulta/gestión','Garantiza la búsqueda de la información en las diferentes herramientas de la entidad.',14),
    (v_presencial,NULL,'ERROR_CRITICO_USUARIO_FINAL','Preguntas filtro','Hace preguntas filtro para correcto direccionamiento e identificación del trámite o servicio.',15),
    (v_presencial,NULL,'ERROR_CRITICO_USUARIO_FINAL','Buen trato y amabilidad','Afectado si usa vocabulario indebido, trato irónico, agresivo, humillante o retador. La comunicación debe ser cordial.',16),
    (v_presencial,NULL,'ERROR_CRITICO_USUARIO_FINAL','Direccionamiento adecuado','Realiza direccionamiento correcto a otros canales según corresponda y acorde con las políticas de la entidad.',17),
    (v_presencial,NULL,'ERROR_CRITICO_CUMPLIMIENTO','Brindar Información Confidencial','Cumple la Ley 1581 de 2012. Evita solicitar información a terceros, de procesos internos o dar mala imagen de la entidad.',18);

  -- ==== INBOUND ====
  INSERT INTO items_evaluacion (tipo_monitoreo_id, campana_id, categoria, nombre, descripcion, orden) VALUES
    (v_inbound,NULL,'ERROR_NO_CRITICO','Guiones','Uso correcto de guiones de bienvenida, caracterización y despedida. Si atiende otro ciudadano en la misma interacción, da de nuevo el guion de bienvenida.',1),
    (v_inbound,NULL,'ERROR_NO_CRITICO','Tiempos de espera','Uso correcto de tiempos (2 min). Garantiza Hold. Valida continuidad del ciudadano. Evita mute.',2),
    (v_inbound,NULL,'ERROR_NO_CRITICO','Tiempos de atención','Contesta en los primeros 5 segundos. Se afecta si evidencia distracciones por conversaciones con compañeros.',3),
    (v_inbound,NULL,'ERROR_NO_CRITICO','Etiqueta Telefónica','Personaliza la interacción por nombre, apellido o título a lo largo de la llamada.',4),
    (v_inbound,NULL,'ERROR_NO_CRITICO','Lenguaje adecuado','Evita muletillas, onomatopeyas (>3 veces), diminutivos, legalismos sin aclarar, calificativos, extranjerismos ni formalismos.',5),
    (v_inbound,NULL,'ERROR_NO_CRITICO','Escucha activa','Demuestra concentración; no hace repetir. Responde puntualmente la consulta.',6),
    (v_inbound,NULL,'ERROR_NO_CRITICO','Actitud de servicio','Genera empatía, usa frases de cortesía, no interrumpe, usa tono y ritmo de voz adecuado.',7),
    (v_inbound,NULL,'ERROR_NO_CRITICO','Controlar la interacción','Control, dominio y seguridad. Evita tiempos muertos >8 segundos.',8),
    (v_inbound,NULL,'ERROR_NO_CRITICO','Estructura de la interacción','1.Presentación, 2.Validación datos, 3.Caracterización, 4.Preguntas filtro, 5.Respuesta, 6.Confirmar claridad, 7.Cierre.',9),
    (v_inbound,NULL,'ERROR_NO_CRITICO','Ortografía y redacción','Información tipificada correcta. Se afecta con 3+ errores.',10),
    (v_inbound,NULL,'ERROR_CRITICO_NEGOCIO','Cuelgue de llamada','Cuelgue Pasivo: tiempos prolongados provocando que el ciudadano finalice. Cuelgue Activo: asesor finaliza deliberadamente sin dar solución.',11),
    (v_inbound,NULL,'ERROR_CRITICO_NEGOCIO','Tipificación','Registra correctamente la tipificación según el árbol de tipificación.',12),
    (v_inbound,NULL,'ERROR_CRITICO_NEGOCIO','Encuesta de satisfacción','Realiza la invitación y transferencia a encuesta de satisfacción al final de la atención.',13),
    (v_inbound,NULL,'ERROR_CRITICO_USUARIO_FINAL','Brinda información completa y concreta','Información completa, oportuna, clara, correcta y veraz. Evita información adicional no requerida.',14),
    (v_inbound,NULL,'ERROR_CRITICO_USUARIO_FINAL','Hace uso correcto de las herramientas de consulta/gestión','Garantiza la búsqueda en las herramientas de la entidad.',15),
    (v_inbound,NULL,'ERROR_CRITICO_USUARIO_FINAL','Preguntas filtro','Preguntas filtro para correcto direccionamiento e identificación del trámite.',16),
    (v_inbound,NULL,'ERROR_CRITICO_USUARIO_FINAL','Buen trato y amabilidad','Afectado si usa vocabulario indebido, trato irónico, agresivo, humillante o retador.',17),
    (v_inbound,NULL,'ERROR_CRITICO_USUARIO_FINAL','Direccionamiento adecuado','Direccionamiento correcto según corresponda y acorde con las políticas.',18),
    (v_inbound,NULL,'ERROR_CRITICO_CUMPLIMIENTO','Información confidencial','Cumple Ley 1581 de 2012. Evita solicitar información a terceros o dar mala imagen de la entidad.',19);

  -- C2C = mismos ítems que Inbound
  INSERT INTO items_evaluacion (tipo_monitoreo_id, campana_id, categoria, nombre, descripcion, orden)
    SELECT v_c2c, campana_id, categoria, nombre, descripcion, orden
    FROM items_evaluacion WHERE tipo_monitoreo_id = v_inbound;

  -- ==== OUT / WCB ====
  INSERT INTO items_evaluacion (tipo_monitoreo_id, campana_id, categoria, nombre, descripcion, orden) VALUES
    (v_out_wcb,NULL,'ERROR_NO_CRITICO','Guiones','Uso correcto de guiones. Si atiende otro ciudadano, da de nuevo el guion de bienvenida.',1),
    (v_out_wcb,NULL,'ERROR_NO_CRITICO','Tiempos de espera','Uso correcto de tiempos (2 min). Garantiza Hold. Evita mute.',2),
    (v_out_wcb,NULL,'ERROR_NO_CRITICO','Etiqueta Telefónica','Personaliza la interacción a lo largo de la llamada.',3),
    (v_out_wcb,NULL,'ERROR_NO_CRITICO','Lenguaje adecuado','Evita muletillas, onomatopeyas, diminutivos, legalismos sin aclarar, calificativos, extranjerismos ni formalismos.',4),
    (v_out_wcb,NULL,'ERROR_NO_CRITICO','Escucha activa','Concentración en la comunicación. Responde puntualmente la consulta.',5),
    (v_out_wcb,NULL,'ERROR_NO_CRITICO','Actitud de servicio','Empatía, frases de cortesía, no interrumpe, tono adecuado.',6),
    (v_out_wcb,NULL,'ERROR_NO_CRITICO','Controlar la interacción','Control, dominio y seguridad. Evita tiempos muertos >8 segundos.',7),
    (v_out_wcb,NULL,'ERROR_NO_CRITICO','Estructura de la interacción','1.Presentación, 2.Validación datos, 3.Caracterización, 4.Preguntas filtro, 5.Respuesta, 6.Confirmar claridad, 7.Cierre.',8),
    (v_out_wcb,NULL,'ERROR_NO_CRITICO','Ortografía y redacción','Información tipificada correcta. Se afecta con 3+ errores.',9),
    (v_out_wcb,NULL,'ERROR_CRITICO_NEGOCIO','Cuelgue de llamada','Cuelgue Pasivo o Activo. No puede finalizar sin dar solución al requerimiento.',10),
    (v_out_wcb,NULL,'ERROR_CRITICO_NEGOCIO','Tipificación','Registra correctamente la tipificación según el árbol.',11),
    (v_out_wcb,NULL,'ERROR_CRITICO_USUARIO_FINAL','Brinda información completa y concreta','Información completa, oportuna, clara, correcta y veraz.',12),
    (v_out_wcb,NULL,'ERROR_CRITICO_USUARIO_FINAL','Hace uso correcto de las herramientas de consulta/gestión','Garantiza la búsqueda en las herramientas.',13),
    (v_out_wcb,NULL,'ERROR_CRITICO_USUARIO_FINAL','Preguntas filtro','Preguntas filtro para correcto direccionamiento.',14),
    (v_out_wcb,NULL,'ERROR_CRITICO_USUARIO_FINAL','Buen trato y amabilidad','Afectado con vocabulario indebido, trato irónico o agresivo.',15),
    (v_out_wcb,NULL,'ERROR_CRITICO_USUARIO_FINAL','Direccionamiento adecuado','Direccionamiento correcto según corresponda.',16),
    (v_out_wcb,NULL,'ERROR_CRITICO_CUMPLIMIENTO','Información confidencial','Cumple Ley 1581 de 2012.',17);

  -- ==== VIDEOLLAMADA ====
  INSERT INTO items_evaluacion (tipo_monitoreo_id, campana_id, categoria, nombre, descripcion, orden) VALUES
    (v_video,NULL,'ERROR_NO_CRITICO','Guiones','Uso correcto de guiones. Si atiende otro ciudadano, da de nuevo el guion de bienvenida.',1),
    (v_video,NULL,'ERROR_NO_CRITICO','Tiempos de espera y atención','Uso correcto de tiempos (2 min). Protocolos de cámara. Contesta en primeros 5 segundos. Sin distracciones.',2),
    (v_video,NULL,'ERROR_NO_CRITICO','Presentación personal','Presentación impecable: cabello, uñas, maquillaje, accesorios, barba. Chaqueta y pendón correctos. Cámara limpia.',3),
    (v_video,NULL,'ERROR_NO_CRITICO','Etiqueta Telefónica','Personaliza la interacción por nombre a lo largo de la videollamada.',4),
    (v_video,NULL,'ERROR_NO_CRITICO','Lenguaje adecuado','Evita muletillas, onomatopeyas, diminutivos, legalismos sin aclarar, extranjerismos ni formalismos.',5),
    (v_video,NULL,'ERROR_NO_CRITICO','Prestar atención','Concentración, sin hacer repetir. Responde puntualmente.',6),
    (v_video,NULL,'ERROR_NO_CRITICO','Actitud de servicio','Empatía, frases de cortesía, conversación modulada y vocalizada.',7),
    (v_video,NULL,'ERROR_NO_CRITICO','Controlar la interacción','Control, dominio y seguridad. Evita tiempos muertos >8 segundos.',8),
    (v_video,NULL,'ERROR_NO_CRITICO','Estructura de la interacción','1.Presentación, 2.Validación datos, 3.Caracterización, 4.Preguntas filtro, 5.Respuesta, 6.Confirmar claridad, 7.Cierre.',9),
    (v_video,NULL,'ERROR_NO_CRITICO','Ortografía y redacción','Información tipificada correcta. Se afecta con 3+ errores.',10),
    (v_video,NULL,'ERROR_CRITICO_NEGOCIO','Cuelgue de llamada','Cuelgue Pasivo: espera prolongada sin acompañamiento. Cuelgue Activo: finaliza deliberadamente sin solución.',11),
    (v_video,NULL,'ERROR_CRITICO_NEGOCIO','Tipificación','Registra correctamente la tipificación según el árbol.',12),
    (v_video,NULL,'ERROR_CRITICO_NEGOCIO','Encuesta de satisfacción','Realiza la invitación y transferencia a encuesta al final.',13),
    (v_video,NULL,'ERROR_CRITICO_USUARIO_FINAL','Brinda información completa y concreta','Información completa, oportuna, clara, correcta y veraz.',14),
    (v_video,NULL,'ERROR_CRITICO_USUARIO_FINAL','Hace uso correcto de las herramientas de consulta/gestión','Garantiza la búsqueda en las herramientas.',15),
    (v_video,NULL,'ERROR_CRITICO_USUARIO_FINAL','Preguntas filtro','Preguntas filtro para correcto direccionamiento.',16),
    (v_video,NULL,'ERROR_CRITICO_USUARIO_FINAL','Buen trato y amabilidad','Afectado con vocabulario indebido, trato irónico, agresivo o humillante. Comunicación no verbal cordial.',17),
    (v_video,NULL,'ERROR_CRITICO_USUARIO_FINAL','Direccionamiento adecuado','Direccionamiento correcto según corresponda.',18),
    (v_video,NULL,'ERROR_CRITICO_CUMPLIMIENTO','Información confidencial','Cumple Ley 1581 de 2012.',19);

  -- ==== VIRTUAL CHAT ====
  INSERT INTO items_evaluacion (tipo_monitoreo_id, campana_id, categoria, nombre, descripcion, orden) VALUES
    (v_chat,NULL,'ERROR_NO_CRITICO','Guiones','Uso correcto de guiones. Si atiende otro ciudadano, da de nuevo el guion de bienvenida.',1),
    (v_chat,NULL,'ERROR_NO_CRITICO','Tiempos de espera','Uso correcto de tiempos (2 min). Garantiza Hold. Valida continuidad. Evita mute.',2),
    (v_chat,NULL,'ERROR_NO_CRITICO','Uso de plantillas','Usa plantillas establecidas por el área de calidad sin cambiar la idea o información del trámite.',3),
    (v_chat,NULL,'ERROR_NO_CRITICO','Etiqueta atención escrita','Personaliza la interacción por nombre a lo largo del chat.',4),
    (v_chat,NULL,'ERROR_NO_CRITICO','Lenguaje adecuado','Evita muletillas, onomatopeyas, diminutivos, legalismos sin aclarar, extranjerismos ni formalismos.',5),
    (v_chat,NULL,'ERROR_NO_CRITICO','Prestar atención','Concentración, sin hacer repetir. Responde puntualmente.',6),
    (v_chat,NULL,'ERROR_NO_CRITICO','Actitud de servicio','Empatía, dinamismo, frases de cortesía.',7),
    (v_chat,NULL,'ERROR_NO_CRITICO','Estructura de la interacción','1.Presentación, 2.Validación datos, 3.Caracterización, 4.Preguntas filtro, 5.Respuesta, 6.Confirmar claridad, 7.Cierre.',8),
    (v_chat,NULL,'ERROR_NO_CRITICO','Controlar la interacción','Control, dominio y seguridad en la interacción.',9),
    (v_chat,NULL,'ERROR_CRITICO_NEGOCIO','Cuelgue','Cuelgue Pasivo o Activo en el canal de chat.',10),
    (v_chat,NULL,'ERROR_CRITICO_NEGOCIO','Ortografía y redacción','Ideas ordenadas y coherentes. Se afecta con 3+ errores o cuando el error altera el sentido de la información.',11),
    (v_chat,NULL,'ERROR_CRITICO_NEGOCIO','Tipificación','Registra correctamente la tipificación según el árbol.',12),
    (v_chat,NULL,'ERROR_CRITICO_NEGOCIO','Encuesta de satisfacción','Realiza la invitación y transferencia a encuesta al final del chat.',13),
    (v_chat,NULL,'ERROR_CRITICO_USUARIO_FINAL','Brinda información completa y concreta','Información completa, oportuna, clara, correcta y veraz.',14),
    (v_chat,NULL,'ERROR_CRITICO_USUARIO_FINAL','Hace uso correcto de las herramientas de consulta/gestión','Garantiza la búsqueda en las herramientas.',15),
    (v_chat,NULL,'ERROR_CRITICO_USUARIO_FINAL','Preguntas filtro','Preguntas filtro para correcto direccionamiento.',16),
    (v_chat,NULL,'ERROR_CRITICO_USUARIO_FINAL','Direccionamiento adecuado','Direccionamiento correcto según corresponda.',17),
    (v_chat,NULL,'ERROR_CRITICO_USUARIO_FINAL','Buen trato y amabilidad','Cordialidad e interés. Afectado con vocabulario indebido, trato irónico o agresivo.',18),
    (v_chat,NULL,'ERROR_CRITICO_CUMPLIMIENTO','Información confidencial','Cumple Ley 1581 de 2012.',19);

END $$;

-- ============================================================
-- SECCIÓN 8: PERMISOS POR ROL
-- ============================================================

INSERT INTO permisos_rol (rol, permiso, habilitado) VALUES
  ('AGENTE',        'ver_mis_monitoreos',     TRUE),
  ('AGENTE',        'ver_mi_perfil',          TRUE),
  ('SUPERVISOR',    'ver_monitoreos_campana', TRUE),
  ('SUPERVISOR',    'evaluar_refutaciones',   TRUE),
  ('SUPERVISOR',    'ver_reportes_campana',   TRUE),
  ('SUPERVISOR',    'restablecer_contrasena', TRUE),
  ('LIDER_CALIDAD', 'crear_monitoreo',        TRUE),
  ('LIDER_CALIDAD', 'editar_monitoreo',       TRUE),
  ('LIDER_CALIDAD', 'validacion_final',       TRUE),
  ('LIDER_CALIDAD', 'ver_reportes',           TRUE),
  ('LIDER_CALIDAD', 'descargar_pdf',          TRUE),
  ('MINERO',        'ver_reportes',           TRUE),
  ('MINERO',        'ver_metricas',           TRUE),
  ('MINERO',        'descargar_reportes',     TRUE),
  ('MINERO',        'exportar_datos',         TRUE),
  ('ADMIN',         'gestionar_usuarios',     TRUE),
  ('ADMIN',         'gestionar_campanas',     TRUE),
  ('ADMIN',         'configurar_sistema',     TRUE),
  ('ADMIN',         'ver_todos_monitoreos',   TRUE),
  ('ADMIN',         'ver_reportes',           TRUE),
  ('ADMIN',         'restablecer_contrasena', TRUE),
  ('ADMIN',         'carga_masiva_agentes',   TRUE),
  ('ADMIN',         'ver_auditoria',          TRUE),
  ('SUPER_ADMIN',   'acceso_total',           TRUE),
  ('SUPER_ADMIN',   'gestionar_permisos',     TRUE),
  ('SUPER_ADMIN',   'ver_auditoria',          TRUE),
  ('SUPER_ADMIN',   'restablecer_contrasena', TRUE),
  ('SUPER_ADMIN',   'carga_masiva_agentes',   TRUE);
