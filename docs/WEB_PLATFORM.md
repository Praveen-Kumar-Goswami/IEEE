# Clinician web platform

The web platform is the staff side of the smart dressing indicator. Patients use the Android app in `mobile`. Doctors, nurses and admins use the site in `web`. The product name on the site is **Tend**; it is one constant in `web/lib/brand.ts`.

The platform keeps the project rule from the README: alerts say that a monitoring indicator changed and that clinical review is recommended. Nothing on the site says an infection was detected or that a site was diagnosed. Where the brief asked for "risk", the site shows **review priority** (Low, Medium, High, Critical). Review priority is derived from open indicators and device state, and it ranks the review queue. It is not a clinical risk score.

## 1. Sitemap

```
/                         Landing (10 sections + footer)
  #how-it-works           03 System sequence
  #platform               04 Live monitoring
  #technology             07 Technology layers
  #security               08 Security
  #about                  10 Final call to action + footer
/login                    Staff sign in (Supabase Auth, or demo accounts)
/unauthorized             Wrong role, or a patient account on the staff site
/doctor                   Overview
  /patients               Patient list
  /patients/[patientId]   Patient record: Overview, Live data, History, Treatment, Notes, Reports
  /monitoring             Live monitoring wall
  /alerts                 Indicator queue
  /appointments           Week agenda
  /reports                Report builder and export
  /messages               Care team messages
  /notifications          Notification center
  /profile                Profile
  /settings               Preferences
/nurse                    Overview
  /patients               Assigned patients
  /patients/[patientId]   Patient record: Overview, Live data, History, Notes
  /tasks                  Today's tasks
  /monitoring             Live monitoring wall
  /measurements           Patient check-in workflow
  /alerts                 Indicator queue
  /messages, /notifications, /profile
/admin                    System overview
  /doctors, /nurses       Staff tables
  /patients               All patients and assignments
  /devices                Device fleet
  /facilities             Facilities
  /approvals              Access requests
  /analytics              Platform analytics
  /reports                Reports
  /audit                  Audit log
  /security               Roles, permissions, policies
  /integrations           API, database, gateway app
  /settings               Alert thresholds and platform settings
```

## 2. User flows

**Visitor.** Preloader (skippable, shortened on repeat visits) → hero → story sections → "Enter Platform" → `/login`.

**Sign in.** Email and password → Supabase Auth → role read from `app_metadata.role` (written by the `sync_profile_claims` trigger, never from signup metadata) → redirect: doctor → `/doctor`, nurse → `/nurse`, admin → `/admin`. A patient account is sent to `/unauthorized` with a pointer to the Android app. In demo mode (no Supabase variables), the login page offers the three seeded staff accounts.

**Route protection.** `proxy.ts` checks every `/doctor`, `/nurse` and `/admin` request. No session → `/login?next=…`. Wrong role → `/unauthorized`. Each role layout checks again on the server, and `RoleGuard` hides actions the role cannot take.

**Indicator lifecycle.**

```
reading synced → rule crossed → indicator opened (open)
  → nurse or doctor notified (realtime + notifications row)
  → acknowledged (acknowledged_by, acknowledged_at)
  → optional: nurse notifies doctor (notification + audit row)
  → note written (clinical_notes, wording checked)
  → resolved (resolved_at)
```

**Nurse check-in.** Select patient → record measurements (body temperature, pain score, dressing condition, device secure) → notes → confirm → save → success state → task auto-completes if one was linked.

**Admin approval.** Access request → view details → approve (role set through the Lambda `/v1/admin/roles`, which calls `set_profile_role`) or reject with a reason → audit row.

## 3. Component hierarchy

