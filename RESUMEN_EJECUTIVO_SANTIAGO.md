# GameConsole — Resumen Ejecutivo y Guía Técnica de Integración

**Proyecto:** Consola Web de Videojuegos Orientada a Objetos con Inteligencia en Prolog e Integración a GameStats  
**Curso:** Lenguajes de Programación — Proyecto II Semestre 2026  
**Equipo de Desarrollo:** Daniel & Santiago Pedraza  
**Fecha de Entrega:** Viernes 20 de noviembre de 2026  

---

## 1. Resumen de la Implementación Realizada

Siguiendo la repartición de responsabilidades acordada en la especificación técnica, se implementó la arquitectura completa dividida en módulos desacoplados y probados, listos para su ejecución integrada y defensa en video.

### Estructura General del Workspace

```
GameConsole/
├── .agent/skills/frontend-design/SKILL.md   # Guía estética Dark Arcade Neo-Brutalism
├── docker-compose.yml                       # Orquestación de GameConsole + Prolog en red 'gamestats-net'
├── .github/workflows/ci.yml                 # Pipeline CI (Typecheck, tests Prolog, Docker verification)
├── prolog-service/                          # [Santiago] Microservicio de Inteligencia Artificial
│   ├── battleship_ai.pl                     # Base de conocimiento SWI-Prolog (HUNT y TARGET)
│   ├── solver.py                            # Adaptador SWI-Prolog / Fallback resiliente
│   ├── main.py                              # API REST FastAPI (:5000) con CORS
│   ├── Dockerfile                           # Contenedor con SWI-Prolog y Python 3.11
│   ├── requirements.txt
│   └── tests/                               # 19 tests automatizados con pytest (100% pasando)
└── gameconsole-web/                         # [Daniel & Santiago] Consola Web y Videojuegos
    ├── Dockerfile                           # Multi-stage (Node.js -> Nginx Alpine)
    ├── nginx.conf                           # Reverse proxy a Ingestion Go (:8080) y Prolog (:5000)
    ├── package.json                         # React 19, TypeScript, Vite, Tailwind, Lucide Icons
    ├── vite.config.ts                       # Proxies de desarrollo (/api/gamestats, /api/ai)
    └── src/
        ├── types/contracts.ts               # Contratos congelados e interfaces compartidas
        ├── core/                            # [Daniel] Arquitectura Orientada a Objetos
        │   ├── BaseGame.ts                  # Clase abstracta base del ciclo de vida y eventos
        │   ├── GameSessionManager.ts        # Gestor de partidas concurrentes y multi-pestaña
        │   └── GameRegistry.ts              # Catálogo dinámico de videojuegos
        ├── games/                           # [Daniel] Los 3 Videojuegos POO
        │   ├── SnakeGame.ts                 # Canvas 2D, 60 FPS, sprites procedurales
        │   ├── BattleshipGame.ts            # Radar táctico CSS Grid/SVG, turnos vs IA Prolog
        │   ├── HeadFootballGame.ts          # Física 2D propia en Canvas, 1P vs CPU y 2P Local
        │   └── battleship/                  # Componente BattleshipBoard.tsx y submódulos
        ├── services/                        # [Santiago] Telemetría y Clientes HTTP
        │   ├── EventDispatcher.ts           # Cola FIFO no bloqueante, reintentos y pagehide
        │   ├── GameStatsClient.ts           # Cliente para /stats, /matches, /matches/{id}, /invalid
        │   └── PrologClient.ts              # Cliente para la IA de Battleship (/next-move)
        └── components/
            ├── console/                     # [Daniel] Lobby Arcade y Dock Multi-Instancia
            └── dashboard/                   # [Santiago] Panel de Control GameStats en Tiempo Real
```

---

## 2. Repartición de Responsabilidades y Créditos

| Módulo / Componente | Responsable Principal | Detalle de Implementación Concreto |
| :--- | :--- | :--- |
| **Arquitectura Base POO** | **Daniel** | Clase abstracta `BaseGame`, generación de UUIDs por partida, interfaces de ciclo de vida (`start`, `finish`, `update`, `render`, `destroy`, `emit`). |
| **Juego 1: Snake** *(Arcade)* | **Daniel** | Renderizado procedural en Canvas 2D, 60 FPS con `deltaTime`, estela neón, partículas al comer, eventos `CHANGE_DIRECTION` (`{from, to}`), `EAT_FOOD` y `COLLISION`. |
| **Juego 2: Battleship** *(Estrategia / UI)* | **Daniel** | Despliegue interactivo de flota (5 barcos con rotación H/V), radar táctico naval en CSS Grid/SVG animado, turnos jugador vs IA, eventos `FIRE_SHOT` (con `shipSunk` para `DEADLY_STREAK`) y `AI_DECISION`. |
| **Juego 3: Head Football** *(Física 2D)* | **Daniel** | Motor físico cinemático en Canvas 2D (gravedad, salto, rebote en postes/arcos, patada y cabezazo), sprites procedurales, modos 1P vs CPU y 2P Local, eventos `KICK` y `GOAL` (para `COMEBACK`). |
| **Lobby & Gestor Multinstancia** | **Daniel** | Interfaz Arcade con estética *Dark Arcade Neo-Brutalism*, dock para ejecutar múltiples partidas en paralelo en la misma ventana y soporte nativo para abrir partidas en pestañas independientes (`?tab=play&game=...&matchId=...`). |
| **Inteligencia en Prolog** | **Santiago** | Reglas en `battleship_ai.pl`: Modo Cazador (`TARGET`, expansión ortogonal y colinealidad tras `HIT`) y Modo Rastreador (`HUNT`, paridad de tablero y descarte por longitud mínima de barco). |
| **Servicio Web de Prolog** | **Santiago** | Microservicio FastAPI (`main.py`) en Docker con SWI-Prolog, endpoints `POST /api/ai/battleship/next-move` y `GET /health`, con 19 pruebas automatizadas con `pytest`. |
| **Cliente GameStats (`EventDispatcher`)** | **Santiago** | Despachador asíncrono no bloqueante con cola FIFO, backoff exponencial ante fallos de red, sanitización estricta de los 9 campos del sobre de Go (`DisallowUnknownFields`) y vaciado en `pagehide` con `keepalive: true`. |
| **Dashboard de Estadísticas** | **Santiago** | Panel en React que consulta `GET /stats`, `GET /matches`, `GET /matches/{id}` e `GET /invalid` de Go. Visualización de métricas de Scala, banderas para `DEADLY_STREAK` y `COMEBACK`, e inspector de eventos inválidos. |
| **Infraestructura & CI/CD** | **Santiago** | `Dockerfile` (frontend multi-stage con Nginx y prolog), `docker-compose.yml` conectado a la red externa `gamestats-net`, y workflow de GitHub Actions (`ci.yml`). |

