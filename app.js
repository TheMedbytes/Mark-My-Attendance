import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, enableIndexedDbPersistence, collection, doc, setDoc, getDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// 1. REPLACE WITH YOUR FIREBASE CONFIG
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Enable Offline Persistence (IndexedDB native sync)
enableIndexedDbPersistence(db).catch((err) => {
    if (err.code == 'failed-precondition') {
        console.warn("Multiple tabs open, offline sync available in one only.");
    } else if (err.code == 'unimplemented') {
        console.warn("Browser doesn't support offline persistence.");
    }
});

// Default State (Pre-filled with 3rd Year MBBS subjects)
const timeSlots = ["8:00 - 8:50", "8:50 - 9:40", "9:40 - 10:30", "10:30 - 11:00 (Recess)", "11:00 - 1:00 (Clinical)", "1:00 - 2:00 (Practical)"];
let defaultSubjects = ["Pharmacology", "Pathology", "Forensic Medicine", "Microbiology", "Behavioral Sciences", "Surgery", "Medicine", "Break"];
let userTimetable = {};
let userAttendance = [];
let chartInstance = null;

// DOM Elements
const loginScreen = document.getElementById('login-screen');
const mainApp = document.getElementById('main-app');
const btnLogin = document.getElementById('btn-login');
const userAvatar = document.getElementById('user-avatar');
const btnTheme = document.getElementById('btn-theme');

// Auth Flow
btnLogin.addEventListener('click', () => {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider);
});

onAuthStateChanged(auth, async (user) => {
    if (user) {
        loginScreen.classList.remove('active');
        mainApp.classList.add('active');
        userAvatar.src = user.photoURL;
        await loadUserData(user.uid);
        initUI();
    } else {
        loginScreen.classList.add('active');
        mainApp.classList.remove('active');
    }
});

// Data Loading & Sync
async function loadUserData(uid) {
    const docRef = doc(db, "users", uid);
    
    // Real-time listener handles both offline cache and online updates natively
    onSnapshot(docRef, (docSnap) => {
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
    if (user) {
        await setDoc(doc(db, "users", user.uid), {
            timetable: userTimetable,
            attendance: userAttendance,
            lastUpdated: new Date()
        }, { merge: true });
    }
}

function generateDefaultTimetable() {
    let tt = {};
    for (let i = 1; i <= 6; i++) { // Mon-Sat
        tt[i] = timeSlots.map(slot => ({
            time: slot,
            subject: slot.includes("Recess") ? "Break" : defaultSubjects[Math.floor(Math.random() * (defaultSubjects.length-1))]
        }));
    }
    return tt;
}

// UI Navigation
document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        const target = e.currentTarget.dataset.target;
        e.currentTarget.classList.add('active');
        document.getElementById(target).classList.add('active');
        
        if(target === 'view-timetable') renderEditor();
        if(target === 'view-dashboard') renderDashboard();
    });
});

// Theme Toggle
btnTheme.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    document.body.classList.toggle('light-mode');
});

// Render Today's Schedule & Widget
function renderToday() {
    const todayNum = new Date().getDay(); // 0 is Sun, 1 is Mon
    const todaySlots = userTimetable[todayNum] || [];
    const container = document.getElementById('today-timetable');
    container.innerHTML = '';

    if (todayNum === 0 || todaySlots.length === 0) {
        container.innerHTML = '<p class="text-center text-muted">No classes today. Enjoy your day off!</p>';
        document.getElementById('quick-widget').classList.add('hidden');
        return;
    }

    let currentLectureFound = false;
    const nowHour = new Date().getHours();
    
    todaySlots.forEach((slot, index) => {
        if(slot.subject === "Break") return;

        // Basic time logic for Widget (simplified hour check for demo)
        const startHour = parseInt(slot.time.split(':')[0]);
        const isCurrent = (nowHour === startHour);

        if (isCurrent && !currentLectureFound) {
            document.getElementById('quick-widget').classList.remove('hidden');
            document.getElementById('current-subject').innerText = slot.subject;
            document.getElementById('current-time').innerText = slot.time;
            currentLectureFound = true;
            // Attach subject to widget buttons
            window.currentWidgetSubject = slot.subject;
        }

        const card = document.createElement('div');
        card.className = 'glass-card slot-card';
        card.innerHTML = `
            <div class="slot-info">
                <h4>${slot.subject}</h4>
                <span class="slot-time">${slot.time}</span>
            </div>
            <div class="action-buttons">
                <button class="btn btn-success" onclick="markAttendance('${slot.subject}', 'present')">P</button>
                <button class="btn btn-danger" onclick="markAttendance('${slot.subject}', 'absent')">A</button>
                <button class="btn btn-warning" onclick="markAttendance('${slot.subject}', 'leave')">L</button>
            </div>
        `;
        container.appendChild(card);
    });
}

