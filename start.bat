@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ==========================================
echo  NewChat v2.0 - Local Launcher (No Docker)
echo ==========================================
echo.
set "PG_BIN=%ProgramFiles%\PostgreSQL\18\bin"
if exist "%PG_BIN%\pg_isready.exe" (
    "%PG_BIN%\pg_isready.exe" -h 127.0.0.1 -p 5432 -q
    if errorlevel 1 (
        echo [!] PostgreSQL 18 is not running on port 5432. Attempting service start...
        net start postgresql-x64-18 >nul 2>&1
    ) else (
        echo [OK] PostgreSQL 18 running on 127.0.0.1:5432
    )
)

sc query Memurai | find "RUNNING" >nul 2>&1
if errorlevel 1 (
    echo [!] Memurai Redis is not running. Attempting service start...
    net start Memurai >nul 2>&1
) else (
    echo [OK] Memurai Redis running on 127.0.0.1:6379
)

echo.
echo Starting API (:3003), Gateway (:3004), Worker, and Web (:5173)...
call pnpm --filter @newchat/api --filter @newchat/gateway --filter @newchat/worker --filter @newchat/web --parallel dev
pause
