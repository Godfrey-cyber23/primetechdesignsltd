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

const BOOTSTRAP_ADMIN_UID = 'sJSLqnZTFvcnubHnNyl1NJlMHy52';
const MAX_LOGIN_ATTEMPTS = 3;
let authRedirectInProgress = false;

function switchView(viewId) {
    document.querySelectorAll('.auth-view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    document.querySelectorAll('.msg').forEach(m => m.style.display = 'none');
}

function showMsg(elementId, message, isError = true) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.innerText = message;
    el.classList.toggle('success-msg', !isError);
    el.classList.toggle('error-msg', isError);
    el.style.display = 'block';
}

function authErrorMessage(error) {
    const messages = {
        'auth/invalid-credential': 'Email or password is incorrect.',
        'auth/wrong-password': 'Email or password is incorrect.',
        'auth/user-not-found': 'Email or password is incorrect.',
        'auth/too-many-requests': 'Too many attempts. Try again later or contact the system administrator.',
        'auth/user-disabled': 'This account is disabled. Contact the system administrator.',
        'auth/network-request-failed': 'Network error. Check your connection and try again.'
    };
    return messages[error.code] || error.message || 'Authentication failed. Please try again.';
}

function loginAttemptKey(email) {
    return `primetech-login-attempts:${email.trim().toLowerCase()}`;
}

function getLoginAttempts(email) {
    return Number.parseInt(localStorage.getItem(loginAttemptKey(email)) || '0', 10) || 0;
}

function clearLoginAttempts(email) {
    localStorage.removeItem(loginAttemptKey(email));
}

