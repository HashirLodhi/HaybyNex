let appData = {};
let charts = {};

async function fetchData() {
    const res = await fetch('/api/data');
    appData = await res.json();

    // Populate settings inputs
    document.getElementById('setMonth').value = appData.settings.month;
    document.getElementById('setYear').value = appData.settings.year;

    // Auto-sync on first load if strictly necessary (e.g. fresh DB with 2024)
    if (!window.initialSyncDone) {
        checkDateSync();
        window.initialSyncDone = true;
    }

    renderAll();
}

function switchPage(pageId, pushState = true) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    const page = document.getElementById(pageId);
    if (page) {
        page.classList.add('active');
        const navItem = document.querySelector(`[onclick^="switchPage('${pageId}'"]`);
        if (navItem) navItem.classList.add('active');

        if (pushState) {
            history.pushState({ pageId }, '', `/${pageId === 'dashboard' ? '' : pageId}`);
        }
    }

    renderCharts();
}

window.onpopstate = function (event) {
    if (event.state && event.state.pageId) {
        switchPage(event.state.pageId, false);
    } else {
        switchPage('dashboard', false);
    }
};

function renderAll() {
    renderDashboard();
    renderTracker();
    renderGoals();
    renderProfile();
    renderCharts();
}

function renderDashboard() {
    const quoteEl = document.getElementById('dashQuote');
    const authorEl = document.getElementById('dashAuthor');
    const welcomeEl = document.getElementById('welcomeNote');

    if (welcomeEl && appData.profile) {
        welcomeEl.innerText = `Welcome back, ${appData.profile.name}! 👋`;
    }

    if (quoteEl && authorEl) {
        quoteEl.innerText = appData.today_stats.quote.text;
        authorEl.innerText = "- " + appData.today_stats.quote.author;
    }

    const counts = appData.today_stats.total_checks;
    const total = appData.habits.length;
    const perc = total > 0 ? Math.round((counts / total) * 100) : 0;

    document.getElementById('dashProgress').innerText = perc + "%";
    document.getElementById('dashCompleted').innerText = counts;
    document.getElementById('dashActive').innerText = total;

    // Render Doughnut
    const ctxD = document.getElementById('dashDoughnut').getContext('2d');
    if (charts.dashDoughnut) charts.dashDoughnut.destroy();
    charts.dashDoughnut = new Chart(ctxD, {
        type: 'doughnut',
        data: {
            datasets: [{
                data: [perc, 100 - perc],
                backgroundColor: ['#FFB7C5', '#f0f0f0'],
                borderWidth: 0,
                borderRadius: 5
            }]
        },
        options: { cutout: '80%', plugins: { legend: { display: false }, tooltip: { enabled: false } } }
    });

}

function renderTracker() {
    const month = appData.settings.month;
    const year = appData.settings.year;
    const daysInMonth = new Date(year, new Date(Date.parse(month + " 1, 2012")).getMonth() + 1, 0).getDate();

    let html = `<table><thead><tr><th class="habit-col">Habits ✨</th>`;

    // Header for days
    for (let d = 1; d <= daysInMonth; d++) {
        html += `<th>${d}</th>`;
    }
    html += `<th>%</th></tr>`;

    // ADDED V5: Daily Progress Global Row
    html += `<tr class="daily-progress-row"><td class="habit-col">Daily Pulse</td>`;
    for (let d = 1; d <= daysInMonth; d++) {
        let dailyCount = 0;
        appData.habits.forEach(h => {
            if (h.completed_days.includes(d)) dailyCount++;
        });
        const dailyPerc = appData.habits.length > 0 ? (dailyCount / appData.habits.length) * 100 : 0;
        html += `<td><div class="daily-progress-bar"><div class="daily-progress-fill" style="height: ${dailyPerc}%"></div></div></td>`;
    }
    html += `<td>-</td></tr></thead><tbody>`;

    appData.habits.forEach(h => {
        html += `<tr><td class="habit-col">
            <div style="font-size: 1.1rem">${h.name}</div>
        </td>`;
        for (let d = 1; d <= daysInMonth; d++) {
            const checked = h.completed_days.includes(d) ? 'checked' : '';
            html += `<td><input type="checkbox" ${checked} onchange="toggleHabit(${h.id}, ${d}, this.checked)"></td>`;
        }
        html += `<td style="font-weight: 700; color: var(--accent-pink)">${Math.round(h.success_rate)}%</td></tr>`;
    });

    html += `</tbody></table>`;
    document.getElementById('trackerContainer').innerHTML = html;
}

