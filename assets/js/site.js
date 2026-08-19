// <!-- === FIREBASE CONFIGURATION === -->
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
        window.primetechKnowledge = {
            contact: {
                email: 'info@primetechdesignsltd.vercel.app',
                phone: '+260 975755276',
                location: 'Lusaka, Zambia'
            },
            team: [],
            projects: []
        };

        const analyticsSessionId = sessionStorage.getItem('primetechAnalyticsSession') ||
            `${Date.now()}_${Math.random().toString(36).slice(2)}`;
        sessionStorage.setItem('primetechAnalyticsSession', analyticsSessionId);
        const analyticsSessionStartedAt = Number(sessionStorage.getItem('primetechAnalyticsStartedAt')) || Date.now();
        sessionStorage.setItem('primetechAnalyticsStartedAt', String(analyticsSessionStartedAt));
        let analyticsSessionEnded = false;

        function trackAnalyticsEvent(type, extra = {}) {
            return db.collection('analytics_events').add({
                type,
                sessionId: analyticsSessionId,
                path: window.location.pathname,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                ...extra
            }).catch(error => console.warn('Analytics event was not recorded:', error.message));
        }

        trackAnalyticsEvent('page_view');
        if (!sessionStorage.getItem('primetechAnalyticsStarted')) {
            sessionStorage.setItem('primetechAnalyticsStarted', 'true');
            trackAnalyticsEvent('session_start');
        }

        function closeAnalyticsSession() {
            if (analyticsSessionEnded) return;
            analyticsSessionEnded = true;
            trackAnalyticsEvent('session_end', {
                durationSeconds: Math.max(0, Math.round((Date.now() - analyticsSessionStartedAt) / 1000))
            });
        }

        window.addEventListener('pagehide', closeAnalyticsSession, { once: true });

        let publicChatUser = null;
        let publicChatName = localStorage.getItem('publicChatName') || '';
        let publicChatListenerStarted = false;
        let publicChatAuthPromise = null;

        const publicChatPersistenceReady = firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL)
            .catch(error => {
                console.error('Chat persistence setup error:', error);
            });

        async function ensurePublicChatUser() {
            if (publicChatUser) return Promise.resolve(publicChatUser);
            if (firebase.auth().currentUser && firebase.auth().currentUser.isAnonymous) {
                publicChatUser = firebase.auth().currentUser;
                return Promise.resolve(publicChatUser);
            }
            if (publicChatAuthPromise) return publicChatAuthPromise;
            publicChatAuthPromise = publicChatPersistenceReady.then(() => firebase.auth().signInAnonymously()).then(result => {
                publicChatUser = result.user;
                return publicChatUser;
            });
            return publicChatAuthPromise;
        }

  
        document.addEventListener('DOMContentLoaded', () => {

            // Mobile content carousels retain touch scrolling while advancing gently when idle.
            function setupMobileCarousels() {
                const carouselSelectors = [
                    '.services-grid',
                    '.team-grid',
                    '.projects-slider-container',
                    '.process-grid',
                    '.tech-grid',
                    '.testimonial-grid',
                    '.insights-grid'
                ];
                const carousels = carouselSelectors
                    .map(selector => document.querySelector(selector))
                    .filter(Boolean);
                const mobileQuery = window.matchMedia('(max-width: 768px)');
                const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

                carousels.forEach(carousel => {
                    carousel.classList.add('mobile-carousel');
                    let paused = false;
                    let timer;

                    const stop = () => {
                        paused = true;
                        clearInterval(timer);
                    };
                    const start = () => {
                        clearInterval(timer);
                        paused = false;
                        if (!mobileQuery.matches || reducedMotionQuery.matches) return;
                        timer = setInterval(() => {
                            if (paused || carousel.scrollWidth <= carousel.clientWidth) return;
                            const step = carousel.clientWidth * 0.82 + 14;
                            const atEnd = carousel.scrollLeft + carousel.clientWidth >= carousel.scrollWidth - 4;
                            carousel.scrollTo({ left: atEnd ? 0 : carousel.scrollLeft + step, behavior: 'smooth' });
                        }, 3600);
                    };

                    ['mouseenter', 'focusin', 'touchstart', 'pointerdown'].forEach(eventName => {
                        carousel.addEventListener(eventName, stop, { passive: true });
                    });
                    ['mouseleave', 'focusout', 'touchend', 'pointerup', 'pointercancel'].forEach(eventName => {
                        carousel.addEventListener(eventName, start, { passive: true });
                    });
                    carousel.addEventListener('scroll', () => {
                        if (paused) return;
                        clearTimeout(carousel._resumeTimer);
                        carousel._resumeTimer = setTimeout(start, 900);
                    }, { passive: true });
                    start();
                });
            }

            setupMobileCarousels();

            // ---- Year ----
            document.getElementById('year').textContent = new Date().getFullYear();

            // ---- Theme Toggle ----
            const themeToggle = document.getElementById('themeToggle');
            const htmlEl = document.documentElement;

            function getTheme() {
                const s = localStorage.getItem('theme');
                if (s) return s;
                return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
            }

            function setTheme(theme) {
                if (theme === 'light') {
                    htmlEl.setAttribute('data-theme', 'light');
                } else {
                    htmlEl.removeAttribute('data-theme');
                }
                localStorage.setItem('theme', theme);
                const icon = themeToggle.querySelector('i');
                icon.className = theme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
            }

            setTheme(getTheme());

            themeToggle.addEventListener('click', () => {
                const current = htmlEl.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
                setTheme(current === 'dark' ? 'light' : 'dark');
            });

            // ---- Hero Background Parallax ----
            const heroBg = document.querySelector('.hero-bg');
            const heroContent = document.querySelector('.hero-content');
            window.addEventListener('scroll', () => {
                const offset = window.scrollY;
                if (offset < window.innerHeight) {
                    heroBg.style.transform = `scale(1.1) translateY(${offset * 0.3}px)`;
                    heroContent.style.transform = `translateY(${offset * 0.15}px)`;
                    heroContent.style.opacity = 1 - (offset / (window.innerHeight * 0.8));
                }
            });

            // ---- Hero Particle Network ----
            const heroCanvas = document.getElementById('hero-canvas');
            const ctx = heroCanvas.getContext('2d');
            let heroParticles = [];
            let mousePos = { x: null, y: null };

            function resizeHeroCanvas() {
                heroCanvas.width = heroCanvas.parentElement.offsetWidth;
                heroCanvas.height = heroCanvas.parentElement.offsetHeight;
            }

            class HeroParticle {
                constructor() {
                    this.x = Math.random() * heroCanvas.width;
                    this.y = Math.random() * heroCanvas.height;
                    this.baseVx = (Math.random() - 0.5) * 0.3;
                    this.baseVy = (Math.random() - 0.5) * 0.3;
                    this.vx = this.baseVx;
                    this.vy = this.baseVy;
                    this.size = Math.random() * 1.5 + 0.5;
                }
                update() {
                    if (mousePos.x !== null) {
                        let dx = this.x - mousePos.x;
                        let dy = this.y - mousePos.y;
                        let dist = Math.sqrt(dx * dx + dy * dy);
                        if (dist < 100) {
                            let force = (100 - dist) / 100;
                            this.vx += (dx / dist) * force * 0.3;
                            this.vy += (dy / dist) * force * 0.3;
                        }
                    }
                    this.vx += (this.baseVx - this.vx) * 0.05;
                    this.vy += (this.baseVy - this.vy) * 0.05;
                    this.x += this.vx;
                    this.y += this.vy;
                    if (this.x < 0 || this.x > heroCanvas.width) this.vx *= -1;
                    if (this.y < 0 || this.y > heroCanvas.height) this.vy *= -1;
                    this.x = Math.max(0, Math.min(heroCanvas.width, this.x));
                    this.y = Math.max(0, Math.min(heroCanvas.height, this.y));
                }
                draw(isLight) {
                    ctx.fillStyle = isLight ? 'rgba(0, 153, 204, 0.6)' : 'rgba(0, 212, 255, 0.6)';
                    ctx.beginPath();
                    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                    ctx.fill();
                }
            }

            function initHeroParticles() {
                heroParticles = [];
                const count = window.innerWidth < 768 ? 25 : 60;
                for (let i = 0; i < count; i++) {
                    heroParticles.push(new HeroParticle());
                }
            }

            function animateHero() {
                ctx.clearRect(0, 0, heroCanvas.width, heroCanvas.height);
                const isLight = htmlEl.getAttribute('data-theme') === 'light';
                const lineColor = isLight ? '0, 153, 204' : '0, 212, 255';

                for (let i = 0; i < heroParticles.length; i++) {
                    heroParticles[i].update();
                    heroParticles[i].draw(isLight);
                    for (let j = i + 1; j < heroParticles.length; j++) {
                        const dx = heroParticles[i].x - heroParticles[j].x;
                        const dy = heroParticles[i].y - heroParticles[j].y;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        if (dist < 120) {
                            const opacity = (1 - dist / 120) * 0.2;
                            ctx.strokeStyle = `rgba(${lineColor}, ${opacity})`;
                            ctx.lineWidth = 0.5;
                            ctx.beginPath();
                            ctx.moveTo(heroParticles[i].x, heroParticles[i].y);
                            ctx.lineTo(heroParticles[j].x, heroParticles[j].y);
                            ctx.stroke();
                        }
                    }
                }
                requestAnimationFrame(animateHero);
            }

            const heroSection = document.querySelector('.hero');
            heroSection.addEventListener('mousemove', (e) => {
                const rect = heroCanvas.getBoundingClientRect();
                mousePos.x = e.clientX - rect.left;
                mousePos.y = e.clientY - rect.top;
            });
            heroSection.addEventListener('mouseleave', () => {
                mousePos.x = null;
                mousePos.y = null;
            });
            window.addEventListener('resize', () => {
                resizeHeroCanvas();
                initHeroParticles();
            });

            resizeHeroCanvas();
            initHeroParticles();
            animateHero();

            // ---- Stat Counter Animation ----
            const stats = document.querySelectorAll('.stat-number');
            const statObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const target = +entry.target.dataset.target;
                        const decimals = entry.target.dataset.decimals ? 1 : 0;
                        let current = 0;
                        const increment = target / 50;
                        const updateCount = () => {
                            current += increment;
                            if (current < target) {
                                entry.target.textContent = current.toFixed(decimals);
                                requestAnimationFrame(updateCount);
                            } else {
                                entry.target.textContent = target.toFixed(decimals) + (entry.target.dataset.target === "20" ? "+" : "");
                            }
                        };
                        updateCount();
                        observer.unobserve(entry.target);
                    }
                });
            }, { threshold: 0.5 });
            stats.forEach(stat => statObserver.observe(stat));

            // ---- Typing Effect ----
            const typedEl = document.getElementById('typed-text');
            const phrases = ['Custom Web Development', 'Cloud Infrastructure', 'IT Consulting', 'Digital Transformation'];
            let pi = 0, ci = 0, deleting = false;

            function typeLoop() {
                const current = phrases[pi];
                typedEl.textContent = current.substring(0, deleting ? --ci : ++ci);
                let delay = deleting ? 30 : 60;
                if (!deleting && ci === current.length) {
                    delay = 1800;
                    deleting = true;
                } else if (deleting && ci === 0) {
                    deleting = false;
                    pi = (pi + 1) % phrases.length;
                    delay = 300;
                }
                setTimeout(typeLoop, delay);
            }
            typeLoop();

            // ---- Nav ----
            const nav = document.querySelector('nav');
            const hamburger = document.querySelector('.hamburger');
            const mobileMenu = document.querySelector('.mobile-menu');

            window.addEventListener('scroll', () => {
                nav.classList.toggle('scrolled', window.scrollY > 40);
            });

            hamburger.addEventListener('click', () => {
                mobileMenu.classList.toggle('open');
                hamburger.classList.toggle('active');
                hamburger.setAttribute('aria-expanded', mobileMenu.classList.contains('open'));
            });

            mobileMenu.querySelectorAll('a').forEach(a => {
                a.addEventListener('click', () => {
                    mobileMenu.classList.remove('open');
                    hamburger.classList.remove('active');
                    hamburger.setAttribute('aria-expanded', 'false');
                });
            });

            // ---- Active Nav Link ----
            const sections = document.querySelectorAll('section[id]');
            const navLinks = document.querySelectorAll('.nav-links a[href^="#"], .mobile-menu a[href^="#"]');

            function updateActiveNav() {
                const scrollY = window.scrollY + 120;
                let currentId = 'home';
                sections.forEach(section => {
                    const top = section.offsetTop;
                    const height = section.offsetHeight;
                    if (scrollY >= top && scrollY < top + height) {
                        currentId = section.getAttribute('id');
                    }
                });
                navLinks.forEach(link => {
                    const href = link.getAttribute('href');
                    const isHome = href === '#home' || href === '#';
                    const isActive = isHome ? (currentId === 'home' || scrollY < 200) : href === `#${currentId}`;
                    link.classList.toggle('active', isActive);
                });
            }
            updateActiveNav();
            window.addEventListener('scroll', updateActiveNav);

            // ---- Scroll Progress ----
            window.addEventListener('scroll', () => {
                const scrollTop = document.documentElement.scrollTop;
                const docHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
                document.querySelector('.scroll-progress').style.width = (scrollTop / docHeight * 100) + '%';
            });

            // ---- Back to Top ----
            const btt = document.getElementById('backToTop');
            window.addEventListener('scroll', () => {
                btt.classList.toggle('show', window.scrollY > 300);
            });
            btt.addEventListener('click', () => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });

            // ---- Scroll Reveal ----
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(e => {
                    if (e.isIntersecting) {
                        e.target.classList.add('visible');
                        observer.unobserve(e.target);
                    }
                });
            }, { threshold: 0.1, rootMargin: '0px 0px -30px 0px' });

            function observeReveals() {
                document.querySelectorAll('.reveal:not(.visible)').forEach(el => observer.observe(el));
            }
            observeReveals();

            // ==========================================
            // FIREBASE: LOAD DYNAMIC SITE SETTINGS
            // ==========================================
            db.collection('site_settings').doc('general').onSnapshot(doc => {
                if (doc.exists) {
                    const data = doc.data();

                    // Hero Section
                    if (data.heroTitle) document.getElementById('heroTitle').innerHTML = data.heroTitle;
                    if (data.heroDesc) document.getElementById('heroDesc').innerText = data.heroDesc;

                    // About Section
                    if (data.aboutTitle) document.getElementById('aboutTitle').innerText = data.aboutTitle;
                    if (data.aboutText1) document.getElementById('aboutText1').innerText = data.aboutText1;
                    if (data.aboutText2) document.getElementById('aboutText2').innerText = data.aboutText2;

                    // Contact Section
                    if (data.email) document.getElementById('siteEmail').innerText = data.email;
                    if (data.phone) document.getElementById('sitePhone').innerText = data.phone;
                    if (data.location) document.getElementById('siteLocation').innerText = data.location;

                    // About Info Grid (NEW)
                    if (data.email) document.getElementById('aboutEmail').innerText = data.email;
                    if (data.location) document.getElementById('aboutLocation').innerText = data.location;

                    // Footer Section
                    if (data.footerDesc) document.getElementById('footerDesc').innerText = data.footerDesc;
                    if (data.email) {
                        document.getElementById('footerEmail').innerText = data.email;
                        document.getElementById('footerEmail').href = `mailto:${data.email}`;
                    }
                    if (data.phone) {
                        document.getElementById('footerPhone').innerText = data.phone;
                        document.getElementById('footerPhone').href = `tel:${data.phone.replace(/\s/g, '')}`;
                    }
                    if (data.location) {
                        document.getElementById('footerLocation').innerText = data.location;
                    }
                    Object.assign(window.primetechKnowledge.contact, {
                        email: data.email || window.primetechKnowledge.contact.email,
                        phone: data.phone || window.primetechKnowledge.contact.phone,
                        location: data.location || window.primetechKnowledge.contact.location
                    });
                }
            });

            // ==========================================
            // FIREBASE: LOAD DYNAMIC TEAM MEMBERS
            // ==========================================
            db.collection('team_members').onSnapshot(snapshot => {
                const teamGrid = document.getElementById('teamGrid');
                if (!teamGrid) return;
                teamGrid.innerHTML = '';

                if (snapshot.empty) {
                    teamGrid.innerHTML = '<p style="color: var(--text-muted); grid-column: 1/-1; text-align: center;">Team details coming soon.</p>';
                    return;
                }

                snapshot.forEach(doc => {
                    const m = doc.data();
                    const card = document.createElement('div');
                    card.className = 'team-card reveal';
                    card.innerHTML = `
                        <div class="team-img">
                            <img src="${m.img || 'https://via.placeholder.com/400x400'}" alt="${m.name}" loading="lazy" decoding="async" />
                        </div>
                        <div class="team-info">
                            <h3>${m.name}</h3>
                            <span class="team-role">${m.role}</span>
                            <p>${m.bio || ''}</p>
                            <div class="team-social">
                                <a href="#" target="_blank" rel="noopener" aria-label="LinkedIn"><i class="fab fa-linkedin-in"></i></a>
                                <a href="#" target="_blank" rel="noopener" aria-label="GitHub"><i class="fab fa-github"></i></a>
                            </div>
                        </div>
                    `;
                    teamGrid.appendChild(card);
                });
                window.primetechKnowledge.team = snapshot.docs.map(doc => {
                    const member = doc.data();
                    return { name: member.name, role: member.role, bio: member.bio || '' };
                });
                observeReveals(); // Observe newly added cards
            });

            // ==========================================
            // FIREBASE: LOAD DYNAMIC PORTFOLIO PROJECTS
            // ==========================================
            db.collection('projects').where('isPublished', '==', true).orderBy('createdAt', 'desc').onSnapshot(snapshot => {
                const track = document.getElementById('projectsTrack');
                if (!track) return;

                if (snapshot.empty) {
                    track.innerHTML = '<div style="width: 100%; text-align: center; color: var(--text-muted); padding: 40px;">Projects coming soon. Check back later!</div>';
                    return;
                }

                let html = '';
                // Map through items once
                snapshot.forEach(doc => {
                    const p = doc.data();
                    const tagsHtml = (p.tags || []).map(t => `<span class="tag">${t}</span>`).join('');
                    html += `
                        <div class="project-card reveal">
                            <div class="project-img">
                                <img src="${p.imageUrl || 'https://placehold.co/300x150/06060a/8b95a7?text=Primetech'}" alt="${p.title}" loading="lazy" decoding="async" />
                                <div class="project-overlay">
                                    <a href="#" class="project-details-btn" data-project="${doc.id}" aria-label="View details"><i class="fas fa-expand"></i></a>
                                    ${p.liveUrl ? `<a href="${p.liveUrl}" target="_blank" rel="noopener" aria-label="Live Site"><i class="fas fa-external-link-alt"></i></a>` : ''}
                                    ${p.githubUrl ? `<a href="${p.githubUrl}" target="_blank" rel="noopener" aria-label="GitHub"><i class="fab fa-github"></i></a>` : ''}
                                </div>
                            </div>
                            <div class="project-body">
                                <h3>${p.title}</h3>
                                <p>${p.description || ''}</p>
                                <div class="tags">${tagsHtml}</div>
                            </div>
                        </div>
                    `;
                });

                window.primetechKnowledge.projects = snapshot.docs.map(doc => {
                    const project = doc.data();
                    return { title: project.title, description: project.description || '', tags: project.tags || [] };
                });

                // Duplicate the HTML string to create the infinite loop effect
                track.innerHTML = html + html;
                observeReveals();
            });

            // ==========================================
            // FIREBASE: CONTACT FORM SUBMIT (CRM LEAD)
            // ==========================================
            const form = document.getElementById('contactForm');
            const formStatus = document.getElementById('form-status');

            function showFieldError(field, msg) {
                field.classList.add('error');
                const errEl = field.parentNode.querySelector('.field-error');
                errEl.textContent = msg;
                errEl.style.display = 'block';
            }

            function clearFieldError(field) {
                field.classList.remove('error');
                const errEl = field.parentNode.querySelector('.field-error');
                if (errEl) {
                    errEl.style.display = 'none';
                    errEl.textContent = '';
                }
            }

            form.querySelectorAll('input, textarea').forEach(f => {
                f.addEventListener('input', () => clearFieldError(f));
            });

            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                // --- HONEYPOT SPAM CHECK ---
                const honeypot = document.getElementById('company_website');
                if (honeypot.value) {
                    // If the hidden field is filled out, it's a bot. 
                    // Pretend it was successful so the bot moves on, but don't save to Firebase.
                    formStatus.className = 'form-status success';
                    formStatus.textContent = "Message sent! We'll get back to you within 24 hours.";
                    formStatus.style.display = 'block';
                    form.reset();
                    return; // Stop execution completely
                }
                // ---------------------------

                let valid = true;
                const name = document.getElementById('name'),
                    email = document.getElementById('email');
                const subject = document.getElementById('subject'),
                    message = document.getElementById('message');

                [name, email, subject, message].forEach(clearFieldError);

                if (!name.value.trim()) {
                    showFieldError(name, 'Name is required');
                    valid = false;
                }
                if (!email.value.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
                    showFieldError(email, 'Valid email required');
                    valid = false;
                }
                if (!subject.value.trim()) {
                    showFieldError(subject, 'Subject is required');
                    valid = false;
                }
                if (!message.value.trim() || message.value.trim().length < 10) {
                    showFieldError(message, 'At least 10 characters');
                    valid = false;
                }
                if (!valid) return;

                const btn = form.querySelector('button[type="submit"]');
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';

                try {
                    // Save directly to Firestore
                    await db.collection('contact_submissions').add({
                        name: name.value,
                        email: email.value,
                        subject: subject.value,
                        message: message.value,
                        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                        status: 'unread' // useful for the dashboard CRM
                    });

                    formStatus.className = 'form-status success';
                    formStatus.textContent = "Message sent! We'll get back to you within 24 hours.";
                    formStatus.style.display = 'block';
                    form.reset();
                } catch (err) {
                    console.error("Firestore error: ", err);
                    formStatus.className = 'form-status error';
                    formStatus.textContent = 'Something went wrong. Please try again or email us directly.';
                    formStatus.style.display = 'block';
                } finally {
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Message';
                    setTimeout(() => formStatus.style.display = 'none', 5000);
                }
            });

            // ---- FAQ Accordion ----
            const faqItems = document.querySelectorAll('.faq-item');
            faqItems.forEach(item => {
                const question = item.querySelector('.faq-question');
                question.addEventListener('click', () => {
                    const isOpen = item.classList.contains('active');
                    faqItems.forEach(i => i.classList.remove('active'));
                    if (!isOpen) {
                        item.classList.add('active');
                    }
                });
            });

            // ---- Cookie Banner ----
            const cookieBanner = document.getElementById('cookieBanner');
            const cookieAccept = document.getElementById('cookieAccept');
            const cookieDecline = document.getElementById('cookieDecline');

            if (!localStorage.getItem('cookieConsent')) {
                setTimeout(() => {
                    cookieBanner.classList.add('show');
                }, 2500);
            }

            cookieAccept.addEventListener('click', () => {
                localStorage.setItem('cookieConsent', 'accepted');
                cookieBanner.classList.remove('show');
            });

            cookieDecline.addEventListener('click', () => {
                localStorage.setItem('cookieConsent', 'declined');
                cookieBanner.classList.remove('show');
            });

            // ---- Release Notes ----
            const releaseNotesModal = document.getElementById('releaseNotesModal');
            const releaseNotesClose = document.getElementById('releaseNotesClose');
            const releaseNotesDismiss = document.getElementById('releaseNotesDismiss');
            const releaseNotesExplore = document.getElementById('releaseNotesExplore');
            const releaseNotesVersion = '2026-08-18';

            function closeReleaseNotes(savePreference = true) {
                if (savePreference) {
                    localStorage.setItem('releaseNotesSeen', releaseNotesVersion);
                }
                releaseNotesModal.classList.remove('show');
            }

            if (localStorage.getItem('releaseNotesSeen') !== releaseNotesVersion) {
                setTimeout(() => releaseNotesModal.classList.add('show'), 1200);
            }

            releaseNotesClose.addEventListener('click', () => closeReleaseNotes());
            releaseNotesDismiss.addEventListener('click', () => closeReleaseNotes());
            releaseNotesExplore.addEventListener('click', () => closeReleaseNotes());
            releaseNotesModal.addEventListener('click', (e) => {
                if (e.target === releaseNotesModal) closeReleaseNotes();
            });
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && releaseNotesModal.classList.contains('show')) {
                    closeReleaseNotes();
                }
            });

            // ---- Project Modal ----
            const modal = document.getElementById('project-modal');
            const modalTitle = document.getElementById('modal-title');
            const modalContent = document.getElementById('modal-content');

            // Use event delegation for dynamically loaded project cards
            document.body.addEventListener('click', async (e) => {
                const btn = e.target.closest('.project-details-btn');
                if (btn) {
                    e.preventDefault();
                    const projectId = btn.dataset.project;

                    // Fetch project details from Firestore
                    const docRef = await db.collection('projects').doc(projectId).get();
                    if (docRef.exists) {
                        const p = docRef.data();
                        modalTitle.textContent = p.title;

                        let tagsHtml = (p.tags || []).map(t => `<span class="tag">${t}</span>`).join('');
                        let linksHtml = '';
                        if (p.liveUrl) linksHtml += `<a href="${p.liveUrl}" target="_blank" style="color: var(--accent); display:block; margin-bottom:10px;">View Live Site <i class="fas fa-external-link-alt"></i></a>`;
                        if (p.githubUrl) linksHtml += `<a href="${p.githubUrl}" target="_blank" style="color: var(--accent); display:block; margin-bottom:10px;">View on GitHub <i class="fab fa-github"></i></a>`;

                        modalContent.innerHTML = `
                            <img src="${p.imageUrl}" alt="${p.title}" style="width: 100%; border-radius: 12px; margin-bottom: 20px;">
                            <p>${p.longDescription || p.description}</p>
                            <div class="tags" style="margin: 20px 0;">${tagsHtml}</div>
                            ${linksHtml}
                        `;

                        modal.classList.add('show');
                        document.body.style.overflow = 'hidden';
                    }
                }
            });

            function closeModal() {
                modal.classList.remove('show');
                document.body.style.overflow = '';
            }

            document.querySelector('.modal-close').addEventListener('click', closeModal);
            modal.addEventListener('click', (e) => {
                if (e.target === modal) closeModal();
            });
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') closeModal();
            });
        });

        // === LIVE CHAT WIDGET ===
        (function () {
            const lcToggle = document.getElementById('lcToggle');
            const lcWindow = document.getElementById('lcWindow');
            const lcClose = document.getElementById('lcClose');
            const lcBody = document.getElementById('lcBody');
            const lcMessages = document.getElementById('lcMessages');
            const lcNameGate = document.getElementById('lcNameGate');
            const lcNameForm = document.getElementById('lcNameForm');
            const lcNameInput = document.getElementById('lcNameInput');
            const lcNameError = document.getElementById('lcNameError');
            const lcFooter = document.getElementById('lcFooter');
            const lcInput = document.getElementById('lcInput');
            let pendingChatMessage = '';

            function setChatReady(name) {
                publicChatName = name;
                localStorage.setItem('publicChatName', publicChatName);
                lcNameGate.hidden = true;
                lcFooter.hidden = false;
            }

            if (publicChatName) {
                setChatReady(publicChatName);
            }

            function showNameGate(message) {
                pendingChatMessage = message || '';
                lcNameGate.hidden = false;
                lcFooter.hidden = true;
                lcNameInput.focus();
            }

            lcNameForm.addEventListener('submit', async function (event) {
                event.preventDefault();
                const name = lcNameInput.value.trim().slice(0, 80);
                if (!name) {
                    lcNameError.textContent = 'Please enter your name to continue.';
                    return;
                }

                const submitButton = lcNameForm.querySelector('button');
                submitButton.disabled = true;
                lcNameError.textContent = '';
                try {
                    const visitor = await ensurePublicChatUser();
                    await db.collection('clients').doc(visitor.uid).set({
                        name: name,
                        visitorId: visitor.uid,
                        status: 'active',
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    }, { merge: true });
                    startChatListener(visitor);
                    setChatReady(name);
                    lcInput.focus();
                    if (pendingChatMessage) {
                        const message = pendingChatMessage;
                        pendingChatMessage = '';
                        handleUserMessage(message);
                    }
                } catch (error) {
                    console.error('Chat setup error:', error);
                    lcNameError.textContent = error.code === 'auth/admin-restricted-operation'
                        ? 'Anonymous chat access is not enabled yet. Please try again later.'
                        : 'Chat is temporarily unavailable. Please try again.';
                } finally {
                    submitButton.disabled = false;
                }
            });
            const lcSend = document.getElementById('lcSend');
            const lcBadge = document.getElementById('lcBadge');

            let isOpen = false;

            const knowledgeEntries = [
                { keywords: ['hello', 'hi', 'hey', 'greetings'], reply: () => "Hello! Welcome to Primetech Designs. Ask me about our services, process, projects, technologies, pricing, or how to get in touch." },
                { keywords: ['who', 'primetech', 'company', 'about', 'business'], reply: () => "Primetech Designs is a Zambian-owned technology company based in Lusaka. We help businesses, schools, and ambitious teams build reliable web platforms, cloud systems, and IT infrastructure. We were founded in 2022 and have a team of 5." },
                { keywords: ['service', 'services', 'offer', 'provide'], reply: () => "Our services are:\n• Web Development: custom websites, web applications, and progressive web apps\n• Cloud Infrastructure: AWS, Google Cloud, and hybrid solutions\n• IT Consulting: technology guidance, system architecture, and transformation roadmaps\n• Security & Compliance: cybersecurity assessments, secure authentication, and data protection" },
                { keywords: ['website', 'web', 'application', 'app', 'pwa', 'development'], reply: () => "We build custom websites, web applications, and progressive web apps using modern frameworks. We can help with discovery, UI/UX, architecture, development, launch, and ongoing support." },
                { keywords: ['cloud', 'aws', 'gcp', 'infrastructure', 'hosting'], reply: () => "We design secure, scalable, and cost-optimized cloud infrastructure using AWS, Google Cloud, and hybrid environments. Managed IT clients can also receive 24/7 cloud infrastructure monitoring." },
                { keywords: ['security', 'cybersecurity', 'compliance', 'authentication', 'privacy'], reply: () => "Our security work includes cybersecurity assessments, secure authentication, and data protection strategies. Security audits are also part of our launch and support process." },
                { keywords: ['consulting', 'architecture', 'strategy', 'roadmap', 'transformation'], reply: () => "Our IT consulting service provides strategic technology guidance, system architecture, and digital transformation roadmaps tailored to your organization." },
                { keywords: ['process', 'steps', 'method', 'build'], reply: () => "Our process has four stages:\n01 Discovery: understand your business, goals, and audience\n02 Design & Architecture: wireframes, UI/UX, and technical planning\n03 Development: agile coding sprints with regular updates\n04 Launch & Support: deployment, security audits, and ongoing maintenance" },
                { keywords: ['long', 'timeline', 'duration', 'weeks', 'take'], reply: () => "A standard informational website usually takes 2-4 weeks. Full-stack applications and custom systems commonly take 6-12 weeks, depending on scope. We establish milestones during planning." },
                { keywords: ['price', 'pricing', 'cost', 'quote', 'budget', 'afford'], reply: () => "Project pricing depends on complexity, features, and timeline. We provide a detailed, transparent custom quote after an initial discovery conversation. Use the contact form to describe what you want to build." },
                { keywords: ['maintenance', 'support', 'launch', 'retainer', 'update'], reply: () => "Yes. We offer flexible monthly maintenance plans to keep systems secure, updated, and running smoothly. Managed IT clients can also receive 24/7 cloud monitoring." },
                { keywords: ['technology', 'technologies', 'stack', 'tool', 'framework', 'react', 'node', 'javascript'], reply: () => "Our toolbox includes React.js, Node.js, AWS, Google Cloud Platform, JavaScript, HTML5, CSS3, and Git. We choose the stack that best fits the project rather than forcing one technology everywhere." },
                { keywords: ['industry', 'industries', 'school', 'education', 'retail', 'healthcare', 'ngo', 'enterprise'], reply: () => "We work with education, retail and SMEs, healthcare, NGOs and programs, and enterprise organizations. Our experience includes school platforms, program management, IoT, and digital infrastructure." },
                { keywords: ['international', 'outside', 'zambia', 'country', 'slack', 'zoom'], reply: () => "Yes. Although Primetech Designs is based in Lusaka, we work with international clients using tools such as Slack, Zoom, and Trello for smooth communication across time zones." },
                { keywords: ['portfolio', 'project', 'projects', 'work', 'case', 'built'], reply: () => {
                    const projects = window.primetechKnowledge.projects;
                    if (!projects.length) return "Our Featured Projects section includes school platforms, IoT solutions, program management systems, and other digital products. Published project details are loaded live on the Portfolio section.";
                    return "Here are some projects currently featured:\n• " + projects.map(project => `${project.title}${project.description ? ': ' + project.description : ''}`).join('\n• ');
                } },
                { keywords: ['team', 'people', 'experts', 'staff', 'founder'], reply: () => {
                    const team = window.primetechKnowledge.team;
                    if (!team.length) return "Our team is made up of developers, designers, and IT specialists in Lusaka. Meet the Experts section shows the current team profiles when available.";
                    return "Meet the Primetech team:\n• " + team.map(member => `${member.name}${member.role ? ' - ' + member.role : ''}`).join('\n• ');
                } },
                { keywords: ['testimonial', 'review', 'client', 'literacy', 'greentech'], reply: () => "Clients describe our work as intuitive, secure, responsive, and professional. Testimonials on the site include work for Literacy Tree School, BlueCode Systems, and GreenTech, covering school administration, program management, and IoT solutions." },
                { keywords: ['insight', 'article', 'blog', 'exam', 'facial', 'supercomputer', 'beowulf'], reply: () => "Our Insights section covers securing examinations with facial recognition and IoT, building a budget Beowulf cluster with Linux and MPI, and the React plus Directus architecture used for school management." },
                { keywords: ['career', 'careers', 'job', 'hiring', 'cv', 'join'], reply: () => "We are interested in passionate developers, designers, and IT specialists in Lusaka. You can send your CV through the Careers section or use the contact form to ask about roles." },
                { keywords: ['contact', 'email', 'phone', 'reach', 'location'], reply: () => {
                    const contact = window.primetechKnowledge.contact;
                    return `You can reach Primetech Designs at:\nEmail: ${contact.email}\nPhone: ${contact.phone}\nLocation: ${contact.location}\nWe aim to respond to contact enquiries within 24 hours.`;
                } },
                { keywords: ['form', 'enquiry', 'inquiry', 'message', 'consultation', 'start', 'idea'], reply: () => "You can start by using the contact form in the Let's Build Together section. Tell us your name, email, subject, and project requirements, and we will respond within 24 hours. You can also continue chatting here." },
                { keywords: ['thank', 'thanks'], reply: () => "You're welcome! Ask me anything else about Primetech Designs, or use the contact form when you're ready to discuss a project." },
                { keywords: ['bye', 'goodbye'], reply: () => "Thanks for chatting with Primetech Designs. Have a great day!" }
            ];

            const quickReplies = [
                "What services do you offer?",
                "How much does it cost?",
                "How can I contact you?"
            ];

            function getTime() {
                const now = new Date();
                let h = now.getHours();
                const m = now.getMinutes().toString().padStart(2, '0');
                const ampm = h >= 12 ? 'PM' : 'AM';
                h = h % 12 || 12;
                return h + ':' + m + ' ' + ampm;
            }

            function renderMessage(msg) {
                const el = document.createElement('div');
                el.className = 'lc-msg lc-msg--' + msg.sender;
                const reactions = Object.entries(msg.reactions || {}).map(([emoji, users]) => `
                    <button class="lc-reaction-pill" type="button" data-emoji="${emoji}">
                        ${emoji} <span>${users.length}</span>
                    </button>`).join('');
                el.innerHTML = msg.text.replace(/\n/g, '<br>')
                    + '<span class="lc-msg__time">' + msg.time + '</span>'
                    + `<div class="lc-reactions">${reactions}</div>`
                    + `<div class="lc-reaction-picker">
                        <button type="button" data-emoji="👍" aria-label="React with thumbs up">👍</button>
                        <button type="button" data-emoji="❤️" aria-label="React with heart">❤️</button>
                        <button type="button" data-emoji="🎉" aria-label="React with celebration">🎉</button>
                    </div>`;
                el.querySelectorAll('.lc-reaction-pill').forEach(button => {
                    button.addEventListener('click', () => addPublicReaction(msg.id, button.dataset.emoji));
                });
                el.querySelectorAll('.lc-reaction-picker button').forEach(button => {
                    button.addEventListener('click', () => addPublicReaction(msg.id, button.dataset.emoji));
                });
                lcMessages.appendChild(el);
                lcMessages.scrollTop = lcMessages.scrollHeight;
            }

            async function addPublicReaction(messageId, emoji) {
                try {
                    const visitor = await ensurePublicChatUser();
                    const messageRef = db.collection('chats').doc('client_' + visitor.uid)
                        .collection('messages').doc(messageId);
                    await messageRef.set({
                        reactions: { [emoji]: firebase.firestore.FieldValue.arrayUnion(publicChatName || 'Visitor') }
                    }, { merge: true });
                } catch (error) {
                    console.error('Reaction error:', error);
                }
            }

            function showTyping() {
                const el = document.createElement('div');
                el.className = 'lc-typing';
                el.id = 'lcTyping';
                el.innerHTML = '<span></span><span></span><span></span>';
                lcMessages.appendChild(el);
                lcMessages.scrollTop = lcMessages.scrollHeight;
            }

            function hideTyping() {
                const el = document.getElementById('lcTyping');
                if (el) el.remove();
            }

            function showQuickReplies() {
                if (document.getElementById('lcQuickReplies')) return;
                const container = document.createElement('div');
                container.className = 'lc-quick-replies';
                container.id = 'lcQuickReplies';
                quickReplies.forEach(function (qr) {
                    const btn = document.createElement('button');
                    btn.className = 'lc-quick';
                    btn.textContent = qr;
                    btn.addEventListener('click', function () {
                        container.remove();
                        handleUserMessage(qr);
                    });
                    container.appendChild(btn);
                });
                lcMessages.appendChild(container);
                lcMessages.scrollTop = lcMessages.scrollHeight;
            }

            function getBotResponse(text) {
                const words = text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean);
                let bestEntry = null;
                let bestScore = 0;
                knowledgeEntries.forEach(entry => {
                    const score = entry.keywords.reduce((total, keyword) => total + (words.includes(keyword) ? 1 : 0), 0);
                    if (score > bestScore) {
                        bestScore = score;
                        bestEntry = entry;
                    }
                });
                if (bestEntry) return bestEntry.reply();
                return "I can help with questions about Primetech Designs' services, process, timelines, pricing, technologies, portfolio, team, careers, or contact details. What would you like to know?";
            }

            async function handleUserMessage(text) {
                const senderName = publicChatName;
                if (!senderName) {
                    showNameGate(text);
                    return;
                }
                        renderMessage({ text: text, sender: 'user', time: getTime(), id: 'pending-' + Date.now() });
                try {
                    const visitor = await ensurePublicChatUser();
                    const chatId = 'client_' + visitor.uid;
                    await db.collection('clients').doc(visitor.uid).set({
                        name: senderName,
                        visitorId: visitor.uid,
                        status: 'active',
                        lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    }, { merge: true });
                    await db.collection('chats').doc(chatId).collection('messages').add({
                        text: text,
                        sender: "Client",
                        senderName: senderName,
                        visitorId: visitor.uid,
                        timestamp: firebase.firestore.FieldValue.serverTimestamp()
                    });

                    const botReply = getBotResponse(text);
                    if (botReply) {
                        showTyping();
                        setTimeout(async function () {
                            try {
                                hideTyping();
                                await db.collection('clients').doc(visitor.uid).set({
                            lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
                            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                                }, { merge: true });
                                await db.collection('chats').doc(chatId).collection('messages').add({
                            text: botReply,
                            sender: "Bot",
                            senderName: 'Primetech Assistant',
                            visitorId: visitor.uid,
                            timestamp: firebase.firestore.FieldValue.serverTimestamp()
                                });
                            } catch (error) {
                                hideTyping();
                                console.error('Bot reply error:', error);
                                renderMessage({ text: 'I am having trouble replying right now. Please try again.', sender: 'bot', time: getTime() });
                            }
                        }, 800 + Math.random() * 700);
                    }
                } catch (error) {
                    console.error('Message send error:', error);
                    const message = error.code === 'auth/admin-restricted-operation'
                        ? 'Chat setup is not enabled yet. Please try again later.'
                        : 'Your message could not be sent. Please try again.';
                    renderMessage({ text: message, sender: 'bot', time: getTime() });
                }
            }

            function startChatListener(user) {
                if (publicChatListenerStarted || !user || !user.isAnonymous) return;
                publicChatListenerStarted = true;
                const chatId = 'client_' + user.uid;
                db.collection('chats').doc(chatId).collection('messages').orderBy('timestamp').onSnapshot(snapshot => {
                    lcMessages.innerHTML = '';
                    snapshot.forEach(doc => {
                        const m = doc.data();
                        const time = m.timestamp ? new Date(m.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...';
                        const sender = (m.sender === "Client") ? 'user' : 'bot';
                        renderMessage({ text: m.text, sender: sender, time: time, id: doc.id, reactions: m.reactions });
                    });
                    if (snapshot.empty) {
                        renderMessage({ text: "Hi there! 👋 Welcome to Primetech Designs. How can we help you today?", sender: 'bot', time: getTime(), id: 'welcome' });
                        setTimeout(showQuickReplies, 600);
                    }
                }, error => {
                    console.error('Live chat listener error:', error);
                });
            }

            renderMessage({ text: "Hi there! 👋 Welcome to Primetech Designs. How can we help you today?", sender: 'bot', time: getTime(), id: 'welcome' });
            setTimeout(showQuickReplies, 600);

            firebase.auth().onAuthStateChanged(user => {
                if (user && user.isAnonymous) {
                    publicChatUser = user;
                    startChatListener(user);
                    return;
                }

                if (!user && publicChatName) {
                    ensurePublicChatUser().catch(error => {
                        console.error('Anonymous chat authentication error:', error);
                    });
                }
            });

            function openChat() {
                lcWindow.classList.add('open');
                lcToggle.classList.add('hidden');
                lcBadge.classList.add('hidden');
                isOpen = true;
                setTimeout(function () { lcInput.focus(); }, 350);
            }

            function closeChat() {
                lcWindow.classList.remove('open');
                lcToggle.classList.remove('hidden');
                isOpen = false;
            }

            lcToggle.addEventListener('click', function () { if (isOpen) closeChat(); else openChat(); });
            lcClose.addEventListener('click', closeChat);
            
            const lcMinimize = document.getElementById('lcMinimize');
            if (lcMinimize) {
                lcMinimize.addEventListener('click', function() {
                    // Shrink back to the floating bubble but keep chat active in background
                    lcWindow.classList.remove('open');
                    lcToggle.classList.remove('hidden');
                    isOpen = false;
                });
            }

            function sendMessage() {
                const text = lcInput.value.trim();
                if (!text) return;
                const qr = document.getElementById('lcQuickReplies');
                if (qr) qr.remove();
                lcInput.value = '';
                handleUserMessage(text);
            }

            lcSend.addEventListener('click', sendMessage);

            lcInput.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                }
            });
        })();
        // END LIVE CHAT WIDGET
