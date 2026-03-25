import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, enableIndexedDbPersistence, doc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDwn0vt6pt0AuT0dDdCwFWSa8jBt6iZsM8",
  authDomain: "markmyattendance-1472d.firebaseapp.com",
  projectId: "markmyattendance-1472d",
  storageBucket: "markmyattendance-1472d.firebasestorage.app",
  messagingSenderId: "288221101875",
  appId: "1:288221101875:web:401e0f6e847733defc8846"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

enableIndexedDbPersistence(db).catch((err) => console.warn("Offline notice:", err.code));

const timeSlots = ["8:00 - 8:50", "8:50 - 9:40", "9:40 - 10:30", "10:30 - 11:00 (Recess)", "11:00 - 1:00 (Clinical)", "1:00 - 2:00 (Practical)"];
const mbbsSubjects = ["Pharmacology", "Pathology", "Forensic Medicine", "Microbiology", "Behavioral Sciences", "Community Medicine", "Surgery", "Medicine", "Clinical", "Practical", "PERLS"];

let userTimetable = {};
let userAttendance = [];
let chartInstance = null;

// --- AUTHENTICATION ---
onAuthStateChanged(auth, (user) => {
    const loginScreen = document.getElementById('login-screen');
    const mainApp = document.getElementById('main-app');
    if (user) {
        loginScreen.classList.remove('active');
        mainApp.classList.add('active');
        document.getElementById('user-avatar').src = user.photoURL || 'https://via.placeholder.com/40';
        loadUserData(user.uid);
    } else {
        loginScreen.classList.add('active');
        mainApp.classList.remove('active');
    }
});

// Google Login
document.getElementById('btn-login').addEventListener('click', () => signInWithPopup(auth, new GoogleAuthProvider()));

// Email Login
document.getElementById('btn-email-login').addEventListener('click', () => {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-pass').value;
    signInWithEmailAndPassword(auth, email, pass).catch(err => alert(err.message));
});

// Email Signup
document.getElementById('btn-email-signup').addEventListener('click', () => {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-pass').value;
    createUserWithEmailAndPassword(auth, email, pass).then(() => alert("Account Created!")).catch(err => alert(err.message));
});

// --- DATA LOGIC ---
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
    if (!auth.currentUser) return;
    await setDoc(doc(db, "users", auth.currentUser.uid), {
        timetable: userTimetable,
        attendance: userAttendance,
        lastUpdated: new Date().toISOString()
    }, { merge: true });
}

function generateDefaultTimetable() {
    let tt = {};
    for (let i = 1; i <= 6; i++) {
        tt[i] = timeSlots.map(slot => ({ time: slot, subject: slot.includes("Recess") ? "Break" : "Select Subject" }));
    }
    return tt;
}

// --- ATTENDANCE HISTORY EDITING ---
window.markAttendance = function(subject, status, isWidget = false) {
    const sub = isWidget ? document.getElementById('current-subject').innerText : subject;
    userAttendance.push({
        id: Date.now(), // Unique ID to identify for deletion
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
        subject: sub,
        status: status
    });
    saveData();
    if (isWidget) document.getElementById('quick-widget').classList.add('hidden');
};

window.unmarkAttendance = function(recordId) {
    if(confirm("Delete this attendance record?")) {
        userAttendance = userAttendance.filter(rec => rec.id !== recordId);
        saveData();
    }
};

// --- RENDER FUNCTIONS ---
function renderToday() {
    const day = new Date().getDay();
    const slots = userTimetable[day] || [];
    const container = document.getElementById('today-timetable');
    container.innerHTML = slots.map(slot => {
        if(slot.subject === "Break" || slot.subject === "Select Subject") return '';
        return `
        <div class="glass-card slot-card">
            <div class="slot-info"><h4>${slot.subject}</h4><span>${slot.time}</span></div>
            <div class="action-buttons">
                <button class="btn btn-success" onclick="markAttendance('${slot.subject}', 'present')">P</button>
                <button class="btn btn-danger" onclick="markAttendance('${slot.subject}', 'absent')">A</button>
            </div>
        </div>`;
    }).join('');
}

function renderDashboard() {
    const total = userAttendance.length;
    const present = userAttendance.filter(a => a.status === 'present').length;
    const perc = total === 0 ? 0 : Math.round((present / total) * 100);
    document.getElementById('overall-percentage').innerText = perc + "%";

    // History List (Last 10 entries)
    const historyContainer = document.getElementById('history-list');
    historyContainer.innerHTML = [...userAttendance].reverse().slice(0, 10).map(rec => `
        <div class="glass-card slot-card" style="padding: 10px 15px;">
            <div class="slot-info">
                <div>
                    <strong style="color:${rec.status === 'present' ? 'var(--success)' : 'var(--danger)'}">${rec.status.toUpperCase()}</strong>
                    <div style="font-size:14px">${rec.subject}</div>
                    <div style="font-size:10px; color:var(--text-muted)">${rec.date} ${rec.time}</div>
                </div>
                <button class="icon-btn" onclick="unmarkAttendance(${rec.id})">
                    <span class="material-icons-round" style="color:var(--danger)">delete</span>
                </button>
            </div>
        </div>
    `).join('');

    updateChart(present, total);
}

function updateChart(p, t) {
    const ctx = document.getElementById('attendanceChart').getContext('2d');
    if (chartInstance) chartInstance.destroy();
    chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Present', 'Absent'],
            datasets: [{ data: [p, t - p], backgroundColor: ['#10B981', '#EF4444'], borderWidth: 0 }]
        },
        options: { cutout: '75%', plugins: { legend: { display: false } } }
    });
}

// --- NAVIGATION & UI ---
document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.nav-item, .view').forEach(el => el.classList.remove('active'));
        const target = e.currentTarget.dataset.target;
        e.currentTarget.classList.add('active');
        document.getElementById(target).classList.add('active');
        if (target === 'view-timetable') renderEditor();
    });
});

function renderEditor() {
    const day = document.getElementById('day-selector').value;
    document.getElementById('editor-slots').innerHTML = userTimetable[day].map((slot, i) => `
        <div class="editor-row" style="margin-bottom:10px">
            <label style="font-size:12px">${slot.time}</label>
            <select class="glass-input tt-input" data-index="${i}">
                <option value="Break" ${slot.subject==='Break'?'selected':''}>Break</option>
                ${mbbsSubjects.map(s => `<option value="${s}" ${slot.subject===s?'selected':''}>${s}</option>`).join('')}
            </select>
        </div>
    `).join('');
}

document.getElementById('btn-save-timetable').addEventListener('click', () => {
    const day = document.getElementById('day-selector').value;
    document.querySelectorAll('.tt-input').forEach(input => {
        userTimetable[day][input.dataset.index].subject = input.value;
    });
    saveData();
    alert("Timetable Saved!");
});

if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');
