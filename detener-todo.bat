@echo off
setlocal
cd /d "%~dp0"
title GameConsole - Detener Servicios

echo ===================================================
echo   GAMECONSOLE - DETENIENDO SERVICIOS
echo ===================================================
echo.

echo [1/3] Cerrando Consola Web [puerto 3000]...
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }"

echo [2/3] Cerrando Servicio Prolog IA [puerto 5000]...
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 5000 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }"

echo [3/3] Deteniendo contenedores Docker de GameStats...
docker info >nul 2>&1
if %errorlevel% neq 0 goto :done
if not exist "..\P1\docker-compose.yml" goto :done
docker compose -f "..\P1\docker-compose.yml" down

:done
echo.
echo Servicios detenidos correctamente.
pause
endlocal