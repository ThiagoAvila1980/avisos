@echo off
REM Inicia o Next.js em modo desenvolvimento ao abrir (duplo clique ou pasta Inicializar do Windows).
REM Ajuste o caminho se copiar o projeto para outro disco.

title Avisos - Next.js dev
cd /d "%~dp0"

if not exist "package.json" (
  echo Coloque este arquivo na pasta web\ do projeto.
  pause
  exit /b 1
)

echo Iniciando servidor em http://localhost:3000 ^(Webpack — use na rede: http://IP-DESTA-MAQUINA:3000^)
echo Feche esta janela para parar o servidor.
echo.

npm run dev

pause
