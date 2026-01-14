import sqlite3
import os
import io
import sys
from flask import Flask, render_template, request, jsonify, send_file
from datetime import datetime, timedelta
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

def resource_path(relative_path):
    """ Get absolute path to resource, works for dev and for PyInstaller """
    try:
        # PyInstaller creates a temp folder and stores path in _MEIPASS
        base_path = sys._MEIPASS
    except Exception:
        base_path = os.path.abspath(".")
    return os.path.join(base_path, relative_path)

if getattr(sys, 'frozen', False):
    template_folder = resource_path('templates')
    static_folder = resource_path('static')
    app = Flask(__name__, template_folder=template_folder, static_folder=static_folder)
else:
    app = Flask(__name__)

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'habits.db')
if getattr(sys, 'frozen', False):
    # When running as exe, put DB in the same folder as the exe, not temp
    DB_PATH = os.path.join(os.path.dirname(sys.executable), 'habits.db')

MOTIVATIONAL_QUOTES = [
    {"text": "The secret of your future is hidden in your daily routine.", "author": "Mike Murdock"},
    {"text": "Don't watch the clock; do what it does. Keep going.", "author": "Sam Levenson"},
    {"text": "Habits are the compound interest of self-improvement.", "author": "James Clear"},
    {"text": "Motivation is what gets you started. Habit is what keeps you going.", "author": "Jim Ryun"},
    {"text": "Success is the sum of small efforts, repeated day in and day out.", "author": "Robert Collier"}
]

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    # Table for habits with custom monthly goals
    conn.execute('''
        CREATE TABLE IF NOT EXISTS habits (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            goal INTEGER DEFAULT 30
        )
    ''')
    # Table for completions
    conn.execute('''
        CREATE TABLE IF NOT EXISTS completions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            habit_id INTEGER,
            year INTEGER,
            month INTEGER,
            day INTEGER,
            completed BOOLEAN,
            FOREIGN KEY (habit_id) REFERENCES habits (id)
        )
    ''')
    # Table for settings
    conn.execute('''
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    ''')
    
    # Table for profile
    conn.execute('''
        CREATE TABLE IF NOT EXISTS profile (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT DEFAULT 'User',
            bio TEXT DEFAULT 'Habit Enthusiast',
            location TEXT DEFAULT 'World',
            avatar_url TEXT DEFAULT ''
        )
    ''')
    
    # Initialize default settings if not exist
    now = datetime.now()
    # For a better experience, we ensure the "last active" month/year is set if not present
    conn.execute('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', ('year', str(now.year)))
    conn.execute('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', ('month', now.strftime('%B')))
    
    # Initialize profile if not exist
    profile_count = conn.execute('SELECT COUNT(*) as count FROM profile').fetchone()['count']
    if profile_count == 0:
        conn.execute('INSERT INTO profile (name, bio, location) VALUES (?, ?, ?)', ('User', 'Habit Enthusiast', 'World'))
    
    # SEED DATA: If no habits exist, add some defaults
    habits_count = conn.execute('SELECT COUNT(*) as count FROM habits').fetchone()['count']
    if habits_count == 0:
        default_habits = [
            ("Morning Meditation", 25),
            ("Reading Books", 20),
            ("Daily Exercise", 28),
            ("Healthy Eating", 30),
            ("Code Review", 22)
        ]
        conn.executemany('INSERT INTO habits (name, goal) VALUES (?, ?)', default_habits)
        
        # Add some historical random completions for the current month
        # BUT NOT for today, to let the user start fresh
        habits = conn.execute('SELECT id FROM habits').fetchall()
        for h in habits:
            for day in range(1, now.day): # 1 to yesterday
                if day % 2 == 0 or day % 3 == 0:
                    conn.execute('INSERT INTO completions (habit_id, year, month, day, completed) VALUES (?, ?, ?, ?, ?)',
                                (h['id'], now.year, now.month, day, True))
    
    conn.commit()
    conn.close()

