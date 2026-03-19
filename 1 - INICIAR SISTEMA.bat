@echo off
title WhatsApp Extrator Pro - Servidor
echo ===================================================
echo   WhatsApp Extrator Pro
echo   AVISO: Mantenha esta janela aberta enquanto usa!
echo ===================================================
echo.
echo Ligando o motor do sistema...
start http://localhost:3002
node index.js
pause
