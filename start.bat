@echo off
setlocal

:: ==========================================
::  Self-elevate to Administrator
::  Required to start Memurai / PostgreSQL services
:: ==========================================
net session >nul 2>&1
if errorlevel 1 (
    echo ==========================================
    echo  Requesting Administrator privileges...
    echo ==========================================
    powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    if errorlevel 1 (
        echo [!] Elevation failed or was cancelled.
        echo     Right-click start.bat and choose "Run as administrator".
        pause
    )
    exit /b
)

chcp 65001 >nul
cd /d "%~dp0"
echo ==========================================
echo  NewChat v2.0 - Local Launcher (No Docker)
echo ==========================================
echo.

set "PG_BIN=%ProgramFiles%\PostgreSQL\18\bin"
if exist "%PG_BIN%\pg_isready.exe" (
    "%PG_BIN%\pg_isready.exe" -h 127.0.0.1 -p 5432 -q >nul 2>&1
    if errorlevel 1 (
        echo [!] PostgreSQL 18 is not running on port 5432. Attempting service start...
        net start postgresql-x64-18 >nul 2>&1
        "%PG_BIN%\pg_isready.exe" -h 127.0.0.1 -p 5432 -q >nul 2>&1
        if errorlevel 1 (
            echo [!] PostgreSQL is still not reachable on 127.0.0.1:5432.
        ) else (
            echo [OK] PostgreSQL 18 running on 127.0.0.1:5432
        )
    ) else (
        echo [OK] PostgreSQL 18 running on 127.0.0.1:5432
    )
) else (
    echo [i] PostgreSQL 18 not found at "%PG_BIN%". Skipping check.
)

set "MEMURAI_SERVICE=Memurai"
sc query "%MEMURAI_SERVICE%" | find "RUNNING" >nul 2>&1
if errorlevel 1 (
    echo [!] Memurai Redis is not running. Attempting service start...
    net start "%MEMURAI_SERVICE%" >nul 2>&1
    timeout /t 2 /nobreak >nul
    sc query "%MEMURAI_SERVICE%" | find "RUNNING" >nul 2>&1
    if errorlevel 1 (
        echo.
        echo [X] Could not start Memurai. Last lines of memurai-log.txt:
        powershell -NoProfile -Command "Get-Content 'C:\Program Files\Memurai\memurai-log.txt' -Tail 6 -ErrorAction SilentlyContinue"
        echo.
        echo     Note: Memurai Developer Edition stops itself after 10 days of uptime.
        echo     Start the "Memurai" service from services.msc, then rerun start.bat.
        pause
        exit /b 1
    ) else (
        echo [OK] Memurai Redis started on 127.0.0.1:6379
    )
) else (
    echo [OK] Memurai Redis running on 127.0.0.1:6379
)

echo.
echo Starting API (:3003), Gateway (:3004), Worker, and Web (:5173)...
call pnpm --filter @newchat/api --filter @newchat/gateway --filter @newchat/worker --filter @newchat/web --parallel dev
pause
