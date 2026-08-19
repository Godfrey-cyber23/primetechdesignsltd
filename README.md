# Primetech Designs

Professional portfolio and operations platform for Primetech Designs, a Zambian technology company based in Lusaka. The project combines a responsive public-facing website with a Firebase-powered internal dashboard for managing leads, content, projects, and team communication.

## Overview

The public site presents Primetech Designs' capabilities in web development, cloud infrastructure, IT consulting, and security and compliance. It is built as a lightweight static site and includes:

- Responsive navigation with mobile menu support
- Dark and light themes with system preference detection
- Animated hero canvas, parallax effects, counters, typing text, and scroll reveals
- Company profile, team, services, portfolio, process, technology stack, testimonials, FAQ, insights, careers, and contact sections
- Dynamic team and portfolio content loaded from Firestore
- Contact and lead submission workflows connected to the internal dashboard
- SEO metadata, Open Graph tags, sitemap, robots directives, and web app manifest

The internal **Primetech OS** dashboard is available under `/admin` and provides authenticated operational tools, including:

- Website traffic and lead overview
- Client messages and team chat
- Site settings, portfolio, team member, and lead management
- Project registration and project document forms
- Quotation calculations and PDF generation
- Firebase Authentication with email, Google, and phone sign-in flows

## Technology

- HTML5, CSS3, and vanilla JavaScript
- Firebase Authentication and Cloud Firestore
- Chart.js for dashboard visualizations
- jsPDF for generated project documents
- Font Awesome for interface icons
- Google Fonts for typography
- Google Analytics 4 for site analytics
- Cloudinary and external image assets for selected media

There is no build step or package manager configuration in this repository. The site can be served directly by any static web server.

## Project Structure

```text
.
├── index.html                 # Public portfolio site
├── 404.html                   # Not-found page
├── 500.html                   # Server-error page
├── admin/
│   ├── dashboard.html         # Primetech OS dashboard
│   ├── login.html             # Firebase Authentication entry point
├── assets/
│   ├── css/
│   │   ├── dashboard.css      # Dashboard styles
│   │   ├── project-forms.css  # Project form styles
│   │   └── site.css           # Public site styles
│   ├── images/                # Branding and local media assets
│   └── js/
│       ├── auth.js            # Firebase Authentication flows
│       ├── dashboard.js       # Dashboard behavior and data management
│       └── site.js            # Public site behavior and Firebase data loading
├── docs/
│   ├── administration/        # Dashboard and project-form documentation
│   └── development/           # Development configuration references
├── firestore.rules             # Baseline Firestore access-control rules
├── firebase.json               # Firebase CLI rules configuration
├── .gitignore                  # Local, generated, and environment exclusions
├── robots.txt
├── sitemap.xml
└── site.webmanifest
```

## Run Locally

Because the project uses browser modules and Firebase services, serve it through a local HTTP server rather than opening `index.html` directly.

Using Python:

```bash
python3 -m http.server 8000
```

Then open:

- Public site: `http://localhost:8000/`
- Admin login: `http://localhost:8000/admin/login.html`

Any other static server can be used, including the preview server built into a code editor or a hosting provider.

## Firebase Configuration

The public site and admin pages initialize the Firebase project used by Primetech OS. Before deploying a new environment:

1. Create or select a Firebase project.
2. Enable Authentication providers required by the login page.
3. Enable Cloud Firestore.
4. Update the Firebase configuration in `assets/js/site.js`, `assets/js/auth.js`, and the admin scripts as needed.
5. Configure the authorized domains in Firebase Authentication.
6. Create the required Firestore collections and seed any site settings, team, or portfolio data.

The browser configuration reference is stored at [docs/development/firebase-client-config.example.js](docs/development/firebase-client-config.example.js). The Firestore baseline rules are stored at [firestore.rules](firestore.rules); review and deploy them with Firebase CLI after configuring an `admin` custom claim for authorized dashboard users.

### Dashboard Approval Flow

Dashboard accounts are stored in `admin_users/{uid}`. Email, Google, and phone signups create a profile with `status: "pending"` and are signed out immediately. The bootstrap administrator can approve or reject requests, assign roles, suspend or restore members, and review activity from the Admin Command Center before an account can enter `admin/dashboard.html`. Anonymous Firebase Authentication must also be enabled for the public named live-chat flow.

The Admin Command Center also stores assigned work in `tasks/{taskId}` and immutable administrative activity in `admin_audit_logs/{logId}`. Only the bootstrap administrator can create or delete tasks, change member access, or write audit entries; approved members can read tasks and update the status of tasks assigned to them.

Administration requires Firebase password reauthentication and the dashboard signs out after 15 minutes without activity. Login shows three-attempt lock feedback and honors `admin_users/{uid}.loginLocked`; the super administrator can clear that field from the Command Center. A durable lock triggered by failed credentials must be implemented in a trusted Firebase Cloud Function using the Admin SDK, because unauthenticated browser code cannot safely update an account after a failed password attempt.

The initial system administrator is the Firebase user with UID `sJSLqnZTFvcnubHnNyl1NJlMHy52` (`godfreyb998@gmail.com`). This UID is treated as the bootstrap administrator by the client approval flow and Firestore rules. Remove or replace this bootstrap exception after a permanent administrator-claims workflow is established.

Public chat visitors are stored in `clients/{visitorUid}` and their conversations are separated into `chats/client_{visitorUid}/messages`. Approved dashboard users can archive, restore, or permanently delete a client and the client's conversation from the Client Messages view.

The project forms module uses these Firestore paths:

```text
projects/{projectDocId}
projects/{projectDocId}/forms/{formId}
project_counters/{year}
```

## Deployment

This repository is suitable for static hosting providers such as Vercel, Netlify, GitHub Pages, or Firebase Hosting.

For a deployment:

1. Point the host at the repository root.
2. Use no build command.
3. Publish the repository root as the output directory.
4. Configure the host's fallback and error-page behavior for `404.html` and `500.html`.
5. Add the production domain to Firebase Authentication's authorized domains.
6. Verify public Firestore reads, contact submissions, admin authentication, and dashboard data access after deployment.

## Security Requirements

Firebase client configuration values are not a replacement for access control. Before using the admin dashboard in production:

- Require authenticated admin users for dashboard reads and writes.
- Add and test restrictive Firestore Security Rules.
- Allow unauthenticated visitors to create only the specific public submissions they need to create.
- Prevent public reads of client messages, leads, project records, team chat, and internal settings.
- Review Firebase Authentication providers and remove any sign-up method that should not be public.
- Add spam protection to public contact forms, such as a honeypot or reCAPTCHA.
- Review file-upload permissions and validate uploaded file types and sizes.
- Treat project-form contract language as a draft until it has been legally reviewed.

The committed rules allow public reads and creates for the current bot-chat flow, while restricting message edits and deletes to authenticated users. Because the current helper treats every authenticated user as an administrator, replace it with a custom-claims check before production use.

The project notes in [docs/administration/project-forms.md](docs/administration/project-forms.md) include additional warnings for the project forms module.

## Content and Maintenance

Public team and portfolio content is designed to be managed from the dashboard when the corresponding Firestore data is available. Static copy, metadata, layout, and visual behavior can be updated in `index.html`, `assets/css/site.css`, and `assets/js/site.js`.

When making changes, test both the public site and `/admin` at desktop and mobile widths. Pay particular attention to Firebase permissions, contact submissions, dynamic content fallbacks, authentication redirects, and external image or CDN availability.

## License

No open-source license has been declared for this project. Unless the repository owner states otherwise, the source and brand assets should be treated as proprietary to Primetech Designs.