function renderGoals() {
    let html = '';
    const month = appData.settings.month;
    const year = appData.settings.year;
    const daysInMonth = new Date(year, new Date(Date.parse(month + " 1, 2012")).getMonth() + 1, 0).getDate();

    appData.habits.forEach(h => {
        const perc = Math.min(100, Math.round((h.completed_days.length / h.goal) * 100));
        html += `
        <div class="card" style="grid-column: span 4">
            <div style="display:flex; justify-content: space-between; align-items: center; margin-bottom: 20px">
                <h3 style="color: var(--text-primary)">${h.name}</h3>
                <i class="fa-solid fa-crown" style="color: var(--accent-peach)"></i>
            </div>
            <div style="height: 10px; background: #eee; border-radius: 5px; overflow: hidden; margin-bottom: 10px">
                <div style="width: ${perc}%; height: 100%; background: linear-gradient(90deg, var(--accent-pink), var(--accent-peach)); transition: width 1s"></div>
            </div>
            <div style="display:flex; justify-content: space-between; font-size: 0.9rem">
                <span>Progress: ${h.completed_days.length} / ${h.goal}</span>
                <span style="font-weight: 700">${perc}%</span>
            </div>
            <div style="margin-top: 10px; font-size: 0.85rem; color: var(--text-secondary); font-weight: 600;">
                ${h.goal - h.completed_days.length > 0 ? (h.goal - h.completed_days.length) + " check-ins remaining" : "Goal completed! 🎉"}
            </div>
            
            <!-- Dynamic Advice -->
            <div style="margin-top: 5px; font-size: 0.8rem; color: ${h.goal - h.completed_days.length > (daysInMonth - appData.today_stats.server_date.day + 1) ? '#ff7675' : 'var(--accent-purple)'}; font-style: italic;">
                ${(() => {
                const remainingCheckIns = h.goal - h.completed_days.length;
                const daysLeftInMonth = daysInMonth - appData.today_stats.server_date.day + 1;
                if (remainingCheckIns <= 0) return "Well done! Keep it up.";
                if (remainingCheckIns > daysLeftInMonth) {
                    return "Do it daily to lower the gap!";
                } else {
                    return "Do this daily to keep up with the target.";
                }
            })()}
            </div>

            <!-- Month Countdown -->
            <div style="margin-top: 15px; font-size: 0.8rem; opacity: 0.8; border-top: 1px solid var(--border-color); padding-top: 10px;">
                <i class="fa-regular fa-clock"></i> Days remaining in ${month}: ${daysInMonth - appData.today_stats.server_date.day + 1} days
            </div>

            <button onclick="deleteHabit(${h.id})" style="margin-top: 20px; background: none; border: 1px solid #ff7675; color: #ff7675; padding: 5px 12px; border-radius: 5px; cursor: pointer; font-size: 0.8rem">Delete</button>
        </div>`;
    });
    document.getElementById('goalsGrid').innerHTML = html;
}