```
RootLayout
├─ Providers (QueryClient, DataService, Session, Toaster)
├─ Atmosphere (grain, noise, gradients)       – fixed, pointer-events none
├─ Cursor                                     – desktop, fine pointer only
├─ TransitionLayer (view transitions / curtain fallback)
└─ route
   ├─ Landing
   │  ├─ Preloader
   │  ├─ Navbar ─ MobileMenu
   │  ├─ SmoothScroll (ScrollSmoother, desktop)
   │  ├─ Hero ─ HeroScene (R3F: DressingModel, DataParticles, TelemetryLabels)
   │  ├─ Problem (pinned word scrub)
   │  ├─ SystemSequence ─ SystemScene (R3F: stage nodes, flow particles, camera rail)
   │  ├─ LiveMonitoring (mask expansion → MonitorPanel)
   │  ├─ RoleEcosystem ─ RoleCard ×3
   │  ├─ Workflow (SVG flow + motion-path packets)
   │  ├─ Technology ─ StackScene (R3F) + LayerAccordion
   │  ├─ Security ─ ShieldScene (R3F) + SecurityPrinciples
   │  ├─ Analytics ─ AnalyticsPreview (SVG charts)
   │  ├─ FinalCta
   │  └─ Footer
   ├─ Login ─ LoginForm, DemoAccountPicker
   └─ DashboardShell (role layout)
      ├─ Sidebar (nav config per role, animated active indicator)
      ├─ Header (Search → CommandPalette, date, NotificationsMenu, StatusMenu)
      ├─ RealtimeBridge (subscription → live store, query invalidation, toasts)
      └─ page (feature views)
         ├─ patients:      PatientTable, PatientCard, PatientHeader, PatientTabs
         ├─ monitoring:    LiveChart, MonitorWall, MonitorTile, RangeTabs
         ├─ alerts:        AlertQueue, AlertCard
         ├─ timeline:      PatientTimeline
         ├─ notes:         NoteComposer, NoteList
         ├─ tasks:         TaskBoard, TaskRow
         ├─ checkin:       CheckInFlow (Stepper)
         ├─ appointments:  WeekAgenda
         ├─ reports:       ReportsView, ReportPreview, exporters
         ├─ messages:      MessagesView
         ├─ notifications: NotificationList
         ├─ account:       ProfileView, SettingsView
         └─ admin:         SystemStatus, HealthPanel, UsersTable, DevicesTable,
                           Facilities, Approvals, AuditLog, Analytics, SecurityMatrix,
                           Integrations, PlatformSettings
```

Shared UI in `components/ui`: Button, MagneticButton, IconButton, Card, MetricCard, Badge, StatusDot, Tabs, SegmentedControl, Modal, Drawer, Tooltip, Dropdown, Toast, DataTable, Search, Pagination, EmptyState, Skeleton, LoadingState, ErrorState, Input, Textarea, Select, Switch, Avatar, CountUp, Kbd, Timeline, Chart primitives, RoleGuard.

## 4. Design system

Tokens live in `web/app/globals.css` (`@theme`, CSS variables) and are mirrored for JavaScript in `web/lib/design/tokens.ts`.

| Group | Values |
| --- | --- |
| Surface | void `#07080A`, graphite 950 `#0B0C0E` → 100 `#DEDFE0` |
| Text | bone `#EDEAE4` (primary), ivory `#F5F2EC`, muted graphite 300/400 |
| Signal accent | mint `#74D8C0`, deep `#2A9C83` – used for live state only |
| Status | normal mint, watch `#E9B861`, attention `#F27A62`, critical `#F0545C`, info `#8AB4F8`, offline graphite 400 |
| Type | Geist (variable 100–900) for display and UI, Instrument Serif italic for editorial accents, Geist Mono for telemetry |
| Scale | display-xl `clamp(3.5rem, 10.5vw, 11.5rem)` down to micro `0.6875rem` mono, 0.14em tracking |
| Space | 4 px base; section rhythm `clamp(7rem, 16vw, 15rem)` |
| Grid | 12 columns, gutter `clamp(1rem, 2vw, 2rem)`, margin `clamp(1.25rem, 4vw, 4rem)`, max 1680 px |
| Radius | xs 4, sm 8, md 12, lg 18, xl 28, pill |
| Shadow | e1–e3 tuned for dark surfaces, `glow-signal` for live elements |
| Blur | sm 8, md 16, lg 32 |
| z-index | base 0, raised 10, sticky 100, nav 200, drawer 300, modal 400, toast 500, command 600, grain 800, cursor 900, loader 1000 |
| Breakpoints | sm 640, md 768, lg 1024, xl 1280, 2xl 1536, 3xl 1920 |

