@echo off
title WhatsApp Extrator Pro - Servidor
echo ===================================================
echo   WhatsApp Extrator Pro
@echo off
title MOTOR SISTEMA: EXTRATOR WHATSAPP
color 0a

echo Criado por: Geraldo
echo Limpando servidores antigos (Node.js)...
taskkill /F /IM node.exe /T >nul 2>&1

echo Abrindo Dashboard: http://localhost:3002
start http://localhost:3002

echo Ligando o motor do sistema...
node index.js
pause