def calculate_streak(habit_id, current_year, current_month_num, current_day):
    conn = get_db_connection()
    streak = 0
    now = datetime(current_year, current_month_num, current_day)
    
    # Check if completed today or yesterday to continue streak
    check_date = now
    
    # If not completed today, start checking from yesterday
    res_today = conn.execute(
        'SELECT completed FROM completions WHERE habit_id = ? AND year = ? AND month = ? AND day = ?',
        (habit_id, check_date.year, check_date.month, check_date.day)
    ).fetchone()
    
    if not (res_today and res_today['completed']):
        check_date -= timedelta(days=1)

    while True:
        res = conn.execute(
            'SELECT completed FROM completions WHERE habit_id = ? AND year = ? AND month = ? AND day = ?',
            (habit_id, check_date.year, check_date.month, check_date.day)
        ).fetchone()
        
        if res and res['completed']:
            streak += 1
            check_date -= timedelta(days=1)
        else:
            break
            
    conn.close()
    return streak

@app.route('/')
@app.route('/dashboard')
@app.route('/tracker')
@app.route('/goals')
@app.route('/analytics')
@app.route('/profile')
@app.route('/settings')
def index():
    return render_template('index.html')

@app.route('/api/data', methods=['GET'])
def get_data():
    conn = get_db_connection()
    now = datetime.now()
    
    # Get settings
    settings_rows = conn.execute('SELECT key, value FROM settings').fetchall()
    settings = {row['key']: row['value'] for row in settings_rows}
    
    # Get habits
    habits_rows = conn.execute('SELECT id, name, goal FROM habits').fetchall()
    habits = []
    
    current_month_num = datetime.strptime(settings.get('month'), "%B").month
    current_year = int(settings.get('year'))
    
    total_checks_today = 0
    daily_counts = [0] * 31  # For line chart (days 1-31)
    weekly_counts = [0] * 5   # For bar chart (Weeks 1-5)
    max_streak = 0
    
    for h in habits_rows:
        completions = conn.execute(
            'SELECT day FROM completions WHERE habit_id = ? AND year = ? AND month = ? AND completed = 1',
            (h['id'], current_year, current_month_num)
        ).fetchall()
        
        comp_days = [c['day'] for c in completions]
        
        # Process daily counts for line chart
        for day in comp_days:
            if 1 <= day <= 31:
                daily_counts[day-1] += 1
                # Process weekly counts
                week_idx = (day - 1) // 7
                if week_idx < 5:
                    weekly_counts[week_idx] += 1
        
        # Check if completed today
        is_today_done = conn.execute(
            'SELECT completed FROM completions WHERE habit_id = ? AND year = ? AND month = ? AND day = ?',
            (h['id'], now.year, now.month, now.day)
        ).fetchone()
        
        completed_today = False
        if is_today_done and is_today_done['completed']:
            total_checks_today += 1
            completed_today = True
            
        streak = calculate_streak(h['id'], now.year, now.month, now.day)
        if streak > max_streak:
            max_streak = streak
        
        habits.append({
            'id': h['id'],
            'name': h['name'],
            'goal': h['goal'],
            'completed_days': comp_days,
            'streak': streak,
            'success_rate': (len(comp_days) / 31 * 100) if 31 > 0 else 0,
            'completed_today': completed_today
        })
    
    # Get profile
    profile_row = conn.execute('SELECT * FROM profile LIMIT 1').fetchone()
    profile = dict(profile_row) if profile_row else {}
    
    conn.close()
    
    import random
    quote = random.choice(MOTIVATIONAL_QUOTES)
    
    return jsonify({
        'settings': settings,
        'habits': habits,
        'profile': profile,
        'today_stats': {
            'total_checks': total_checks_today,
            'max_streak': max_streak,
            'quote': quote,
            'server_date': {
                'year': now.year,
                'month': now.strftime('%B'),
                'day': now.day
            }
        },
        'analytics': {
            'daily_line': daily_counts,
            'weekly_bar': weekly_counts
        }
    })