Accent use is rationed: mint marks something live or connected, amber and coral mark indicators. Everything else is graphite and bone.

## 5. Animation system

| Tier | Duration | Use | Ease |
| --- | --- | --- | --- |
| Micro | 120 / 180 / 240 ms | buttons, icons, toggles, tooltips | `cubic-bezier(0.25, 1, 0.5, 1)` (quart out) |
| Standard | 320 / 480 / 680 ms | cards, drawers, modals, menus, navigation | `cubic-bezier(0.16, 1, 0.3, 1)` (expo out) |
| Cinematic | 900 / 1300 / 1700 ms | hero, section reveals, 3D sequences | `cubic-bezier(0.65, 0, 0.35, 1)` (in-out) and expo out |

Rules:

- GSAP drives cinematic and scroll work (ScrollTrigger, SplitText, DrawSVG, MotionPath, ScrollSmoother). Motion drives component state (presence, layout, springs). CSS handles micro hover states.
- Linear easing only for things that are physically constant: scrubbed scroll, ticking clocks, particles drifting.
- Every timeline is created inside `useGSAP` so it is reverted on unmount.
- Only three landing sections pin: Problem, System sequence, and the Live monitoring mask.
- `prefers-reduced-motion`: no smooth scroll, no pins, no scrubbed 3D; content is shown in its final state and 3D scenes render one still frame. Users can also switch to reduced motion in Settings.

## 6. 3D interaction plan

| Scene | Content | Interaction | Budget |
| --- | --- | --- | --- |
| Hero | Layered smart dressing: film, absorbent pad, flex sensor layer (DS18B20 probe, BME280, copper electrodes, ESP32 module), contact layer. Luminous trace shader, 420 drifting particles, Lightformer environment, contact shadows, subtle bloom. | Pointer parallax on model and camera, scroll rotates and separates layers, device orientation on phones. Telemetry labels anchored to sensor nodes. | ≤ 60 draw calls, DPR ≤ 1.75 |
| System sequence | Five stations on a curve: dressing, phone gateway, processing sphere, threshold ring, care team, record ledger. | Scroll scrubs a camera rail; flow particles advance only as far as the active step. Ends on a screen that the DOM dashboard expands out of. | 1 200 particles desktop, 300 mobile |
| Technology | Six stacked plates. | Selecting a layer (plate or list) lifts and lights it. | static geometry |
| Security | Core, geodesic shell with Fresnel shader, three orbit rings. | Hovering a principle lights its part of the structure. | < 20 draw calls |

Every canvas is loaded with `next/dynamic` (no SSR), mounted when it nears the viewport, and paused (`frameloop="never"`) when it leaves. Device tier (`useDeviceTier`) lowers DPR, particle counts, transmission and bloom on mobile and low-memory devices. Without WebGL, each scene renders an SVG fallback with the same composition. Geometry is procedural, so there are no models to download; if a GLB is added later, `useGLTF` with the Draco decoder is already the loading path.

## 7. Database

Existing tables (migrations `20260922190000`–`190002`): `profiles`, `patient_profiles`, `clinician_patient_assignments`, `devices`, `monitoring_sessions`, `sensor_readings`, `alert_rules`, `indicator_alerts`, `clinical_notes`, `device_events`, `audit_logs`.

Added by `20260923090000_clinician_platform.sql`:

