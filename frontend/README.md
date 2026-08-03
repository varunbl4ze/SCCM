# Civic Registry — Frontend

A complete, responsive frontend for the Civic Complaint Management System, built with HTML5, CSS3, vanilla ES6 JavaScript, Bootstrap 5, Font Awesome, and Chart.js (admin dashboard only). No build step, no framework — open the files directly or serve them statically.

## Folder structure

```
frontend/
├── index.html              Landing page (hero, about, features, stats, CTA)
├── login.html               Login
├── register.html            Registration
├── dashboard.html            Citizen dashboard
├── complaint.html            Raise a complaint
├── tracking.html             Track / search / filter my complaints
├── complaint-details.html    Single complaint: timeline, department, comments
├── profile.html               View/edit profile, change password
├── admin.html                 Admin console: stats, charts, management table
├── css/
│   ├── style.css            Design tokens, nav, hero, cards, buttons, footer
│   ├── forms.css            Login/register/complaint/profile form styling
│   ├── dashboard.css        App shell: sidebar, stat cards, tables, timeline
│   └── responsive.css       Mobile/tablet overrides
├── js/
│   ├── api.js               All Fetch calls to the Flask backend live here
│   ├── auth.js               Session storage, route guards, login/register forms
│   ├── utils.js               Toasts, formatting, status badges, validation
│   ├── dashboard.js           Citizen dashboard logic
│   ├── complaint.js           Raise-complaint form logic
│   ├── tracking.js            Complaint list, search, filters
│   ├── complaint-details.js   Single complaint view
│   ├── profile.js             Profile view/edit + change password
│   └── admin.js               Admin stats, Chart.js charts, management table
├── assets/
│   ├── images/               (empty — drop any content images here)
│   ├── icons/                (empty — Font Awesome is loaded via CDN)
│   └── logo/civic-seal.svg   The brand mark used in the navbar
└── README.md
```

## Running it

This is a static site — no build tools required.

1. Start your Flask backend (see the `civic_backend` project) so it's running at `http://127.0.0.1:5000`.
2. Serve the `frontend/` folder with any static server, for example:
   ```bash
   cd frontend
   python -m http.server 5500
   ```
3. Open `http://127.0.0.1:5500/index.html` in your browser.

**Important:** opening the HTML files directly via `file://` will work for layout, but some browsers block `fetch()` calls from `file://` origins. Serving over `http://` (as above) avoids that.

### Pointing at a different backend

Every API call goes through one constant. Open `js/api.js` and change:
```js
const API_BASE_URL = 'http://127.0.0.1:5000/api';
```

## Backend endpoints this frontend uses

| Endpoint | Used by |
|---|---|
| `POST /api/auth/register` | register.html |
| `POST /api/auth/login` | login.html |
| `GET /api/auth/me` | profile.html (session refresh) |
| `POST /api/complaints/` | complaint.html |
| `GET /api/complaints/?status=&user_id=&category=` | dashboard, tracking, admin |
| `GET /api/complaints/<id>` | complaint-details.html |
| `PUT/PATCH /api/complaints/<id>` | (available via `API.complaints.update`, not currently called by any page — free to wire up an "edit complaint" flow) |
| `PATCH /api/complaints/<id>/status` | admin.html |
| `DELETE /api/complaints/<id>` | complaint-details.html (withdraw), admin.html (delete) |

## Features flagged as "not yet connected"

The brief asked for a few features the current Flask backend doesn't expose endpoints for. Rather than fake them, the frontend clearly marks each one in the UI and in code (search for `TODO: backend` across `js/`):

- **Photo upload** (`complaint.html`) — the image is previewed client-side via `FileReader`, but there's no `POST /api/complaints/<id>/image` route yet to persist it. Wire it up in `js/complaint.js` → `initImageUpload()` and `API.images.upload()` in `js/api.js`.
- **Comments** (`complaint-details.html`) — shows an empty state. Wire up `API.comments.list()` / `API.comments.add()` in `js/api.js` once a comments route exists.
- **Profile editing & change password** (`profile.html`) — the forms validate and call `API.profile.update()` / `API.profile.changePassword()`, which currently throw a clear "not available" error that the UI surfaces as a toast (edits still preview locally so the form doesn't feel broken). Wire up a `PATCH /api/auth/me` and a change-password route to make these real.
- **Department field** — the `Complaint` model has no `department` column yet, so the frontend derives a department label from `category` via `categoryToDepartment()` in `js/utils.js`. Swap this for a real field the moment the backend adds one.
- **Role-based API access** — `admin.html` is gated client-side by `requireAdmin()` (checks `user.role` from the JWT), but the underlying `/api/complaints/` routes don't currently enforce role checks server-side. Anyone with a valid token can currently call any complaint endpoint. Add role checks in the Flask routes before shipping this to production.

## Design notes

- Palette and type tokens are defined as CSS custom properties at the top of `css/style.css` — change them there, not in individual pages.
- Every complaint is shown with a derived "docket number" (`CCR-<year>-<padded id>`) via `docketId()` in `js/utils.js`. This is a display-only transform — API calls always use the real numeric `id`.
- Status colors are centralized as `.status-badge.status-<value>` classes in `css/style.css`; the four values are `pending`, `in_progress`, `resolved`, `rejected` (matching the backend's `Complaint.VALID_STATUSES`).
