// assets/js/superadmin.js
// Super Admin client module: pending approvals, tasks, roles, audit, notifications

/* global firebase, showToast */

const sa_db = firebase.firestore();
const sa_functions = firebase.app().functions ? firebase.app().functions() : null;

async function initSuperAdminPanel() {
    // populate pending list and bind actions
    await listPendingAdmins('pendingAdminList');
    await listTasks('tasksList');
    await listAudit('auditList');
}

async function listPendingAdmins(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '<div class="empty-state">Loading…</div>';

    try {
        const snapshot = await sa_db.collection('admin_users').where('status', '==', 'pending').orderBy('createdAt', 'asc').get();
        if (snapshot.empty) {
            container.innerHTML = '<div class="empty-state">No pending accounts</div>';
            return;
        }
        container.innerHTML = '';
        snapshot.forEach(doc => {
            const d = doc.data();
            const row = document.createElement('div');
            row.className = 'list-item';
            row.innerHTML = `
                <div style="flex:1; min-width:0;">
                    <strong>${escapeHtml(d.displayName || d.email || doc.id)}</strong>
                    <div class="muted">${escapeHtml(d.email || '')}</div>
                    <div style="font-size:0.85rem; color:var(--text-muted);">Requested: ${d.createdAt && d.createdAt.toDate ? d.createdAt.toDate().toLocaleString() : '...'}</div>
                </div>
                <div style="display:flex; gap:8px; align-items:center;">
                    <select id="roleSelect_${doc.id}" style="padding:6px; font-size:0.9rem;">
                        <option value="admin">Admin</option>
                        <option value="manager">Manager</option>
                    </select>
                    <button class="btn-primary" onclick="approveAdmin('${doc.id}')">Approve</button>
                    <button class="btn-danger" onclick="rejectAdmin('${doc.id}')">Reject</button>
                </div>`;
            container.appendChild(row);
        });
    } catch (err) {
        console.error('listPendingAdmins', err);
        container.innerHTML = '<div class="empty-state">Unable to load pending accounts</div>';
    }
}

