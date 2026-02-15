@echo off
cd /d "%~dp0"
echo Starting NZM Stats Web Server...
echo Please wait for the address (e.g. http://localhost:8787) to appear.
npm start
pause