function renderCharts() {
    Object.values(charts).forEach(c => { if (c) c.destroy(); });

    if (document.getElementById('dashboard').classList.contains('active')) {
        const ctxTrend = document.getElementById('dashTrendChart').getContext('2d');
        const daysInMonth = new Date(appData.settings.year, new Date(Date.parse(appData.settings.month + " 1, 2012")).getMonth() + 1, 0).getDate();
        charts.dashTrend = new Chart(ctxTrend, {
            type: 'line',
            data: {
                labels: Array.from({ length: daysInMonth }, (_, i) => i + 1),
                datasets: [{
                    label: 'Activity',
                    data: appData.analytics.daily_line,
                    borderColor: '#FFB7C5',
                    backgroundColor: 'rgba(255, 183, 197, 0.2)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointBackgroundColor: '#FFB7C5'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { display: true, grid: { display: false } },
                    y: { display: false }
                },
                plugins: { legend: { display: false } }
            }
        });
    }

    if (document.getElementById('analytics').classList.contains('active')) {
        // Line Chart
        charts.aLine = new Chart(document.getElementById('analyticsLineChart'), {
            type: 'line',
            data: {
                labels: Array.from({ length: 31 }, (_, i) => i + 1),
                datasets: [{
                    label: 'Completions',
                    data: appData.analytics.daily_line,
                    borderColor: '#6C5CE7',
                    tension: 0.4,
                    fill: false
                }]
            }
        });

        // Bar Chart
        charts.aBar = new Chart(document.getElementById('analyticsBarChart'), {
            type: 'bar',
            data: {
                labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5'],
                datasets: [{
                    data: appData.analytics.weekly_bar,
                    backgroundColor: ['#FFB7C5', '#FFDAB9', '#D1E3FF', '#FFE4E1', '#E6E6FA'],
                    borderRadius: 10
                }]
            },
            options: { plugins: { legend: { display: false } } }
        });

        // Radar Chart
        charts.aRadar = new Chart(document.getElementById('analyticsRadarChart'), {
            type: 'radar',
            data: {
                labels: appData.habits.map(h => h.name),
                datasets: [{
                    label: 'Consistency',
                    data: appData.habits.map(h => h.success_rate),
                    backgroundColor: 'rgba(108, 92, 231, 0.1)',
                    borderColor: '#6C5CE7'
                }]
            }
        });

        // Pie Chart
        charts.aPie = new Chart(document.getElementById('analyticsPieChart'), {
            type: 'pie',
            data: {
                labels: appData.habits.map(h => h.name),
                datasets: [{
                    data: appData.habits.map(h => h.completed_days.length),
                    backgroundColor: ['#FFB7C5', '#FFDAB9', '#D1E3FF', '#FFE4E1', '#E6E6FA', '#F0FFF0']
                }]
            }
        });
    }
}

function renderProfile() {
    const prof = appData.profile;
    if (!prof) return;

    document.getElementById('profNameDisplay').innerText = prof.name;
    document.getElementById('profBioDisplay').innerText = prof.bio;
    document.getElementById('profLocDisplay').innerText = prof.location;

    document.getElementById('profNameInput').value = prof.name;
    document.getElementById('profBioInput').value = prof.bio;
    document.getElementById('profLocInput').value = prof.location;
}

async function updateProfile() {
    const name = document.getElementById('profNameInput').value;
    const bio = document.getElementById('profBioInput').value;
    const location = document.getElementById('profLocInput').value;

    await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, bio, location })
    });
    fetchData();
}

async function toggleHabit(habitId, day, completed) {
    const year = appData.settings.year;
    const month = new Date(Date.parse(appData.settings.month + " 1, 2012")).getMonth() + 1;
    await fetch('/api/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ habit_id: habitId, year, month, day, completed: completed ? 1 : 0 })
    });
    fetchData(); // Refresh UI
}

async function addHabit() {
    const name = prompt("Habit Name:");
    const goal = prompt("Monthly Goal (days):", 30);
    if (!name) return;
    await fetch('/api/habits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, goal })
    });
    fetchData();
}

async function deleteHabit(habitId) {
    if (!confirm("Delete this habit?")) return;
    await fetch(`/api/habits/${habitId}`, { method: 'DELETE' });
    fetchData();
}

async function updateSettings() {
    const month = document.getElementById('setMonth').value;
    const year = document.getElementById('setYear').value;
    await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month, year })
    });
    fetchData();
}

// Auto-sync date if outdated (only run once)
async function checkDateSync() {
    const server = appData.today_stats.server_date;
    const settings = appData.settings;

    // If the database is still on 2024 (default from old version), force sync
    if (settings.year === "2024") {
        console.log("Syncing from 2024 to current date...");
        await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ month: server.month, year: server.year })
        });
        // We don't call fetchData here to avoid loop, just update appData locally for this render
        appData.settings.month = server.month;
        appData.settings.year = String(server.year);
        document.getElementById('setMonth').value = server.month;
        document.getElementById('setYear').value = server.year;
    }
}

window.onload = async () => {
    await fetchData();

    // Handle initial routing based on URL
    const path = window.location.pathname.replace('/', '');
    const validPages = ['dashboard', 'tracker', 'goals', 'analytics', 'profile', 'settings'];
    if (validPages.includes(path)) {
        switchPage(path, false);
    } else if (path === '') {
        switchPage('dashboard', false);
    }
};