| Table | Purpose | Key relations |
| --- | --- | --- |
| `facilities` | Wards and units | – |
| `staff_profiles` | Department, title, facility, account status for staff | `profiles` 1:1 |
| `patient_profiles` (+ columns) | `facility_id`, `room_label` | `facilities` |
| `care_tasks` | Nurse and doctor tasks | patient, assignee, creator, optional alert |
| `patient_checkins` | Manual measurements from a nurse | patient, nurse, session, optional task |
| `care_plans` | Dressing and review plan per patient | patient, author |
| `appointments` | Reviews and dressing changes | patient, clinician |
| `notifications` | Per-recipient inbox | recipient, entity |
| `messages` | Care team messages | sender, recipient, optional patient |
| `reports` | Export requests and generated files | creator, optional patient |
| `access_requests` | Staff access approvals | requester, reviewer |

All ids are UUIDs and every table has `created_at` (and `updated_at` where rows change). Auth identity stays in `auth.users`; profile data stays in `profiles` and the role tables. RLS is enabled and forced on every new table: staff see rows for patients on an active assignment, recipients see their own notifications and messages, admins see everything, and nobody can edit an audit row. The view `patient_monitoring_overview` (`security_invoker`) feeds patient tables, and `reading_buckets()` returns downsampled series for charts. New indicator alerts create notifications for the assigned team through a trigger.

Realtime publication: `sensor_readings`, `indicator_alerts`, `devices` (existing) plus `patient_profiles`, `care_tasks`, `notifications`, `messages`, `access_requests`.

## 8. Folder architecture

```
web/
  proxy.ts                 route protection (Next 16 proxy)
  app/                     routes only; pages compose feature views
  components/
    ui/                    design-system primitives
    cursor/                cursor system
    layout/                navbar, footer, logo, atmosphere, preloader, transitions
    charts/                SVG and Recharts primitives
    three/                 canvas shell, fallbacks, shared shaders
  features/
    landing/               sections/, scenes/
    auth/                  login, session, role guard
    dashboard/             shell, sidebar, header, command palette, nav config
    patients/ monitoring/ alerts/ tasks/ checkin/ appointments/
    reports/ messages/ notifications/ account/ admin/
  hooks/                   motion, pointer, viewport, device tier hooks
  lib/                     brand, env, design tokens, gsap setup, supabase clients, auth
  services/
    data/                  DataService interface, demo/, supabase/
    realtime/              RealtimeSource interface, demo simulator, supabase channels
  stores/                  zustand: live data, ui, cursor, preferences, toasts
  types/                   domain types
  utils/                   formatting, math, csv
```

Demo data and real services are separate implementations of the same `DataService` and `RealtimeSource` interfaces. Demo mode is on when `NEXT_PUBLIC_SUPABASE_URL` is missing or `NEXT_PUBLIC_DEMO_MODE=true`. The demo signal is a deterministic model of each simulated dressing plus a finite script of events (a moisture crossing, a device dropping offline and returning), so a given minute always shows the same values.

## 9. Milestones

| Phase | Output |
| --- | --- |
| 01 | Tokens, type scale, grid, motion tokens |
| 02 | Landing structure, navigation, footer |
| 03 | Hero, dressing model, particles, telemetry |
| 04 | Problem, system sequence, live monitoring, workflow, technology, security, analytics, CTA |
| 05 | Cursor, magnetic interactions, preloader, route transitions |
| 06 | Login, Supabase Auth, proxy, role redirects |
| 07 | Dashboard shell, command palette, notifications, toasts |
| 08 | Doctor workspace |
| 09 | Nurse workspace |
| 10 | Admin workspace |
| 11 | Supabase data service and migration |
| 12 | Realtime sources and bridge |
| 13 | Mobile layouts and reduced effects |
| 14 | Keyboard, focus, ARIA, reduced motion |
| 15 | Lazy 3D, pausing, code splitting |
| 16 | Build, type check, browser QA at desktop, tablet and mobile widths |