---

## 3. Instrucciones de Instalación y Ejecución

### Opción A: Ejecución con Docker Compose (Recomendada para entrega)

1. **Asegurar que la red y GameStats estén activos:**
   ```bash
   # En el repositorio de GameStats
   docker compose up --build -d --wait
   ```
   *GameStats creará la red externa `gamestats-net` y expondrá Go en el puerto `8080`.*

2. **Levantar GameConsole y el Servicio Prolog:**
   ```bash
   # En la raíz de este repositorio (GameConsole/)
   docker compose up --build -d
   ```

3. **Acceso a los servicios:**
   - **Consola Web:** `http://localhost:3000`
   - **Microservicio Prolog (Salud):** `http://localhost:5000/health`
   - **Ingestión Go (GameStats):** `http://localhost:8080/health`

---

### Opción B: Ejecución en Entorno Local de Desarrollo (Sin Docker)

1. **Servicio Prolog (Python):**
   ```bash
   cd prolog-service
   pip install -r requirements.txt
   uvicorn main:app --host 0.0.0.0 --port 5000 --reload
   ```

2. **Consola Web (Vite + React):**
   ```bash
   cd gameconsole-web
   npm install
   npm run dev
   ```
   *Acceder a `http://localhost:5173` (Vite incluye reverse proxy automático hacia `:8080` y `:5000`).*

3. **Ejecutar Pruebas de Prolog:**
   ```bash
   cd prolog-service
   python -m pytest tests
   ```

---

## 4. Guía para la Demostración en Video (<= 15 minutos)

Para obtener la calificación máxima según los criterios del enunciado, estructurar la grabación del video en estos 5 pasos:

1. **Introducción y Arquitectura (2 min):**
   - Mostrar la estructura de directorios, la separación POO en `gameconsole-web/src/core/BaseGame.ts` y el microservicio en `prolog-service/`.
   - Mostrar el contenedor Docker corriendo en la red `gamestats-net`.

2. **Demostración de los 3 Videojuegos POO (5 min):**
   - **Snake:** Mostrar controles, cambio de dirección, partículas al comer y fin de partida con colisión.
   - **Battleship:** Mostrar despliegue interactivo de barcos (rotación con tecla R), radar naval animado y disparos por turnos.
   - **Head Football:** Mostrar física 2D en Canvas (salto, cabezazo, patada, rebotes en los postes y reloj de 90 minutos).

3. **Demostración de la Inteligencia en Prolog (3 min):**
   - Mostrar cómo la computadora en Battleship dispara en modo `HUNT` (paridad de ajedrez).
   - Mostrar que al acertar un barco (`HIT`), cambia automáticamente a modo `TARGET` explorando celdas ortogonales (N, S, E, O) y persiguiendo la línea del barco.
   - Mostrar el log en la consola del navegador o en los eventos (`AI_DECISION`) con el tiempo de inferencia reportado por Prolog.

4. **Prueba de Concurrencia y Multi-Pestaña (3 min):**
   - Abrir simultáneamente 3 partidas: una de Snake en la consola principal, una de Battleship en el dock dividido, y abrir una tercera partida en una pestaña independiente usando el botón "Abrir en Pestaña".
   - Jugar en paralelo y mostrar que cada partida tiene su propio `matchId` único generado con `crypto.randomUUID()`.
   - Abrir `http://localhost:8080/stats` y mostrar cómo se incrementan los eventos recibidos sin errores (`invalidEvents: 0`).

5. **Panel de Control GameStats y Detección de Patrones (2 min):**
   - Ir a la pestaña "GameStats Live" de la consola.
   - Mostrar las métricas globales y por juego consumidas directamente de Go y Scala.
   - Mostrar la detección de patrones:
     - `DEADLY_STREAK` en Battleship (3 aciertos consecutivos culminando en hundimiento).
     - `COMEBACK` en Head Football (remontada tras ir perdiendo por 2 o más goles).
   - Abrir el visor de "Eventos Inválidos" para constatar que el buffer está en 0 errores.
