import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, enableIndexedDbPersistence, doc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDwn0vt6pt0AuT0dDdCwFWSa8jBt6iZsM8",
  authDomain: "markmyattendance-1472d.firebaseapp.com",
  projectId: "markmyattendance-1472d",
  storageBucket: "markmyattendance-1472d.firebasestorage.app",
  messagingSenderId: "288221101875",
  appId: "1:288221101875:web:401e0f6e847733defc8846"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Enable Offline Persistence
enableIndexedDbPersistence(db).catch((err) => {
    console.warn("Offline persistence notice:", err.code);
});

// App Constants
const timeSlots = ["8:00 - 8:50", "8:50 - 9:40", "9:40 - 10:30", "10:30 - 11:00 (Recess)", "11:00 - 1:00 (Clinical)", "1:00 - 2:00 (Practical)"];
const mbbsSubjects = ["Pharmacology", "Pathology", "Forensic Medicine", "Microbiology", "Behavioral Sciences", "Community Medicine", "Surgery", "Medicine", "Clinical", "Practical"];

let userTimetable = {};
let userAttendance = [];
let chartInstance = null;

// --- AUTHENTICATION ---
const loginScreen = document.getElementById('login-screen');
const mainApp = document.getElementById('main-app');
const btnLogin = document.getElementById('btn-login');

btnLogin.addEventListener('click', () => {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider);
});

onAuthStateChanged(auth, async (user) => {
    if (user) {
        loginScreen.classList.remove('active');
        mainApp.classList.add('active');
        document.getElementById('user-avatar').src = user.photoURL;
        loadUserData(user.uid);
    } else {
        loginScreen.classList.add('active');
        mainApp.classList.remove('active');
    }
});

// --- DATA SYNC ---
function loadUserData(uid) {
    onSnapshot(doc(db, "users", uid), (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            userTimetable = data.timetable || generateDefaultTimetable();
            userAttendance = data.attendance || [];
        } else {
            userTimetable = generateDefaultTimetable();
            saveData();
        }
        renderToday();
        renderDashboard();
    });
}

async function saveData() {
    const user = auth.currentUser;
    if (!user) return;
    await setDoc(doc(db, "users", user.uid), {
        timetable: userTimetable,
        attendance: userAttendance,
        lastUpdated: new Date().toISOString()
    }, { merge: true });
}

function generateDefaultTimetable() {
    let tt = {};
    for (let i = 1; i <= 6; i++) { // Mon-Sat
        tt[i] = timeSlots.map(slot => ({
            time: slot,
            subject: slot.includes("Recess") ? "Break" : "Select Subject"
        }));
    }
    return tt;
}

// --- RENDER TODAY VIEW ---
function renderToday() {
    const todayNum = new Date().getDay();
    const todaySlots = userTimetable[todayNum] || [];
    const container = document.getElementById('today-timetable');
    const widget = document.getElementById('quick-widget');
    container.innerHTML = '';

    if (todayNum === 0 || todaySlots.length === 0) {
        container.innerHTML = '<p class="text-center">Sunday: No classes scheduled.</p>';
        widget.classList.add('hidden');
        return;
    }

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinutes = now.getMinutes();
    const totalMinutesNow = currentHour * 60 + currentMinutes;

    let activeLecture = null;

    todaySlots.forEach((slot) => {
        if (slot.subject === "Break" || slot.subject === "Select Subject") return;

        // Parse time logic for Widget detection
        const startTimeStr = slot.time.split(' - ')[0];
        let [startH, startM] = startTimeStr.split(':').map(Number);
        if (startH < 8) startH += 12; // Handle 1:00 PM clinicals
        const totalStartMinutes = startH * 60 + startM;

        // Display current lecture in widget if within the hour
        if (totalMinutesNow >= totalStartMinutes && totalMinutesNow < totalStartMinutes + 60) {
            activeLecture = slot;
        }

        const card = document.createElement('div');
        card.className = 'glass-card slot-card';
        card.innerHTML = `
            <div class="slot-info">
                <h4>${slot.subject}</h4>
                <span class="slot-time">${slot.time}</span>
            </div>
            <div class="action-buttons">
                <button class="btn btn-success" onclick="markAttendance('${slot.subject}', 'present')">Present</button>
                <button class="btn btn-danger" onclick="markAttendance('${slot.subject}', 'absent')">Absent</button>
            </div>
        `;
        container.appendChild(card);
    });

    if (activeLecture) {
        widget.classList.remove('hidden');
        document.getElementById('current-subject').innerText = activeLecture.subject;
        document.getElementById('current-time').innerText = activeLecture.time;
        window.currentWidgetSubject = activeLecture.subject;
    } else {
        widget.classList.add('hidden');
    }
}