@app.route('/api/complete', methods=['POST'])
def toggle_completion():
    data = request.json
    habit_id = data.get('habit_id')
    year = int(data.get('year'))
    month = int(data.get('month'))
    day = int(data.get('day'))
    completed = data.get('completed')
    
    conn = get_db_connection()
    existing = conn.execute(
        'SELECT id FROM completions WHERE habit_id = ? AND year = ? AND month = ? AND day = ?',
        (habit_id, year, month, day)
    ).fetchone()
    
    if existing:
        conn.execute('UPDATE completions SET completed = ? WHERE id = ?', (completed, existing['id']))
    else:
        conn.execute('INSERT INTO completions (habit_id, year, month, day, completed) VALUES (?, ?, ?, ?, ?)',
                    (habit_id, year, month, day, completed))
    
    conn.commit()
    conn.close()
    return jsonify({'status': 'success'})

@app.route('/api/settings', methods=['POST'])
def update_settings():
    data = request.json
    conn = get_db_connection()
    if 'year' in data:
        conn.execute('UPDATE settings SET value = ? WHERE key = ?', (str(data['year']), 'year'))
    if 'month' in data:
        conn.execute('UPDATE settings SET value = ? WHERE key = ?', (data['month'], 'month'))
    conn.commit()
    conn.close()
    return jsonify({'status': 'success'})

@app.route('/api/profile', methods=['POST'])
def update_profile():
    data = request.json
    name = data.get('name')
    bio = data.get('bio')
    location = data.get('location')
    
    conn = get_db_connection()
    conn.execute('UPDATE profile SET name = ?, bio = ?, location = ? WHERE id = (SELECT id FROM profile LIMIT 1)', (name, bio, location))
    conn.commit()
    conn.close()
    return jsonify({'status': 'success'})

@app.route('/api/habits', methods=['POST'])
@app.route('/api/habits/<int:habit_id>', methods=['DELETE'])
def manage_habits(habit_id=None):
    conn = get_db_connection()
    if request.method == 'POST':
        name = request.json.get('name')
        goal = request.json.get('goal', 30)
        try:
            conn.execute('INSERT INTO habits (name, goal) VALUES (?, ?)', (name, goal))
            conn.commit()
            return jsonify({'status': 'success'})
        except sqlite3.IntegrityError:
            return jsonify({'status': 'error', 'message': 'Already exists'}), 400
    elif request.method == 'DELETE':
        if habit_id:
            conn.execute('DELETE FROM completions WHERE habit_id = ?', (habit_id,))
            conn.execute('DELETE FROM habits WHERE id = ?', (habit_id,))
            conn.commit()
        return jsonify({'status': 'success'})
    conn.close()

@app.route('/export')
def export_pdf():
    # Basic PDF Export logic
    buffer = io.BytesIO()
    p = canvas.Canvas(buffer, pagesize=letter)
    width, height = letter
    
    p.setFont("Helvetica-Bold", 16)
    p.drawString(100, height - 50, "Habit Tracker Report")
    
    conn = get_db_connection()
    habits = conn.execute('SELECT * FROM habits').fetchall()
    
    p.setFont("Helvetica", 12)
    y = height - 100
    for h in habits:
        completions = conn.execute('SELECT COUNT(*) as count FROM completions WHERE habit_id = ? AND completed = 1', (h['id'],)).fetchone()
        p.drawString(100, y, f"Habit: {h['name']} | Monthly Goal: {h['goal']} | Total completions: {completions['count']}")
        y -= 20
        if y < 50:
            p.showPage()
            y = height - 50
            
    conn.close()
    p.save()
    buffer.seek(0)
    return send_file(buffer, as_attachment=True, download_name="habit_report.pdf", mimetype='application/pdf')

if __name__ == '__main__':
    init_db()
    app.run(debug=True, port=5000)
