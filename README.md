# ObraManager — Sistema de gestión para contratistas

Aplicación Next.js 15 + Supabase para administrar proyectos, RRHH, finanzas, cotizaciones, clientes y más.

## 📦 Contenido de esta versión

- ✅ Autenticación (Supabase Auth)
- ✅ Dashboard con métricas
- ✅ Proyectos (CRUD)
- ✅ RRHH / Empleados (CRUD)
- ✅ Facturación
- ✅ Finanzas
- ✅ Proveedores
- ✅ Contratos
- ✅ **Cotizaciones con partidas e IVA**
- ✅ **Clientes con validación de RUT chileno**
- ✅ **Configuración de empresa (logo, datos, color corporativo)**

## 🚀 Instalación

### 1. Crear proyecto en Supabase

1. Ve a [supabase.com](https://supabase.com) → New Project
2. Una vez creado, ve a **Settings → API**
3. Copia `Project URL` y `anon public` key

### 2. Configurar variables de entorno

```bash
cp .env.local.example .env.local
```

Edita `.env.local` con tus claves de Supabase.

### 3. Ejecutar los SQL en orden

Abre **Supabase → SQL Editor** y ejecuta los archivos de la carpeta `sql/` **en este orden exacto**:

1. `sql/01_schema_base.sql` — Tablas base (proyectos, empleados, proveedores, contratos, facturas)
2. `sql/02_cotizaciones.sql` — Cotizaciones con partidas
3. `sql/03_empresa_config.sql` — Configuración de empresa + bucket de Storage para logos
4. `sql/04_clientes.sql` — Clientes con RUT + vínculo a cotizaciones

⚠️ Cada SQL debe terminar con "Success. No rows returned" antes de pasar al siguiente.

### 4. Instalar dependencias y correr

```bash
npm install
npm run dev
```

Abre `http://localhost:3000`. La primera vez te pide crear una cuenta (Supabase enviará un correo de confirmación).

## 📂 Estructura del proyecto

```
obramanager/
├── app/
│   ├── (protected)/        ← Rutas que requieren login
│   │   ├── clientes/
│   │   ├── configuracion/
│   │   ├── contratos/
│   │   ├── cotizaciones/
│   │   ├── facturacion/
│   │   ├── finanzas/
│   │   ├── proveedores/
│   │   ├── proyectos/
│   │   ├── rrhh/
│   │   └── layout.tsx
│   ├── api/                ← Endpoints REST
│   ├── auth/login/         ← Página de login
│   ├── dashboard/          ← Dashboard principal
│   ├── layout.tsx
│   ├── page.tsx            ← Redirect a /dashboard o /auth/login
│   └── globals.css
├── components/
│   ├── Sidebar.tsx         ← Menú lateral
│   ├── ui.tsx              ← Componentes UI client (Modal, Btn, FormInput…)
│   └── ui-server.tsx       ← Componentes UI safe para Server Components
├── lib/
│   ├── supabase.ts         ← Cliente Supabase (browser)
│   ├── supabase-server.ts  ← Cliente Supabase (server)
│   ├── format.ts           ← Helpers de formato (fmt, fmtM)
│   └── rut.ts              ← Validación de RUT chileno
├── types/
│   ├── cliente.ts
│   ├── cotizaciones.ts
│   └── empresa.ts
├── sql/                    ← Migraciones para Supabase
├── middleware.ts           ← Protección de rutas
├── next.config.ts
├── package.json
└── tsconfig.json
```

## 🎨 Personalización

Una vez que entres con tu cuenta, ve a **Admin → Configuración** para:

- Subir el logo de tu empresa
- Llenar los datos (razón social, RUT, dirección, etc.)
- Elegir tu color corporativo (se usa en los PDFs)

Esto luego aparecerá en los PDFs de cotización.

## 🛠 Próximos pasos planificados

- [ ] PDF descargable de cotización con logo
- [ ] Subida de documentos (planos, fotos) por proyecto
- [ ] Multi-usuario por empresa (roles)
- [ ] Suscripciones con Mercado Pago

## 💡 Notas

- El bucket de Supabase Storage para logos se llama `empresa-logos` y es público (necesario para que los logos se muestren en PDFs).
- Cada usuario solo ve sus propios datos (Row Level Security activado en todas las tablas).
- Validación de RUT chileno incluida con módulo 11.