// --- ATTENDANCE LOGIC ---
window.markAttendance = function(subject, status, isWidget = false) {
    const targetSubject = isWidget ? window.currentWidgetSubject : subject;
    
    userAttendance.push({
        date: new Date().toISOString(),
        subject: targetSubject,
        status: status
    });
    
    saveData();
    if (isWidget) document.getElementById('quick-widget').classList.add('hidden');
};

document.getElementById('btn-mark-all')?.addEventListener('click', () => {
    const todayNum = new Date().getDay();
    const todaySlots = userTimetable[todayNum] || [];
    todaySlots.forEach(slot => {
        if (slot.subject !== "Break" && slot.subject !== "Select Subject") {
            userAttendance.push({ date: new Date().toISOString(), subject: slot.subject, status: 'present' });
        }
    });
    saveData();
    alert("Marked all today's lectures as Present!");
});

// --- DASHBOARD & CHARTS ---
function renderDashboard() {
    const total = userAttendance.length;
    const present = userAttendance.filter(a => a.status === 'present').length;
    const percentage = total === 0 ? 0 : Math.round((present / total) * 100);
    
    document.getElementById('overall-percentage').innerText = `${percentage}%`;
    const statusText = document.getElementById('attendance-status');

    // Warning System
    if (percentage < 75) {
        const needed = Math.ceil((0.75 * total - present) / 0.25);
        statusText.innerHTML = `<span style="color:var(--danger)">Below 75%! Need ${needed > 0 ? needed : 0} more lectures.</span>`;
    } else {
        statusText.innerHTML = `<span style="color:var(--success)">Attendance is good.</span>`;
    }

    const ctx = document.getElementById('attendanceChart').getContext('2d');
    if (chartInstance) chartInstance.destroy();
    chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Present', 'Absent'],
            datasets: [{
                data: [present, total - present],
                backgroundColor: ['#10B981', '#EF4444'],
                borderWidth: 0
            }]
        },
        options: { cutout: '70%', plugins: { legend: { display: false } } }
    });
}

// --- TIMETABLE EDITOR ---
function renderEditor() {
    const day = document.getElementById('day-selector').value;
    const container = document.getElementById('editor-slots');
    container.innerHTML = '';
    
    userTimetable[day].forEach((slot, index) => {
        const selectHTML = mbbsSubjects.map(sub => 
            `<option value="${sub}" ${slot.subject === sub ? 'selected' : ''}>${sub}</option>`
        ).join('');

        container.innerHTML += `
            <div class="editor-row">
                <label>${slot.time}</label>
                <select class="glass-input tt-input" data-index="${index}">
                    <option value="Break">Break</option>
                    ${selectHTML}
                </select>
            </div>
        `;
    });
}

document.getElementById('day-selector')?.addEventListener('change', renderEditor);
document.getElementById('btn-save-timetable')?.addEventListener('click', () => {
    const day = document.getElementById('day-selector').value;
    const inputs = document.querySelectorAll('.tt-input');
    inputs.forEach((input, index) => {
        userTimetable[day][index].subject = input.value;
    });
    saveData();
    alert("Timetable updated successfully!");
});

// --- UI THEME & NAV ---
document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.nav-item, .view').forEach(el => el.classList.remove('active'));
        const target = e.currentTarget.dataset.target;
        e.currentTarget.classList.add('active');
        document.getElementById(target).classList.add('active');
        if (target === 'view-timetable') renderEditor();
    });
});

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js');
}
