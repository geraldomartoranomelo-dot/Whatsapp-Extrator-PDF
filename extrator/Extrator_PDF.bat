@echo off
echo ==========================================
echo        EXTRATOR DE PDF PARA MARKDOWN
echo ==========================================
echo.
echo Lendo PDFs da pasta: %~dp0Entrada
echo.

cd /d %~dp0
python conversor.py

echo.
echo Pressione qualquer tecla para fechar esta janela...
pause >nul
