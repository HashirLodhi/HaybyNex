# HaybyNex | Pro Habit Tracker 🎯

**HaybyNex** is a high-performance, aesthetically pleasing habit tracking application built with Flask and Vanilla JavaScript. It features a modern SPA (Single Page Application) design, local database persistence, and advanced progress analytics.

## ✨ Features

- **Personalized Dashboard**: Get greeted with a "Welcome back" note and daily motivational quotes.
- **Monthly Habit Tracker**: A clean, grid-based tracker with daily pulse indicators.
- **Smart Goals**: 
  - Automated detection of current month and year.
  - "Check-ins remaining" countdown.
  - Dynamic advice based on your progress (e.g., "Do it daily to lower the gap!").
- **Profile Management**: Customize your profile with your name, bio, and location.
- **Advanced Analytics**: Interactive charts powered by Chart.js to visualize your consistency.
- **PDF Export**: Generate professional reports of your habit progress.
- **Single File Executable**: Easy to run on Windows without installing Python.

## 🚀 Getting Started

### Prerequisites
- Python 3.x
- Virtual environment (`venv`)

### Installation & Local Setup
1. Clone the repository:
   ```bash
   git clone https://github.com/HashirLodhi/HaybyNex.git
   cd HaybyNex
   ```
2. Create and activate virtual environment:
   ```bash
   python -m venv venv
   .\venv\Scripts\activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Run the application:
   ```bash
   python app.py
   ```
5. Open your browser at `http://127.0.0.1:5000`

### Building the EXE
To build the standalone executable, run the provided PowerShell script:
```powershell
.\build_exe.ps1
```
The final EXE will be located in the `dist/` folder.

## 🛠️ Tech Stack
- **Backend**: Flask (Python)
- **Frontend**: Vanilla HTML5, CSS3, JavaScript
- **Database**: SQLite3
- **Charts**: Chart.js
- **Grouping/Icons**: Font Awesome 6

## 👤 Developer
**Muhammad Hashir Lodhi**
- [LinkedIn](https://www.linkedin.com/in/hashir-lodhi/)
- [Medium](https://medium.com/@hashirlodhi145)
- [GitHub](https://github.com/HashirLodhi)

---
*Created with ❤️ for better habits.*
