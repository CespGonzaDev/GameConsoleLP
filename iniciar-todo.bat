@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"
title GameConsole - Launcher

echo ===================================================
echo   GAMECONSOLE - INICIANDO ECOSISTEMA COMPLETO
echo ===================================================
echo.

echo [1/3] Verificando Docker Desktop y GameStats [puerto 8080]...
docker info >nul 2>&1
if %errorlevel% equ 0 goto :docker_ready

set "DOCKER_EXE="
if exist "%ProgramFiles%\Docker\Docker\Docker Desktop.exe" set "DOCKER_EXE=%ProgramFiles%\Docker\Docker\Docker Desktop.exe"
if not defined DOCKER_EXE if exist "%LocalAppData%\Programs\DockerDesktop\Docker Desktop.exe" set "DOCKER_EXE=%LocalAppData%\Programs\DockerDesktop\Docker Desktop.exe"
if not defined DOCKER_EXE if exist "%LocalAppData%\Docker\Docker Desktop.exe" set "DOCKER_EXE=%LocalAppData%\Docker\Docker Desktop.exe"
if not defined DOCKER_EXE if exist "%ProgramFiles(x86)%\Docker\Docker\Docker Desktop.exe" set "DOCKER_EXE=%ProgramFiles(x86)%\Docker\Docker\Docker Desktop.exe"

if not defined DOCKER_EXE goto :docker_missing

echo       Docker Desktop no estaba abierto. Iniciando "!DOCKER_EXE!"...
start "" "!DOCKER_EXE!"
echo       Esperando a que el motor de Docker este listo [max 60s]...
powershell -NoProfile -Command "$ready=$false; for($i=1; $i -le 30; $i++){ docker info *> $null; if($LASTEXITCODE -eq 0){ $ready=$true; break }; Write-Host -NoNewline '.'; Start-Sleep -Seconds 2 }; Write-Host ''"
docker info >nul 2>&1
if %errorlevel% equ 0 goto :docker_ready
echo [AVISO] Docker no respondio a tiempo. Los juegos funcionaran, pero el Dashboard estara OFFLINE.
goto :step_prolog

:docker_missing
echo [AVISO] No se encontro Docker Desktop en rutas estandar. Continuando sin GameStats.
goto :step_prolog

:docker_ready
if not exist "..\P1\docker-compose.yml" goto :gamestats_missing
echo       Iniciando GameStats [Go + Scala]...
docker compose -f "..\P1\docker-compose.yml" up -d
goto :step_prolog

:gamestats_missing
echo [AVISO] No se encontro ..\P1\docker-compose.yml. GameStats no se inicio.

:step_prolog
echo.
echo [2/3] Verificando Servicio Prolog IA [puerto 5000]...
powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort 5000 -State Listen -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }"
if %errorlevel% equ 0 goto :prolog_running

echo       Iniciando Prolog AI Service en segundo plano...
start "GameConsole - Prolog AI 5000" /min /D "%~dp0prolog-service" cmd /k "python -m uvicorn main:app --host 0.0.0.0 --port 5000"
goto :step_web

:prolog_running
echo       Servicio Prolog ya estaba activo en el puerto 5000.

:step_web
echo.
echo [3/3] Verificando Consola Web [puerto 3000]...
if exist "%~dp0gameconsole-web\node_modules" goto :check_port_3000
echo       Instalando dependencias de frontend [npm install]...
pushd "%~dp0gameconsole-web"
call npm install
popd

:check_port_3000
powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }"
if %errorlevel% equ 0 goto :web_running

echo       Iniciando Consola Web Vite en http://localhost:3000 ...
echo       Esta ventana mantiene vivo el servidor web; no la cierres mientras juegas.
echo.
cd /d "%~dp0gameconsole-web"
call npm.cmd run dev -- --open
echo.
echo [AVISO] El servidor web se detuvo.
pause
goto :eof

:web_running
echo       Consola Web ya estaba activa en el puerto 3000. Abriendo navegador...
start "" "http://localhost:3000"
echo.
echo ===================================================
echo   LISTO! Todos los servicios estan activos:
echo   - Consola Web : http://localhost:3000
echo   - Prolog IA   : http://localhost:5000/health
echo   - GameStats   : http://localhost:8080/health
echo ===================================================
pause
endlocal