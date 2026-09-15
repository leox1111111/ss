@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul

set "IDFILE=%~dp0lastid.txt"
echo 0 > "%IDFILE%"

echo ===================================
echo           KLIENT CZATU
echo ===================================
echo.

set "SERVER=https://ss-zecl.onrender.com"
set "NICK=vic00"

echo.
echo Polaczono jako %NICK%. Wpisz wiadomosc i Enter, aby wyslac.
echo Wpisz "exit" aby zakonczyc.
echo -----------------------------------

:loop
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0poll.ps1" -Server "%SERVER%" -IdFile "%IDFILE%"

set "MSG="
set /p MSG=^> 

if /i "%MSG%"=="exit" goto end
if "%MSG%"=="" goto loop

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0send.ps1" -Server "%SERVER%" -Nick "%NICK%" -Text "%MSG%"

goto loop

:end
echo Rozlaczono.
pause