async function approveAdmin(uid) {
    try {
        const roleEl = document.getElementById('roleSelect_' + uid);
        const role = roleEl ? roleEl.value : 'admin';

        // Update admin_users status to approved and set role
        await sa_db.collection('admin_users').doc(uid).update({
            status: 'approved',
            role,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Call cloud function to set custom claims
        if (sa_functions) {
            try {
                const setRole = sa_functions.httpsCallable('setRole');
                await setRole({ uid, role });
            } catch (err) {
                console.warn('setRole failed:', err.message || err);
                // proceed but record audit
            }
        }

        // Audit entry
        await sa_db.collection('admin_audit').add({
            actorUid: firebase.auth().currentUser.uid,
            action: 'approve_admin',
            targetUid: uid,
            details: { role },
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Notification to user
        await sa_db.collection('notifications').doc(uid).collection('inbox').add({
            title: 'Admin access approved',
            body: 'Your account was approved. You may now log in to the admin dashboard.',
            read: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        showToast('Account approved');
        await listPendingAdmins('pendingAdminList');
    } catch (err) {
        console.error('approveAdmin', err);
        showToast('Could not approve account: ' + (err.message || err));
    }
}

async function rejectAdmin(uid) {
    try {
        await sa_db.collection('admin_users').doc(uid).update({
            status: 'rejected',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        await sa_db.collection('admin_audit').add({
            actorUid: firebase.auth().currentUser.uid,
            action: 'reject_admin',
            targetUid: uid,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        await sa_db.collection('notifications').doc(uid).collection('inbox').add({
            title: 'Admin access request rejected',
            body: 'Your request for admin access was not approved. Contact an administrator for more info.',
            read: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        showToast('Account rejected');
        await listPendingAdmins('pendingAdminList');
    } catch (err) {
        console.error('rejectAdmin', err);
        showToast('Could not reject account: ' + (err.message || err));
    }
}

// --- Tasks ---
async function listTasks(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '<div class="empty-state">Loading…</div>';
    try {
        const snapshot = await sa_db.collection('tasks').orderBy('createdAt', 'desc').limit(50).get();
        if (snapshot.empty) { container.innerHTML = '<div class="empty-state">No tasks yet</div>'; return; }
        container.innerHTML = '';
        snapshot.forEach(doc => {
            const t = doc.data();
            const item = document.createElement('div');
            item.className = 'list-item';
            item.innerHTML = `
                <div style="flex:1; min-width:0;">
                    <strong>${escapeHtml(t.title)}</strong>
                    <div class="muted">${escapeHtml(t.description || '')}</div>
                    <div style="font-size:0.85rem; color:var(--text-muted);">Assignee: ${escapeHtml(t.assigneeUid || 'Unassigned')} · ${t.status || 'open'}</div>
                </div>
                <div style="display:flex; gap:8px; align-items:center;">
                    <button class="btn-primary" onclick="openAssignTaskModal('${doc.id}')">Assign</button>
                    <button class="btn-secondary" onclick="markTaskDone('${doc.id}')">Mark Done</button>
                </div>`;
            container.appendChild(item);
        });
    } catch (err) {
        console.error('listTasks', err);
        container.innerHTML = '<div class="empty-state">Unable to load tasks</div>';
    }
}

async function createTask(title, description, assigneeUid = null, priority = 'normal', dueDate = null) {
    try {
        const data = {
            title, description, assigneeUid, status: 'open', priority, dueDate: dueDate ? new Date(dueDate) : null,
            createdBy: firebase.auth().currentUser.uid, createdAt: firebase.firestore.FieldValue.serverTimestamp(), updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        const ref = await sa_db.collection('tasks').add(data);
        await sa_db.collection('admin_audit').add({ actorUid: firebase.auth().currentUser.uid, action: 'create_task', targetPath: `tasks/${ref.id}`, details: { title }, timestamp: firebase.firestore.FieldValue.serverTimestamp() });
        showToast('Task created');
        await listTasks('tasksList');
        return ref;
    } catch (err) {
        console.error('createTask', err);
        showToast('Could not create task: ' + (err.message || err));
    }
}

async function openAssignTaskModal(taskId) {
    // Simple prompt flow for now
    const assignee = prompt('Enter assignee UID (use team directory email to lookup in console if needed):');
    if (!assignee) return;
    try {
        await sa_db.collection('tasks').doc(taskId).update({ assigneeUid: assignee, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
        await sa_db.collection('admin_audit').add({ actorUid: firebase.auth().currentUser.uid, action: 'assign_task', targetPath: `tasks/${taskId}`, details: { assignee: assignee }, timestamp: firebase.firestore.FieldValue.serverTimestamp() });
        await sa_db.collection('notifications').doc(assignee).collection('inbox').add({ title: 'Task assigned', body: `A new task was assigned to you: ${taskId}`, read: false, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
        showToast('Task assigned');
        await listTasks('tasksList');
    } catch (err) {
        console.error('openAssignTaskModal', err);
        showToast('Could not assign task: ' + (err.message || err));
    }
}

async function markTaskDone(taskId) {
    try {
        await sa_db.collection('tasks').doc(taskId).update({ status: 'done', updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
        await sa_db.collection('admin_audit').add({ actorUid: firebase.auth().currentUser.uid, action: 'complete_task', targetPath: `tasks/${taskId}`, timestamp: firebase.firestore.FieldValue.serverTimestamp() });
        showToast('Task marked done');
        await listTasks('tasksList');
    } catch (err) {
        console.error('markTaskDone', err);
        showToast('Could not update task: ' + (err.message || err));
    }
}

// --- Audit ---
async function listAudit(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '<div class="empty-state">Loading…</div>';
    try {
        const snapshot = await sa_db.collection('admin_audit').orderBy('timestamp', 'desc').limit(50).get();
        if (snapshot.empty) { container.innerHTML = '<div class="empty-state">No audit activity yet</div>'; return; }
        container.innerHTML = '';
        snapshot.forEach(doc => {
            const a = doc.data();
            const item = document.createElement('div');
            item.className = 'list-item';
            item.innerHTML = `
                <div style="flex:1; min-width:0;">
                    <strong>${escapeHtml(a.action)}</strong>
                    <div class="muted">${escapeHtml(a.actorUid || '')} · ${a.timestamp && a.timestamp.toDate ? a.timestamp.toDate().toLocaleString() : '...'}</div>
                    <div style="font-size:0.85rem; color:var(--text-muted);">${escapeHtml(JSON.stringify(a.details || ''))}</div>
                </div>`;
            container.appendChild(item);
        });
    } catch (err) {
        console.error('listAudit', err);
        container.innerHTML = '<div class="empty-state">Unable to load audit</div>';
    }
}

// Expose to global scope for simple HTML onclick bindings
window.initSuperAdminPanel = initSuperAdminPanel;
window.listPendingAdmins = listPendingAdmins;
window.approveAdmin = approveAdmin;
window.rejectAdmin = rejectAdmin;
window.createTask = createTask;
window.listTasks = listTasks;
window.openAssignTaskModal = openAssignTaskModal;
window.listAudit = listAudit;

