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
  
        document.addEventListener('DOMContentLoaded', () => {

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
            const lcInput = document.getElementById('lcInput');
            const lcSend = document.getElementById('lcSend');
            const lcBadge = document.getElementById('lcBadge');

            let isOpen = false;

            const responses = [
                { keywords: ['hello', 'hi', 'hey', 'greetings'], reply: "Hello! 👋 Welcome to Primetech Designs. How can I help you today?" },
                { keywords: ['service', 'services', 'offer'], reply: "We offer:\n• Web Development\n• Cloud Infrastructure\n• IT Consulting\n• Security & Compliance" },
                { keywords: ['price', 'pricing', 'cost', 'quote'], reply: "Pricing depends on your project scope. Could you share what you're looking to build? You can also use the contact form on this page." },
                { keywords: ['contact', 'email', 'phone'], reply: "You can reach us at:\n📧 info@primetechdesigns.com\n📞 +260 975755276\n📍 Lusaka, Zambia" },
                { keywords: ['portfolio', 'work', 'projects'], reply: "Check out our Featured Projects section above! We've built school platforms, IoT systems, and more." },
                { keywords: ['thank', 'thanks'], reply: "You're welcome! 😊 Is there anything else I can help you with?" },
                { keywords: ['bye', 'goodbye'], reply: "Thanks for chatting with us! Have a great day! 👋" }
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
                el.innerHTML = msg.text.replace(/\n/g, '<br>') + '<span class="lc-msg__time">' + msg.time + '</span>';
                lcBody.appendChild(el);
                lcBody.scrollTop = lcBody.scrollHeight;
            }

            function showTyping() {
                const el = document.createElement('div');
                el.className = 'lc-typing';
                el.id = 'lcTyping';
                el.innerHTML = '<span></span><span></span><span></span>';
                lcBody.appendChild(el);
                lcBody.scrollTop = lcBody.scrollHeight;
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
                lcBody.appendChild(container);
                lcBody.scrollTop = lcBody.scrollHeight;
            }

            function getBotResponse(text) {
                const lower = text.toLowerCase();
                for (let i = 0; i < responses.length; i++) {
                    const r = responses[i];
                    for (let j = 0; j < r.keywords.length; j++) {
                        if (lower.indexOf(r.keywords[j]) !== -1) return r.reply;
                    }
                }
                return null;
            }

            async function handleUserMessage(text) {
                await db.collection('chats').doc('client').collection('messages').add({
                    text: text,
                    sender: "Client",
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });

                const botReply = getBotResponse(text);
                if (botReply) {
                    showTyping();
                    setTimeout(async function () {
                        hideTyping();
                        await db.collection('chats').doc('client').collection('messages').add({
                            text: botReply,
                            sender: "Bot",
                            timestamp: firebase.firestore.FieldValue.serverTimestamp()
                        });
                    }, 800 + Math.random() * 700);
                }
            }

            db.collection('chats').doc('client').collection('messages').orderBy('timestamp').onSnapshot(snapshot => {
                lcBody.innerHTML = '';

                if (snapshot.empty) {
                    renderMessage({ text: "Hi there! 👋 Welcome to Primetech Designs. How can we help you today?", sender: 'bot', time: getTime() });
                    setTimeout(showQuickReplies, 600);
                    return;
                }

                snapshot.forEach(doc => {
                    const m = doc.data();
                    const time = m.timestamp ? new Date(m.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...';
                    const sender = (m.sender === "Client") ? 'user' : 'bot';
                    renderMessage({ text: m.text, sender: sender, time: time });
                });
                lcBody.scrollTop = lcBody.scrollHeight;
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