function setLoading(buttonId, isLoading, originalText) {
    const btn = document.getElementById(buttonId);
    if (isLoading) {
        btn.innerHTML = '<div class="spinner"></div>';
        btn.disabled = true;
    } else {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

function getAdminProfile(user) {
    return firebase.firestore().collection('admin_users').doc(user.uid).get();
}

function createPendingAdminProfile(user) {
    const isBootstrapAdmin = user.uid === BOOTSTRAP_ADMIN_UID;
    const profile = {
        email: user.email || '',
        displayName: user.displayName || '',
        provider: user.providerData[0] ? user.providerData[0].providerId : 'password',
        status: isBootstrapAdmin ? 'approved' : 'pending',
        loginStatus: 'unlocked',
        loginLocked: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    return firebase.firestore().collection('admin_users').doc(user.uid).set(profile, { merge: true });
}

async function continueToDashboard(user) {
    if (authRedirectInProgress) return;
    authRedirectInProgress = true;
    const profileSnapshot = await getAdminProfile(user);
    if (!profileSnapshot.exists) {
        await createPendingAdminProfile(user);
        if (user.uid === BOOTSTRAP_ADMIN_UID) {
            window.location.href = '../admin/dashboard.html';
            return;
        }
        await firebase.auth().signOut();
        showMsg('loginError', 'Your account is awaiting system administrator approval.');
        return;
    }

    const profile = profileSnapshot.data();
    if (profile.loginLocked === true || profile.loginStatus === 'locked') {
        await firebase.auth().signOut();
        authRedirectInProgress = false;
        showMsg('loginError', 'This account is locked. A super administrator must unlock it.');
        return;
    }
    if (user.uid === BOOTSTRAP_ADMIN_UID && profile.status !== 'approved') {
        await firebase.firestore().collection('admin_users').doc(user.uid).update({
            status: 'approved',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        window.location.href = '../admin/dashboard.html';
        return;
    }

    if (profile.status !== 'approved') {
        await firebase.auth().signOut();
        authRedirectInProgress = false;
        showMsg('loginError', profile.status === 'rejected'
            ? 'Your dashboard access request was not approved.'
            : 'Your account is awaiting system administrator approval.');
        return;
    }

    window.location.href = '../admin/dashboard.html';
}

function loginUser(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const attempts = getLoginAttempts(email);
    if (attempts >= MAX_LOGIN_ATTEMPTS) {
        showMsg('loginError', 'This account is locked after 3 failed attempts. A super administrator must unlock it.');
        return;
    }
    setLoading('loginBtn', true, 'Sign In');

    firebase.auth().signInWithEmailAndPassword(email, password)
        .then(userCredential => {
            clearLoginAttempts(email);
            return continueToDashboard(userCredential.user);
        })
        .catch(err => {
            const nextAttempts = getLoginAttempts(email) + 1;
            localStorage.setItem(loginAttemptKey(email), String(nextAttempts));
            showMsg('loginError', nextAttempts >= MAX_LOGIN_ATTEMPTS
                ? '3 failed attempts. This account is locked until a super administrator unlocks it.'
                : `${authErrorMessage(err)} ${MAX_LOGIN_ATTEMPTS - nextAttempts} attempt(s) remaining.`);
            setLoading('loginBtn', false, 'Sign In');
            authRedirectInProgress = false;
        });
}

function signupUser(e) {
    e.preventDefault();
    setLoading('signupBtn', true, '');
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;

    firebase.auth().createUserWithEmailAndPassword(email, password)
        .then(async userCredential => {
            await createPendingAdminProfile(userCredential.user);
            await firebase.auth().signOut();
            switchView('loginView');
            showMsg('loginError', 'Account created. A system administrator must approve it before dashboard access is enabled.');
        })
        .catch(err => {
            showMsg('signupError', err.message);
            setLoading('signupBtn', false, 'Create Account');
        });
}

function loginWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithPopup(provider)
        .then(continueToDashboard)
        .catch(err => {
            showMsg('loginError', authErrorMessage(err));
        });
}

let recaptchaVerifier;
let confirmationResult;

function sendPhoneCode() {
    const phone = document.getElementById('phoneNumber').value;
    const btn = document.getElementById('sendCodeBtn');
    btn.innerHTML = '<div class="spinner"></div>';
    btn.disabled = true;

    recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
        size: 'normal',
        callback: () => {
            firebase.auth().signInWithPhoneNumber(phone, recaptchaVerifier)
                .then(result => {
                    confirmationResult = result;
                    document.getElementById('phoneFormStep').style.display = 'none';
                    document.getElementById('phoneVerifyStep').style.display = 'block';
                    showMsg('phoneSuccess', 'Code sent to ' + phone, false);
                    btn.innerText = 'Send Verification Code';
                    btn.disabled = false;
                })
                .catch(err => {
                    showMsg('phoneError', err.message);
                    btn.innerText = 'Send Verification Code';
                    btn.disabled = false;
                    recaptchaVerifier.render();
                });
        }
    });

    recaptchaVerifier.render().then(widgetId => {
        grecaptcha.execute(widgetId);
    });
}

function verifyPhoneCode() {
    const code = document.getElementById('verificationCode').value;
    const btn = document.getElementById('verifyCodeBtn');
    btn.innerHTML = '<div class="spinner"></div>';
    btn.disabled = true;

    confirmationResult.confirm(code).then(async userCredential => {
        await createPendingAdminProfile(userCredential.user);
        await firebase.auth().signOut();
        switchView('loginView');
        showMsg('loginError', 'Account verified. A system administrator must approve it before dashboard access is enabled.');
    }).catch(() => {
        showMsg('phoneError', "Invalid verification code. Please try again.");
        btn.innerText = 'Verify & Login';
        btn.disabled = false;
    });
}

function resetPassword(e) {
    e.preventDefault();
    setLoading('resetBtn', true, '');
    const email = document.getElementById('forgotEmail').value;

    firebase.auth().sendPasswordResetEmail(email)
        .then(() => {
            showMsg('forgotSuccess', 'Reset link sent! Check your email.', false);
            setLoading('resetBtn', false, 'Send Reset Link');
        })
        .catch(err => {
            showMsg('forgotError', err.message);
            setLoading('resetBtn', false, 'Send Reset Link');
        });
}

firebase.auth().onAuthStateChanged(user => {
    if (user && !user.isAnonymous) continueToDashboard(user).catch(err => {
        showMsg('loginError', err.message);
    });
});