
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

// === VIEW SWITCHER ===
function switchView(viewId, btn) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    btn.classList.add('active');

    const titles = {
        dashboard: ['Dashboard Overview', "Welcome back! Here's what's happening today."],
        clientMessages: ['Client Messages', 'Chat directly with your website leads.'],
        teamChat: ['Team Communication', 'Slack-style internal chat.'],
        siteSettings: ['Website Settings', 'Update global site content dynamically.'],
        portfolio: ['Portfolio Manager', 'Add or remove projects from the live site.'],
        crm: ['Lead CRM', 'View and manage contact form submissions.'],
        team: ['Team Members', 'Add or remove team members from the live site.']
    };
    document.getElementById('pageTitle').innerText = titles[viewId][0];
    document.getElementById('pageSubtitle').innerText = titles[viewId][1];
    toggleSidebar(false);

    if ((viewId === 'dashboard') && chartsInitialized) {
        if (trafficChartInstance) trafficChartInstance.resize();
    }
}

// ==========================================
// FIREBASE: DASHBOARD STATS & ANALYTICS
// ==========================================
function initDashboardStats() {
    // 1. Listen for general site analytics document
    db.collection('analytics').doc('overview').onSnapshot(doc => {
        let data = doc.exists ? doc.data() : null;
        if (!data) {
            db.collection('analytics').doc('overview').set({
                pageViews: 1245, avgDuration: "3m 24s", bounceRate: 42,
                trafficData: [120, 190, 150, 280, 210, 340, 245],
                topPages: [
                    { name: 'Home', percentage: 65 },
                    { name: 'Services', percentage: 20 },
                    { name: 'Portfolio', percentage: 10 },
                    { name: 'Contact', percentage: 5 }
                ]
            });
            return;
        }

        document.getElementById('statPageViews').innerText = data.pageViews || 0;
        document.getElementById('statDuration').innerText = data.avgDuration || '0s';
        document.getElementById('statBounce').innerText = (data.bounceRate || 0) + '%';

        const topPagesHTML = data.topPages.map(page => `
                    <div style="display: flex; justify-content: space-between;">
                        <span style="font-size: 0.85rem;">${page.name}</span>
                        <span style="font-size: 0.85rem; color: var(--accent);">${page.percentage}%</span>
                    </div>
                    <div style="height: 6px; background: var(--bg); border-radius: 4px; margin-bottom: 10px;">
                        <div style="width: ${page.percentage}%; height: 100%; background: var(--gradient); border-radius: 4px;"></div>
                    </div>
                `).join('');
        document.getElementById('topPagesList').innerHTML = topPagesHTML;

        if (trafficChartInstance) trafficChartInstance.destroy();
        initCharts(data);
        chartsInitialized = true;

        // Populate settings forms
        document.getElementById('setViews').value = data.pageViews || 0;
        document.getElementById('setDur').value = data.avgDuration || '';
        document.getElementById('setBounce').value = data.bounceRate || 0;
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

function initCharts(data) {
    const ctx1 = document.getElementById('trafficChart');
    if (ctx1) trafficChartInstance = new Chart(ctx1, {
        type: 'line',
        data: {
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
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

function saveAnalytics(e) {
    e.preventDefault();
    db.collection('analytics').doc('overview').set({
        pageViews: Number(document.getElementById('setViews').value),
        avgDuration: document.getElementById('setDur').value,
        bounceRate: Number(document.getElementById('setBounce').value)
    }, { merge: true }).then(() => showToast("Analytics updated!"));
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
    if (confirm("Delete this submission?")) {
        db.collection('contact_submissions').doc(id).delete();
    }
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
                    <td style="cursor: pointer;" onclick="alert('Message from ${s.name}:\\n\\n${s.message}')">${s.subject}</td>
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

// ==========================================
// FIREBASE: TEAM MEMBERS
// ==========================================
function addTeamMember(e) {
    e.preventDefault();
    db.collection('team_members').add({
        name: tName.value, role: tRole.value, bio: tBio.value, img: tImg.value
    }).then(() => {
        teamForm.reset();
        showToast("Team member added to live site!");
    });
}

function deleteTeamMember(id) {
    if (confirm("Remove this team member?")) {
        db.collection('team_members').doc(id).delete();
    }
}

db.collection('team_members').onSnapshot(snapshot => {
    const list = document.getElementById('teamListHtml');
    list.innerHTML = '';
    if (snapshot.empty) {
        list.innerHTML = '<p style="color: var(--text-muted); text-align: center;">No team members added yet.</p>';
        return;
    }
    snapshot.forEach(doc => {
        const m = doc.data();
        list.innerHTML += `
                <div class="list-item">
                    <img src="${m.img}" onerror="this.src='https://via.placeholder.com/40'">
                    <div class="list-info">
                        <h4>${m.name}</h4>
                        <p>${m.role}</p>
                    </div>
                    <button class="btn-danger" onclick="deleteTeamMember('${doc.id}')"><i class="fas fa-trash"></i></button>
                </div>`;
    });
});

// ==========================================
// CHAT LOGIC (CLIENT & TEAM)
// ==========================================
let activeClientListener = null;

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
        if (item !== menu) item.style.display = 'none';
    });
    menu.style.display = menu.style.display === 'none' ? 'flex' : 'none';
}

function archiveClient(clientId) {
    db.collection('clients').doc(clientId).update({ status: 'archived', updatedAt: firebase.firestore.FieldValue.serverTimestamp() })
        .then(() => showToast('Client archived.'))
        .catch(error => showToast('Could not archive client: ' + error.message));
}

function archiveSelectedClient() {
    const clientId = document.getElementById('archiveClientButton').dataset.clientId;
    if (clientId) archiveClient(clientId);
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
    if (!confirm('Delete this client and all of their chat messages permanently?')) return;
    try {
        const chatRef = db.collection('chats').doc('client_' + clientId);
        const messages = await chatRef.collection('messages').get();
        const batch = db.batch();
        for (const message of messages.docs) {
            const replies = await message.ref.collection('replies').get();
            replies.docs.forEach(reply => batch.delete(reply.ref));
            batch.delete(message.ref);
        }
        batch.delete(db.collection('clients').doc(clientId));
        batch.delete(chatRef);
        await batch.commit();
        if (currentChatId === 'client_' + clientId) {
            document.getElementById('clientChatMessages').innerHTML = '<div style="text-align:center; color:var(--text-muted); margin-top:40px;">Select a client to view messages.</div>';
        }
        showToast('Client and messages deleted.');
    } catch (error) {
        showToast('Could not delete client: ' + error.message);
    }
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
        const isChannel = ['general', 'design', 'backend-dev'].includes(name);
        document.getElementById('teamChatHeader').innerHTML = isChannel ? `<span class="hash">#</span> ${name}` : `<img src="https://i.pravatar.cc/150?img=5" style="width:24px; height:24px; border-radius:50%; margin-right:5px;"> ${name}`;
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
                <div class="message">${formatMessage(m.text)}</div>
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
            text: input.value, sender: adminName,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(), reactions: {}
        });
        input.value = '';
    }
}
function handleChatSend(e, type) { if (e.key === 'Enter') sendMessage(type); }

function editMessage(id, type) {
    const wrapper = document.querySelector(`.message-wrapper[data-id="${id}"]`);
    const oldText = wrapper.querySelector('.message').innerText;
    const newText = prompt("Edit message:", oldText);
    if (newText !== null && newText.trim() !== '') {
        db.collection('chats').doc(currentChatId).collection('messages').doc(id).update({ text: newText });
    }
}

function deleteMessage(id, type) {
    if (confirm("Delete this message?")) {
        db.collection('chats').doc(currentChatId).collection('messages').doc(id).delete();
    }
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
    const name = prompt("Enter new channel name:");
    if (name) {
        const id = 'team_' + name.replace(/\s+/g, '_').toLowerCase();
        const list = document.getElementById('channelList');
        const li = document.createElement('li');
        li.className = 'chat-user-item';
        li.onclick = function () { selectChat('team', id, name, this); };
        li.innerHTML = `<span class="hash">#</span> ${name}`;
        list.appendChild(li);
        selectChat('team', id, name, li);
        showToast(`Channel #${name} created!`);
    }
}

function addDM() {
    const name = prompt("Enter name of person to message:");
    if (name) {
        const id = 'dm_' + name.replace(/\s+/g, '_').toLowerCase();
        const list = document.getElementById('dmList');
        const li = document.createElement('li');
        li.className = 'chat-user-item';
        li.onclick = function () { selectChat('team', id, name, this); };
        li.innerHTML = `<img src="https://i.pravatar.cc/150?img=${Math.floor(Math.random() * 50) + 1}"><div><h4>${name}</h4></div>`;
        list.appendChild(li);
        selectChat('team', id, name, li);
        showToast(`DM with ${name} started!`);
    }
}

// === CALLS ===
let callStream = null;
async function startCall(type) {
    try {
        callStream = await navigator.mediaDevices.getUserMedia({ video: type === 'video', audio: true });
        document.getElementById('callVideo').srcObject = callStream;
        document.getElementById('callModal').classList.add('active');
        document.getElementById('callName').innerText = type === 'video' ? 'Video Call Connected' : 'Voice Call Connected';
    } catch (err) { alert("Camera/Mic access denied. Use HTTPS or localhost."); }
}
function endCall() { if (callStream) callStream.getTracks().forEach(t => t.stop()); document.getElementById('callModal').classList.remove('active'); }
function toggleMute() { if (callStream) callStream.getAudioTracks().forEach(t => t.enabled = !t.enabled); }
function toggleVideo() { if (callStream) callStream.getVideoTracks().forEach(t => t.enabled = !t.enabled); }


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