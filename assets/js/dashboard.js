
// === FIREBASE CONFIGURATION ===
const firebaseConfig = {
    apiKey: "AIzaSyCQNKfoNDPfj-mSZxAQCIEzQ4H3tS-KmiM",
    authDomain: "primetech-os.firebaseapp.com",
    projectId: "primetech-os",
    storageBucket: "primetech-os.firebasestorage.app",
    messagingSenderId: "853393963895",
    appId: "1:853393963895:web:e2c881c3eab3e52b88ff72",
    measurementId: "G-7R82XLTYT4"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const adminName = "Godfrey"; // Hardcoded admin name for chat
const BOOTSTRAP_ADMIN_UID = 'sJSLqnZTFvcnubHnNyl1NJlMHy52';
let authenticatedAdmin = null;

// Global State
let currentChatId = 'team_general';
let currentChatType = 'team';
let activeMessageListener = null;
let currentThreadMsgId = null;
let activeThreadListener = null;
let chartsInitialized = false;
let trafficChartInstance, engagementChartInstance, sourcesChartInstance;
let teamRoster = [];
let teamPresence = {};
let activePresenceListener = null;
let presenceHeartbeat = null;
let messagePriority = false;
let authenticatedAdminProfile = null;
let isSuperAdmin = false;
let adminAccessUnlocked = false;
let inactivityTimer = null;
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;

// === TOAST ===
function showToast(msg) {
    const t = document.getElementById('toast');
    t.innerText = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
}

// === MOBILE NAV ===
function toggleSidebar(state) {
    document.getElementById('sidebar').classList.toggle('active', state);
    document.getElementById('overlay').classList.toggle('active', state);
}

function toggleChatSidebar(id) {
    document.getElementById(id).classList.toggle('mobile-active');
}

function toggleNavGroup(button) {
    const group = button.closest('.nav-group');
    const expanded = button.getAttribute('aria-expanded') === 'true';
    button.setAttribute('aria-expanded', String(!expanded));
    group.classList.toggle('collapsed', expanded);
}

function toggleSidebarMinimized() {
    const sidebar = document.getElementById('sidebar');
    const minimized = sidebar.classList.toggle('minimized');
    localStorage.setItem('primetech-sidebar-minimized', String(minimized));
    const button = document.querySelector('.sidebar-collapse-btn');
    button.title = minimized ? 'Expand navigation' : 'Minimize navigation';
    button.setAttribute('aria-label', button.title);
}

function restoreSidebarState() {
    if (localStorage.getItem('primetech-sidebar-minimized') === 'true' && window.innerWidth > 768) {
        toggleSidebarMinimized();
    }
}

restoreSidebarState();

// === VIEW SWITCHER ===
function switchView(viewId, btn) {
    if (viewId === 'adminControls' && (!isSuperAdmin || !adminAccessUnlocked)) {
        requestAdminAccess();
        return;
    }
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    btn.classList.add('active');
    const group = btn.closest('.nav-group');
    if (group?.classList.contains('collapsed')) {
        const section = group.querySelector('.nav-section-title');
        section.setAttribute('aria-expanded', 'true');
        group.classList.remove('collapsed');
    }

    const titles = {
        dashboard: ['Dashboard Overview', "Welcome back! Here's what's happening today."],
        clientMessages: ['Client Messages', 'Chat directly with your website leads.'],
        teamChat: ['Team Communication', 'Slack-style internal chat.'],
        projectForms: ['Project Workspace', 'Manage delivery, documents, and project lifecycle.'],
        crm: ['Lead Pipeline', 'Review and manage incoming opportunities.'],
        portfolio: ['Portfolio Manager', 'Publish and maintain your public work.'],
        siteSettings: ['Website Settings', 'Update global site content dynamically.'],
        team: ['Team Directory', 'View approved admins and their availability.'],
        myProfile: ['My Profile', 'Update your personal and team directory information.'],
        adminControls: ['Admin Command Center', 'Control access, roles, tasks, and internal accountability.']
    };
    document.getElementById('pageTitle').innerText = titles[viewId][0];
    document.getElementById('pageSubtitle').innerText = titles[viewId][1];
    toggleSidebar(false);

    if ((viewId === 'dashboard') && chartsInitialized) {
        if (trafficChartInstance) trafficChartInstance.resize();
    }
}

function requestAdminAccess() {
    if (!isSuperAdmin) return;
    document.getElementById('adminUnlockPassword').value = '';
    document.getElementById('adminUnlockError').style.display = 'none';
    document.getElementById('adminUnlockModal').classList.add('active');
    setTimeout(() => document.getElementById('adminUnlockPassword').focus(), 0);
}

function closeAdminAccess() {
    document.getElementById('adminUnlockModal').classList.remove('active');
}

async function confirmAdminAccess(event) {
    event.preventDefault();
    const password = document.getElementById('adminUnlockPassword').value;
    const error = document.getElementById('adminUnlockError');
    try {
        const credential = firebase.auth.EmailAuthProvider.credential(authenticatedAdmin.email, password);
        await authenticatedAdmin.reauthenticateWithCredential(credential);
        adminAccessUnlocked = true;
        closeAdminAccess();
        const button = document.querySelector('#adminControlsNav .nav-item');
        switchView('adminControls', button);
        showToast('Administration unlocked for this session.');
    } catch (authError) {
        error.innerText = authError.code === 'auth/wrong-password' ? 'The password is incorrect.' : 'Could not confirm access. Try again.';
        error.style.display = 'block';
    }
}

function resetInactivityTimer() {
    if (!authenticatedAdmin) return;
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(lockForInactivity, INACTIVITY_TIMEOUT_MS);
}

async function lockForInactivity() {
    adminAccessUnlocked = false;
    if (document.getElementById('adminControls')?.classList.contains('active')) {
        showToast('Administration locked after inactivity.');
    }
    await firebase.auth().signOut();
    window.location.href = 'login.html';
}

['click', 'keydown', 'mousemove', 'touchstart'].forEach(eventName => {
    document.addEventListener(eventName, resetInactivityTimer, { passive: true });
});

// ==========================================
// FIREBASE: DASHBOARD STATS & ANALYTICS
// ==========================================
function initDashboardStats() {
    db.collection('analytics_events').orderBy('timestamp', 'desc').limit(5000).onSnapshot(snapshot => {
        const events = snapshot.docs.map(doc => doc.data()).filter(event => event.timestamp);
        const pageViews = events.filter(event => event.type === 'page_view');
        const sessionStarts = events.filter(event => event.type === 'session_start');
        const sessionEnds = events.filter(event => event.type === 'session_end' && Number(event.durationSeconds) >= 0);
        const sessionIds = new Set(pageViews.map(event => event.sessionId));
        const sessions = sessionStarts.length ? new Set(sessionStarts.map(event => event.sessionId)) : sessionIds;
        const durations = sessionEnds.map(event => Number(event.durationSeconds)).filter(Number.isFinite);
        const averageSeconds = durations.length ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : 0;
        const bouncedSessions = [...sessions].filter(sessionId => pageViews.filter(event => event.sessionId === sessionId).length === 1).length;
        const bounceRate = sessions.size ? Math.round((bouncedSessions / sessions.size) * 100) : 0;
        const pathCounts = pageViews.reduce((counts, event) => {
            counts[event.path] = (counts[event.path] || 0) + 1;
            return counts;
        }, {});
        const topPages = Object.entries(pathCounts)
            .sort((first, second) => second[1] - first[1])
            .slice(0, 5)
            .map(([path, count]) => ({ name: formatAnalyticsPath(path), percentage: pageViews.length ? Math.round((count / pageViews.length) * 100) : 0 }));
        const trafficData = [];
        const trafficLabels = [];
        for (let offset = 6; offset >= 0; offset--) {
            const day = new Date();
            day.setHours(0, 0, 0, 0);
            day.setDate(day.getDate() - offset);
            const nextDay = new Date(day);
            nextDay.setDate(day.getDate() + 1);
            trafficLabels.push(day.toLocaleDateString([], { weekday: 'short' }));
            trafficData.push(pageViews.filter(event => {
                const timestamp = event.timestamp.toDate();
                return timestamp >= day && timestamp < nextDay;
            }).length);
        }
        const analytics = {
            pageViews: pageViews.length,
            avgDuration: formatAnalyticsDuration(averageSeconds),
            bounceRate,
            trafficData,
            trafficLabels,
            topPages: topPages.length ? topPages : [{ name: 'No page views yet', percentage: 0 }]
        };
        renderLiveAnalytics(analytics);
    }, error => {
        console.error('Live analytics error:', error);
        showToast('Live analytics are unavailable. Check the analytics Firestore rules.');
    });

    // 2. Listen for actual leads (Count unread contact submissions)
    db.collection('contact_submissions').onSnapshot(snapshot => {
        let unreadCount = 0;
        snapshot.forEach(doc => {
            if (!doc.data().isRead) unreadCount++;
        });
        document.getElementById('statLeads').innerText = snapshot.size;
        document.getElementById('leadBadge').innerText = unreadCount;
    });
}

function formatAnalyticsPath(path) {
    if (path === '/' || path === '/index.html') return 'Home';
    return path.replace(/^\//, '').replace(/[-_]/g, ' ').replace(/\.html$/, '').replace(/\b\w/g, character => character.toUpperCase());
}

function formatAnalyticsDuration(seconds) {
    if (!seconds) return '0s';
    const minutes = Math.floor(seconds / 60);
    return minutes ? `${minutes}m ${seconds % 60}s` : `${seconds}s`;
}

function renderLiveAnalytics(data) {
    document.getElementById('statPageViews').innerText = data.pageViews;
    document.getElementById('statDuration').innerText = data.avgDuration;
    document.getElementById('statBounce').innerText = data.bounceRate + '%';
    document.getElementById('topPagesList').innerHTML = data.topPages.map(page => `
        <div style="display: flex; justify-content: space-between;">
            <span style="font-size: 0.85rem;">${escapeHtml(page.name)}</span>
            <span style="font-size: 0.85rem; color: var(--accent);">${page.percentage}%</span>
        </div>
        <div style="height: 6px; background: var(--bg); border-radius: 4px; margin-bottom: 10px;">
            <div style="width: ${page.percentage}%; height: 100%; background: var(--gradient); border-radius: 4px;"></div>
        </div>`).join('');
    if (trafficChartInstance) trafficChartInstance.destroy();
    initCharts(data);
    chartsInitialized = true;
    document.getElementById('setViews').value = data.pageViews;
    document.getElementById('setDur').value = data.avgDuration;
    document.getElementById('setBounce').value = data.bounceRate;
}

function initCharts(data) {
    const ctx1 = document.getElementById('trafficChart');
    if (ctx1) trafficChartInstance = new Chart(ctx1, {
        type: 'line',
        data: {
            labels: data.trafficLabels || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            datasets: [{ data: data.trafficData, borderColor: '#00D4FF', backgroundColor: 'rgba(0, 212, 255, 0.1)', fill: true, tension: 0.4 }]
        },
        options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });
}

// ==========================================
// FIREBASE: SITE SETTINGS & ANALYTICS SAVE
// ==========================================
function saveSettings(e) {
    e.preventDefault();
    db.collection('site_settings').doc('general').set({
        heroTitle: document.getElementById('setHeroTitle').value,
        heroDesc: document.getElementById('setHeroDesc').value,
        aboutTitle: document.getElementById('setAboutTitle').value,
        aboutText1: document.getElementById('setAboutText1').value,
        aboutText2: document.getElementById('setAboutText2').value,
        footerDesc: document.getElementById('setFooterDesc').value,
        email: document.getElementById('setEmail').value,
        phone: document.getElementById('setPhone').value,
        location: document.getElementById('setLocation').value
    }, { merge: true }).then(() => showToast("Site settings saved! Live site updated."));
}

// Load Site Settings into form
db.collection('site_settings').doc('general').onSnapshot(doc => {
    if (doc.exists) {
        const d = doc.data();
        document.getElementById('setHeroTitle').value = d.heroTitle || '';
        document.getElementById('setHeroDesc').value = d.heroDesc || '';
        document.getElementById('setAboutTitle').value = d.aboutTitle || '';
        document.getElementById('setAboutText1').value = d.aboutText1 || '';
        document.getElementById('setAboutText2').value = d.aboutText2 || '';
        document.getElementById('setFooterDesc').value = d.footerDesc || '';
        document.getElementById('setEmail').value = d.email || '';
        document.getElementById('setPhone').value = d.phone || '';
        document.getElementById('setLocation').value = d.location || '';
    }
});

// ==========================================
// FIREBASE: PORTFOLIO MANAGER (ADD / EDIT / PUBLISH / DELETE)
// ==========================================

let confirmCallback = null;

// --- Custom Confirmation Modal Logic ---
function showConfirmModal(title, message, callback, btnText = "Confirm", iconClass = "fas fa-exclamation-triangle", iconColor = "var(--warning)") {
    document.getElementById('confirmTitle').innerText = title;
    document.getElementById('confirmMessage').innerText = message;
    document.getElementById('confirmActionBtn').innerText = btnText;
    
    const icon = document.getElementById('confirmIcon');
    icon.className = iconClass;
    icon.style.color = iconColor;
    
    confirmCallback = callback;
    document.getElementById('confirmActionBtn').onclick = executeConfirmAction;
    document.getElementById('confirmActionModal').classList.add('active');
}

function closeConfirmModal() {
    document.getElementById('confirmActionModal').classList.remove('active');
    confirmCallback = null;
}

function executeConfirmAction() {
    if (confirmCallback) confirmCallback();
    closeConfirmModal();
}

let inputModalCallback = null;

function showBrandedInput(title, message, placeholder, callback, iconClass = 'fas fa-pen') {
    document.getElementById('inputModalTitle').innerText = title;
    document.getElementById('inputModalMessage').innerText = message;
    document.getElementById('inputModalField').placeholder = placeholder;
    document.getElementById('inputModalField').value = '';
    document.getElementById('inputModalIcon').className = iconClass;
    inputModalCallback = callback;
    document.getElementById('inputActionModal').classList.add('active');
    setTimeout(() => document.getElementById('inputModalField').focus(), 0);
}

function closeInputModal() {
    document.getElementById('inputActionModal').classList.remove('active');
    inputModalCallback = null;
}

function submitInputModal(event) {
    event.preventDefault();
    const value = document.getElementById('inputModalField').value.trim();
    if (!value) return;
    const callback = inputModalCallback;
    closeInputModal();
    if (callback) callback(value);
}

function showBrandedNotice(title, message, iconClass = 'fas fa-circle-info', iconColor = 'var(--accent)') {
    document.getElementById('noticeModalTitle').innerText = title;
    document.getElementById('noticeModalMessage').innerText = message;
    const icon = document.getElementById('noticeModalIcon');
    icon.className = iconClass;
    icon.style.color = iconColor;
    document.getElementById('noticeModal').classList.add('active');
}

function closeBrandedNotice() {
    document.getElementById('noticeModal').classList.remove('active');
}

function savePortfolioProject(e) {
    e.preventDefault();
    const id = document.getElementById('pId').value;
    const tags = document.getElementById('pTags').value.split(',').map(t => t.trim()).filter(t => t);
    
    const projectData = {
        title: document.getElementById('pTitle').value,
        description: document.getElementById('pDesc').value,
        longDescription: document.getElementById('pLongDesc').value,
        imageUrl: document.getElementById('pImg').value,
        liveUrl: document.getElementById('pLive').value,
        githubUrl: document.getElementById('pGithub').value,
        tags: tags,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (id) {
        // Update existing project
        db.collection('projects').doc(id).update(projectData).then(() => {
            showToast("Project updated successfully!");
            resetPortfolioForm();
        }).catch(err => showToast("Error updating: " + err.message));
    } else {
        // Add new project (Hidden by default)
        projectData.isPublished = false; 
        projectData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        
        db.collection('projects').add(projectData).then(() => {
            showToast("Project added! Click the eye icon to make it live.");
            resetPortfolioForm();
        }).catch(err => showToast("Error adding: " + err.message));
    }
}

function resetPortfolioForm() {
    document.getElementById('projectForm').reset();
    document.getElementById('pId').value = '';
    document.getElementById('portfolioFormTitle').innerText = 'Add New Project';
    document.getElementById('portfolioSubmitText').innerText = 'Add Project';
    document.getElementById('cancelEditBtn').style.display = 'none';
}

function editPortfolioProject(id) {
    db.collection('projects').doc(id).get().then(doc => {
        if (doc.exists) {
            const p = doc.data();
            document.getElementById('pId').value = doc.id;
            document.getElementById('pTitle').value = p.title || '';
            document.getElementById('pDesc').value = p.description || '';
            document.getElementById('pLongDesc').value = p.longDescription || '';
            document.getElementById('pImg').value = p.imageUrl || '';
            document.getElementById('pLive').value = p.liveUrl || '';
            document.getElementById('pGithub').value = p.githubUrl || '';
            document.getElementById('pTags').value = (p.tags || []).join(', ');
            
            document.getElementById('portfolioFormTitle').innerText = 'Edit Project';
            document.getElementById('portfolioSubmitText').innerText = 'Update Project';
            document.getElementById('cancelEditBtn').style.display = 'block';
            
            // Scroll to top of the page so the user sees the form
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });
}

function deleteProject(id) {
    showConfirmModal(
        "Delete Project", 
        "Are you sure you want to permanently delete this project? This action cannot be undone.", 
        () => {
            db.collection('projects').doc(id).delete().then(() => {
                showToast("Project deleted successfully.");
                if (document.getElementById('pId').value === id) resetPortfolioForm();
            }).catch(err => showToast("Error deleting: " + err.message));
        },
        "Delete",
        "fas fa-trash",
        "var(--danger)"
    );
}

function togglePublish(id, currentState) {
    const action = currentState ? "Unpublish" : "Publish";
    const msg = currentState 
        ? "Unpublishing this project will immediately hide it from your live website. Are you sure?" 
        : "Publishing this project will make it immediately visible on your live website. Are you sure?";
        
    showConfirmModal(
        `${action} Project`, 
        msg, 
        () => {
            db.collection('projects').doc(id).update({ isPublished: !currentState }).then(() => {
                showToast(`Project ${currentState ? 'unpublished (hidden)' : 'is now live!'} `);
            });
        },
        action,
        currentState ? "fas fa-eye-slash" : "fas fa-globe",
        currentState ? "var(--warning)" : "var(--success)"
    );
}

// --- Search Logic ---
function filterPortfolioProjects() {
    const search = document.getElementById('portfolioSearch').value.toLowerCase();
    const items = document.querySelectorAll('#portfolioList .list-item');
    
    items.forEach(item => {
        const text = item.innerText.toLowerCase();
        item.style.display = text.includes(search) ? 'flex' : 'none';
    });
}

// --- Real-time listener for Portfolio List ---
db.collection('projects').orderBy('createdAt', 'desc').onSnapshot(snapshot => {
    const list = document.getElementById("portfolioList");
    if (!list) return;
    
    list.innerHTML = '';
    if (snapshot.empty) {
        list.innerHTML = '<p style="color: var(--text-muted); text-align: center;">No projects added yet.</p>';
        return;
    }
    
    snapshot.forEach(doc => {
        const p = doc.data();
        const isPublished = p.isPublished || false;
        
        list.innerHTML += `
            <div class="list-item" style="flex-wrap: wrap;">
                <img src="${p.imageUrl || 'https://placehold.co/40x40/06060a/8b95a7?text=PT'}" onerror="this.src='https://placehold.co/40x40/06060a/8b95a7?text=PT'" style="width: 40px; height: 40px; border-radius: 8px; object-fit: cover;">
                <div class="list-info" style="flex: 1; min-width: 150px;">
                    <h4>${p.title || 'Untitled Project'} 
                        ${isPublished ? '<span style="color:var(--success); font-size:0.7rem; margin-left:5px;">(Live)</span>' : '<span style="color:var(--text-muted); font-size:0.7rem; margin-left:5px;">(Hidden)</span>'}
                    </h4>
                    <p>${p.description || ''}</p>
                </div>
                <div style="display: flex; gap: 8px; margin-top: 10px; width: 100%; justify-content: flex-end;">
                    <button class="btn-success" onclick="togglePublish('${doc.id}', ${isPublished})" title="${isPublished ? 'Unpublish' : 'Publish'}">
                        <i class="fas fa-${isPublished ? 'eye-slash' : 'eye'}"></i>
                    </button>
                    <button class="btn-primary" style="background: var(--surface-2); color: var(--accent); padding: 6px 12px; font-size: 0.75rem;" onclick="editPortfolioProject('${doc.id}')" title="Edit">
                        <i class="fas fa-pen"></i>
                    </button>
                    <button class="btn-danger" onclick="deleteProject('${doc.id}')" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>`;
    });
    
    // Apply current search filter when list reloads
    filterPortfolioProjects();
});

// ==========================================
// FIREBASE: CRM / LEAD SUBMISSIONS
// ==========================================
function markLeadRead(id, isRead) {
    db.collection('contact_submissions').doc(id).update({ isRead: !isRead });
}

function deleteLead(id) {
    showConfirmModal('Delete submission?', 'This contact submission will be permanently removed.', () => {
        db.collection('contact_submissions').doc(id).delete();
    }, 'Delete', 'fas fa-trash', 'var(--danger)');
}

db.collection('contact_submissions').orderBy('timestamp', 'desc').onSnapshot(snapshot => {
    const tbody = document.getElementById('crmTableBody');
    tbody.innerHTML = '';
    if (snapshot.empty) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">No submissions yet.</td></tr>';
        return;
    }
    snapshot.forEach(doc => {
        const s = doc.data();
        const date = s.timestamp ? new Date(s.timestamp.toDate()).toLocaleDateString() : '...';
        const isRead = s.isRead;
        tbody.innerHTML += `
                <tr class="${isRead ? '' : 'unread'}">
                    <td>${s.name}</td>
                    <td>${s.email}</td>
                    <td style="cursor: pointer;" onclick="showBrandedNotice('Message from ${escapeHtml(s.name)}', '${escapeHtml(s.message || '').replace(/\\n/g, '<br>')}')">${s.subject}</td>
                    <td>${date}</td>
                    <td>
                        <button class="btn-success" onclick="markLeadRead('${doc.id}', ${isRead})">
                            <i class="fas fa-${isRead ? 'envelope' : 'envelope-open'}"></i>
                        </button>
                        <button class="btn-danger" onclick="deleteLead('${doc.id}')"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>`;
    });
});

function loadTeamDirectory() {
    db.collection('admin_users').where('status', '==', 'approved').onSnapshot(async snapshot => {
    const list = document.getElementById('teamListHtml');
    if (!list) return;
    const profileSnapshot = await db.collection('team_members').get();
    const profiles = new Map(profileSnapshot.docs.map(doc => [String(doc.data().email || '').toLowerCase(), doc.data()]));
    const admins = snapshot.docs.map(doc => {
        const admin = doc.data();
        const profile = profiles.get(String(admin.email || '').toLowerCase()) || {};
        return { ...profile, ...admin, uid: doc.id, name: admin.displayName || profile.name || admin.email || 'Team member', role: profile.role || admin.jobTitle || 'Admin' };
    });
    document.getElementById('teamStatTotal').innerText = admins.length;
    document.getElementById('teamStatActive').innerText = admins.filter(member => member.bio).length;
    document.getElementById('teamStatImages').innerText = admins.filter(member => member.img || member.photoURL).length;
    document.getElementById('teamStatRoles').innerText = new Set(admins.map(member => member.role)).size;
    list.innerHTML = admins.length ? admins.map(member => `
        <div class="list-item team-directory-item">
            ${member.img || member.photoURL ? `<img src="${escapeHtml(member.img || member.photoURL)}" onerror="this.style.display='none'">` : `<div class="team-avatar">${initials(member.name)}</div>`}
            <div class="list-info"><h4>${escapeHtml(member.name)}</h4><p>${escapeHtml(member.role)} · ${escapeHtml(member.email || '')}</p></div>
            <span class="directory-status"><span class="presence-dot ${presenceState(teamPresence[member.uid])}"></span>${presenceState(teamPresence[member.uid])}</span>
            ${authenticatedAdmin?.uid === member.uid ? '<button class="btn-primary" onclick="openMyProfile()" title="Edit your profile"><i class="fas fa-pen"></i></button>' : ''}
        </div>`).join('') : '<p style="color: var(--text-muted); text-align: center;">No approved admins yet.</p>';
    filterTeamMembers();
    }, error => console.error('Team directory error:', error));
}

function filterTeamMembers() {
    const query = (document.getElementById('teamSearch')?.value || '').toLowerCase();
    document.querySelectorAll('#teamListHtml .team-directory-item').forEach(item => {
        item.style.display = item.innerText.toLowerCase().includes(query) ? 'flex' : 'none';
    });
}

async function loadAdminProfile() {
    if (!authenticatedAdmin) return;
    const [adminSnapshot, publicSnapshot] = await Promise.all([
        db.collection('admin_users').doc(authenticatedAdmin.uid).get(),
        db.collection('team_members').doc(authenticatedAdmin.uid).get()
    ]);
    const admin = adminSnapshot.exists ? adminSnapshot.data() : {};
    const publicProfile = publicSnapshot.exists ? publicSnapshot.data() : {};
    const name = admin.displayName || authenticatedAdmin.displayName || adminName;
    const role = admin.jobTitle || publicProfile.role || 'Admin';
    document.getElementById('profileName').value = name;
    document.getElementById('profileEmail').value = authenticatedAdmin.email || admin.email || '';
    document.getElementById('profileRole').value = role;
    document.getElementById('profilePhone').value = admin.phone || publicProfile.phone || '';
    document.getElementById('profilePhoto').value = admin.photoURL || publicProfile.img || '';
    document.getElementById('profileBio').value = admin.bio || publicProfile.bio || '';
    document.getElementById('profileSummaryName').innerText = name;
    document.getElementById('profileSummaryRole').innerText = role;
    document.getElementById('profileAvatarLarge').innerText = initials(name);
}

function openMyProfile() {
    const profileButton = [...document.querySelectorAll('.nav-item')].find(button => button.innerText.includes('My') && button.innerText.includes('Profile'));
    switchView('myProfile', profileButton);
    loadAdminProfile().catch(error => showToast('Could not load profile: ' + error.message));
}

async function saveAdminProfile(event) {
    event.preventDefault();
    if (!authenticatedAdmin) return;
    const name = document.getElementById('profileName').value.trim();
    const role = document.getElementById('profileRole').value.trim() || 'Admin';
    const phone = document.getElementById('profilePhone').value.trim();
    const photoURL = document.getElementById('profilePhoto').value.trim();
    const bio = document.getElementById('profileBio').value.trim();
    try {
        await db.collection('admin_users').doc(authenticatedAdmin.uid).set({
            displayName: name, jobTitle: role, phone, photoURL, bio,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        await db.collection('team_members').doc(authenticatedAdmin.uid).set({
            uid: authenticatedAdmin.uid, email: authenticatedAdmin.email || '', name,
            role, phone, img: photoURL, bio, updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        await authenticatedAdmin.updateProfile({ displayName: name, photoURL: photoURL || null });
        document.getElementById('profileSummaryName').innerText = name;
        document.getElementById('profileSummaryRole').innerText = role;
        document.getElementById('profileAvatarLarge').innerText = initials(name);
        document.getElementById('teamPresenceName').innerText = name;
        document.getElementById('teamPresenceAvatar').innerText = initials(name);
        showToast('Profile updated successfully.');
    } catch (error) {
        showToast('Could not save profile: ' + error.message);
    }
}

function formatAdminDate(value) {
    return value && value.toDate ? value.toDate().toLocaleString() : 'Just now';
}

function recordAdminAudit(action, targetId, details) {
    return db.collection('admin_audit_logs').add({
        action, targetId: targetId || '', details: details || '',
        actorId: authenticatedAdmin.uid, actorEmail: authenticatedAdmin.email || '',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
}

function loadAdminCommandCenter() {
    if (!isSuperAdmin) return;

    db.collection('admin_users').onSnapshot(snapshot => {
        const members = snapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id }));
        const pending = members.filter(member => member.status === 'pending');
        const managed = members.filter(member => member.uid !== BOOTSTRAP_ADMIN_UID && ['approved', 'suspended'].includes(member.status));
        document.getElementById('pendingAdminBadge').innerText = pending.length;
        const pendingMarkup = pending.length ? pending.map(member => `
            <div class="list-item" style="align-items:flex-start; gap:12px;">
                <div class="list-info"><h4>${escapeHtml(member.displayName || member.email || 'New member')}</h4>
                    <p>${escapeHtml(member.email || '')} · Requested ${formatAdminDate(member.createdAt)}</p></div>
                <div style="display:flex; gap:6px; flex-wrap:wrap; justify-content:flex-end;">
                    <select id="approval-role-${member.uid}" aria-label="Role for ${escapeHtml(member.email || 'member')}">
                        <option value="member">Member</option><option value="manager">Manager</option><option value="admin">Admin</option>
                    </select>
                    <button class="btn-success" onclick="reviewAdmin('${member.uid}', 'approved')" title="Approve account"><i class="fas fa-check"></i></button>
                    <button class="btn-danger" onclick="reviewAdmin('${member.uid}', 'rejected')" title="Reject account"><i class="fas fa-xmark"></i></button>
                </div>
            </div>`).join('') : '<p class="form-help">No pending account requests.</p>';
        const managedMarkup = managed.length ? `<h4 style="margin:20px 0 8px;">Current members</h4>${managed.map(member => `
            <div class="list-item" style="align-items:flex-start; gap:12px;">
                <div class="list-info"><h4>${escapeHtml(member.displayName || member.email || 'Member')}</h4><p>${escapeHtml(member.email || '')} · ${escapeHtml(member.loginLocked ? 'login locked' : member.status)}</p></div>
                <select onchange="updateAdminMember('${member.uid}', this.value)">
                    ${['member', 'manager', 'admin'].map(role => `<option value="${role}" ${member.role === role ? 'selected' : ''}>${role}</option>`).join('')}
                </select>
                ${member.loginLocked ? `<button class="btn-success" onclick="unlockAdmin('${member.uid}')" title="Unlock login"><i class="fas fa-unlock"></i></button>` : ''}
                <button class="${member.status === 'suspended' ? 'btn-success' : 'btn-danger'}" onclick="updateAdminMember('${member.uid}', '${member.status === 'suspended' ? 'approved' : 'suspended'}')" title="${member.status === 'suspended' ? 'Restore access' : 'Suspend access'}"><i class="fas fa-${member.status === 'suspended' ? 'rotate-left' : 'ban'}"></i></button>
            </div>`).join('')}` : '';
        document.getElementById('adminApprovalList').innerHTML = pendingMarkup + managedMarkup;

        const approved = members.filter(member => member.status === 'approved' || member.status === 'suspended');
        document.getElementById('taskAssignee').innerHTML = approved.length
            ? approved.map(member => `<option value="${member.uid}" ${member.status === 'suspended' ? 'disabled' : ''}>${escapeHtml(member.displayName || member.email || member.uid)}${member.status === 'suspended' ? ' (suspended)' : ''}</option>`).join('')
            : '<option value="">No approved members</option>';
    }, error => showToast('Could not load admin accounts: ' + error.message));

    db.collection('tasks').onSnapshot(snapshot => {
        const tasks = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        document.getElementById('adminTaskList').innerHTML = tasks.length ? tasks.map(task => `
            <div class="list-item"><div class="list-info"><h4>${escapeHtml(task.title || 'Untitled task')}</h4>
                <p>${escapeHtml(task.description || 'No details')} · Assigned to ${escapeHtml(task.assigneeName || task.assignedTo || 'Unassigned')}</p></div>
                <span class="directory-status">${escapeHtml(task.status || 'open')}${task.dueDate ? ` · due ${escapeHtml(task.dueDate)}` : ''}</span>
                <button class="btn-danger" onclick="deleteAdminTask('${task.id}')" title="Delete task"><i class="fas fa-trash"></i></button></div>`).join('') : '<p class="form-help">No tasks assigned yet.</p>';
    }, error => showToast('Could not load tasks: ' + error.message));

    db.collection('admin_audit_logs').limit(25).onSnapshot(snapshot => {
        const logs = snapshot.docs.map(doc => doc.data());
        document.getElementById('adminAuditList').innerHTML = logs.length ? logs.map(log => `
            <div class="list-item"><div class="list-info"><h4>${escapeHtml(log.action || 'Administrative action')}</h4>
                <p>${escapeHtml(log.details || '')} · ${escapeHtml(log.actorEmail || 'System')} · ${formatAdminDate(log.createdAt)}</p></div></div>`).join('') : '<p class="form-help">No administrative activity recorded.</p>';
    }, error => showToast('Could not load audit history: ' + error.message));
}

async function reviewAdmin(uid, status) {
    if (!isSuperAdmin) return;
    const role = document.getElementById(`approval-role-${uid}`)?.value || 'member';
    try {
        await db.collection('admin_users').doc(uid).update({ status, role, reviewedBy: authenticatedAdmin.uid, reviewedAt: firebase.firestore.FieldValue.serverTimestamp(), updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
        await recordAdminAudit(status === 'approved' ? 'Approved admin account' : 'Rejected admin account', uid, `${role} role`);
        showToast(status === 'approved' ? 'Account approved.' : 'Account rejected.');
    } catch (error) { showToast('Could not review account: ' + error.message); }
}

async function updateAdminMember(uid, value) {
    if (!isSuperAdmin || uid === BOOTSTRAP_ADMIN_UID) return;
    const update = ['approved', 'suspended'].includes(value) ? { status: value } : { role: value };
    try {
        await db.collection('admin_users').doc(uid).update({ ...update, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
        await recordAdminAudit(update.status ? `${update.status === 'suspended' ? 'Suspended' : 'Restored'} admin access` : 'Updated admin role', uid, update.role || '');
        showToast('Member access updated.');
    } catch (error) { showToast('Could not update member: ' + error.message); }
}

async function unlockAdmin(uid) {
    if (!isSuperAdmin || uid === BOOTSTRAP_ADMIN_UID) return;
    try {
        await db.collection('admin_users').doc(uid).update({ loginLocked: false, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
        await recordAdminAudit('Unlocked admin login', uid, 'Login lock cleared by super admin');
        showToast('Login unlocked.');
    } catch (error) { showToast('Could not unlock account: ' + error.message); }
}

async function createAdminTask(event) {
    event.preventDefault();
    if (!isSuperAdmin) return;
    const assignee = document.getElementById('taskAssignee');
    const assigneeName = assignee.options[assignee.selectedIndex]?.textContent || '';
    try {
        const task = await db.collection('tasks').add({
            title: document.getElementById('taskTitle').value.trim(),
            description: document.getElementById('taskDescription').value.trim(),
            assignedTo: assignee.value, assigneeName, dueDate: document.getElementById('taskDueDate').value,
            status: 'open', createdBy: authenticatedAdmin.uid, createdAt: firebase.firestore.FieldValue.serverTimestamp(), updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        await recordAdminAudit('Created task', task.id, `Assigned to ${assigneeName}`);
        event.target.reset();
        showToast('Task assigned.');
    } catch (error) { showToast('Could not assign task: ' + error.message); }
}

async function deleteAdminTask(taskId) {
    if (!isSuperAdmin) return;
    try {
        await db.collection('tasks').doc(taskId).delete();
        await recordAdminAudit('Deleted task', taskId, 'Task removed by super admin');
        showToast('Task deleted.');
    } catch (error) { showToast('Could not delete task: ' + error.message); }
}

// ==========================================
// CHAT LOGIC (CLIENT & TEAM)
// ==========================================
let activeClientListener = null;

function initials(name) {
    return (name || 'Team').split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase();
}

function presenceState(data) {
    if (!data || data.status === 'offline') return 'offline';
    if (data.status === 'away') return 'away';
    const lastSeen = data.lastSeen && data.lastSeen.toDate ? data.lastSeen.toDate().getTime() : 0;
    return lastSeen && Date.now() - lastSeen > 120000 ? 'offline' : 'online';
}

function renderTeamRoster() {
    const list = document.getElementById('dmList');
    if (!list) return;
    const query = (document.getElementById('teamChatSearch')?.value || '').toLowerCase();
    const visibleMembers = teamRoster.filter(member => `${member.name} ${member.role} ${member.email}`.toLowerCase().includes(query));
    list.innerHTML = visibleMembers.length ? visibleMembers.map(member => {
        const memberPresence = teamPresence[member.presenceId] || Object.values(teamPresence).find(presence =>
            (member.email && presence.email === member.email) || (member.name && presence.name === member.name)
        );
        const state = presenceState(memberPresence);
        const chatId = 'dm_' + (member.presenceId || member.id || member.name).replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
        return `<li class="chat-user-item" onclick="selectChat('team', '${chatId}', '${member.name.replace(/'/g, "\\'")}', this)">
            ${member.img ? `<img src="${member.img}" onerror="this.style.display='none'">` : `<span class="team-avatar">${initials(member.name)}</span>`}
            <div class="chat-person-copy"><h4>${member.name}</h4><small>${member.role || 'Team member'}</small></div>
            <span class="presence-dot ${state}" title="${state}"></span>
        </li>`;
    }).join('') : '<li class="chat-user-item roster-loading">No matching teammates.</li>';
}

function filterTeamChat() {
    const query = (document.getElementById('teamChatSearch')?.value || '').toLowerCase();
    document.querySelectorAll('#channelList .chat-user-item').forEach(item => {
        item.style.display = item.innerText.toLowerCase().includes(query) ? '' : 'none';
    });
    renderTeamRoster();
}

function loadTeamChat() {
    let approvedAdmins = [];
    let profileDetails = [];
    const renderApprovedRoster = () => {
        const detailsByEmail = new Map(profileDetails.map(member => [String(member.email || '').toLowerCase(), member]));
        teamRoster = approvedAdmins.map(admin => {
            const profile = detailsByEmail.get(String(admin.email || '').toLowerCase()) || {};
            return {
                ...profile,
                ...admin,
                name: admin.displayName || profile.name || admin.email || 'Team member',
                role: profile.role || 'Admin',
                img: profile.img || admin.photoURL || '',
                presenceId: admin.uid,
                email: admin.email || profile.email || ''
            };
        });
        renderTeamRoster();
    };

    db.collection('admin_users').where('status', '==', 'approved').onSnapshot(snapshot => {
        approvedAdmins = snapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id }));
        renderApprovedRoster();
    }, error => showBrandedNotice('People unavailable', 'Approved admin profiles could not be loaded.', 'fas fa-users-slash', 'var(--danger)'));

    db.collection('team_members').onSnapshot(snapshot => {
        profileDetails = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        renderApprovedRoster();
    });

    if (activePresenceListener) activePresenceListener();
    activePresenceListener = db.collection('team_presence').onSnapshot(snapshot => {
        teamPresence = {};
        snapshot.forEach(doc => { teamPresence[doc.id] = doc.data(); });
        const ownPresence = teamPresence[authenticatedAdmin?.uid];
        if (ownPresence) {
            document.getElementById('teamPresenceStatus').value = ownPresence.status || 'online';
            document.getElementById('teamPresenceDot').className = `presence-dot ${presenceState(ownPresence)}`;
        }
        renderTeamRoster();
    });

    db.collection('chat_channels').orderBy('name').onSnapshot(snapshot => {
        const list = document.getElementById('channelList');
        const existing = new Set([...list.querySelectorAll('.chat-item-label')].map(item => item.innerText.toLowerCase()));
        snapshot.forEach(doc => {
            const channel = doc.data();
            if (existing.has((channel.name || '').toLowerCase())) return;
            const item = document.createElement('li');
            item.className = 'chat-user-item';
            item.onclick = () => selectChat('team', doc.id, channel.name, item);
            item.innerHTML = `<span class="hash">#</span><span class="chat-item-label">${channel.name}</span>`;
            list.appendChild(item);
        });
        filterTeamChat();
    }, error => console.warn('Could not load channels:', error.message));
}

function updatePresenceStatus(status) {
    if (!authenticatedAdmin) return;
    db.collection('team_presence').doc(authenticatedAdmin.uid).set({
        name: authenticatedAdmin.displayName || adminName,
        email: authenticatedAdmin.email || '', status,
        lastSeen: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true }).catch(error => showToast('Could not update availability: ' + error.message));
}

function startPresenceHeartbeat() {
    if (!authenticatedAdmin) return;
    const statusSelect = document.getElementById('teamPresenceStatus');
    const writePresence = () => updatePresenceStatus(statusSelect?.value || 'online');
    writePresence();
    clearInterval(presenceHeartbeat);
    presenceHeartbeat = setInterval(writePresence, 60000);
    window.addEventListener('beforeunload', () => {
        db.collection('team_presence').doc(authenticatedAdmin.uid).set({ status: 'offline', lastSeen: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
    }, { once: true });
}

function insertChatToken(type) {
    const input = document.getElementById('teamChatInput');
    const tokens = { code: '```\n// paste code here\n```', mention: '@', command: '/' };
    input.value += (input.value ? '\n' : '') + tokens[type];
    input.focus();
    autoGrowChatInput(input);
}

function autoGrowChatInput(input) {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 140) + 'px';
}

function toggleMessagePriority() {
    messagePriority = !messagePriority;
    document.querySelector('.priority-btn')?.classList.toggle('active', messagePriority);
    showToast(messagePriority ? 'Next message marked high priority.' : 'Priority removed.');
}

function togglePinnedMessages() { showToast('Pin messages from the message action menu.'); }
function toggleChatDetails() { showToast(`${teamRoster.length} teammates in this workspace.`); }

function loadClientList() {
    const clientList = document.getElementById('clientList');
    if (!clientList) return;
    if (activeClientListener) activeClientListener();

    activeClientListener = db.collection('clients').orderBy('updatedAt', 'desc').onSnapshot(snapshot => {
        clientList.innerHTML = '';
        const clients = snapshot.docs.filter(doc => doc.data().status !== 'deleted');
        document.getElementById('leadBadge').textContent = clients.length;

        if (!clients.length) {
            clientList.innerHTML = '<li class="chat-user-item" style="justify-content:center; color:var(--text-muted);">No clients yet.</li>';
            return;
        }

        clients.forEach(doc => {
            const client = doc.data();
            const name = client.name || 'Unnamed visitor';
            const chatId = 'client_' + doc.id;
            const item = document.createElement('li');
            item.className = 'chat-user-item' + (client.status === 'archived' ? ' archived' : '');
            item.innerHTML = `
                <div class="client-avatar">${escapeHtml(name.charAt(0).toUpperCase())}</div>
                <div style="min-width:0; flex:1;">
                    <h4>${escapeHtml(name)}</h4>
                    <small style="color:var(--text-muted);">${client.status === 'archived' ? 'Archived' : 'Active'}</small>
                </div>
                <button class="action-btn" title="Client actions" onclick="event.stopPropagation(); toggleClientActions('${doc.id}', this)">
                    <i class="fas fa-ellipsis-v"></i>
                </button>
                <div class="client-actions" id="client-actions-${doc.id}" style="display:none;">
                    ${client.status === 'archived'
                        ? `<button onclick="event.stopPropagation(); restoreClient('${doc.id}')"><i class="fas fa-box-open"></i> Restore</button>`
                        : `<button onclick="event.stopPropagation(); archiveClient('${doc.id}')"><i class="fas fa-archive"></i> Archive</button>`}
                    <button class="danger" onclick="event.stopPropagation(); deleteClient('${doc.id}')"><i class="fas fa-trash"></i> Delete</button>
                </div>`;
            item.onclick = () => selectChat('client', chatId, name, item);
            clientList.appendChild(item);
        });
    }, error => {
        clientList.innerHTML = '<li class="chat-user-item" style="justify-content:center; color:var(--danger);">Unable to load clients.</li>';
        console.error('Client list error:', error);
    });
}

function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function toggleClientActions(clientId, button) {
    const menu = document.getElementById('client-actions-' + clientId);
    document.querySelectorAll('.client-actions').forEach(item => {
        if (item !== menu) {
            item.style.display = 'none';
            item.closest('.chat-user-item')?.classList.remove('actions-open');
        }
    });
    const isOpening = menu.style.display === 'none';
    menu.style.display = isOpening ? 'flex' : 'none';
    menu.closest('.chat-user-item')?.classList.toggle('actions-open', isOpening);
}

function archiveClient(clientId) {
    db.collection('clients').doc(clientId).update({ status: 'archived', updatedAt: firebase.firestore.FieldValue.serverTimestamp() })
        .then(() => showToast('Client archived.'))
        .catch(error => showToast('Could not archive client: ' + error.message));
}

async function archiveSelectedClient() {
    const clientId = document.getElementById('archiveClientButton').dataset.clientId;
    if (!clientId) return;

    try {
        const clientSnapshot = await db.collection('clients').doc(clientId).get();
        if (clientSnapshot.exists && clientSnapshot.data().status === 'archived') {
            restoreClient(clientId);
        } else {
            archiveClient(clientId);
        }
    } catch (error) {
        showToast('Could not update client status: ' + error.message);
    }
}

function deleteSelectedClient() {
    const clientId = document.getElementById('deleteClientButton').dataset.clientId;
    if (clientId) deleteClient(clientId);
}

function restoreClient(clientId) {
    db.collection('clients').doc(clientId).update({ status: 'active', updatedAt: firebase.firestore.FieldValue.serverTimestamp() })
        .then(() => showToast('Client restored.'))
        .catch(error => showToast('Could not restore client: ' + error.message));
}

async function deleteClient(clientId) {
    showConfirmModal('Delete client?', 'This permanently removes the client and all associated chat messages.', async () => {
        try {
            const chatRef = db.collection('chats').doc('client_' + clientId);
            const messages = await chatRef.collection('messages').get();
            const operations = [];
            for (const message of messages.docs) {
                const replies = await message.ref.collection('replies').get();
                replies.docs.forEach(reply => operations.push(reply.ref));
                operations.push(message.ref);
            }
            operations.push(db.collection('clients').doc(clientId), chatRef);
            for (let offset = 0; offset < operations.length; offset += 400) {
                const deleteBatch = db.batch();
                operations.slice(offset, offset + 400).forEach(ref => deleteBatch.delete(ref));
                await deleteBatch.commit();
            }
            if (currentChatId === 'client_' + clientId) {
                document.getElementById('clientChatMessages').innerHTML = '<div style="text-align:center; color:var(--text-muted); margin-top:40px;">Select a client to view messages.</div>';
            }
            showToast('Client and messages deleted.');
        } catch (error) {
            showToast('Could not delete client: ' + error.message);
        }
    }, 'Delete client', 'fas fa-user-slash', 'var(--danger)');
}

function selectChat(type, chatId, name, element) {
    currentChatType = type;
    currentChatId = chatId;

    document.querySelectorAll('.chat-user-item').forEach(el => el.classList.remove('active'));
    if (element) element.classList.add('active');

    if (type === 'client') {
        document.getElementById('clientChatHeader').innerHTML = `<i class="fas fa-lock" style="font-size:0.7rem; color:var(--text-muted);"></i> ${name}`;
        document.getElementById('clientChatInput').placeholder = `Message ${name}...`;
        const clientId = chatId.replace(/^client_/, '');
        document.getElementById('archiveClientButton').disabled = false;
        document.getElementById('deleteClientButton').disabled = false;
        document.getElementById('archiveClientButton').dataset.clientId = clientId;
        document.getElementById('deleteClientButton').dataset.clientId = clientId;
    } else {
        const isChannel = chatId.startsWith('team_');
        document.getElementById('teamChatHeader').innerHTML = isChannel ? `<span class="hash">#</span> ${name}` : `<span class="team-avatar small">${initials(name)}</span> ${name}`;
        document.getElementById('teamChatMeta').innerText = isChannel ? 'Team channel' : 'Private conversation';
        document.getElementById('teamChatInput').placeholder = `Message ${name}...`;
    }

    if (window.innerWidth <= 768) {
        document.getElementById(type === 'client' ? 'clientSidebar' : 'teamSidebar').classList.remove('mobile-active');
    }

    if (activeMessageListener) activeMessageListener();

    const msgAreaId = type === 'client' ? 'clientChatMessages' : 'teamChatMessages';
    const msgArea = document.getElementById(msgAreaId);
    msgArea.innerHTML = '<div style="text-align:center; color:var(--text-muted); margin-top:20px;">Loading messages...</div>';

    activeMessageListener = db.collection('chats').doc(chatId).collection('messages').orderBy('timestamp', 'asc').onSnapshot(snapshot => {
        msgArea.innerHTML = '';
        if (snapshot.empty) {
            const visitorId = chatId.replace(/^client_/, '');
            db.collection('chats').doc('client').collection('messages')
                .where('visitorId', '==', visitorId)
                .get()
                .then(legacySnapshot => {
                    if (legacySnapshot.empty) {
                        msgArea.innerHTML = '<div style="text-align:center; color:var(--text-muted); margin-top:40px;"><i class="fas fa-comments" style="font-size:2rem; display:block; margin-bottom:10px;"></i>No messages yet.</div>';
                        return;
                    }
                    legacySnapshot.docs
                        .sort((a, b) => {
                            const first = a.data().timestamp ? a.data().timestamp.toMillis() : 0;
                            const second = b.data().timestamp ? b.data().timestamp.toMillis() : 0;
                            return first - second;
                        })
                        .forEach(message => renderMessage(message, msgArea, type));
                    msgArea.scrollTop = msgArea.scrollHeight;
                })
                .catch(error => {
                    console.error('Legacy conversation lookup error:', error);
                    msgArea.innerHTML = '<div style="text-align:center; color:var(--danger); margin-top:40px;">Unable to load this conversation history.</div>';
                });
            return;
        }
        snapshot.forEach(doc => {
            renderMessage(doc, msgArea, type);
        });
        msgArea.scrollTop = msgArea.scrollHeight;
    }, error => {
        console.error('Conversation history error:', error);
        msgArea.innerHTML = '<div style="text-align:center; color:var(--danger); margin-top:40px;">Unable to load this conversation.</div>';
    });
}

function renderMessage(doc, msgArea, type) {
    const m = doc.data();
    const msgId = doc.id;
    const time = m.timestamp ? new Date(m.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...';
    const senderName = m.senderName || m.sender || 'Visitor';
    const isSent = m.sender === adminName;
    const wrapper = document.createElement('div');
    wrapper.className = `message-wrapper ${isSent ? 'sent' : 'received'}`;
    wrapper.dataset.id = msgId;

    let actionsHTML = isSent ? `
                <div class="message-actions">
                    <button class="action-btn" onclick="editMessage('${msgId}', '${type}')" title="Edit"><i class="fas fa-pencil-alt"></i></button>
                    <button class="action-btn" onclick="deleteMessage('${msgId}', '${type}')" title="Delete"><i class="fas fa-trash"></i></button>
                    <button class="action-btn" onclick="openThread('${msgId}')" title="Reply in thread"><i class="fas fa-reply"></i></button>
                </div>` : `
                <div class="message-actions">
                    <button class="action-btn" onclick="openThread('${msgId}')" title="Reply in thread"><i class="fas fa-reply"></i></button>
                    ${type === 'client' ? `<button class="action-btn" onclick="deleteMessage('${msgId}', '${type}')" title="Delete"><i class="fas fa-trash"></i></button>` : ''}
                </div>`;

    let reactionsHTML = '<div class="applied-reactions" id="reactions_' + msgId + '"></div>';
    let reactionBarHTML = `<div class="reaction-bar"><span onclick="addReaction('${msgId}', '👍')">👍</span><span onclick="addReaction('${msgId}', '❤️')">❤️</span><span onclick="addReaction('${msgId}', '🎉')">🎉</span></div>`;
    let threadBtnHTML = m.threadCount > 0 ? `<button class="thread-reply-btn" onclick="openThread('${msgId}')"><i class="fas fa-reply"></i> ${m.threadCount} replies</button>` : '';

    wrapper.innerHTML = `
                <div class="message-info"><strong>${isSent ? 'You' : senderName}</strong> <span>${time}</span></div>
                <div class="message ${m.priority ? 'priority-message' : ''}">${m.priority ? '<span class="priority-label"><i class="fas fa-bell"></i> Priority</span>' : ''}${formatMessage(m.text)}</div>
                ${actionsHTML} ${reactionBarHTML} ${reactionsHTML} ${threadBtnHTML}
            `;
    msgArea.appendChild(wrapper);

    let touchStartX = null;
    wrapper.addEventListener('touchstart', event => {
        touchStartX = event.changedTouches[0].clientX;
    }, { passive: true });
    wrapper.addEventListener('touchend', event => {
        if (touchStartX === null) return;
        const distance = event.changedTouches[0].clientX - touchStartX;
        touchStartX = null;
        if (distance > 60) openThread(msgId);
    }, { passive: true });

    if (m.reactions) {
        const reactArea = wrapper.querySelector(`#reactions_${msgId}`);
        Object.keys(m.reactions).forEach(emoji => {
            reactArea.innerHTML += `<span class="reaction-pill" onclick="removeReaction('${msgId}', '${emoji}')">${emoji} ${m.reactions[emoji].length}</span>`;
        });
    }
}

function formatMessage(text) {
    if (!text) return '';
    if (text.includes('```')) {
        return text.replace(/```(?:[a-zA-Z0-9_+-]+)?\n?([\s\S]*?)```/g, '<pre class="code-block"><code>$1</code></pre>').replace(/\n/g, '<br>');
    }
    let html = text.replace(/\*([^*]+)\*/g, '<strong>$1</strong>').replace(/_([^_]+)_/g, '<em>$1</em>');
    if (text.startsWith('/giphy')) {
        const query = text.split(' ').slice(1).join(' ');
        return `<div style="text-align:center; font-size:0.7rem; opacity:0.7; margin-bottom:5px;">/giphy ${query}</div><img src="https://media.giphy.com/media/sSgvbe1m3n93GqgjHc/giphy.gif" alt="GIF" style="max-width:200px; border-radius:8px;">`;
    }
    return html;
}

function sendMessage(type) {
    const inputId = type === 'client' ? 'clientChatInput' : 'teamChatInput';
    const input = document.getElementById(inputId);
    if (input.value.trim() !== '') {
        db.collection('chats').doc(currentChatId).collection('messages').add({
            text: input.value, sender: adminName, senderUid: authenticatedAdmin?.uid || '', senderName: authenticatedAdmin?.displayName || adminName,
            priority: messagePriority,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(), reactions: {}
        });
        input.value = '';
        messagePriority = false;
        document.querySelector('.priority-btn')?.classList.remove('active');
        autoGrowChatInput(input);
    }
}
function handleChatSend(e, type) { if (e.key === 'Enter' && (type !== 'team' || !e.shiftKey)) { e.preventDefault(); sendMessage(type); } }

function editMessage(id, type) {
    const wrapper = document.querySelector(`.message-wrapper[data-id="${id}"]`);
    const oldText = wrapper.querySelector('.message').innerText;
    showBrandedInput('Edit message', 'Update the message content below.', 'Message text', newText => {
        db.collection('chats').doc(currentChatId).collection('messages').doc(id).update({ text: newText });
    }, 'fas fa-pen-to-square');
    document.getElementById('inputModalField').value = oldText;
}

function deleteMessage(id, type) {
    showConfirmModal('Delete message?', 'This message will be removed from the conversation.', () => {
        db.collection('chats').doc(currentChatId).collection('messages').doc(id).delete();
    }, 'Delete', 'fas fa-trash', 'var(--danger)');
}

async function addReaction(msgId, emoji) {
    const msgRef = db.collection('chats').doc(currentChatId).collection('messages').doc(msgId);
    await msgRef.set({ reactions: { [emoji]: firebase.firestore.FieldValue.arrayUnion(adminName) } }, { merge: true });
}

async function removeReaction(msgId, emoji) {
    const msgRef = db.collection('chats').doc(currentChatId).collection('messages').doc(msgId);
    await msgRef.set({ reactions: { [emoji]: firebase.firestore.FieldValue.arrayRemove(adminName) } }, { merge: true });
}

function openThread(msgId) {
    currentThreadMsgId = msgId;
    document.getElementById('threadPanel').classList.add('active');
    if (activeThreadListener) activeThreadListener();
    const threadArea = document.getElementById('threadMessages');
    threadArea.innerHTML = '<div style="text-align:center; color:var(--text-muted);">Loading thread...</div>';

    const listenForReplies = () => db.collection('chats').doc(currentChatId).collection('messages').doc(msgId).collection('replies').orderBy('timestamp', 'asc').onSnapshot(snapshot => {
        const repliesArea = document.getElementById('threadReplies');
        if (!repliesArea) return;
        if (snapshot.empty) {
            repliesArea.innerHTML = '<div style="text-align:center; color:var(--text-muted); margin-top:10px;">No replies yet.</div>';
            return;
        }
        let repliesHTML = '';
        snapshot.forEach(doc => {
            const r = doc.data();
            const time = r.timestamp ? new Date(r.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...';
            const isSent = r.sender === adminName;
            const senderName = r.senderName || r.sender || 'Visitor';
            repliesHTML += `
                        <div class="message-wrapper ${isSent ? 'sent' : 'received'}" style="max-width: 100%;">
                            <div class="message-info"><strong>${isSent ? 'You' : senderName}</strong> <span>${time}</span></div>
                            <div class="message">${formatMessage(r.text)}</div>
                        </div>`;
        });
        repliesArea.innerHTML = repliesHTML;
        threadArea.scrollTop = threadArea.scrollHeight;
    });

    db.collection('chats').doc(currentChatId).collection('messages').doc(msgId).get().then(doc => {
        if (!doc.exists) return;
        const m = doc.data();
        const senderName = m.senderName || m.sender || 'Visitor';
        const time = m.timestamp ? new Date(m.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...';
        threadArea.innerHTML = `
            <div class="thread-parent-message">
                <div class="thread-parent-label"><i class="fas fa-reply"></i> Replying to ${senderName}</div>
                <div class="message-info"><strong>${senderName}</strong> <span>${time}</span></div>
                <div class="message">${formatMessage(m.text)}</div>
            </div>
            <div id="threadReplies" class="thread-replies"></div>
        `;
        activeThreadListener = listenForReplies();
    }).catch(error => {
        console.error('Thread parent error:', error);
        threadArea.innerHTML = '<div style="color:var(--danger);">Unable to load the selected message.</div>';
    });
}

function closeThread() {
    document.getElementById('threadPanel').classList.remove('active');
    if (activeThreadListener) activeThreadListener();
    currentThreadMsgId = null;
}

function handleThreadSend(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendThreadReply();
    }
}

async function sendThreadReply() {
    const input = document.getElementById('threadInput');
    const text = input.value.trim();
    if (!text || !currentThreadMsgId) return;

    try {
        const messageRef = db.collection('chats').doc(currentChatId)
            .collection('messages').doc(currentThreadMsgId);
        await messageRef.collection('replies').add({
            text,
            sender: adminName,
            senderName: adminName,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        await messageRef.set({
            threadCount: firebase.firestore.FieldValue.increment(1)
        }, { merge: true });
        input.value = '';
    } catch (error) {
        showToast('Could not send reply: ' + error.message);
    }
}

let typingTimeout;
function handleTyping(type) {
    const indicator = document.getElementById(type === 'client' ? 'clientTyping' : 'teamTyping');
    indicator.innerText = "You are typing...";
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => { indicator.innerText = ""; }, 1500);
}

function handleFileUpload(event, type) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
        let msgContent = file.type.startsWith('image/') ? `<img src="${e.target.result}" alt="upload">` : `<a href="${e.target.result}" download="${file.name}" style="color:#fff; text-decoration:underline;"><i class="fas fa-file"></i> ${file.name}</a>`;
        db.collection('chats').doc(currentChatId).collection('messages').add({
            text: msgContent, sender: adminName, timestamp: firebase.firestore.FieldValue.serverTimestamp(), reactions: {}
        });
    }
    reader.readAsDataURL(file);
    event.target.value = '';
}

function addChannel() {
    showBrandedInput('Create channel', 'Give your team channel a clear, memorable name.', 'e.g. frontend', name => {
        const id = 'team_' + name.replace(/\s+/g, '_').toLowerCase();
        db.collection('chat_channels').doc(id).set({ name: name.trim(), createdBy: authenticatedAdmin?.uid || '', createdAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true })
            .then(() => showToast(`Channel #${name} created!`)).catch(error => showToast('Could not create channel: ' + error.message));
    }, 'fas fa-hashtag');
}

function addDM() {
    showBrandedInput('Start a direct message', 'Enter the exact name of an approved admin.', 'Teammate name', name => {
        const member = teamRoster.find(item => item.name.toLowerCase() === name.trim().toLowerCase());
        if (!member) return showToast('Choose a teammate from the People list.');
        const item = [...document.querySelectorAll('#dmList .chat-user-item')].find(row => row.innerText.includes(member.name));
        selectChat('team', 'dm_' + (member.presenceId || member.id).replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase(), member.name, item);
    }, 'fas fa-message');
}

// === TEAM WEBRTC CALLS ===
let callStream = null;
let callPeerConnection = null;
let activeCall = null;
let activeCallListener = null;
let activeCandidateListener = null;
let incomingCall = null;
let incomingCallListener = null;
let pendingRemoteCandidates = [];

const webRtcConfig = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

function callTargetForCurrentChat() {
    if (currentChatType !== 'team' || !currentChatId.startsWith('dm_')) return null;
    return teamRoster.find(member => {
        const memberId = (member.presenceId || member.id || '').replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
        return `dm_${memberId}` === currentChatId;
    }) || null;
}

function showCallUnavailable(message) {
    showBrandedNotice('Call unavailable', message, 'fas fa-phone-slash', 'var(--danger)');
}

function showActiveCall(name, type) {
    const remoteVideo = document.getElementById('remoteCallVideo');
    remoteVideo.style.display = type === 'video' ? 'block' : 'none';
    document.getElementById('callName').innerText = `${type === 'video' ? 'Video' : 'Voice'} call with ${name}`;
    document.getElementById('callModal').classList.add('active');
}

function listenForRemoteCandidates(callRef, collectionName) {
    if (activeCandidateListener) activeCandidateListener();
    activeCandidateListener = callRef.collection(collectionName).onSnapshot(snapshot => {
        snapshot.docChanges().forEach(change => {
            if (change.type === 'added') {
                const candidate = new RTCIceCandidate(change.doc.data());
                if (callPeerConnection?.remoteDescription) {
                    callPeerConnection.addIceCandidate(candidate).catch(error => {
                        console.warn('Could not add remote ICE candidate:', error);
                    });
                } else {
                    pendingRemoteCandidates.push(candidate);
                }
            }
        });
    });
}

async function flushRemoteCandidates() {
    const candidates = pendingRemoteCandidates;
    pendingRemoteCandidates = [];
    for (const candidate of candidates) {
        await callPeerConnection?.addIceCandidate(candidate).catch(error => {
            console.warn('Could not add queued remote ICE candidate:', error);
        });
    }
}

function createCallPeerConnection(callRef, role, type) {
    callPeerConnection = new RTCPeerConnection(webRtcConfig);
    callStream.getTracks().forEach(track => callPeerConnection.addTrack(track, callStream));
    callPeerConnection.onicecandidate = event => {
        if (event.candidate) {
            callRef.collection(role === 'caller' ? 'callerCandidates' : 'calleeCandidates').add(event.candidate.toJSON());
        }
    };
    callPeerConnection.ontrack = event => {
        const stream = event.streams[0];
        document.getElementById('remoteCallVideo').srcObject = stream;
        document.getElementById('remoteCallAudio').srcObject = stream;
    };
    callPeerConnection.onconnectionstatechange = () => {
        if (['failed', 'disconnected', 'closed'].includes(callPeerConnection.connectionState)) endCall(false);
    };
    return callPeerConnection;
}

async function startCall(type) {
    const target = callTargetForCurrentChat();
    if (!target) {
        showCallUnavailable('Open a direct message with a teammate before starting a call.');
        return;
    }
    if (!authenticatedAdmin || activeCall) return;
    if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) {
        showCallUnavailable('This browser does not support WebRTC calls.');
        return;
    }

    try {
        callStream = await navigator.mediaDevices.getUserMedia({ video: type === 'video', audio: true });
        const callRef = db.collection('calls').doc();
        activeCall = { id: callRef.id, ref: callRef, role: 'caller', type, name: target.name };
        createCallPeerConnection(callRef, 'caller', type);
        document.getElementById('callVideo').srcObject = callStream;
        showActiveCall(target.name, type);

        const offer = await callPeerConnection.createOffer();
        await callPeerConnection.setLocalDescription(offer);
        await callRef.set({
            callerId: authenticatedAdmin.uid,
            callerName: authenticatedAdmin.displayName || adminName,
            calleeId: target.presenceId || target.id,
            calleeName: target.name,
            type,
            status: 'ringing',
            offer: { type: offer.type, sdp: offer.sdp },
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        listenForRemoteCandidates(callRef, 'calleeCandidates');
        activeCallListener = callRef.onSnapshot(async snapshot => {
            const data = snapshot.data();
            if (!data || !activeCall || activeCall.id !== snapshot.id) return;
            if (data.answer && !callPeerConnection.currentRemoteDescription) {
                await callPeerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
                await flushRemoteCandidates();
                document.getElementById('callName').innerText = `${type === 'video' ? 'Video' : 'Voice'} call with ${target.name}`;
            }
            if (data.status === 'declined' || data.status === 'ended') endCall(false);
        });
    } catch (error) {
        console.error('Could not start team call:', error);
        endCall(false);
        showCallUnavailable('Camera and microphone access requires HTTPS or localhost, and browser permission.');
    }
}

function listenForIncomingCalls() {
    if (incomingCallListener) incomingCallListener();
    if (!authenticatedAdmin) return;
    incomingCallListener = db.collection('calls').where('calleeId', '==', authenticatedAdmin.uid).onSnapshot(snapshot => {
        snapshot.docChanges().forEach(change => {
            const data = change.doc.data();
            if (change.type === 'added' && data.status === 'ringing' && !activeCall && !incomingCall) {
                incomingCall = { id: change.doc.id, ref: change.doc.ref, ...data };
                document.getElementById('incomingCallName').innerText = `${data.callerName || 'A teammate'} is calling`;
                document.getElementById('incomingCallType').innerText = `${data.type === 'video' ? 'Video' : 'Voice'} call in Team Chat`;
                document.getElementById('incomingCallModal').classList.add('active');
            }
            if (incomingCall?.id === change.doc.id && ['ended', 'declined'].includes(data.status)) {
                incomingCall = null;
                document.getElementById('incomingCallModal').classList.remove('active');
            }
        });
    }, error => console.warn('Incoming call listener error:', error));
}

async function acceptIncomingCall() {
    if (!incomingCall || activeCall) return;
    const call = incomingCall;
    incomingCall = null;
    document.getElementById('incomingCallModal').classList.remove('active');
    try {
        callStream = await navigator.mediaDevices.getUserMedia({ video: call.type === 'video', audio: true });
        activeCall = { id: call.id, ref: call.ref, role: 'callee', type: call.type, name: call.callerName || 'Teammate' };
        createCallPeerConnection(call.ref, 'callee', call.type);
        document.getElementById('callVideo').srcObject = callStream;
        showActiveCall(activeCall.name, call.type);
        await callPeerConnection.setRemoteDescription(new RTCSessionDescription(call.offer));
        await flushRemoteCandidates();
        listenForRemoteCandidates(call.ref, 'callerCandidates');
        const answer = await callPeerConnection.createAnswer();
        await callPeerConnection.setLocalDescription(answer);
        await call.ref.update({ answer: { type: answer.type, sdp: answer.sdp }, status: 'active' });
    } catch (error) {
        console.error('Could not answer team call:', error);
        await call.ref.update({ status: 'ended' }).catch(() => {});
        endCall(false);
        showCallUnavailable('Camera and microphone access requires HTTPS or localhost, and browser permission.');
    }
}

function declineIncomingCall() {
    if (!incomingCall) return;
    incomingCall.ref.update({ status: 'declined' }).catch(error => console.warn('Could not decline call:', error));
    incomingCall = null;
    document.getElementById('incomingCallModal').classList.remove('active');
}

function endCall(notifyPeer = true) {
    const call = activeCall;
    if (notifyPeer && call) call.ref.update({ status: 'ended' }).catch(() => {});
    if (activeCallListener) activeCallListener();
    if (activeCandidateListener) activeCandidateListener();
    if (callPeerConnection) callPeerConnection.close();
    if (callStream) callStream.getTracks().forEach(track => track.stop());
    document.getElementById('callVideo').srcObject = null;
    document.getElementById('remoteCallVideo').srcObject = null;
    document.getElementById('remoteCallAudio').srcObject = null;
    document.getElementById('callModal').classList.remove('active');
    callPeerConnection = null;
    callStream = null;
    activeCall = null;
    activeCallListener = null;
    activeCandidateListener = null;
    pendingRemoteCandidates = [];
}

function toggleMute() {
    if (!callStream) return;
    callStream.getAudioTracks().forEach(track => { track.enabled = !track.enabled; });
}

function toggleVideo() {
    if (!callStream) return;
    callStream.getVideoTracks().forEach(track => { track.enabled = !track.enabled; });
}


/* =========================================================
   PRIMETECH OS - PROJECT MANAGEMENT MODULE
========================================================= */

// Use the existing Firebase 'db' instance from the top of your file
const projectDB = db;
let currentProject = null;
let allProjects = [];
let currentFormType = null;
let quotationItemCounter = 1;

document.addEventListener("DOMContentLoaded", function () {
    // Initialize project loading when the page loads
    setTimeout(loadProjects, 300);
});

/* ============================================================
   NEW PROJECT MODAL
============================================================ */

function openNewProjectModal() {
    document.getElementById("newProjectModal").classList.add("active");
}

function closeNewProjectModal() {
    document.getElementById("newProjectModal").classList.remove("active");
}

/* ============================================================
   CREATE PROJECT
============================================================ */

async function createProject(event) {
    event.preventDefault();

    if (!projectDB) {
        showToast("Firestore is not ready.");
        return;
    }

    const clientName = document.getElementById("projectClient").value.trim();
    const contact = document.getElementById("projectContact").value.trim();
    const email = document.getElementById("projectEmail").value.trim();
    const phone = document.getElementById("projectPhone").value.trim();
    const projectName = document.getElementById("projectName").value.trim();
    const projectType = document.getElementById("projectType").value;
    const timeline = document.getElementById("projectTimeline").value.trim();
    const budget = document.getElementById("projectBudget").value.trim();
    const problem = document.getElementById("projectProblem").value.trim();

    try {
        // Generate PD-2026-001 format
        const year = new Date().getFullYear();
        const counterRef = projectDB.collection("project_counters").doc(String(year));

        const result = await projectDB.runTransaction(async (transaction) => {
            const snapshot = await transaction.get(counterRef);
            let nextNumber = 1;
            if (snapshot.exists) {
                nextNumber = (snapshot.data().value || 0) + 1;
            }
            transaction.set(counterRef, { value: nextNumber }, { merge: true });
            return nextNumber;
        });

        const projectId = `PD-${year}-${String(result).padStart(3, "0")}`;

        const projectData = {
            projectId: projectId,
            client: { name: clientName, contact: contact, email: email, phone: phone },
            project: { name: projectName, type: projectType, timeline: timeline, estimatedBudget: budget, businessProblem: problem },
            status: "DISCOVERY",
            lifecycle: {
                clientIntake: "pending", discovery: "pending", proposal: "pending", quotation: "pending",
                contract: "pending", kickoff: "pending", scope: "pending", designApproval: "pending",
                changeRequest: "pending", uat: "pending", acceptance: "pending", handover: "pending",
                warranty: "pending", maintenance: "pending"
            },
            progress: 0,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        const projectRef = await projectDB.collection("projects").add(projectData);

        // Automatically create Client Intake document
        await projectRef.collection("forms").add({
            type: "client-intake",
            title: "Client Intake",
            phase: "Discovery",
            status: "draft",
            data: { clientName, contactPerson: contact, email, phone, projectName, projectType, businessProblem: problem },
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Update project lifecycle
        await projectRef.update({
            "lifecycle.clientIntake": "completed",
            progress: 7,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        closeNewProjectModal();
        document.getElementById("newProjectForm").reset();
        showToast(`${projectId} created successfully!`);

        await loadProjects();
        await selectProject(projectRef.id);

    } catch (error) {
        console.error("Project creation failed:", error);
        showToast("Unable to create project: " + error.message);
    }
}

/* ============================================================
   LOAD PROJECTS
============================================================ */

async function loadProjects() {
    if (!projectDB) return;

    try {
        const snapshot = await projectDB.collection("projects").orderBy("createdAt", "desc").get();
        allProjects = [];
        snapshot.forEach(doc => allProjects.push({ id: doc.id, ...doc.data() }));

        renderProjectList();
        updateProjectStatistics();
    } catch (error) {
        console.error("Unable to load projects:", error);
        // Fallback if index isn't built yet
        try {
            const fallback = await projectDB.collection("projects").get();
            allProjects = [];
            fallback.forEach(doc => allProjects.push({ id: doc.id, ...doc.data() }));
            renderProjectList();
            updateProjectStatistics();
        } catch (e) { }
    }
}

/* ============================================================
   RENDER PROJECT LIST
============================================================ */

function renderProjectList(projects = allProjects) {
    const container = document.getElementById("projectList");
    if (!container) return;

    if (!projects.length) {
        container.innerHTML = `<div class="empty-state"><i class="fas fa-folder-open" style="font-size: 2rem; margin-bottom: 15px; color: var(--text-muted);"></i><p style="color: var(--text-muted);">No Projects Yet</p></div>`;
        return;
    }

    container.innerHTML = projects.map(project => {
        const active = currentProject && currentProject.id === project.id ? "active" : "";
        return `
            <div class="project-list-item ${active}" onclick="selectProject('${project.id}')">
                <div class="project-list-icon"><i class="fas fa-folder"></i></div>
                <div class="project-list-info">
                    <strong>${project.project?.name || "Unnamed Project"}</strong>
                    <span>${project.projectId || ""}</span>
                    <small>${project.client?.name || "No Client"}</small>
                </div>
                <span class="document-status pending">${project.status || "DISCOVERY"}</span>
            </div>
        `;
    }).join("");
}

/* ============================================================
   SEARCH PROJECTS
============================================================ */

function filterProjects() {
    const search = document.getElementById("projectSearch")?.value.toLowerCase().trim();
    if (!search) { renderProjectList(allProjects); return; }
    const filtered = allProjects.filter(p =>
        String(p.projectId || "").toLowerCase().includes(search) ||
        String(p.client?.name || "").toLowerCase().includes(search) ||
        String(p.project?.name || "").toLowerCase().includes(search)
    );
    renderProjectList(filtered);
}

/* ============================================================
   SELECT PROJECT
============================================================ */

async function selectProject(projectDocumentId) {
    if (!projectDB) return;
    try {
        const doc = await projectDB.collection("projects").doc(projectDocumentId).get();
        if (!doc.exists) { showToast("Project not found."); return; }

        currentProject = { id: doc.id, ...doc.data() };
        renderSelectedProject();
        renderProjectList();
    } catch (error) {
        console.error("Unable to select project:", error);
    }
}

function renderSelectedProject() {
    if (!currentProject) return;

    document.getElementById("projectEmptyState").style.display = "none";
    document.getElementById("selectedProjectContainer").style.display = "block";

    document.getElementById("selectedProjectId").innerText = currentProject.projectId;
    document.getElementById("selectedProjectName").innerText = currentProject.project?.name;
    document.getElementById("selectedClientName").innerText = currentProject.client?.name;
    document.getElementById("selectedProjectStatus").innerText = currentProject.status;

    const progress = currentProject.progress || 0;
    document.getElementById("projectProgress").innerText = progress + "%";
    document.getElementById("projectProgressBar").style.width = progress + "%";

    // Update Lifecycle statuses
    const lifecycle = currentProject.lifecycle || {};
    Object.keys(lifecycle).forEach(key => {
        const kebabKey = key.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
        const element = document.getElementById(`status-${kebabKey}`);
        if (element) {
            const status = lifecycle[key] || "pending";
            element.textContent = status.charAt(0).toUpperCase() + status.slice(1);
            element.className = "document-status " + status;
        }
    });
}

/* ============================================================
   OPEN PROJECT FORM
============================================================ */
function openFormExportModal() {
    const titleEl = document.getElementById('projectFormTitle');
    const nameEl = document.getElementById('exportProjectName');
    
    if(nameEl) nameEl.innerText = titleEl ? titleEl.innerText : 'Document Export';
    document.getElementById('projectExportModal').classList.add('active');
}

function closeProjectExportModal() {
    document.getElementById('projectExportModal').classList.remove('active');
}

// Helper: Extract all field labels and values from the currently open dynamic form
function getDynamicFormData() {
    const formBody = document.getElementById('projectFormBody');
    const data = [];
    
    if (!formBody) return data;

    const groups = formBody.querySelectorAll('.form-group');
    groups.forEach(group => {
        const label = group.querySelector('label')?.innerText || 'Field';
        const input = group.querySelector('input, textarea, select');
        
        if (input) {
            let value = input.value || 'N/A';
            if (input.type === 'checkbox') value = input.checked ? 'Yes' : 'No';
            if (input.tagName === 'SELECT') value = input.options[input.selectedIndex]?.text || 'N/A';
            data.push({ label: label.replace(/\*/g, '').trim(), value });
        }
    });
    
    return data;
}

// Helper: Build plain text for sharing
function buildShareText() {
    const title = document.getElementById('projectFormTitle')?.innerText || 'Project Document';
    const formData = getDynamicFormData();
    
    let text = `*${title}*\n\n`;
    formData.forEach(item => {
        text += `${item.label}: ${item.value}\n`;
    });
    text += `\nGenerated from Primetech OS Dashboard.`;
    return text;
}

// 1. Generate PDF
function generateFormPDF() {
    const title = document.getElementById('projectFormTitle')?.innerText || 'Project Document';
    const formData = getDynamicFormData();

    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Branded Header
        doc.setFillColor(6, 6, 10); 
        doc.rect(0, 0, 210, 35, 'F');
        doc.setTextColor(0, 212, 255); 
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text('PRIMETECH OS', 14, 18);
        
        doc.setTextColor(139, 149, 167); 
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('Project Document Export', 14, 26);
        
        doc.setDrawColor(123, 47, 255); 
        doc.setLineWidth(1);
        doc.line(0, 35, 210, 35);

        // Title
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        const titleLines = doc.splitTextToSize(title, 180);
        doc.text(titleLines, 14, 50);
        
        let y = 50 + (titleLines.length * 8);
        doc.setDrawColor(230, 230, 230);
        doc.line(14, y, 196, y);
        y += 10;

        // Form Data
        doc.setFontSize(11);
        
        formData.forEach(item => {
            if (y > 270) { doc.addPage(); y = 20; } // Add page if overflowing
            
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(123, 47, 255); // Purple labels
            doc.text(item.label + ":", 14, y);
            y += 6;
            
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(60, 60, 60);
            const splitValue = doc.splitTextToSize(item.value, 180);
            doc.text(splitValue, 14, y);
            y += splitValue.length * 6 + 5;
        });

        // Footer
        doc.setDrawColor(0, 212, 255);
        doc.setLineWidth(0.5);
        doc.line(14, 280, 196, 280);
        doc.setTextColor(150);
        doc.setFontSize(8);
        doc.text(`Generated on ${new Date().toLocaleDateString()} | Primetech OS`, 14, 285);

        doc.save(`${title.replace(/[^a-z0-9]/gi, '_')}.pdf`);
        showToast("PDF Downloaded.");
    } catch (err) {
        console.error(err);
        showToast("Failed to generate PDF.");
    }
}

// 2. Generate DOCX
function downloadFormDOCX() {
    const title = document.getElementById('projectFormTitle')?.innerText || 'Project Document';
    const formData = getDynamicFormData();

    const header = `
        <div style="background:#06060a; color:#fff; padding:20px; margin-bottom:30px; border-bottom:5px solid #7B2FFF;">
            <h1 style="color:#00D4FF; margin:0; font-size:24pt;">PRIMETECH OS</h1>
            <p style="color:#8b95a7; margin:5px 0 0 0; font-size:10pt;">Project Document Export</p>
        </div>
    `;
    
    let content = `<h2 style="color:#06060a; font-size:20pt; margin-bottom:20px; border-bottom:2px solid #eee; padding-bottom:10px;">${title}</h2>`;
    
    formData.forEach(item => {
        content += `
            <p style="margin-top:15px;">
                <strong style="color:#7B2FFF;">${item.label}:</strong><br>
                <span style="color:#333;">${item.value}</span>
            </p>
        `;
    });

    content += `
        <div style="margin-top:50px; border-top:1px solid #eee; padding-top:15px; text-align:center;">
            <p style="color:#888; font-size:9pt;">Generated on ${new Date().toLocaleDateString()} | Primetech OS</p>
        </div>
    `;

    const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Document</title></head><body style="font-family: Arial, sans-serif; font-size:11pt; color:#333;">${header}${content}</body></html>`;
    
    const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title.replace(/[^a-z0-9]/gi, '_')}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("DOCX Downloaded.");
}

// 3. Share via WhatsApp, Email, or Copy Text
function shareForm(method) {
    const text = buildShareText();
    const subject = document.getElementById('projectFormTitle')?.innerText || 'Project Document';

    if (method === 'whatsapp') {
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    } else if (method === 'email') {
        window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
    } else if (method === 'link') {
        navigator.clipboard.writeText(text).then(() => {
            showToast("Document details copied to clipboard!");
        }).catch(err => showToast("Failed to copy: " + err));
    }
}

async function openProjectForm(type) {
    if (!currentProject) {
        showToast("Select a project first.");
        return;
    }

    currentFormType = type;
    const modal = document.getElementById("projectFormModal");
    const config = getProjectFormConfig(type);

    document.getElementById("projectFormTitle").innerText = config.title;
    document.getElementById("projectFormPhase").innerText = config.phase;
    document.getElementById("projectFormDescription").innerText = config.description;
    document.getElementById("projectFormBody").innerHTML = buildProjectForm(type, currentProject);

    modal.classList.add("active");
    await loadExistingProjectForm(type);
}

function closeProjectForm() {
    document.getElementById("projectFormModal").classList.remove("active");
    currentFormType = null;
}

function getProjectFormConfig(type) {
    const configs = {
        "client-intake": { title: "Client Intake", phase: "DISCOVERY", description: "Capture the client's initial business requirements." },
        "discovery": { title: "Discovery & Requirements", phase: "DISCOVERY", description: "Document goals, requirements, and processes." },
        "proposal": { title: "Project Proposal", phase: "DISCOVERY", description: "Prepare the proposed solution and scope." },
        "quotation": { title: "Project Quotation", phase: "COMMERCIAL", description: "Prepare the formal project quotation." },
        "contract": { title: "Development Contract", phase: "COMMERCIAL", description: "Record the agreement." },
        "kickoff": { title: "Project Kickoff", phase: "EXECUTION", description: "Start the project after approval." },
        "scope": { title: "Scope Baseline", phase: "DESIGN", description: "Record approved scope and exclusions." },
        "design-approval": { title: "Design Approval", phase: "DESIGN", description: "Record client approval of UI/UX." },
        "change-request": { title: "Change Request", phase: "CONTROL", description: "Record a change to approved scope." },
        "uat": { title: "User Acceptance Testing", phase: "LAUNCH", description: "Record client testing results." },
        "acceptance": { title: "Final Acceptance", phase: "LAUNCH", description: "Record final client acceptance." },
        "handover": { title: "Project Handover", phase: "LAUNCH", description: "Record system handover." },
        "warranty": { title: "Warranty", phase: "SUPPORT", description: "Record warranty terms." },
        "maintenance": { title: "Maintenance Agreement", phase: "SUPPORT", description: "Record ongoing support." }
    };
    return configs[type] || { title: "Document", phase: "PROJECT", description: "" };
}

/* ============================================================
   BUILD FORM HTML
============================================================ */

function buildProjectForm(type, project) {
    const client = project.client || {};
    const data = project.project || {};

    function identity() {
        return `
            ${readonlyField("Project ID", project.projectId)}
            ${readonlyField("Client", client.name)}
            ${readonlyField("Project", data.name)}
        `;
    }

    switch (type) {
        case "client-intake":
            return `
                <div class="form-grid">
                    ${identity()}
                    <div class="form-group"><label>Contact Person</label><input type="text" name="contactPerson" value="${client.contact || ''}"></div>
                    <div class="form-group"><label>Email</label><input type="email" name="email" value="${client.email || ''}"></div>
                    <div class="form-group"><label>Phone</label><input type="text" name="phone" value="${client.phone || ''}"></div>
                    <div class="form-group" style="grid-column:1/-1;"><label>Business Problem</label><textarea name="businessProblem" rows="5">${data.businessProblem || ''}</textarea></div>
                </div>
            `;
        case "discovery":
            return `
                <div class="form-grid">
                    ${identity()}
                    <div class="form-group" style="grid-column:1/-1;"><label>Business Goals</label><textarea name="businessGoals" rows="5"></textarea></div>
                    <div class="form-group" style="grid-column:1/-1;"><label>Functional Requirements</label><textarea name="functionalRequirements" rows="7"></textarea></div>
                    <div class="form-group" style="grid-column:1/-1;"><label>Out of Scope</label><textarea name="outOfScope" rows="5"></textarea></div>
                </div>
            `;
        case "proposal":
            return `
                <div class="form-grid">
                    ${identity()}
                    <div class="form-group" style="grid-column:1/-1;"><label>Proposed Solution</label><textarea name="proposedSolution" rows="7"></textarea></div>
                    <div class="form-group" style="grid-column:1/-1;"><label>Key Deliverables</label><textarea name="deliverables" rows="6"></textarea></div>
                </div>
            `;
        case "quotation":
            return buildQuotationForm(project);
        case "contract":
            return `
                <div class="form-grid">
                    ${identity()}
                    <div class="form-group"><label>Start Date</label><input type="date" name="startDate"></div>
                    <div class="form-group"><label>Completion Date</label><input type="date" name="completionDate"></div>
                    <div class="form-group"><label>Payment Terms</label>
                        <select name="paymentTerms">
                            <option>50% Deposit / 50% Completion</option>
                            <option>40% Deposit / 30% Development / 30% Completion</option>
                            <option>Milestone Based</option>
                        </select>
                    </div>
                    <div class="form-group"><label>Contract Status</label>
                        <select name="contractStatus"><option value="draft">Draft</option><option value="sent">Sent to Client</option><option value="signed">Signed</option></select>
                    </div>
                    <div class="form-group" style="grid-column:1/-1;"><label>Special Terms</label><textarea name="specialTerms" rows="7"></textarea></div>
                </div>
            `;
        case "kickoff":
            return `
                <div class="form-grid">
                    ${identity()}
                    <div class="form-group"><label>Project Manager</label><input type="text" name="projectManager"></div>
                    <div class="form-group"><label>Kickoff Date</label><input type="date" name="kickoffDate"></div>
                    <div class="form-group" style="grid-column:1/-1;"><label>Notes</label><textarea name="notes" rows="6"></textarea></div>
                </div>
            `;
        case "scope":
            return `
                <div class="form-grid">
                    ${identity()}
                    <div class="form-group" style="grid-column:1/-1;"><label>Approved Scope</label><textarea name="approvedScope" rows="10"></textarea></div>
                    <div class="form-group" style="grid-column:1/-1;"><label>Exclusions</label><textarea name="exclusions" rows="6"></textarea></div>
                </div>
            `;
        case "design-approval":
            return `
                <div class="form-grid">
                    ${identity()}
                    <div class="form-group"><label>Design Version</label><input type="text" name="designVersion" placeholder="v1.0"></div>
                    <div class="form-group"><label>Approval Status</label>
                        <select name="approvalStatus"><option>Pending</option><option>Approved</option><option>Approved with Changes</option><option>Rejected</option></select>
                    </div>
                    <div class="form-group" style="grid-column:1/-1;"><label>Client Comments</label><textarea name="comments" rows="6"></textarea></div>
                </div>
            `;
        case "change-request":
            return `
                <div class="form-grid">
                    ${identity()}
                    <div class="form-group"><label>Request Date</label><input type="date" name="requestDate"></div>
                    <div class="form-group"><label>Requested By</label><input type="text" name="requestedBy" value="${client.contact || ''}"></div>
                    <div class="form-group" style="grid-column:1/-1;"><label>Change Requested</label><textarea name="changeRequested" rows="6"></textarea></div>
                    <div class="form-group"><label>Additional Cost</label><input type="number" name="additionalCost" min="0" step="0.01"></div>
                    <div class="form-group"><label>Additional Time</label><input type="text" name="additionalTime" placeholder="e.g. 5 days"></div>
                </div>
            `;
        case "uat":
            return `
                <div class="form-grid">
                    ${identity()}
                    <div class="form-group"><label>UAT Start</label><input type="date" name="uatStart"></div>
                    <div class="form-group"><label>UAT End</label><input type="date" name="uatEnd"></div>
                    <div class="form-group"><label>Result</label>
                        <select name="result"><option>Pending</option><option>Passed</option><option>Passed with Minor Issues</option><option>Failed</option></select>
                    </div>
                    <div class="form-group" style="grid-column:1/-1;"><label>Test Notes</label><textarea name="testNotes" rows="8"></textarea></div>
                </div>
            `;
        case "acceptance":
            return `
                <div class="form-grid">
                    ${identity()}
                    <div class="form-group"><label>Acceptance Date</label><input type="date" name="acceptanceDate"></div>
                    <div class="form-group"><label>Acceptance Status</label>
                        <select name="acceptanceStatus"><option>Pending</option><option>Accepted</option><option>Accepted with Minor Issues</option></select>
                    </div>
                    <div class="form-group" style="grid-column:1/-1;"><label>Client Comments</label><textarea name="comments" rows="7"></textarea></div>
                </div>
            `;
        case "handover":
            return `
                <div class="form-grid">
                    ${identity()}
                    <div class="form-group"><label>Handover Date</label><input type="date" name="handoverDate"></div>
                    <div class="form-group"><label>Training Provided</label>
                        <select name="trainingProvided"><option>Yes</option><option>No</option></select>
                    </div>
                    <div class="form-group" style="grid-column:1/-1;"><label>Handover Items</label><textarea name="handoverItems" rows="8" placeholder="Credentials, source code, etc."></textarea></div>
                </div>
            `;
        case "warranty":
            return `
                <div class="form-grid">
                    ${identity()}
                    <div class="form-group"><label>Warranty Start</label><input type="date" name="warrantyStart"></div>
                    <div class="form-group"><label>Warranty Period</label><input type="text" name="warrantyPeriod" value="90 days"></div>
                    <div class="form-group" style="grid-column:1/-1;"><label>Coverage</label><textarea name="coverage" rows="7"></textarea></div>
                </div>
            `;
        case "maintenance":
            return `
                <div class="form-grid">
                    ${identity()}
                    <div class="form-group"><label>Maintenance Plan</label>
                        <select name="plan"><option>Basic</option><option>Standard</option><option>Premium</option></select>
                    </div>
                    <div class="form-group"><label>Monthly Fee</label><input type="number" name="monthlyFee" min="0" step="0.01"></div>
                    <div class="form-group" style="grid-column:1/-1;"><label>Support Scope</label><textarea name="supportScope" rows="7"></textarea></div>
                </div>
            `;
        default:
            return `<div class="form-group"><label>Notes</label><textarea name="notes" rows="10"></textarea></div>`;
    }
}

function readonlyField(label, value) {
    return `
        <div class="form-group">
            <label>${label}</label>
            <input type="text" value="${value || ''}" readonly>
        </div>
    `;
}

/* ============================================================
   QUOTATION BUILDER
============================================================ */

function buildQuotationForm(project) {
    const client = project.client || {};
    return `
        <div class="form-grid">
            ${readonlyField("Project ID", project.projectId)}
            ${readonlyField("Client", client.name)}
            <div class="form-group"><label>Quote Number</label><input type="text" name="quoteNumber" value="${project.projectId}-Q1"></div>
            <div class="form-group"><label>Quote Date</label><input type="date" name="quoteDate" value="${new Date().toISOString().split('T')[0]}"></div>
        </div>
        <div style="margin-top:25px; padding-top:25px; border-top:1px solid var(--border);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                <h3>Quotation Items</h3>
                <button type="button" class="btn-secondary" onclick="addQuotationItem()"><i class="fas fa-plus"></i> Add Item</button>
            </div>
            <div id="quotationItems">${quotationItemHTML()}</div>
            <div style="max-width:400px; margin-left:auto; margin-top:25px;">
                <div class="quotation-total-row"><span>Subtotal</span><strong id="quotationSubtotal">0.00</strong></div>
                <div class="quotation-total-row"><span>Tax / VAT (%)</span><input type="number" name="taxRate" id="quotationTaxRate" value="0" min="0" step="0.01" onchange="calculateQuotation()" style="width:100px; background:var(--bg); border:1px solid var(--border); color:var(--text); border-radius:6px; padding:5px;"></div>
                <div class="quotation-total-row total"><span>Total</span><strong id="quotationTotal">0.00</strong></div>
            </div>
        </div>
    `;
}

function quotationItemHTML() {
    return `
        <div class="quotation-item">
            <input type="text" name="item_description[]" placeholder="Description">
            <input type="number" name="item_qty[]" value="1" min="1" step="1" onchange="calculateQuotation()">
            <input type="number" name="item_price[]" value="0" min="0" step="0.01" onchange="calculateQuotation()">
            <input type="text" class="item-total" value="0.00" readonly>
            <button type="button" onclick="removeQuotationItem(this)" style="border:none; background:transparent; color:var(--danger); cursor:pointer;"><i class="fas fa-trash"></i></button>
        </div>
    `;
}

function addQuotationItem() {
    document.getElementById("quotationItems").insertAdjacentHTML("beforeend", quotationItemHTML());
    calculateQuotation();
}

function removeQuotationItem(button) {
    button.closest(".quotation-item").remove();
    calculateQuotation();
}

function calculateQuotation() {
    let subtotal = 0;
    document.querySelectorAll(".quotation-item").forEach(item => {
        const qty = parseFloat(item.querySelector('[name="item_qty[]"]')?.value) || 0;
        const price = parseFloat(item.querySelector('[name="item_price[]"]')?.value) || 0;
        const total = qty * price;
        item.querySelector('.item-total').value = total.toFixed(2);
        subtotal += total;
    });
    const taxRate = parseFloat(document.getElementById('quotationTaxRate')?.value) || 0;
    const grandTotal = subtotal + (subtotal * taxRate / 100);
    document.getElementById('quotationSubtotal').innerText = subtotal.toFixed(2);
    document.getElementById('quotationTotal').innerText = grandTotal.toFixed(2);
}

/* ============================================================
   SAVE PROJECT DOCUMENT
============================================================ */

async function saveProjectDocument(event) {
    event.preventDefault();
    if (!currentProject || !currentFormType) return;

    try {
        const formData = new FormData(event.target);
        const data = {};
        formData.forEach((value, key) => {
            if (key.endsWith("[]")) {
                const cleanKey = key.replace("[]", "");
                if (!data[cleanKey]) data[cleanKey] = [];
                data[cleanKey].push(value);
            } else {
                data[key] = value;
            }
        });

        if (currentFormType === "quotation") {
            data.items = [];
            document.querySelectorAll(".quotation-item").forEach(item => {
                const desc = item.querySelector('[name="item_description[]"]')?.value || "";
                const qty = parseFloat(item.querySelector('[name="item_qty[]"]')?.value) || 0;
                const price = parseFloat(item.querySelector('[name="item_price[]"]')?.value) || 0;
                if (desc.trim() !== "") data.items.push({ description: desc, quantity: qty, unitPrice: price, total: qty * price });
            });
            calculateQuotation();
            data.subtotal = parseFloat(document.getElementById('quotationSubtotal').innerText);
            data.total = parseFloat(document.getElementById('quotationTotal').innerText);
        }

        const formsRef = projectDB.collection("projects").doc(currentProject.id).collection("forms");
        const existing = await formsRef.where("type", "==", currentFormType).limit(1).get();

        let status = "completed";
        if (currentFormType === "contract") status = data.contractStatus === "signed" ? "completed" : "pending";
        if (currentFormType === "uat") status = data.result === "Passed" || data.result === "Passed with Minor Issues" ? "completed" : "pending";
        if (currentFormType === "acceptance") status = data.acceptanceStatus === "Accepted" ? "completed" : "pending";
        if (currentFormType === "design-approval") status = data.approvalStatus === "Approved" ? "completed" : "pending";

        const documentData = {
            type: currentFormType,
            title: getProjectFormConfig(currentFormType).title,
            phase: getProjectFormConfig(currentFormType).phase,
            status: status,
            data: data,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (!existing.empty) {
            await existing.docs[0].ref.update(documentData);
        } else {
            documentData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await formsRef.add(documentData);
        }

        // Update lifecycle
        const lifecycleKey = currentFormType.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
        let newStatus = status;
        let projectStatus = currentProject.status;

        if (currentFormType === "acceptance" && newStatus === "completed") projectStatus = "COMPLETED";
        else if (currentFormType === "handover" && newStatus === "completed") projectStatus = "HANDOVER";
        else if (currentFormType === "uat") projectStatus = "UAT";
        else if (currentFormType === "design-approval") projectStatus = "DESIGN";
        else if (currentFormType === "kickoff") projectStatus = "DEVELOPMENT";
        else if (currentFormType === "contract") projectStatus = "COMMERCIAL";

        await projectDB.collection("projects").doc(currentProject.id).update({
            [`lifecycle.${lifecycleKey}`]: newStatus,
            status: projectStatus,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        showToast(getProjectFormConfig(currentFormType).title + " saved successfully!");
        closeProjectForm();
        await selectProject(currentProject.id);
        await loadProjects();

    } catch (error) {
        console.error("Save failed:", error);
        showToast("Could not save document: " + error.message);
    }
}

async function loadExistingProjectForm(type) {
    if (!currentProject) return;
    try {
        const snapshot = await projectDB.collection("projects").doc(currentProject.id).collection("forms").where("type", "==", type).limit(1).get();
        if (snapshot.empty) return;

        const data = snapshot.docs[0].data().data || {};
        Object.keys(data).forEach(key => {
            if (key !== 'items') {
                const el = document.querySelector(`[name="${key}"]`);
                if (el) el.value = data[key];
            }
        });

        if (type === "quotation" && Array.isArray(data.items)) {
            const container = document.getElementById("quotationItems");
            container.innerHTML = "";
            data.items.forEach(item => {
                const html = `
                    <div class="quotation-item">
                        <input type="text" name="item_description[]" value="${item.description}">
                        <input type="number" name="item_qty[]" value="${item.quantity}" onchange="calculateQuotation()">
                        <input type="number" name="item_price[]" value="${item.unitPrice}" onchange="calculateQuotation()">
                        <input type="text" class="item-total" value="${item.total.toFixed(2)}" readonly>
                        <button type="button" onclick="removeQuotationItem(this)" style="border:none; background:transparent; color:var(--danger); cursor:pointer;"><i class="fas fa-trash"></i></button>
                    </div>
                `;
                container.insertAdjacentHTML("beforeend", html);
            });
            calculateQuotation();
        }
    } catch (e) {
        console.error("Load form error", e);
    }
}

/* ============================================================
   STATISTICS
============================================================ */

function updateProjectStatistics() {
    const total = allProjects.length;
    const active = allProjects.filter(p => p.status !== "COMPLETED").length;
    const completed = allProjects.filter(p => p.status === "COMPLETED").length;
    let pending = 0;
    allProjects.forEach(p => {
        Object.values(p.lifecycle || {}).forEach(s => { if (s === "pending") pending++; });
    });

    if (document.getElementById("projectTotal")) document.getElementById("projectTotal").innerText = total;
    if (document.getElementById("projectActive")) document.getElementById("projectActive").innerText = active;
    if (document.getElementById("projectCompleted")) document.getElementById("projectCompleted").innerText = completed;
    if (document.getElementById("projectPending")) document.getElementById("projectPending").innerText = pending;
}


// ==========================================
// FIREBASE AUTHENTICATION PROTECTION
// ==========================================

function logoutAdmin() {
    // Show confirmation modal instead of logging out immediately
    document.getElementById('logoutModal').classList.add('active');
}

function confirmLogout() {
    firebase.auth().signOut().then(() => {
        window.location.href = 'login.html';
    }).catch(err => {
        console.error("Logout error:", err);
    });
}

function cancelLogout() {
    document.getElementById('logoutModal').classList.remove('active');
}

// Check if user is logged in
firebase.auth().onAuthStateChanged(async user => {
    if (!user || user.isAnonymous) {
        // User is NOT logged in, redirect to login page
        window.location.href = 'login.html';
        return;
    }

    try {
        const profileSnapshot = await db.collection('admin_users').doc(user.uid).get();
        const profile = profileSnapshot.exists ? profileSnapshot.data() : null;
        if (user.uid !== BOOTSTRAP_ADMIN_UID && (!profile || profile.status !== 'approved')) {
            await firebase.auth().signOut();
            window.location.href = 'login.html';
            return;
        }

        authenticatedAdmin = user;
    authenticatedAdminProfile = profile || { status: 'approved' };
    isSuperAdmin = user.uid === BOOTSTRAP_ADMIN_UID;
    document.getElementById('adminControlsNav').style.display = isSuperAdmin ? '' : 'none';
    if (isSuperAdmin) loadAdminCommandCenter();
    resetInactivityTimer();
        loadAdminProfile().catch(error => console.warn('Could not load admin profile:', error.message));
        loadTeamDirectory();
        document.getElementById('teamPresenceName').innerText = user.displayName || adminName;
        document.getElementById('teamPresenceAvatar').innerText = initials(user.displayName || adminName);
        loadTeamChat();
        listenForIncomingCalls();
        startPresenceHeartbeat();
        loadClientList();
        selectChat('team', 'team_general', 'general', document.querySelector('#teamChat .chat-user-item'));
        // User IS logged in, safe to load dashboard data
        console.log("Admin authenticated:", user.email);

        // Initialize dashboard stats only if they haven't been initialized
        if (typeof initDashboardStats === 'function' && !window.statsInitialized) {
            initDashboardStats();
            window.statsInitialized = true;
        }

        // Initialize projects only if they haven't been initialized
        if (typeof loadProjects === 'function' && !window.projectsInitialized) {
            setTimeout(loadProjects, 300);
            window.projectsInitialized = true;
        }

        // Initialize Chat
        if (typeof selectChat === 'function' && !window.chatInitialized) {
            selectChat('team', 'team_general', 'general', document.querySelector('#teamChat .chat-user-item'));
            window.chatInitialized = true;
        }
    } catch (error) {
        console.error('Admin approval check failed:', error);
        await firebase.auth().signOut();
        window.location.href = 'login.html';
    }
});
