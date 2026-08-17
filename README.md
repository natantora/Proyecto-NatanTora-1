# Midrash Natán Torá — natantora.com

Sitio web del Midrash Natán Torá, Plaza Polanco, CDMX.

## Stack
- **Next.js 16** (App Router)
- **PostgreSQL en Railway** (base de datos)
- **Sesiones propias firmadas** (autenticación y permisos)
- **Railway Storage Bucket** (galería, audio y video)
- **Tailwind CSS** (Styling)
- **Railway** (Hosting)

## Setup
1. Clone the repo
2. `npm install`
3. Copia `.env.example` como `.env.local` y configura PostgreSQL
4. Ejecuta `npm run db:migrate`
5. Ejecuta `npm run dev`

## Railway

El servicio web necesita estas referencias:

- `DATABASE_URL=${{Postgres.DATABASE_URL}}`
- `INITIAL_OWNER_EMAIL` con el correo de la primera cuenta propietaria

Para archivos, conecta un Storage Bucket de Railway mediante la inyección
automática de credenciales. Las migraciones se ejecutan automáticamente antes
de cada despliegue.

## Admin Access
Login at `/auth/login` with your admin account.
Admin panel at `/admin`.
