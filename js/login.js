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

function loginUser(e) {
    e.preventDefault();
    setLoading('loginBtn', true, '');
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    firebase.auth().signInWithEmailAndPassword(email, password)
        .then(() => { window.location.href = 'index.html'; })
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
        .then(() => { window.location.href = 'index.html'; })
        .catch(err => {
            showMsg('signupError', err.message);
            setLoading('signupBtn', false, 'Create Account');
        });
}

function loginWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithPopup(provider)
        .then(() => { window.location.href = 'index.html'; })
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

    confirmationResult.confirm(code).then(() => {
        window.location.href = 'index.html';
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
    if (user) window.location.href = 'index.html';
});