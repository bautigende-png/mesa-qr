# Mesa Lista

MVP production-ready para asistencia de mesas con Next.js App Router, TypeScript, Tailwind y Supabase.

## Qué incluye

- Cliente público en `/t/[tableId]`
- Login y panel de mozos en `/waiter`
- Login y panel admin en `/admin`
- Eventos `CALL_WAITER` y `REQUEST_BILL`
- Cooldown anti-spam por acción, mesa y `session_id`
- Supabase Auth con roles `ADMIN` y `WAITER`
- Realtime con Supabase Realtime y polling fallback cada 5s
- CRUD de mesas, settings, usuarios mozo, QR descargable e impresión
- SQL schema, RLS, seed, middleware y estructura PWA-ready

## Stack

- Next.js 15 App Router
- React 19
- TypeScript
- Tailwind CSS
- Supabase Auth + Postgres + Realtime

## Setup local

1. Instalar dependencias:

```bash
npm install
```

2. Crear `.env.local` a partir de [.env.example](/Users/bautistagende/Downloads/2026-01-monthly/.env.example)

3. Crear proyecto en Supabase y correr:

```sql
-- primero
\i sql/schema.sql

-- después
\i sql/seed.sql
```

Si usás el editor SQL de Supabase, pegá primero el contenido de [schema.sql](/Users/bautistagende/Downloads/2026-01-monthly/sql/schema.sql) y después el de [seed.sql](/Users/bautistagende/Downloads/2026-01-monthly/sql/seed.sql).

4. Crear el primer usuario admin:

- En Supabase Auth, creá un usuario con email/password.
- Iniciá sesión una vez o dejá que el trigger cree el perfil.
- Ejecutá:

```sql
update public.profiles
set role = 'ADMIN'
where email = 'admin@restaurant.com';
```

5. Levantar la app:

```bash
npm run dev
```

## Migracion de branding

Si ya habías creado la base antes de agregar personalización de marca, corré también:

```sql
\i sql/2026-03-20-branding-settings.sql
```

O pegá el contenido de [2026-03-20-branding-settings.sql](/Users/bautistagende/Downloads/2026-01-monthly/sql/2026-03-20-branding-settings.sql) en el SQL Editor de Supabase.

## Variables de entorno

- `NEXT_PUBLIC_APP_URL`: URL pública de la app, usada para generar QR
- `NEXT_PUBLIC_SUPABASE_URL`: URL del proyecto Supabase
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: anon key
- `SUPABASE_SERVICE_ROLE_KEY`: requerida en server routes para alta/baja de mozos

## Modelo de datos

- `profiles`: vínculo con `auth.users` y rol
- `restaurant_tables`: mesas y URLs externas
- `settings`: nombre del restaurante y menú global
- `events`: eventos de llamado de mozo o cuenta

## Realtime

El panel de mozo escucha cambios en `public.events` vía Supabase Realtime. Si el canal falla o se retrasa, también refresca por polling cada 5 segundos.

## Deploy

### Vercel

1. Importar el repo/proyecto.
2. Configurar las 4 variables de entorno.
3. Deploy.

### Supabase

1. Activar Realtime para la tabla `events`.
2. Verificar que el proyecto tenga las políticas RLS del archivo [schema.sql](/Users/bautistagende/Downloads/2026-01-monthly/sql/schema.sql).
3. Crear el primer admin manualmente.

## Notas operativas

- El botón principal del cliente abre `ordering_url` de la mesa. Si no existe una URL válida, cae a `menu_url_override` y luego a `global_menu_url`.
- Los eventos se guardan con email del cliente y `marketing_opt_in`.
- El cooldown de 60 segundos se valida del lado servidor.
- El alta de mozos usa `SUPABASE_SERVICE_ROLE_KEY`, por eso nunca debe exponerse al cliente.

## Próximos pasos recomendados

- Agregar tests E2E con Playwright
- Sumar estados de audio configurables y kiosko fullscreen para el panel mozo
- Añadir export CSV para historial
