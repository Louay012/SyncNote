@echo off
setlocal

cd /d "%~dp0"

echo [0/4] Freeing ports 3000 and 4000 if needed...
for %%P in (3000 4000) do (
	for /f "tokens=5" %%I in ('netstat -ano ^| findstr /r /c:":%%P .*LISTENING"') do (
		echo   - Stopping process %%I on port %%P
		taskkill /F /PID %%I >nul 2>nul
	)
)

echo [1/4] Installing backend dependencies...
cd /d "%~dp0back"
call npm install
if errorlevel 1 goto :error

echo [2/4] Installing frontend dependencies...
cd /d "%~dp0front"
call npm install
if errorlevel 1 goto :error

echo [3/4] Starting backend server in a new terminal...
start "SyncNote Backend" cmd /k "cd /d ""%~dp0back"" && npm run dev"

echo [4/4] Starting frontend server in a new terminal...
start "SyncNote Frontend" cmd /k "cd /d ""%~dp0front"" && npm run dev"

echo Servers launched.
exit /b 0

:error
echo Failed to install dependencies.
exit /b 1
