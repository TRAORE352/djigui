@echo off
REM ====================================================================
REM  DJIGUI - demarrage des deux serveurs dans deux fenetres.
REM  A lancer par un double-clic depuis le dossier du projet.
REM ====================================================================
echo.
echo   DJIGUI - demarrage
echo.

if not exist "backend\.env" (
  echo   Il manque le fichier backend\.env
  echo   Copiez backend\.env.example en backend\.env et remplissez-le.
  echo.
  pause
  exit /b 1
)
if not exist "frontend\.env.local" (
  echo   Il manque le fichier frontend\.env.local
  echo   Copiez frontend\.env.local.example en frontend\.env.local
  echo.
  pause
  exit /b 1
)
if not exist "backend\node_modules" (
  echo   Installation des bibliotheques du backend...
  cd backend && call npm install && cd ..
)
if not exist "frontend\node_modules" (
  echo   Installation des bibliotheques du frontend...
  cd frontend && call npm install && cd ..
)

start "DJIGUI service" cmd /k "cd backend && npm run dev"
timeout /t 3 /nobreak >nul
start "DJIGUI application" cmd /k "cd frontend && npm run dev"

echo.
echo   Deux fenetres se sont ouvertes. Ne les fermez pas.
echo   Service     : http://localhost:4000
echo   Application : http://localhost:3000
echo.
pause
