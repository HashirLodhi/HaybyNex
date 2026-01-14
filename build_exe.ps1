# Build script for Habit Tracker
.\venv\Scripts\python.exe -m PyInstaller app.spec --clean --noconfirm
Write-Host "Build complete! Your EXE is in the 'dist' folder." -ForegroundColor Green
Pause
