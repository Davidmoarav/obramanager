# ObraManager v3 — Sistema de gestión para contratistas

Aplicación Next.js 15 + Supabase para administrar proyectos, RRHH, finanzas, cotizaciones, clientes, configuración de empresa y generación de PDFs.

## 📦 Contenido de esta versión

- ✅ Autenticación (Supabase Auth)
- ✅ Dashboard con métricas
- ✅ Proyectos, RRHH, Facturación, Finanzas, Proveedores, Contratos
- ✅ **Cotizaciones con partidas e IVA chileno (19%)**
- ✅ **Clientes con validación de RUT chileno**
- ✅ **Configuración de empresa (logo, datos, color corporativo)**
- ✅ **PDF descargable de cotizaciones con logo y datos del cliente**

## 🚀 Instalación

### 1. Crear proyecto en Supabase
1. Ve a [supabase.com](https://supabase.com) → New Project
2. Settings → API → copia `Project URL` y `anon public` key

### 2. Configurar variables de entorno
```bash
cp .env.local.example .env.local
```
Edita `.env.local` con tus claves.

### 3. Ejecutar SQL en orden
Abre **Supabase → SQL Editor** y ejecuta los archivos de `sql/` EN ORDEN:

1. `sql/01_schema_base.sql`
2. `sql/02_cotizaciones.sql`
3. `sql/03_empresa_config.sql`
4. `sql/04_clientes.sql`

### 4. Instalar y correr
```bash
npm install
npm run dev
```

## 🎨 Configuración inicial

1. Crear cuenta en `/auth/login` (confirma el correo)
2. Ir a **Admin → Configuración** y llenar datos de la empresa + subir logo
3. Ir a **Operaciones → Clientes** y crear al menos un cliente
4. Crear primera cotización y descargar el PDF

## 📂 Estructura

```
obramanager/
├── app/
│   ├── (protected)/        ← Rutas con login
│   ├── api/                ← Endpoints REST
│   ├── auth/login/
│   ├── dashboard/
│   └── ...
├── components/
│   ├── Sidebar.tsx
│   ├── CotizacionPDF.tsx   ← Plantilla PDF
│   ├── DescargarPDFBtn.tsx
│   ├── ui.tsx
│   └── ui-server.tsx
├── lib/
│   ├── supabase.ts
│   ├── supabase-server.ts
│   ├── format.ts
│   └── rut.ts              ← Validación RUT chileno
├── types/
└── sql/                    ← Migraciones para Supabase
```
