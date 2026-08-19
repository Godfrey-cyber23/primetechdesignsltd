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

function switchView(viewId) {
    document.querySelectorAll('.auth-view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    document.querySelectorAll('.msg').forEach(m => m.style.display = 'none');
}

function showMsg(elementId, message, isError = true) {
    const el = document.getElementById(elementId);
    el.innerText = message;
    el.style.display = 'block';
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
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    return firebase.firestore().collection('admin_users').doc(user.uid).set(profile, { merge: true });
}

async function continueToDashboard(user) {
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
        showMsg('loginError', profile.status === 'rejected'
            ? 'Your dashboard access request was not approved.'
            : 'Your account is awaiting system administrator approval.');
        return;
    }

    window.location.href = '../admin/dashboard.html';
}

function loginUser(e) {
    e.preventDefault();
    setLoading('loginBtn', true, '');
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    firebase.auth().signInWithEmailAndPassword(email, password)
        .then(continueToDashboard)
        .catch(err => {
            showMsg('loginError', err.message);
            setLoading('loginBtn', false, 'Sign In');
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
            showMsg('loginError', err.message);
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
        showMsg('phoneError', "Invalid code. Please try again.");
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