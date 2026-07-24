@echo off
cd /d "%~dp0"
if not exist node_modules (
  echo node_modules not found. Running npm install...
  call npm install
  if errorlevel 1 pause & exit /b 1
)
echo Starting Knowledge Chat...
npm start
pause
