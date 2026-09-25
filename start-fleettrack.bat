@echo off
REM FleetTrack one-click starter: launches the single-host server if :3100 is free.
cd /d "%~dp0backend"
netstat -ano | findstr ":3100" | findstr "LISTENING" >nul
if %errorlevel%==0 (
  echo FleetTrack is already running: http://localhost:3100
  pause
  exit /b 0
)
echo Starting FleetTrack on http://localhost:3100 ...
start "" /min "C:\Program Files\nodejs\node.exe" dist\combined.js
timeout /t 12 /nobreak >nul
curl.exe -s -o nul -w "health=%{http_code}\n" http://localhost:3100/health --max-time 15
echo Open: http://localhost:3100
pause
