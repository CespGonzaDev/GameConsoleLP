# 🕹️ GameConsole — Manual de Inicio Rápido y Tutorial Completo

Consola web de videojuegos orientada a objetos con motor táctico en Prolog e integración de telemetría con GameStats (Go + Scala).

---

## ❓ ¿Por qué salen errores `ECONNREFUSED` en Vite y qué servicios debo levantar?

Cuando ejecutas solo `npm run dev` en `gameconsole-web`, los juegos (**Snake**, **Battleship** y **Head Football**) funcionan sin problema, pero el despachador de telemetría (`EventDispatcher`) y el Dashboard (`GAMESTATS LIVE`) intentan conectarse a:
- **GameStats (Go + Scala):** `http://localhost:8080`
- **Prolog IA Service (FastAPI + SWI-Prolog):** `http://localhost:5000`

Si **GameStats** no está encendido en el puerto `8080`, verás un aviso `OFFLINE` en el Dashboard (y `503 Service Unavailable` si el backend no responde).
- **Para solo probar los 3 juegos:** No es obligatorio encender GameStats ni Prolog (Battleship incluye un fallback táctico local si Prolog está apagado).
- **Para probar telemetría completa, el Dashboard en tiempo real y 0 errores de conexión:** SÍ debes levantar **GameStats** primero.

---

## 🚀 Tutorial Paso a Paso: Levantar Todo el Ecosistema (Sin Errores)

### Paso 1: Levantar GameStats (Go + Scala en `:8080`)
En una terminal aparte, clona (si aún no lo tienes) y levanta el repositorio previo **`GameStats`**:

```powershell
git clone https://github.com/CespGonzaDev/GameStats.git
cd GameStats
docker compose up --build -d --wait
```

Verifica que Go esté respondiendo:
```powershell
curl http://localhost:8080/health
# Debe devolver: {"status":"ok"}
```
*Esto también crea automáticamente la red Docker `gamestats-net`.*

---

### Paso 2: Levantar el Microservicio de Prolog IA (`:5000`)
En otra terminal dentro de `GameConsole/prolog-service`:

```powershell
cd GameConsole/prolog-service
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 5000 --reload
```

Verifica que Prolog esté respondiendo:
```powershell
curl http://localhost:5000/health
# Debe devolver: {"status":"ok","service":"gameconsole-prolog-ai","prologEngine":"SWI-Prolog"}
```

---

### Paso 3: Levantar la Consola Web (`gameconsole-web`)
En otra terminal dentro de `GameConsole/gameconsole-web`:

```powershell
cd GameConsole/gameconsole-web
npm install
npm run dev
```

👉 Abre en tu navegador la URL que muestra Vite (por defecto **`http://localhost:3000`** o **`http://localhost:5173`**).

---

### Opción Alternativa: Todo con Docker Compose
Si ya ejecutaste el **Paso 1** (`GameStats` levantado creando la red `gamestats-net`), puedes levantar **Prolog + Consola Web** juntos desde la raíz de `GameConsole/`:

```powershell
cd GameConsole
docker compose up --build -d
```
> Si el contenedor de ingestión Go de GameStats no se llama `ingestion-go` en la red `gamestats-net`, indícalo con
> `GAMESTATS_UPSTREAM=<host>:8080 docker compose up --build -d`. nginx resuelve los upstreams en cada petición, así que
> la consola arranca aunque GameStats o Prolog estén apagados (el Dashboard mostrará DOWN y la API responderá 503 JSON).

- Consola Web: `http://localhost:3000`
- API Prolog: `http://localhost:5000/health`
- GameStats Go: `http://localhost:8080/health`

---

## 🎮 Guía de Controles y Cómo Probar Cada Videojuego

En el **Arcade Lobby**, selecciona un cartucho y presiona **"START GAME"** (o el botón de nueva pestaña para abrirlo aparte):

### 🐍 1. Snake Neo
* **Moverse:** `W`, `A`, `S`, `D` o Flechas (`↑`, `←`, `↓`, `→`) · Swipe en móvil.
* **Comida:** Apple (`+10`), Cyber Berry (`+20`), Golden Star (`+35`), Energy Pill (`+50`).
* **Eventos GameStats:** `CHANGE_DIRECTION` (`{from, to}`), `EAT_FOOD`, `COLLISION`.

### 🚢 2. Battleship AI (vs SWI-Prolog)
1. **Despliegue de Flota (5 barcos):**
   - Selecciona un barco y presiona **`R`** para rotar (Horizontal / Vertical), o haz clic en **"AUTO DESPLEGAR FLOTA"**.
   - Presiona **"INICIAR COMBATE NAVAL"**.
2. **Combate:**
   - Haz clic en una casilla del **Radar Enemigo** para disparar.
   - La IA consultará a Prolog (`/api/ai/battleship/next-move`) alternando entre **HUNT** (paridad) y **TARGET** (adyacentes tras `HIT`).
3. **Patrón Scala (`DEADLY_STREAK`):** Logra $\ge 3$ impactos consecutivos sin fallar culminando en el hundimiento de un barco.

### ⚽ 3. Head Football (Cuenta Regresiva 90s)
* **Tiempo de partido:** Cuenta atrás desde `90'` hasta `0'`, finalizando automáticamente al llegar a `0`.
* **Jugador 1 (Izquierda):** `A` / `D` moverse · `W` saltar/cabecear · `Espacio` o `S` tiro raso · `F` tiro bombeado.
* **Jugador 2 (Derecha, en modo 2P Local):** `←` / `→` moverse · `↑` saltar · `↓` tiro raso · `Enter` o `M` tiro bombeado.
* **Patrón Scala (`COMEBACK`):** Remontar una desventaja de $\ge 2$ goles antes de que el reloj llegue a `0'`.

---

## 🪟 Cómo Probar Multi-Instancia y Pestañas en Paralelo
- **En la misma vista:** Inicia una partida, cierra el modal (`X`), ve a la pestaña **`MULTI-DOCK`** y abre otra partida; haz clic sobre cualquiera de las pantallas para enfocar sus controles.
- **En pestañas separadas:** Haz clic en el icono de ventana externa en la tarjeta del Lobby o en la barra superior de la partida (`?tab=play&game=...`). Cada pestaña genera su propio `matchId` UUID independiente.
