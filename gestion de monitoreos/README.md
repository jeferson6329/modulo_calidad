# 📋 Sistema de Gestión de Calidad

Sistema integral de monitoreo y control de calidad construido con **Next.js 15**, **Supabase**, **Resend** y **TypeScript**.

---

## 🚀 Stack

| Tecnología | Uso |
|---|---|
| Next.js 15 (App Router) | Frontend + API Routes |
| Supabase | Base de datos (PostgreSQL) + Auth + Storage |
| Resend | Envío de emails |
| TypeScript | Tipado estático |
| Tailwind CSS | Estilos |
| jsPDF | Generación de PDFs |
| React Hook Form + Zod | Formularios y validación |

---

## 👥 Roles

| Rol | Descripción |
|---|---|
| **Agente** | Ve sus monitoreos, acepta/refuta, registra compromiso |
| **Supervisor** | Evalúa refutaciones de su campaña |
| **Líder de Calidad** | Crea monitoreos, validación final |
| **Minero** | Métricas, reportes y exportaciones |
| **Admin** | Gestiona usuarios, campañas y configuración |
| **Super Admin** | Acceso total + gestión de permisos granulares |

---

## 🔄 Flujo de Monitoreo

```
Líder crea monitoreo
      ↓
Agente revisa (48h laborales)
   ├── ACEPTA → ✅ FIN
   └── REFUTA (con justificación)
               ↓
         Supervisor evalúa
         ├── RECHAZA → Regresa al Agente
         └── APRUEBA → Líder valida
                           ├── VALIDA → ✅ FIN
                           └── RECHAZA → Regresa al Agente
```

---

## 📊 Scoring

| Categoría | Peso | Comportamiento |
|---|---|---|
| Errores No Críticos | 25% | Promedio de ítems |
| Errores Críticos de Negocio | 30% | Si falla 1 → categoría = 0 |
| Errores Críticos de Usuario Final | 30% | Si falla 1 → categoría = 0 |
| Errores Críticos de Cumplimiento | 15% | Promedio de ítems |

**Fórmula:** `Nota = (ECN×25%) + (ECNEG×30%) + (ECUF×30%) + (ECC×15%)`

---

## 🛠️ Instalación

### 1. Instalar dependencias
```bash
npm install
```

### 2. Configurar Supabase
1. Crea un proyecto en [supabase.com](https://supabase.com)
2. Ve a **SQL Editor** y ejecuta el contenido de `supabase/schema.sql`
3. Copia tus credenciales al archivo `.env.local`

### 3. Configurar Resend
1. Crea una cuenta en [resend.com](https://resend.com)
2. Genera una API key
3. Agrégala a `.env.local` como `RESEND_API_KEY`

### 4. Variables de entorno
Edita `.env.local` con tus valores:
```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
RESEND_API_KEY=re_xxxxxxxxxx
RESEND_FROM_EMAIL=noreply@tudominio.com
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 5. Ejecutar
```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000)

---

## 📁 Estructura

```
├── app/
│   ├── (auth)/           # Login, recuperar contraseña
│   ├── (dashboard)/      # Panel principal
│   │   └── dashboard/
│   │       ├── monitoreos/    # CRUD monitoreos
│   │       ├── reportes/      # Métricas y exportación
│   │       ├── usuarios/      # Gestión de usuarios
│   │       ├── campanas/      # Gestión de campañas
│   │       ├── permisos/      # Permisos por rol (Super Admin)
│   │       ├── validaciones/  # Validaciones pendientes (Líder)
│   │       └── refutaciones/  # Refutaciones pendientes (Supervisor)
│   └── api/              # API Routes
├── components/           # Componentes React
│   ├── layout/           # Sidebar, Header
│   ├── dashboard/        # Dashboards por rol
│   ├── monitoreos/       # Formularios y detalle
│   ├── reportes/         # Panel de métricas
│   ├── usuarios/         # Gestión de usuarios
│   ├── campanas/         # Gestión de campañas
│   └── permisos/         # Gestión de permisos
├── lib/
│   ├── supabase/         # Clientes (client, server, middleware)
│   ├── scoring.ts        # Lógica de cálculo de scores
│   ├── pdf-generator.ts  # Generación de PDFs
│   ├── email.ts          # Emails con Resend
│   └── utils.ts          # Utilidades generales
├── types/
│   └── index.ts          # Tipos TypeScript centrales
└── supabase/
    └── schema.sql        # Schema completo de base de datos
```

---

## 📄 Generación de PDF

El PDF descargable replica el formato del documento de retroalimentación oficial, incluyendo:
- Encabezado con N° monitoreo, agente, analista y fechas
- Scores por categoría (ECN, ECUF, ECC, ENC)
- Tabla de ítems CUMPLE/NO CUMPLE por sección
- Descripción de llamada, aspectos positivos/a mejorar
- Compromiso del agente
- Sección de firmas

---

## 📧 Notificaciones por Email

El sistema envía emails automáticos en cada cambio de estado:

| Evento | Destinatario |
|---|---|
| Nuevo monitoreo creado | Agente |
| Monitoreo refutado | Supervisor de la campaña |
| Refutación aprobada | Líder de Calidad |
| Retorno al asesor | Agente |
| Monitoreo validado/aceptado | Agente |
| Recordatorio de plazo | Agente |
