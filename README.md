# SQL Server Block Monitor

Dashboard profesional para monitorear bloqueos, cadenas y sesiones activas en **SQL Server 2019 Enterprise**.

## Ubicacion del proyecto

`D:\source\repos\SqlServerBlockDashboard`

## Caracteristicas

- KPIs en tiempo real: sesiones bloqueadas, cadenas activas, head blockers y wait time maximo
- Grafo interactivo de cadenas de bloqueo (blocker -> blocked)
- Tabla de sesiones con filtros (todas, bloqueadas, blockers)
- Panel de detalle con query text, locks y contexto del cliente
- Auto-refresh configurable (5s / 10s)
- Conexion de solo lectura via DMVs
- Acceso protegido por contrasena

## Requisitos

- Node.js 20+
- SQL Server 2019 con usuario que tenga `VIEW SERVER STATE`
- Docker (opcional, recomendado para produccion)

## Configuracion

1. Copia el archivo de entorno:

```bash
cp .env.example .env
```

2. Configura las variables en `.env`:

```env
SQLSERVER_CONNECTION_STRING=Server=tu-servidor,1433;Database=master;User Id=MonitorApp;Password=***;Encrypt=true;TrustServerCertificate=true
DASHBOARD_PASSWORD=tu-contrasena-segura
DASHBOARD_AUTH_SECRET=secreto-largo-para-firmar-sesiones
```

3. Crea el usuario monitor en SQL Server ejecutando `scripts/setup-monitor-user.sql`.

## Acceso al dashboard

- Al abrir la app se muestra la pantalla de login en `/login`
- Solo quien conozca `DASHBOARD_PASSWORD` puede entrar
- La sesion dura 24 horas (cookie HttpOnly firmada)
- Usa el boton **Salir** en el header para cerrar sesion

## Desarrollo local

```bash
npm install
npm run dev
```

Abre http://localhost:3000 (redirige a login si no hay sesion)

## Build

```bash
npm run build
npm start
```

Nota Windows: si `npm run build` falla con `EISDIR readlink` en unidad D:, usa Docker (`docker compose up --build`) o ejecuta el build desde otra ruta/unidad.

## Docker

### Produccion en VPS con Coolify (recomendado)

Tu servidor ya tiene **Traefik** (`coolify-proxy`) escuchando en **80/443**. No agregues Caddy ni otro proxy.

**Dominio en Coolify (importante):** en **Domains** usa exactamente:

```
https://healthy.mikipu.com:3000
```

- `https://` es obligatorio para que Coolify genere SSL
- `:3000` le indica a Traefik el puerto interno del contenedor (no va en la URL del navegador)
- En el navegador abres: `https://healthy.mikipu.com` (sin `:3000`)

Despliega como recurso **Docker Compose**:

1. **Nuevo recurso** → repositorio Git → build pack **Docker Compose**
2. Variables de entorno en la UI de Coolify
3. Dominio como se indica arriba
4. **Deploy** / **Redeploy**

Si ves **"no available server"**:

- El contenedor puede estar `unhealthy` (antes el healthcheck fallaba si SQL no conectaba)
- Verifica en el VPS: `docker ps` → debe decir `(healthy)`
- Confirma que el dominio incluye `https://` y `:3000`

Si el navegador dice **"No es seguro"**:

- El dominio en Coolify debe empezar con `https://`
- Espera 1-2 minutos tras el deploy para que Let's Encrypt emita el certificado
- Abre siempre `https://healthy.mikipu.com`, no `http://`

Ver logs del proxy:

```bash
docker logs -f coolify-proxy
```

### Produccion sin Coolify (Traefik manual)

Si despliegas con `docker compose up` directamente en un servidor que ya tiene Traefik, agrega labels y conecta el contenedor a la red del proxy. Ejemplo:

```yaml
services:
  dashboard:
    # ... resto igual ...
    labels:
      - traefik.enable=true
      - traefik.http.routers.sqlserver-dashboard.rule=Host(`healthy.mikipu.com`)
      - traefik.http.routers.sqlserver-dashboard.entrypoints=https
      - traefik.http.routers.sqlserver-dashboard.tls=true
      - traefik.http.routers.sqlserver-dashboard.tls.certresolver=letsencrypt
      - traefik.http.services.sqlserver-dashboard.loadbalancer.server.port=3000
    networks:
      - default
      - coolify

networks:
  coolify:
    external: true
```

El nombre de la red externa puede variar; verificalo con `docker network ls` en tu VPS.

Para desarrollo local sin HTTPS usa `npm run dev` (seccion anterior).

## API

| Endpoint | Descripcion |
|----------|-------------|
| POST /api/auth/login | Iniciar sesion |
| POST /api/auth/logout | Cerrar sesion |
| GET /api/health | Estado de conexion y permisos |
| GET /api/blocking | Snapshot de bloqueos y cadenas |
| GET /api/sessions | Sesiones activas |
| GET /api/sessions/[spid] | Detalle de una sesion |

Todas las rutas `/api/*` (excepto login) requieren sesion valida.

## Seguridad

- Configura `DASHBOARD_PASSWORD` siempre en produccion
- Usa `DASHBOARD_AUTH_SECRET` distinto a la contrasena en produccion
- Usa una cuenta SQL dedicada con `VIEW SERVER STATE` unicamente
- No otorgues sysadmin ni permisos de KILL
- Configura `Encrypt=true` en produccion

## Stack

- Next.js 16 + TypeScript
- Tailwind CSS + componentes estilo shadcn/ui
- TanStack Query
- Recharts + React Flow
- mssql (tedious)