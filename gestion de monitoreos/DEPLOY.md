# 🚀 Guía de despliegue — Sistema de Gestión de Calidad

## Paso 1 — Preparar Supabase

### 1.1 Crear el proyecto
1. Ir a [supabase.com](https://supabase.com) → **New project**
2. Anotar la contraseña de la base de datos (guárdala, no se puede recuperar)
3. Esperar que el proyecto esté listo (~2 minutos)

### 1.2 Ejecutar el schema
1. Ir a **SQL Editor** en el panel de Supabase
2. Hacer clic en **New query**
3. Pegar el contenido completo de `supabase/schema.sql`
4. Hacer clic en **Run** (▶)
5. Verificar que no haya errores en el panel inferior

### 1.3 Obtener las credenciales
Ir a **Settings → API**:
- `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
- `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `service_role` → `SUPABASE_SERVICE_ROLE_KEY` ⚠️ nunca la expongas

### 1.4 Configurar autenticación
1. Ir a **Authentication → URL Configuration**
2. En **Site URL**: poner la URL de tu app en Vercel (ej: `https://mi-app.vercel.app`)
3. En **Redirect URLs**: agregar:
   - `https://mi-app.vercel.app/reset-password`
   - `http://localhost:3000/reset-password` (para desarrollo)

### 1.5 Crear el primer Super Admin
1. Ir a **Authentication → Users** → **Add user**
2. Crear el usuario con email y contraseña
3. Ir a **Table Editor → perfiles**
4. Cambiar el `rol` de ese usuario a `SUPER_ADMIN`

---

## Paso 2 — Preparar Resend

1. Ir a [resend.com](https://resend.com) → crear cuenta
2. Ir a **API Keys** → **Create API Key** → copiar la clave
3. Ir a **Domains** → **Add Domain** → agregar tu dominio
4. Seguir las instrucciones DNS para verificarlo
5. Una vez verificado, usar `noreply@tudominio.com` como `RESEND_FROM_EMAIL`

> **Alternativa para pruebas:** Resend permite enviar desde `onboarding@resend.dev` sin verificar dominio, pero solo a tu propio email.

---

## Paso 3 — Desplegar en Vercel

### 3.1 Subir el código a GitHub
```bash
# En la carpeta del proyecto
git init
git add .
git commit -m "feat: sistema de gestión de calidad v1.0"
git branch -M main
git remote add origin https://github.com/tu-usuario/tu-repo.git
git push -u origin main
```

> **Importante:** El archivo `.env.local` está en `.gitignore` — nunca se sube al repo.

### 3.2 Conectar con Vercel
1. Ir a [vercel.com](https://vercel.com) → **Add New Project**
2. Importar el repositorio de GitHub
3. Framework: **Next.js** (detección automática)
4. **NO hacer clic en Deploy todavía** — primero configurar las variables

### 3.3 Configurar variables de entorno en Vercel
En la pantalla de configuración del proyecto, ir a **Environment Variables** y agregar:

| Nombre | Valor | Entornos |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxx.supabase.co` | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` | Production, Preview, Development |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | Production, Preview, Development |
| `RESEND_API_KEY` | `re_xxx...` | Production, Preview, Development |
| `RESEND_FROM_EMAIL` | `noreply@tudominio.com` | Production, Preview, Development |
| `NEXT_PUBLIC_APP_URL` | `https://tu-app.vercel.app` | Production |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | Development |
| `NEXT_PUBLIC_APP_NAME` | `Sistema de Gestión de Calidad` | Production, Preview, Development |

### 3.4 Desplegar
1. Hacer clic en **Deploy**
2. Esperar ~3 minutos
3. Vercel mostrará la URL de producción

---

## Paso 4 — Verificar el despliegue

### Checklist post-deploy
- [ ] La página de login carga correctamente
- [ ] Puedes iniciar sesión con el Super Admin
- [ ] El dashboard muestra el contenido correcto según el rol
- [ ] Crear un monitoreo de prueba funciona
- [ ] El PDF se genera correctamente
- [ ] Llega el email al agente al crear el monitoreo
- [ ] El cambio de contraseña funciona
- [ ] Un agente NO puede acceder a `/dashboard/usuarios`

---

## Paso 5 — Dominio personalizado (opcional)

1. En Vercel → tu proyecto → **Settings → Domains**
2. Agregar tu dominio (ej: `calidad.miempresa.com`)
3. Configurar los registros DNS según indique Vercel
4. Actualizar `NEXT_PUBLIC_APP_URL` en Vercel con el nuevo dominio
5. Actualizar **Site URL** en Supabase con el nuevo dominio

---

## Comandos de desarrollo local

```bash
# Instalar dependencias
npm install

# Correr en modo desarrollo
npm run dev
# → http://localhost:3000

# Build de producción (verificar antes de subir)
npm run build
npm run start
```

---

## Estructura de archivos clave

```
├── supabase/
│   └── schema.sql          ← Schema completo (único archivo — ejecutar una sola vez)
├── .env.local              ← Variables locales (NO subir a git)
├── .env.example            ← Plantilla de variables (sí subir)
└── DEPLOY.md               ← Esta guía
```

---

## Solución de problemas comunes

### "Invalid API key" al hacer login
→ Verificar que `NEXT_PUBLIC_SUPABASE_ANON_KEY` esté correctamente copiada en Vercel.

### Los emails no llegan
→ Verificar que el dominio en Resend esté verificado y que `RESEND_FROM_EMAIL` use ese dominio.

### "relation does not exist" en consultas
→ El schema no se ejecutó correctamente. Volver al paso 1.2.

### El PDF no descarga
→ Revisar la consola del navegador. Si el error es de `jsPDF`, verificar que `npm install` se ejecutó correctamente.

### Acceso denegado después de hacer login
→ El rol del usuario en la tabla `perfiles` no corresponde. Verificarlo en Supabase → Table Editor → perfiles.

### Error 500 en `/api/usuarios/carga-masiva`
→ La `SUPABASE_SERVICE_ROLE_KEY` no está configurada o es incorrecta.
