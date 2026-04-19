@echo off
REM Verifica prazos no SQLite (toast Windows desativado — ver Web Push na VPS).
REM Uso legado: Agendador de Tarefas — opcional; só imprime no console.
REM       "Iniciar em": pasta web do projeto (opcional; o script já posiciona).

setlocal
cd /d "%~dp0.."
if not exist "package.json" (
  echo Erro: execute a partir da pasta scripts do projeto web.
  exit /b 1
)

node "%~dp0check-entregas-reminder.cjs" %*
exit /b %ERRORLEVEL%