// Mark Attendance globally
window.markAttendance = function(subject, status, isWidget = false) {
    if(isWidget) subject = window.currentWidgetSubject;
    
    userAttendance.push({
        date: new Date().toISOString(),
        subject: subject,
        status: status
    });
    
    saveData(); // Triggers Firestore + IndexedDB sync automatically

    if(isWidget) {
        document.getElementById('quick-widget').classList.add('hidden');
    }
}

document.getElementById('btn-mark-all').addEventListener('click', () => {
    const todayNum = new Date().getDay();
    const todaySlots = userTimetable[todayNum] || [];
    todaySlots.forEach(slot => {
        if(slot.subject !== "Break") {
            window.markAttendance(slot.subject, 'present');
        }
    });
});

// Dashboard & Chart.js
function renderDashboard() {
    let total = userAttendance.length;
    let present = userAttendance.filter(a => a.status === 'present').length;
    let percentage = total === 0 ? 0 : Math.round((present / total) * 100);
    
    document.getElementById('overall-percentage').innerText = `${percentage}%`;
    const statusText = document.getElementById('attendance-status');
    
    // Warning System
    if (percentage >= 75) {
        statusText.innerText = "Safe Zone";
        statusText.style.color = "var(--success)";
    } else if (percentage >= 65) {
        statusText.innerText = `Warning: You need ${Math.ceil((0.75 * total - present) / 0.25)} more lectures to reach 75%`;
        statusText.style.color = "var(--accent)";
    } else {
        statusText.innerText = "Critical Shortage!";
        statusText.style.color = "var(--danger)";
    }

    // Render Pie Chart
    const ctx = document.getElementById('attendanceChart').getContext('2d');
    if (chartInstance) chartInstance.destroy();
    
    let absent = userAttendance.filter(a => a.status === 'absent').length;
    let leave = userAttendance.filter(a => a.status === 'leave').length;

    chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Present', 'Absent', 'Leave'],
            datasets: [{
                data: [present, absent, leave],
                backgroundColor: ['#10B981', '#EF4444', '#F59E0B'],
                borderWidth: 0
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, cutout: '70%' }
    });
}

// Timetable Editor
function renderEditor() {
    const day = document.getElementById('day-selector').value;
    const container = document.getElementById('editor-slots');
    container.innerHTML = '';
    
    timeSlots.forEach((slot, index) => {
        const currentSub = userTimetable[day][index].subject;
        container.innerHTML += `
            <div style="margin-bottom: 10px;">
                <label style="font-size: 12px; color: var(--text-muted);">${slot}</label>
                <input type="text" class="glass-input tt-input" data-index="${index}" value="${currentSub}">
            </div>
        `;
    });
}

document.getElementById('day-selector').addEventListener('change', renderEditor);

document.getElementById('btn-save-timetable').addEventListener('click', () => {
    const day = document.getElementById('day-selector').value;
    const inputs = document.querySelectorAll('.tt-input');
    inputs.forEach((input, index) => {
        userTimetable[day][index].subject = input.value;
    });
    saveData();
    alert("Timetable Saved!");
});

// Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js');
    });
}
