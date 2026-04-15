# CHAMPIONTRACKPRO — ARCHITECTURE DNA
**Generated:** 2026-03-17
**Codebase Scan Depth:** Complete — all .ts/.tsx/.js files (excluding node_modules, dist, .expo)
**Total Features Identified:** 87

---

## SECTION 1 — FILE INVENTORY

### Active Application Files (Production)

| Path | Purpose | Layer | Lines (est.) | Key Exports/Functions |
|------|---------|-------|-------------|----------------------|
| `App.js` | App entry point (web), loads StitchNavigator | FE | ~60 | default App |
| `index.js` | Native entry point, registers App | FE | ~10 | AppRegistry |
| `index.web.js` | Web entry point | FE | ~10 | render |
| `app.config.js` | Expo config | INFRA | ~20 | expo config |
| `app.json` | Expo manifest (slug, bundle ids) | INFRA | 39 | expo config |
| `package.json` | Dependencies + build scripts | INFRA | 63 | npm scripts |
| `firestore.rules` | Firestore security rules | BE | 199 | read/write rules for all collections |
| `firestore.indexes.json` | Composite indexes for Firestore queries | BE | 67 | 3 response indexes + 2 questionnaire indexes |
| `functions/index.js` | All Cloud Functions (BE) | BE | ~900 | syncIcsNow, syncIcsCron, sendQuestionnaireAvailableNotifications, sendQuestionnaireReminders, sendTestNotification, createMembership, lookupTeamByCode, anonymizePlayerDataForAI |
| `navigation/StitchNavigator.js` | Root navigator — auth gate + role-based routing | FE | 661 | AuthGate, AthleteTabs, CoachTabs, AdminTabs, RootStackNavigator |

#### src/screens/

| Path | Purpose | Layer | Lines (est.) | Key Exports |
|------|---------|-------|-------------|-------------|
| `src/screens/AdminHomeScreen.tsx` | Admin team selector grid + Create Team CTA | FE | 341 | AdminHomeScreen |
| `src/screens/AdminTeamScreen.tsx` | Team settings: calendar sync + access codes (legacy, superseded by AdminTeamDetailScreen) | FE | 516 | AdminTeamScreen |
| `src/screens/AdminTeamDetailScreen.tsx` | Dashboard-first team view; gear drawer with accordion panels | FE | 800 | AdminTeamDetailScreen |
| `src/screens/CreateTeamModal.tsx` | Full-screen modal to create a new team | FE | 279 | CreateTeamModal |
| `src/screens/PerformanceDashboard.tsx` | Full analytics dashboard (Brief + Charts tabs) | FE | ~1200 | PerformanceDashboard |
| `src/screens/AthleteDetailScreen.tsx` | Per-athlete profile with gauge, radar, EMA trendline, session table | FE | 563 | AthleteDetailScreen |
| `src/screens/CoachHomeScreen.tsx` | Coach home — KPI cards + alerts for last training | FE | 349 | CoachHomeScreen |
| `src/screens/CoachScheduleScreen.tsx` | Coach schedule — Day/Week/Month views with training cards | FE | 719 | CoachScheduleScreen |
| `src/screens/CoachTeamScreen.tsx` | Team roster with last-training questionnaire status per athlete | FE | 309 | CoachTeamScreen |
| `src/screens/CoachProfileScreen.tsx` | Coach profile edit + photo upload + logout | FE | 476 | CoachProfileScreen |
| `src/screens/OnboardingNotifScreen.tsx` | Push notification permission onboarding (athlete first login) | FE | 268 | OnboardingNotifScreen |
| `src/screens/WelcomeScreen.tsx` | Welcome screen (unused) | FE | ~30 | WelcomeScreen |
| `src/screens/AthleteHome.js` | Athlete home wrapper — delegates to AthleteHomeNew | FE | ~85 | AthleteHome |
| `src/screens/AthleteHomeNewScreen.js` | Athlete home new variant (stitch component import) | FE | ~20 | - |
| `src/screens/ScheduleScreenNewScreen.js` | Athlete schedule wrapper (stitch component import) | FE | ~20 | - |
| `src/screens/AuthScreen.js` | Auth screen (unused/legacy) | FE | ~20 | - |
| `src/screens/AdminPanel.js` | Legacy admin panel (unused) | FE | ~20 | - |
| `src/screens/Alerts.js` | Alerts screen stub (unused) | FE | ~20 | - |
| `src/screens/Analytics.js` | Analytics screen stub (unused) | FE | ~20 | - |
| `src/screens/CoachDashboard.js` | Legacy coach dashboard (unused) | FE | ~20 | - |
| `src/screens/Questionnaire.js` | Legacy questionnaire (unused) | FE | ~20 | - |
| `src/screens/RoleScreen.js` | Role selection screen (unused) | FE | ~20 | - |
| `src/screens/Schedule.js` | Schedule stub (unused) | FE | ~20 | - |
| `src/screens/ScheduleScreenNewScreen.js` | Schedule screen new stub | FE | ~20 | - |

#### screens/ (legacy/Stitch screens)

| Path | Purpose | Layer | Lines (est.) | Key Exports |
|------|---------|-------|-------------|-------------|
| `screens/StitchLandingScreen.js` | Landing/marketing page | FE | ~200 | LandingScreen |
| `screens/StitchLoginScreen.js` | Login form (email/password) | FE | ~150 | LoginScreen |
| `screens/StitchCreateAccountScreen.js` | Create account form | FE | ~200 | CreateAccountScreen |
| `screens/StitchQuestionnaireScreen.js` | V3 questionnaire — 6 sliders + Friction Matrix | FE | 1089 | StitchQuestionnaireScreen |
| `screens/StitchProfileScreen.js` | Athlete profile + notification test button | FE | ~200 | ProfileScreen |
| `screens/StitchScheduleScreen.js` | Athlete schedule (legacy) | FE | ~150 | ScheduleScreen |
| `screens/StitchHomeScreenClean.js` | Athlete home (legacy) | FE | ~100 | HomeScreen |
| `screens/StitchAdminDashboard.js` | Admin dashboard placeholder (tab filler) | FE | ~50 | AdminDashboard |
| `screens/StitchTeamDetails.js` | Team details (legacy stub) | FE | ~100 | TeamDetails |
| `screens/DebugTestQuestionnaireScreen.js` | Debug screen for notification deep-link testing | FE | ~50 | DebugTestQuestionnaireScreen |
| `screens/DevEventsProbe.js` | Dev diagnostic for Firestore events | FE | ~100 | DevEventsProbe |
| `screens/TeamCalendarSettings.js` | Legacy calendar settings (unused) | FE | ~100 | - |

#### src/components/

| Path | Purpose | Layer | Lines (est.) | Key Exports |
|------|---------|-------|-------------|-------------|
| `src/components/DARPerformanceChart.tsx` | 2×2 quadrant DAR analytics container | FE | 438 | DARPerformanceChart |
| `src/components/DARStackedChart.tsx` | Stacked bar chart for zone distribution (timeline/byPlayer) | FE | ~150 | DARStackedChart |
| `src/components/DARRawChart.tsx` | Raw score charts (timeline/byPlayer workload) | FE | ~150 | DARRawChart |
| `src/components/SplashScreen.tsx` | Animated splash screen during auth load | FE | ~50 | SplashScreen |
| `src/components/PWAInstallBanner.tsx` | iOS PWA install banner | FE | ~100 | PWAInstallBanner |
| `src/components/FCMDebugPanel.tsx` | Debug panel for FCM token diagnostics | FE | ~100 | FCMDebugPanel |
| `src/components/AnimatedLogo.tsx` | Animated CTP logo component | FE | ~50 | AnimatedLogo |
| `src/components/BrandHeader.tsx` | Branded header bar | FE | ~50 | BrandHeader |
| `src/components/ChampionTrackProLogo.tsx` | Logo component with fallback | FE | ~50 | ChampionTrackProLogo |
| `src/components/CTPButton.tsx` | Design system button | FE | ~40 | CTPButton |
| `src/components/CTPInput.tsx` | Design system input | FE | ~40 | CTPInput |
| `src/components/ListEmpty.tsx` | Empty list placeholder | FE | ~30 | ListEmpty |
| `src/components/MobileViewport.tsx` | Mobile viewport constraint wrapper | FE | ~40 | MobileViewport |
| `src/components/RoleToggle.tsx` | Role switcher toggle | FE | ~50 | RoleToggle |
| `src/components/SessionCard.tsx` | Session summary card | FE | ~80 | SessionCard |
| `src/components/SliderDivider.tsx` | Decorative slider divider | FE | ~30 | SliderDivider |
| `src/components/StatusPill.tsx` | Status badge pill | FE | ~30 | StatusPill |
| `src/components/StitchWebView.tsx` | Web view wrapper | FE | ~40 | StitchWebView |
| `src/components/TestScreen.tsx` | Test screen component | FE | ~30 | TestScreen |

#### src/utils/

| Path | Purpose | Layer | Lines (est.) | Key Exports |
|------|---------|-------|-------------|-------------|
| `src/utils/analytics.ts` | EMA, deviation, readiness score, V1→V2 field mapping | FE | 137 | calculateEMA, calculateDeviation, calculateReadiness, extractV2Metrics |
| `src/utils/useDARAlgorithm.ts` | DAR zone classification algorithm (EMA 28d window) | FE | 196 | processDARData, getDARDataForResponses, getDARZoneForMetric, DAR_COLORS |
| `src/utils/questionnaire.ts` | Questionnaire status computation (open/closed/completed) | FE | ~50 | computeQuestionnaireStatus, getQuestionnaireWindowFromEnd |
| `src/utils/questionnaireTemplates.ts` | Default questionnaire templates + Firestore seeding + fetch | FE | 233 | seedDefaultQuestionnaires, fetchTeamQuestionnaire, calcReadinessFromQuestionnaire |
| `src/utils/responsive.ts` | Responsive utility helpers | FE | ~30 | - |
| `src/utils/time.ts` | Time formatting helpers | FE | ~50 | - |
| `src/utils/press.ts` | Touch/press utilities | FE | ~20 | - |
| `src/utils/phoneE164.js` | Phone number E.164 formatting | FE | ~30 | - |

#### src/lib/

| Path | Purpose | Layer | Lines (est.) | Key Exports |
|------|---------|-------|-------------|-------------|
| `src/lib/firebase.ts` | Firebase app instance export (web) | FE | ~30 | app, auth, db, functions |
| `src/lib/responses.ts` | Questionnaire response save/read — Firestore wrapper | FE | 118 | saveQuestionnaireResponse, getMyResponseStatus, getMyResponseInfo |
| `src/lib/mapTraining.ts` | Training event data mapper | FE | ~50 | mapTraining |
| `src/lib/resolveAthleteTeam.ts` | Athlete team resolution helper | FE | ~40 | resolveAthleteTeam |
| `src/lib/scheduleQueries.ts` | Firestore schedule query helpers | FE | ~80 | - |
| `src/lib/teamContext.ts` | Team context provider | FE | ~50 | TeamContext |
| `src/lib/trainings.ts` | Training data fetching helpers | FE | ~60 | - |
| `src/lib/icsImporterReal.ts` | ICS import utility (frontend, superseded by CF) | FE | ~100 | - |
| `src/lib/testEventsImporter.js` | Test events importer for dev | FE | ~50 | - |

#### src/services/

| Path | Purpose | Layer | Lines (est.) | Key Exports |
|------|---------|-------|-------------|-------------|
| `src/services/fcmService.js` | FCM initialization, token save, foreground notification handler | FE | 150 | initializeFCM |
| `src/services/webNotifications.ts` | Web push token registration + foreground message handler | FE | 334 | registerWebPushTokenForCurrentUser, setupForegroundMessageHandler, debugWebPushStatus |
| `src/services/notificationTest.ts` | Test notification trigger flow | FE | ~60 | sendTestNotification |
| `src/services/notifications.ts` | Notification service abstraction | FE | ~50 | - |
| `src/services/membership.ts` | Team membership service | FE | ~80 | - |

#### src/hooks/

| Path | Purpose | Layer | Lines (est.) | Key Exports |
|------|---------|-------|-------------|-------------|
| `src/hooks/useIsDesktop.ts` | Responsive hook — returns true if viewport >= 768px | FE | ~20 | useIsDesktop |
| `src/hooks/useDevice.ts` | Device detection hook | FE | ~30 | useDevice |

#### src/constants/ + src/theme/

| Path | Purpose | Layer | Lines (est.) | Key Exports |
|------|---------|-------|-------------|-------------|
| `src/constants/theme.ts` | Design system constants (colors, fonts, spacing, gradients) | FE | ~60 | theme |
| `src/theme/tokens.ts` | Design tokens | FE | ~40 | tokens |
| `src/types/firestore.ts` | TypeScript types for Firestore documents | FE | ~80 | User, Team, Training, Response types |

#### src/features/

| Path | Purpose | Layer | Lines (est.) | Key Exports |
|------|---------|-------|-------------|-------------|
| `src/features/questionnaire/services.ts` | Questionnaire service layer | FE | ~50 | - |
| `src/features/schedule/ics.ts` | ICS parsing feature | FE | ~60 | - |
| `src/features/schedule/services.ts` | Schedule service layer | FE | ~60 | - |

#### src/stitch_components/ (Athlete UI library)

| Path | Purpose | Layer | Lines (est.) | Key Exports |
|------|---------|-------|-------------|-------------|
| `src/stitch_components/AthleteHomeNew.tsx` | Athlete home — 4-state questionnaire logic + session list | FE | ~400 | AthleteHomeNew |
| `src/stitch_components/AthleteHomeStitch.tsx` | Athlete home stitch variant | FE | ~300 | - |
| `src/stitch_components/AthleteHomeWeb.tsx` | Athlete home web-specific | FE | ~300 | - |
| `src/stitch_components/AthleteHome.tsx` | Athlete home base | FE | ~200 | - |
| `src/stitch_components/AthleteScheduleDay.tsx` | Day schedule view for athlete | FE | ~150 | AthleteScheduleDay |
| `src/stitch_components/AthleteScheduleWeek.tsx` | Week schedule view for athlete | FE | ~150 | AthleteScheduleWeek |
| `src/stitch_components/QuestionnaireScreenNew.tsx` | Questionnaire screen new variant | FE | ~300 | - |
| `src/stitch_components/QuestionnairePainNo.tsx` | Questionnaire no-pain path | FE | ~100 | - |
| `src/stitch_components/QuestionnairePainYes.tsx` | Questionnaire pain path | FE | ~100 | - |
| `src/stitch_components/ScheduleScreenNew.tsx` | Athlete schedule new variant | FE | ~250 | - |
| `src/stitch_components/Landing.tsx` | Landing stitch component | FE | ~100 | - |
| `src/stitch_components/LandingScreenNew.tsx` | Landing screen new variant | FE | ~200 | - |
| `src/stitch_components/Login.tsx` | Login stitch component | FE | ~100 | - |
| `src/stitch_components/LoginScreenNew.tsx` | Login new variant | FE | ~150 | - |
| `src/stitch_components/CreateAccount.tsx` | Create account component | FE | ~200 | - |
| `src/stitch_components/AdminDashboardNew.tsx` | Admin dashboard new variant | FE | ~150 | - |
| `src/stitch_components/BottomNavigationNew.tsx` | Bottom nav component | FE | ~100 | - |
| `src/stitch_components/UnifiedAthleteNavigation.tsx` | Unified navigation for athlete | FE | ~100 | - |
| `src/stitch_components/ResponsiveLayout.tsx` | Responsive layout wrapper | FE | ~80 | - |
| `src/stitch_components/ResponsiveNavigation.tsx` | Responsive nav | FE | ~80 | - |
| `src/stitch_components/ModernButton.tsx` | Modern button component | FE | ~50 | - |
| `src/stitch_components/ModernCard.tsx` | Modern card component | FE | ~50 | - |
| `src/stitch_components/ModernSlider.tsx` | Modern slider component | FE | ~80 | - |
| `src/stitch_components/index.ts` | Stitch components barrel export | FE | ~30 | - |

#### Infrastructure & Config Files

| Path | Purpose | Layer | Lines (est.) | Key Exports |
|------|---------|-------|-------------|-------------|
| `public/firebase-messaging-sw.js` | FCM service worker — background message handler + notification click | BE | 71 | SW event handlers |
| `services/firebaseConfig.js` | Firebase initialization (main services/config) | FE | ~40 | auth, db, functions |
| `firebaseConfig.js` | Firebase config root | FE | ~20 | - |
| `firebaseConfig.web.js` | Firebase web config | FE | ~20 | - |
| `firebaseConfig.native.js` | Firebase native config | FE | ~20 | - |
| `web/firebaseConfig.web.ts` | Firebase web config (TypeScript) | FE | ~30 | app, auth, db |
| `metro.config.js` | Metro bundler config | INFRA | ~20 | - |

#### Scripts (dev tooling, not production)

| Path | Purpose |
|------|---------|
| `scripts/seed-realistic-season.js` | Seeds 90 days of realistic basketball data |
| `scripts/seedBasketballTeam.js` | Seeds basketball team test data |
| `scripts/seedTestData.js` | Seeds generic test data |
| `scripts/copy-service-worker.js` | Post-build: copies SW to dist |
| `scripts/inject-metadata.js` | Post-build: injects OG meta tags |
| `scripts/verify-build.js` | Post-build verification |
| `scripts/backfill-members.js` | One-off: backfills members subcollection |
| `scripts/fix-coach-membership.js` | One-off: fixes coach team membership |
| `scripts/generate-badge.js` / `generate-badge-slider.js` | PWA badge generation |
| `scripts/generate-og-image.js` | OG image generation |

---

## SECTION 2 — DOMAIN MAP

### Domain 1: Authentication

| Feature | File | Status | Layer | Description | Dependencies |
|---------|------|--------|-------|-------------|--------------|
| Email/Password Login | `screens/StitchLoginScreen.js` | DONE | FE | Firebase Auth signInWithEmailAndPassword form | Firebase Auth |
| Account Creation | `screens/StitchCreateAccountScreen.js` | DONE | FE | Creates user doc + sets role=athlete by default | Firebase Auth, Firestore |
| Auth State Listener | `navigation/StitchNavigator.js` → AuthGate | DONE | FE | onAuthStateChanged + role fetching via onSnapshot | Firebase Auth, Firestore |
| Role-Based Routing | `navigation/StitchNavigator.js` → RootStackNavigator | DONE | FE | Routes to AthleteTabs / CoachTabs / AdminTabs based on users/{uid}.role | AuthGate |
| Browser Persistence | `navigation/StitchNavigator.js` | DONE | FE | setPersistence(browserLocalPersistence) — stays logged in across sessions | Firebase Auth |
| Auto Admin Seed | `navigation/StitchNavigator.js` → AuthGate | DONE | FE | Creates admin doc if gabfavergeat@gmail.com logs in and no doc exists | Firestore |
| Login Count Tracking | `navigation/StitchNavigator.js` → AuthGate | DONE | FE | Increments users/{uid}.loginCount on each auth | Firestore |
| Role Race Condition Fix | `navigation/StitchNavigator.js` | DONE | FE | Waits for onSnapshot confirmation before rendering tabs (prevents coach rendered as athlete) | Firebase Firestore |
| Logout | `src/screens/CoachProfileScreen.tsx`, `src/screens/AdminHomeScreen.tsx` | DONE | FE | Firebase signOut + navigation reset | Firebase Auth |
| Onboarding Notification Screen | `src/screens/OnboardingNotifScreen.tsx` | DONE | FE | First-login push permission request screen for athletes; iOS PWA install step | FCM, webNotifications.ts |
| Join by Code | `navigation/StitchNavigator.js` → pendingJoinCode + `functions/index.js` | DONE | BOTH | URL param `?code=XXXX-A` resolved by lookupTeamByCode CF, joined via createMembership CF | Cloud Functions |

### Domain 2: Athlete Experience

| Feature | File | Status | Layer | Description | Dependencies |
|---------|------|--------|-------|-------------|--------------|
| Athlete Home — 4-State Questionnaire Logic | `src/stitch_components/AthleteHomeNew.tsx` | DONE | FE | Shows upcoming session with status: not_open_yet / open / completed / closed | Firestore trainings + responses |
| Athlete Home Session List | `src/stitch_components/AthleteHomeNew.tsx` | DONE | FE | Lists today's/upcoming trainings with questionnaire status badges | Firestore |
| isTestSession Exclusion | `src/stitch_components/AthleteHomeNew.tsx`, `screens/StitchQuestionnaireScreen.js` | DONE | FE | Test sessions shown with yellow "🧪 Test Session" banner; marked isTest:true in response | Firestore |
| Athlete Schedule | `screens/StitchScheduleScreen.js`, `src/stitch_components/ScheduleScreenNew.tsx` | DONE | FE | Athlete's training calendar view | Firestore |
| Athlete Profile | `screens/StitchProfileScreen.js` | DONE | FE | Profile display + notification test button | Firebase Auth |
| Questionnaire V3 (6 Sliders) | `screens/StitchQuestionnaireScreen.js` | DONE | FE | Physical Engine (3Q) + Technical Execution (2Q) + Mental Energy (1Q) sliders 1–100 | Firestore, responses.ts |
| Dynamic Questionnaire Loading | `screens/StitchQuestionnaireScreen.js` | DONE | FE | Loads team-assigned questionnaire from Firestore, falls back to V3 defaults | questionnaireTemplates.ts |
| Friction Matrix (Q7–Q10) | `screens/StitchQuestionnaireScreen.js` | DONE | FE | Conditional follow-up questions when athlete reports friction | Firestore |
| Questionnaire Time Window Validation | `screens/StitchQuestionnaireScreen.js`, `src/utils/questionnaire.ts` | DONE | FE | Checks if questionnaire is open (after training end, within 5h window) | Firestore, Luxon |
| Questionnaire Access Control | `screens/StitchQuestionnaireScreen.js` | DONE | FE | Verifies: user authenticated, has teamId, training exists, not already submitted | Firestore |
| Readiness Score Calculation | `screens/StitchQuestionnaireScreen.js` | DONE | FE | Dynamic weighted score from questionnaire definition; V2 backward-compat aliases written | questionnaireTemplates.ts |
| workloadAU Calculation | `screens/StitchQuestionnaireScreen.js` | DONE | FE | Set to null in V3 (sessionRPE removed) | - |
| Questionnaire Response Save | `src/lib/responses.ts` | DONE | FE | setDoc to teams/{teamId}/trainings/{id}/responses/{uid} with merge | Firestore |
| Confirmation + Auto-Redirect | `screens/StitchQuestionnaireScreen.js` | DONE | FE | Success overlay with 2s auto-redirect to home | - |
| Deep Link to Questionnaire | `navigation/StitchNavigator.js` | DONE | FE | URL params `?screen=questionnaire&trainingId=X&teamId=Y` or `?sessionId=X&openQuestionnaire=1` | StitchNavigator |
| PWA Install Banner | `src/components/PWAInstallBanner.tsx` | DONE | FE | iOS Safari install instructions | - |

### Domain 3: Coach Dashboard

| Feature | File | Status | Layer | Description | Dependencies |
|---------|------|--------|-------|-------------|--------------|
| Coach Home KPI Cards | `src/screens/CoachHomeScreen.tsx` | DONE | FE | Athletes count, This Week trainings count, Response rate from last training | Firestore |
| Coach Home Alerts | `src/screens/CoachHomeScreen.tsx` | DONE | FE | Lists athletes with no response or pain reported for last training | Firestore |
| Coach Team Roster | `src/screens/CoachTeamScreen.tsx` | DONE | FE | Roster with last-training status (completed/pending/pain) per athlete; click → AthleteDetail | Firestore |
| Athlete Detail Screen | `src/screens/AthleteDetailScreen.tsx` | DONE | FE | SVG gauge (7d readiness), radar chart, EMA workload trendline, last 5 sessions table | Recharts, analytics.ts |
| Coach Schedule | `src/screens/CoachScheduleScreen.tsx` | DONE | FE | Day/Week/Month view with expandable training cards + per-member status | Firestore |
| Coach Profile Edit | `src/screens/CoachProfileScreen.tsx` | DONE | FE | Edit full name, photo (base64 stored in Firestore), coach code copy | Firebase Auth, Firestore |
| Performance Dashboard | `src/screens/PerformanceDashboard.tsx` | DONE | FE | Morning Brief tab + Analytics tab (DAR, EMA, Radar, Deviation, Workload charts) | Recharts, analytics.ts, DARPerformanceChart |
| Morning Brief | `src/screens/PerformanceDashboard.tsx` | DONE | FE | Latest session overview with readiness score, EMA trend indicator | Firestore |
| Player Filter | `src/screens/PerformanceDashboard.tsx` | DONE | FE | Multi-select player filter chips for all analytics views | - |
| Duration Filter | `src/screens/PerformanceDashboard.tsx` | DONE | FE | 7d / 14d / 30d / 90d time range filter | - |
| DAR Analytics (2×2 Quadrant) | `src/components/DARPerformanceChart.tsx` | DONE | FE | Physical/Mental/Technical metrics, zone stacked bars, workload AU per player | useDARAlgorithm.ts |
| EMA 28d Chart | `src/screens/PerformanceDashboard.tsx` | DONE | FE | 28-day exponential moving average trendline | analytics.ts, Recharts |
| Radar Chart | `src/screens/PerformanceDashboard.tsx` | DONE | FE | Last-session performance radar (Physical/Mental/Technical/Recovery) | Recharts |
| Deviation Chart | `src/screens/PerformanceDashboard.tsx` | DONE | FE | Percentage deviation from EMA baseline | analytics.ts |
| Workload Chart | `src/screens/PerformanceDashboard.tsx` | DONE | FE | Acute (7d) vs Chronic (28d) workload EMA | analytics.ts |
| isTestSession Filter | `src/screens/CoachHomeScreen.tsx`, `src/screens/PerformanceDashboard.tsx` | DONE | FE | Test sessions excluded from all coach analytics | Firestore |

### Domain 4: Admin Panel

| Feature | File | Status | Layer | Description | Dependencies |
|---------|------|--------|-------|-------------|--------------|
| Admin Home Team Grid | `src/screens/AdminHomeScreen.tsx` | DONE | FE | Lists all teams with member count + Create Team button | Firestore |
| Admin Logout | `src/screens/AdminHomeScreen.tsx` | DONE | FE | Firebase signOut | Firebase Auth |
| Create Team | `src/screens/CreateTeamModal.tsx` | DONE | FE | Creates Firestore team doc with name, sport, division, logo, season dates, DAR metrics, ICS URL, invite code | Firestore, Cloud Functions |
| Team Logo Upload | `src/screens/CreateTeamModal.tsx` | DONE | FE | Base64 logo stored in teams/{teamId}.logoUrl | Firestore |
| DAR Metric Selection | `src/screens/CreateTeamModal.tsx` | DONE | FE | Toggle which DAR metrics (min 3) are active for the team | Firestore |
| Admin Team Detail — Dashboard | `src/screens/AdminTeamDetailScreen.tsx` | DONE | FE | Embeds full PerformanceDashboard as main content with gear drawer overlay | PerformanceDashboard |
| Admin Settings Drawer | `src/screens/AdminTeamDetailScreen.tsx` | DONE | FE | Slide-in drawer with 4 accordion panels: Team Info, Access Codes, Calendar Sync, Questionnaire | - |
| Team Info Edit | `src/screens/AdminTeamDetailScreen.tsx` | DONE | FE | Edit name, sport, division, season dates | Firestore |
| Access Codes | `src/screens/AdminTeamDetailScreen.tsx`, `src/screens/AdminTeamScreen.tsx` | DONE | FE | Generates invite code XXXXX-C (coach) and XXXXX-A (athlete); copy code + link | Firestore |
| Calendar Sync Config | `src/screens/AdminTeamDetailScreen.tsx`, `src/screens/AdminTeamScreen.tsx` | DONE | FE | Set ICS URL, toggle auto-sync, Sync Now button (calls syncIcsNow CF) | Cloud Functions |
| Calendar Events Preview | `src/screens/AdminTeamDetailScreen.tsx` | DONE | FE | Shows ±30 days of trainings from Firestore (past/upcoming filter) | Firestore |
| Questionnaire Assignment | `src/screens/AdminTeamDetailScreen.tsx` | DONE | FE | Picker modal to assign questionnaire template to team; shows question preview + readiness formula | questionnaireTemplates.ts, Firestore |
| Default Questionnaire Seeding | `src/utils/questionnaireTemplates.ts` | DONE | FE | Idempotent seed of 5 default questionnaire templates (Basketball×2, Handball, Soccer, Generic) | Firestore |
| Admin Performance Dashboard | `navigation/StitchNavigator.js` → AdminPerformanceDashboard | DONE | FE | Full dashboard accessible from AdminTeamDetailScreen | PerformanceDashboard |

### Domain 5: Data & Analytics

| Feature | File | Status | Layer | Description | Dependencies |
|---------|------|--------|-------|-------------|--------------|
| DAR Algorithm | `src/utils/useDARAlgorithm.ts` | DONE | FE | 28-day EMA with carry-forward; GREEN (±15%), BLUE (<-15%), YELLOW (>+15%) zone classification | analytics.ts |
| EMA Calculation | `src/utils/analytics.ts` | DONE | FE | Exponential moving average for any N-day window; null-safe (carry forward) | - |
| Readiness Score | `src/utils/analytics.ts` | DONE | FE | Weighted 0–100 score from V2 metrics; high=bad inversion for cardioLoad/neuroLoad/etc. | - |
| V1 → V2 Field Mapping | `src/utils/analytics.ts` → extractV2Metrics | DONE | FE | Maps legacy French fields (impactCardiaque, sommeil, etc.) to V2 metric keys | - |
| Dynamic Readiness (V3) | `src/utils/questionnaireTemplates.ts` → calcReadinessFromQuestionnaire | DONE | FE | Calculates readiness dynamically from questionnaire question definitions + weights | - |
| DAR Stacked Chart | `src/components/DARStackedChart.tsx` | DONE | FE | Zone distribution stacked bars (timeline mode + byPlayer mode) | Recharts |
| DAR Raw Chart | `src/components/DARRawChart.tsx` | DONE | FE | Raw score timeline + workload AU per player bar chart | Recharts |
| Zone Distribution Row | `src/components/DARPerformanceChart.tsx` | DONE | FE | Per-player mini stacked bars below 2×2 grid | - |
| Per-Athlete Analytics | `src/screens/AthleteDetailScreen.tsx` | DONE | FE | Gauge + radar + EMA trendline (28 sessions) + session table | Recharts, analytics.ts |
| GDPR Anonymization | `functions/index.js` → anonymizePlayerDataForAI | DONE | BE | Firestore onDelete trigger on users/{uid} — anonymizes responses and writes to ai_training_dataset | Cloud Functions |
| AI Training Dataset | `functions/index.js`, `firestore.rules` | DONE | BE | ai_training_dataset collection — Cloud Functions only (no client read/write) | Cloud Functions |
| Questionnaire Templates (5 sports) | `src/utils/questionnaireTemplates.ts` | DONE | FE | Basketball (2), Handball, Soccer, Generic — seeded to /questionnaires collection | Firestore |
| Response Index (collectionGroup) | `firestore.indexes.json` | DONE | BE | 3 composite indexes: teamId+submittedAt, userId+submittedAt, userId+teamId+submittedAt | Firestore |
| Questionnaire Index | `firestore.indexes.json` | DONE | BE | sport+sessionType+isDefault+isArchived composite index | Firestore |

### Domain 6: Notifications

| Feature | File | Status | Layer | Description | Dependencies |
|---------|------|--------|-------|-------------|--------------|
| FCM Service Worker | `public/firebase-messaging-sw.js` | DONE | BE | Background message handler + notificationclick deep link handler | Firebase Messaging |
| FCM Initialization | `src/services/fcmService.js` | DONE | FE | SW registration, permission request, token retrieval, foreground handler, 24h re-registration | Firebase Messaging |
| Web Push Token Registration | `src/services/webNotifications.ts` | DONE | FE | Register SW (classic, scope /), get FCM token, save to users/{uid}.fcmWebTokens via arrayUnion | Firebase Messaging, Firestore |
| Token Storage | `src/services/fcmService.js`, `src/services/webNotifications.ts` | DONE | FE | fcmWebTokens[] array on users/{uid} (NOT subcollection) | Firestore |
| Foreground Notification Display | `src/services/fcmService.js` → showForegroundNotification | DONE | FE | Shows notification via SW.showNotification when app is open | Service Worker |
| Questionnaire Available CF | `functions/index.js` → sendQuestionnaireAvailableNotifications | DONE | BE | CRON every 1 min — finds trainings that ended, queries pendingQuestionnaireReminders, sends FCM to all team members | Cloud Functions, FCM |
| Questionnaire Reminder CF | `functions/index.js` → sendQuestionnaireReminders | DONE | BE | CRON every 5 min — sends reminder 3h after training end if not completed | Cloud Functions, FCM |
| Test Notification CF | `functions/index.js` → sendTestNotification | DONE | BE | HTTPS callable — sends test push to current user's tokens | Cloud Functions, FCM |
| Deep Link on Notification Click | `public/firebase-messaging-sw.js`, `navigation/StitchNavigator.js` | DONE | BOTH | Click opens `/?screen=questionnaire&trainingId=X&teamId=Y` | Service Worker, Navigator |
| Onboarding Push Permission | `src/screens/OnboardingNotifScreen.tsx` | DONE | FE | Platform-aware: iOS Safari shows PWA install step first; 2-skip tolerance | webNotifications.ts |
| pendingQuestionnaireReminders Collection | `functions/index.js`, `firestore.rules` | DONE | BE | Internal CF-only collection (client write: false) | Cloud Functions |
| 24h Token Re-Registration | `src/services/fcmService.js` | DONE | FE | visibilitychange listener re-registers token if >24h since last reg | webNotifications.ts |

### Domain 7: Infrastructure & Utilities

| Feature | File | Status | Layer | Description | Dependencies |
|---------|------|--------|-------|-------------|--------------|
| ICS Calendar Sync (CRON) | `functions/index.js` → syncIcsCron | DONE | BE | Runs every 15 min — syncs all teams with calendarActive=true | node-ical, node-fetch |
| ICS Calendar Sync (Manual) | `functions/index.js` → syncIcsNow | DONE | BE | HTTPS callable — immediate sync for one team | node-ical, node-fetch |
| ICS Event Expansion | `functions/index.js` → expandEvents | DONE | BE | Expands RRULE recurrences + EXDATE exclusions over 180-day window | node-ical |
| SSRF Protection | `functions/index.js` → isUrlSafe | DONE | BE | Rejects non-HTTPS + private IP ranges (localhost, 10.x, 192.168.x, GCP metadata) | - |
| ICS Hash-Based Upsert | `functions/index.js` → syncTeam | DONE | BE | SHA-256 hash of event fields; only writes when changed | crypto |
| Questionnaire Auto-Link | `functions/index.js` → resolveQuestionnaireId | DONE | BE | Resolves questionnaire: team-assigned → sport+sessionType default → sport+any → generic | Firestore |
| Team Membership Service | `functions/index.js` → createMembership | DONE | BE | Callable — validates join code suffix (-C/-A), creates teams/{teamId}/members/{uid} | Firestore |
| Lookup Team by Code | `functions/index.js` → lookupTeamByCode | DONE | BE | Callable — finds team by inviteCode prefix | Firestore |
| Orphan Event Deletion | `functions/index.js` → syncTeam | DONE | BE | Deletes Firestore trainings no longer in ICS feed | Firestore |
| Sync Status Tracking | `functions/index.js` → updateTeamSyncStatus | DONE | BE | Writes calendarLastSyncStatus (syncing/ok/error) + error message to team doc | Firestore |
| useIsDesktop Hook | `src/hooks/useIsDesktop.ts` | DONE | FE | Window width >= 768px; mandatory on all Coach/Admin screens | - |
| Design System Tokens | `src/constants/theme.ts`, `src/theme/tokens.ts` | DONE | FE | Colors, fonts, gradients, shadows, border radii | - |
| Build Pipeline | `package.json` → web:build | DONE | INFRA | expo export → copy-service-worker.js → inject-metadata.js → verify-build.js | Expo, Node |
| OG Image Generation | `scripts/generate-og-image.js` | DONE | INFRA | Generates social OG image via sharp | sharp |
| Vercel Deploy | implicit | DONE | INFRA | Deployed to champion-track-pro.vercel.app | Vercel |

---

## SECTION 3 — FIRESTORE SCHEMA

### Collection: `users/{uid}`

| Field | Type | Description |
|-------|------|-------------|
| `email` | string | User email |
| `role` | string | "athlete" \| "coach" \| "admin" |
| `teamId` | string | (athletes/coaches) linked team ID |
| `displayName` | string | Display name |
| `fullName` | string | Full name |
| `photoBase64` | string | Base64 photo (coaches) |
| `photoURL` | string | Photo URL (fallback) |
| `fcmWebTokens` | string[] | FCM token array (arrayUnion) |
| `fcmToken` | string | Latest FCM token |
| `fcmTokenUpdatedAt` | string (ISO) | Last token update timestamp |
| `loginCount` | number | Incremented each login |
| `onboardingComplete` | boolean | Whether notification onboarding was completed |
| `createdAt` | Timestamp | Account creation time |
| `updatedAt` | Timestamp | Last update |

**Security:** User reads own doc; admin reads all; coach reads team members. Self-update blocks `role` and `teamId` fields (VULN-03 fix).

### Collection: `teams/{teamId}`

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Team name |
| `sport` | string | "Basketball" \| "Soccer" \| "Handball" \| etc. |
| `division` | string | "NCAA D1" \| "Pro" \| etc. |
| `logoUrl` | string | Base64 or URL logo |
| `seasonStart` | string | ISO date |
| `seasonEnd` | string | ISO date |
| `inviteCode` | string | 6-char random code (e.g. "AB3X7K") |
| `activeDARMetrics` | string[] | Active metric keys for DAR |
| `questionnaireId` | string | Assigned questionnaire template ID |
| `icsUrl` | string | ICS calendar URL (canonical) |
| `calendarUrl` | string | ICS URL (legacy alias, kept in sync) |
| `calendarActive` | boolean | Whether auto-sync is enabled |
| `calendarLastSyncAt` | Timestamp | Last sync time |
| `calendarLastSyncStatus` | string | "ok" \| "error" \| "syncing" |
| `calendarSyncError` | string | Error message if status=error |
| `calendarLastSyncCounts` | object | { created, updated, deleted, cancelled } |
| `timeZone` | string | Timezone for events (fallback UTC) |
| `members` | number | Member count (for display, not auth) |
| `createdAt` | Timestamp | - |
| `updatedAt` | Timestamp | - |

**Security:** Admin full access; coach reads if member; athlete reads if member; update of `members` field only (increment +1) allowed for signed-in users.

### Subcollection: `teams/{teamId}/members/{uid}`

| Field | Type | Description |
|-------|------|-------------|
| `displayName` | string | Member display name |
| `name` | string | Name (alias) |
| `fullName` | string | Full name |
| `email` | string | Email |
| `role` | string | "coach" \| "athlete" |
| `position` | string | Player position |
| `jerseyNumber` | number | Jersey number |
| `joinedAt` | Timestamp | When joined |

**Security:** Admin full; coach reads if member; athlete reads self only; create if self or coach/admin.

### Subcollection: `teams/{teamId}/trainings/{trainingId}`

| Field | Type | Description |
|-------|------|-------------|
| `title` | string | Event title (from ICS or manual) |
| `description` | string | Event description |
| `location` | string | Event location |
| `date` | string | ISO date (YYYY-MM-DD) |
| `startUtc` | Timestamp | Start UTC timestamp |
| `endUtc` | Timestamp | End UTC timestamp |
| `displayTz` | string | Display timezone |
| `durationMinutes` | number | Duration in minutes |
| `sessionType` | string | "game" \| "practice" \| "training" \| "scrimmage" \| "conditioning" |
| `isGame` | boolean | Derived from title/description |
| `isTestSession` | boolean | Excluded from analytics |
| `questionnaireId` | string | Assigned questionnaire |
| `calendarEventId` | string | ICS UID |
| `hash` | string | SHA-256 of event fields (change detection) |
| `cancelled` | boolean | ICS CANCELLED status |
| `lastSeenAt` | Timestamp | Last sync time this event was seen |
| `createdAt` | Timestamp | - |
| `updatedAt` | Timestamp | - |
| `source` | string | "ics" |

**Security:** Admin full; coach + athletes can read if team member; athlete can create if isTestSession=true (their own).

### Subcollection: `teams/{teamId}/trainings/{trainingId}/responses/{uid}`

| Field | Type | Description |
|-------|------|-------------|
| `userId` | string | Athlete UID |
| `teamId` | string | Team ID (for collectionGroup queries) |
| `trainingId` | string | Training ID |
| `status` | string | "completed" |
| `submittedAt` | Timestamp | Submission time |
| `completedAt` | Timestamp | Completion time |
| `metrics` | object | V3: { tankLevel, cardioLoad, legBounce, motorControl, tacticalSharpness, teamChemistry, ...dynamic } (1–100 scale) |
| `readinessScore` | number | Weighted score 0–100 |
| `workloadAU` | number\|null | Workload Arbitrary Units (null in V3) |
| `sessionType` | string | Session type at time of response |
| `questionnaireId` | string | Which questionnaire was used |
| `hasFriction` | boolean | Q7: friction present |
| `frictionType` | string[] | Q8: friction categories |
| `frictionImpact` | number | Q9: friction impact 1–100 |
| `worryLevel` | number | Q10: worry level 1–100 |
| `worryFlag` | boolean | true if frictionType=YES AND worryLevel>70 |
| `isTest` | boolean | From isTestSession training |
| `neuroLoad` | number | V2 backward-compat alias |
| `stressLevel` | number | V2 backward-compat alias |
| `sleepQuality` | number | V2 backward-compat alias |
| `tacticalLucidity` | number | V2 backward-compat alias |
| — V1 French fields (legacy) — | | |
| `impactCardiaque` | number | V1 legacy |
| `impactMusculaire` | number | V1 legacy |
| `sommeil` | number | V1 legacy |
| `nervosite` | number | V1 legacy |
| `technique` | number | V1 legacy |
| `tactique` | number | V1 legacy |
| `fatigue` | number | V1 legacy |

**Security:** Athlete creates/updates own response within 5h window after training end (or if isTestSession). Coach lists all for team. Admin full access. Delete: admin only.

### Collection: `questionnaires/{questionnaireId}`

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Template ID (e.g. "tpl-basketball-any") |
| `name` | string | Display name |
| `sport` | string | Sport category |
| `sessionType` | string | "any" \| "game" \| "practice" |
| `description` | string | Template description |
| `isDefault` | boolean | Whether it's a default template |
| `isArchived` | boolean | Whether archived |
| `createdBy` | string | "system" or admin UID |
| `createdAt` | Timestamp | - |
| `questions` | QuestionDef[] | Array of question definitions |

**QuestionDef fields:**
- `id`: string ("q1", "q2"…)
- `metricKey`: string (Firestore field key in response.metrics)
- `category`: string
- `questionText`: string
- `leftAnchor`: string
- `rightAnchor`: string
- `weight`: number (0.0–1.0, all questions must sum to 1.0)
- `inverted`: boolean (high score = bad)
- `isRequired`: boolean

**Security:** Any signed-in user can read; only admin can create/update/delete.
**Index:** sport + sessionType + isDefault + isArchived (ASCENDING)

### Collection: `pendingQuestionnaireReminders/{docId}`

| Field | Type | Description |
|-------|------|-------------|
| `teamId` | string | Team ID |
| `trainingId` | string | Training ID |
| `status` | string | "pending" \| "sent" |
| `dueAt` | Timestamp | When reminder should fire |
| `createdAt` | Timestamp | - |

**Security:** Admin read only; write: false (Cloud Functions only via Admin SDK).
**Index:** status + dueAt (ASCENDING)

### Collection: `ai_training_dataset/{doc}`

| Field | Type | Description |
|-------|------|-------------|
| (anonymized) | mixed | GDPR-anonymized response data for AI training |

**Security:** read: false, write: false (Cloud Functions Admin SDK only — GDPR trigger on user delete).

---

## SECTION 4 — DATA FLOW DIAGRAMS

### Flow 1: Athlete Submits Questionnaire

```
1. TRIGGER: Athlete taps "Respond" on session card in AthleteHomeNew.tsx
2. NAVIGATE: navigation.navigate("Questionnaire", { trainingId, teamId, eventData })
3. SCREEN LOAD: StitchQuestionnaireScreen.js
   ├── checkAccess():
   │   ├── getDoc("users/{uid}") → get teamId
   │   ├── getDoc("teams/{teamId}/trainings/{trainingId}") → get endUtc, isTestSession, sessionType
   │   ├── getDoc("teams/{teamId}/trainings/{trainingId}/responses/{uid}") → check if already completed
   │   ├── computeQuestionnaireStatus(endMillis, hasCompleted, now) → "open" | "completed" | "closed" | "not_open_yet"
   │   └── If not open → redirect silently (navigation.goBack())
   ├── loadQuestionnaire():
   │   ├── getDoc("teams/{teamId}") → get questionnaireId + sport
   │   ├── IF questionnaireId → getDoc("questionnaires/{questionnaireId}")
   │   └── ELSE → getDocs query(sport=X, isDefault=true, sessionType=any)
4. ATHLETE FILLS: 6 slider questions (1–100) + Friction Matrix (Q7–Q10)
5. SUBMIT → handleSubmit():
   ├── getDoc("users/{uid}") → verify teamId
   ├── calculateReadiness(metrics) using questionnaire weights
   ├── saveQuestionnaireResponse(teamId, trainingId, uid, payload)
   │   └── setDoc("teams/{teamId}/trainings/{trainingId}/responses/{uid}", { userId, teamId, metrics, readinessScore, ... }, merge)
   └── Show success confirmation → auto-redirect to home (2s)
6. BACKEND TRIGGER (async):
   └── sendQuestionnaireReminders CF (CRON 5min) checks if all members responded
```

### Flow 2: Coach Opens Dashboard

```
1. TRIGGER: Coach logs in → RootStackNavigator renders CoachTabs
2. COACH HOME (CoachHomeScreen.tsx):
   ├── getDoc("users/{uid}") → teamId, coachName
   ├── getDoc("teams/{teamId}") → teamName
   ├── getCountFromServer("teams/{teamId}/members") → athleteCount
   ├── getDocs("teams/{teamId}/trainings", where startUtc >= weekStart) → weekTrainings
   ├── getDocs("teams/{teamId}/trainings", orderBy startUtc desc, limit 5) → lastTraining
   ├── getDocs("teams/{teamId}/members") → memberMap
   ├── getDocs("teams/{teamId}/trainings/{lastId}/responses") → responseRate, alerts
   └── Renders: KPI cards + alert list
3. NAVIGATE to Analytics tab → PerformanceDashboard:
   ├── getDoc("users/{uid}") → teamId
   ├── getDoc("teams/{teamId}") → teamName
   ├── getDocs("teams/{teamId}/members") → members list
   ├── collectionGroup("responses") where teamId=X AND submittedAt >= (now - duration) → all responses
   ├── Filter: !isTest, status="completed"
   ├── calculateEMA(responses, 28) → EMA trendline
   ├── getDARDataForResponses(responses, metricExtractor) → DAR zone data
   └── Recharts renders: Line, Bar, Radar, ComposedChart, DARPerformanceChart
4. NAVIGATE to Team tab → CoachTeamScreen:
   ├── getDocs("teams/{teamId}/members") + enrich from users/{uid}
   ├── getDocs last training + responses
   └── Athlete roster with status; click → AthleteDetailScreen
5. AthleteDetailScreen:
   ├── getDoc("users/{uid}") → athlete profile
   ├── collectionGroup("responses") where userId=X (and teamId=Y) → last 28 responses
   └── Recharts: gauge SVG, RadarChart, LineChart
```

### Flow 3: Admin Creates Team

```
1. TRIGGER: Admin clicks "+ CREATE TEAM" on AdminHomeScreen
2. NAVIGATE: navigation.navigate("CreateTeamModal")
3. FORM: Name*, Sport, Division, Logo (base64), Season dates, DAR metrics (min 3), ICS URL
4. SUBMIT → handleSave():
   ├── generateCode(6) → inviteCode
   ├── addDoc("teams", { name, sport, division, logoUrl (base64), activeDARMetrics, inviteCode, calendarUrl, icsUrl, calendarActive, createdAt })
   ├── IF calendarUrl provided:
   │   └── httpsCallable("syncIcsNow", { teamId }) → CF syncs ICS immediately
   └── navigation.navigate("AdminTeamDetailScreen", { teamId, teamName })
5. AdminTeamDetailScreen renders:
   ├── PerformanceDashboard (empty — no data yet)
   └── Gear drawer → Access Codes accordion (auto-opens)
6. Admin shares invite codes:
   ├── Coach: ${inviteCode}-C (e.g. "AB3X7K-C")
   └── Athlete: ${inviteCode}-A (e.g. "AB3X7K-A")
```

### Flow 4: Calendar Sync

```
TRIGGER A — CRON (every 15 min):
syncIcsCron CF:
  └── getDocs("teams") where calendarActive=true
      └── For each team → syncTeam(teamId)

TRIGGER B — Manual (Admin clicks "Sync Now"):
  httpsCallable("syncIcsNow", { teamId }) → syncTeam(teamId)

syncTeam(teamId):
  1. getDoc("teams/{teamId}") → icsUrl, sport, questionnaireId, timeZone
  2. isUrlSafe(icsUrl) — SSRF check (must be HTTPS, non-private IP)
  3. updateTeamSyncStatus(teamId, "syncing")
  4. fetch(icsUrl, { timeout: 30s }) → ICS text
  5. ical.sync.parseICS(icsText) → parsed events
  6. expandEvents() → expands RRULE recurrences + EXDATE exclusions (180-day window, max 500 events)
  7. For each event:
     ├── deriveEventFields() → date, sessionType, isGame, durationMinutes
     ├── resolveQuestionnaireId() → questionnaire (cached per sessionType)
     ├── makeHash(event) → SHA-256 for change detection
     ├── getDoc existing → compare hash → IF changed: batch.set() update
     └── IF new: batch.set() create with all fields
  8. Find orphans (existing docs not in incoming set) → batch.delete()
  9. batch.commit()
  10. updateTeamSyncStatus(teamId, "ok", null, { created, updated, deleted, cancelled })

QUESTIONNAIRE NOTIFICATION (after training ends):
sendQuestionnaireAvailableNotifications (CRON 1 min):
  1. Query trainings that just ended (endUtc in last 2 min)
  2. For each: check no pendingReminder exists → create one
  3. Send FCM to all team members' fcmWebTokens[]

sendQuestionnaireReminders (CRON 5 min):
  1. Query pendingQuestionnaireReminders where status=pending AND dueAt <= now
  2. For each: check if athlete responded → if not, send reminder FCM
  3. Mark reminder as sent
```

### Flow 5: Join Team by Code

```
1. ATHLETE receives link: https://champion-track-pro.vercel.app/?code=AB3X7K-A
2. URL loaded → StitchNavigator.js extracts code param → pendingJoinCode.current = "AB3X7K-A"
3. window.history.replaceState({}, "", "/") — cleans URL
4. Auth completes → AuthGate useEffect fires:
   ├── httpsCallable("lookupTeamByCode", { code: "AB3X7K-A" })
   │   └── CF: queries teams where inviteCode = "AB3X7K" → returns { teamId, role: "athlete" }
   └── httpsCallable("createMembership", { teamId, role: "athlete", name, email })
       └── CF: creates teams/{teamId}/members/{uid} + updates users/{uid}.teamId
```

---

## SECTION 5 — MISSING FEATURES & GAPS

### Navigation / Route Gaps

| Issue | Description |
|-------|-------------|
| Admin "Teams" tab | `AdminTabs` maps Teams tab to `AdminDashboard` (StitchAdminDashboard.js — a placeholder), not the real AdminTeamScreen |
| Admin "Analytics" tab | Same — maps to `AdminDashboard` placeholder instead of any analytics screen |
| Coach "Analytics" tab label | Coach tab "Analytics" actually renders PerformanceDashboard (works fine), but the route name is "Analytics" while CoachHomeScreen navigates to "Analytics" — consistent |
| Questionnaire params mismatch | `AthleteHome.js` sends `{ trainingId, teamId }` but `StitchQuestionnaireScreen.js` reads `{ sessionId }` — uses `sessionId` as the parameter key. Navigation passes both `trainingId` (new) and `sessionId` (deprecated legacy alias) — the screen reads `sessionId` from `route.params` which receives the value from the old path. **Active but fragile.** |

### TODOs Found in Code

| Location | TODO/Gap | Priority |
|----------|---------|----------|
| `src/screens/AdminTeamDetailScreen.tsx` line ~546 | "Create Custom Questionnaire — coming soon" (alert stub) | PLANNED |
| `firestore.rules` | `isCoachOfTeam()` function is identical to `isTeamMember()` — uses existence check not role check — coach and athlete have same access level per this rule | LOW (documented) |
| `src/screens/CoachHomeScreen.tsx` | Pain detection uses V1 field `impactMusculaire >= 70` and `fatigue >= 80`; V3 metrics (frictionType, worryFlag) not checked | IN_PROGRESS |
| `src/screens/CoachTeamScreen.tsx` | Same pain detection issue — V1 only | IN_PROGRESS |
| Admin "Teams" tab | Renders StitchAdminDashboard (placeholder) | PENDING |
| Admin "Analytics" tab | Renders StitchAdminDashboard (placeholder) | PENDING |
| `src/screens/WelcomeScreen.tsx` | Exists but not used in navigator | PENDING |
| Phone number field in coach profile | Edit mode shows phone field but it's never saved (not in handleSave payload) | IN_PROGRESS |
| `src/lib/icsImporterReal.ts` | Frontend ICS importer — superseded by Cloud Function but still present | LEGACY |
| `screens/TeamCalendarSettings.js` | Unused legacy screen | LEGACY |

### Partially Implemented Features

| Feature | Status | Notes |
|---------|--------|-------|
| Custom Questionnaire Builder | PLANNED | Admin UI shows "Create Custom Questionnaire — coming soon" alert |
| V3 Pain / worryFlag detection in coach alerts | IN_PROGRESS | Coach home and team screen only detect V1 pain fields; worryFlag from V3 not surfaced |
| Coach schedule response status | IN_PROGRESS | CoachScheduleScreen checks `physicalPain` field which is a V1/old field; response detection may miss V3 responses |
| Athlete detail screen V3 radar | IN_PROGRESS | AthleteDetailScreen reads V2 metric keys (cardioLoad, motorControl, etc.) — works for V2 responses but V3 metric keys differ (tankLevel, legBounce, etc.) |

---

## SECTION 6 — SECURITY AUDIT SUMMARY

### Firestore Security Rules Analysis

| Rule | Intended Behavior | Verified | Issues |
|------|------------------|---------|--------|
| `users/{uid}` read | Own doc, admin, or coach of same team | PASS | Coach can read any user if they share a teamId — teamId field check added |
| `users/{uid}` create | Only self | PASS | - |
| `users/{uid}` update | Self (cannot change role/teamId) or admin | PASS | VULN-03 fixed: `!request.resource.data.diff(resource.data).affectedKeys().hasAny(['role','teamId'])` |
| `users/{uid}` delete | Admin only | PASS | - |
| `teams/{teamId}` read | Admin, coach of team, team member | PASS | - |
| `teams/{teamId}` create/delete | Admin only | PASS | - |
| `teams/{teamId}` update | Admin, or signed-in user incrementing members count by exactly +1 | PASS | The `members + 1` check prevents arbitrary write but allows any signed-in user to increment count — acceptable for join flow |
| `teams/{teamId}/members/{uid}` read | Admin, self, coach of team, or any team member | PASS | Any team member can read all other members — intended |
| `teams/{teamId}/members/{uid}` create | Self, or coach, or admin | PASS | This means any coach (not just of this team) can add members — minor gap |
| `teams/{teamId}/trainings/{trainingId}` read | Admin, coach of team, team member, or user with matching teamId | PASS | - |
| `teams/{teamId}/trainings/{trainingId}` create | Admin, or team member creating isTestSession:true | PASS | - |
| `teams/{teamId}/trainings/{trainingId}` update/delete | Admin only | PASS | - |
| `responses/{uid}` get | Admin, own response (athlete), or coach of team | PASS | - |
| `responses/{uid}` list | Admin or coach of team only | PASS | Athletes cannot list responses — must use direct get |
| `responses/{uid}` create | Athlete within 5h window OR isTestSession | PASS | isQuestionnaireWindowOpen() function verified |
| `responses/{uid}` create | responseId must equal request.auth.uid | PASS | Prevents creating responses for other athletes |
| `questionnaires` read | Any signed-in user | PASS | - |
| `questionnaires` write | Admin only | PASS | - |
| `pendingQuestionnaireReminders` read | Admin only | PASS | - |
| `pendingQuestionnaireReminders` write | false (CF Admin SDK only) | PASS | - |
| `ai_training_dataset` | read/write: false | PASS | CF Admin SDK bypasses rules |
| No unauthenticated reads | signedIn() required on all paths | PASS | VULN-01 fixed |
| collectionGroup responses | Admin or coach of team (teamId-based) | PASS | VULN-02 fixed via isCoachOfTeam() |

### Security Observations

| Finding | Severity | Notes |
|---------|----------|-------|
| `isCoachOfTeam(teamId)` is identical to `isTeamMember(teamId)` — both check membership subcollection existence, not the member's role field | LOW | Any team member (athlete) passes isCoachOfTeam check for responses list. In practice, the `isCoach()` check (users.role=coach) precedes `isCoachOfTeam()`, so athletes still cannot list responses — combination is correct |
| Any `coach` (not specifically this team's coach) can create members on any team | LOW | `createMembership` CF validates the invite code suffix, so in practice this path is controlled |
| SSRF protection in Cloud Functions validates HTTPS + blocks private IP ranges including GCP metadata endpoint (169.254.x.x) | PASS | Well-implemented |
| FCM VAPID key hardcoded in `src/services/fcmService.js` | LOW | VAPID key is public by design in FCM; not a secret |
| Firebase project credentials hardcoded in service files | INFO | Web SDK config is intended to be public; security enforced by Firestore rules and Firebase Auth |
| `gabfavergeat@gmail.com` gets auto-admin role in client code | LOW | Convenience feature, cannot escalate privileges since Firestore rules block self-role-change |

---

## SECTION 7 — STATUS SUMMARY TABLE

| Feature | File | Status | Layer | Priority |
|---------|------|--------|-------|----------|
| Email/Password Login | `screens/StitchLoginScreen.js` | DONE | FE | — |
| Account Creation | `screens/StitchCreateAccountScreen.js` | DONE | FE | — |
| Auth State + Role Detection | `navigation/StitchNavigator.js` | DONE | FE | — |
| Role-Based Navigation | `navigation/StitchNavigator.js` | DONE | FE | — |
| Browser Session Persistence | `navigation/StitchNavigator.js` | DONE | FE | — |
| Login Count Tracking | `navigation/StitchNavigator.js` | DONE | FE | — |
| Join by Invite Code | `navigation/StitchNavigator.js` + `functions/index.js` | DONE | BOTH | — |
| Onboarding Notifications Screen | `src/screens/OnboardingNotifScreen.tsx` | DONE | FE | — |
| Athlete Home 4-State Logic | `src/stitch_components/AthleteHomeNew.tsx` | DONE | FE | — |
| Athlete Schedule | `screens/StitchScheduleScreen.js` | DONE | FE | — |
| Athlete Profile | `screens/StitchProfileScreen.js` | DONE | FE | — |
| Questionnaire V3 (6 sliders) | `screens/StitchQuestionnaireScreen.js` | DONE | FE | — |
| Friction Matrix (Q7–Q10) | `screens/StitchQuestionnaireScreen.js` | DONE | FE | — |
| Dynamic Questionnaire Loading | `screens/StitchQuestionnaireScreen.js` | DONE | FE | — |
| Questionnaire Time Window | `screens/StitchQuestionnaireScreen.js` | DONE | FE | — |
| Readiness Score (V3 weighted) | `screens/StitchQuestionnaireScreen.js` | DONE | FE | — |
| Response Save to Firestore | `src/lib/responses.ts` | DONE | FE | — |
| Deep Link to Questionnaire | `navigation/StitchNavigator.js` | DONE | FE | — |
| isTestSession Banner | `screens/StitchQuestionnaireScreen.js` | DONE | FE | — |
| Coach Home KPI Cards | `src/screens/CoachHomeScreen.tsx` | DONE | FE | — |
| Coach Home Alerts (last training) | `src/screens/CoachHomeScreen.tsx` | DONE | FE | — |
| Coach Home Pain Detection (V3) | `src/screens/CoachHomeScreen.tsx` | IN_PROGRESS | FE | HIGH |
| Coach Team Roster | `src/screens/CoachTeamScreen.tsx` | DONE | FE | — |
| Athlete Detail Screen | `src/screens/AthleteDetailScreen.tsx` | DONE | FE | — |
| Athlete Detail V3 Radar Metrics | `src/screens/AthleteDetailScreen.tsx` | IN_PROGRESS | FE | HIGH |
| Coach Schedule (Day/Week/Month) | `src/screens/CoachScheduleScreen.tsx` | DONE | FE | — |
| Coach Schedule Response Status | `src/screens/CoachScheduleScreen.tsx` | IN_PROGRESS | FE | MEDIUM |
| Coach Profile Edit | `src/screens/CoachProfileScreen.tsx` | DONE | FE | — |
| Coach Profile Phone Save | `src/screens/CoachProfileScreen.tsx` | IN_PROGRESS | FE | LOW |
| Performance Dashboard | `src/screens/PerformanceDashboard.tsx` | DONE | FE | — |
| Morning Brief Tab | `src/screens/PerformanceDashboard.tsx` | DONE | FE | — |
| DAR Analytics 2×2 Quadrant | `src/components/DARPerformanceChart.tsx` | DONE | FE | — |
| EMA 28d Trendline Chart | `src/screens/PerformanceDashboard.tsx` | DONE | FE | — |
| Radar Chart | `src/screens/PerformanceDashboard.tsx` | DONE | FE | — |
| Deviation Chart | `src/screens/PerformanceDashboard.tsx` | DONE | FE | — |
| Workload AU Chart | `src/screens/PerformanceDashboard.tsx` | DONE | FE | — |
| Player Filter Chips | `src/screens/PerformanceDashboard.tsx` | DONE | FE | — |
| Duration Filter (7/14/30/90d) | `src/screens/PerformanceDashboard.tsx` | DONE | FE | — |
| isTestSession Exclusion | `src/screens/PerformanceDashboard.tsx` | DONE | FE | — |
| Admin Home Team Grid | `src/screens/AdminHomeScreen.tsx` | DONE | FE | — |
| Admin Logout | `src/screens/AdminHomeScreen.tsx` | DONE | FE | — |
| Create Team Modal | `src/screens/CreateTeamModal.tsx` | DONE | FE | — |
| Team Logo Upload | `src/screens/CreateTeamModal.tsx` | DONE | FE | — |
| DAR Metric Selection | `src/screens/CreateTeamModal.tsx` | DONE | FE | — |
| Admin Team Detail (Dashboard-first) | `src/screens/AdminTeamDetailScreen.tsx` | DONE | FE | — |
| Admin Settings Drawer | `src/screens/AdminTeamDetailScreen.tsx` | DONE | FE | — |
| Team Info Edit | `src/screens/AdminTeamDetailScreen.tsx` | DONE | FE | — |
| Access Codes (Coach + Athlete) | `src/screens/AdminTeamDetailScreen.tsx` | DONE | FE | — |
| Calendar Sync Config | `src/screens/AdminTeamDetailScreen.tsx` | DONE | FE | — |
| Calendar Events Preview | `src/screens/AdminTeamDetailScreen.tsx` | DONE | FE | — |
| Questionnaire Assignment | `src/screens/AdminTeamDetailScreen.tsx` | DONE | FE | — |
| Custom Questionnaire Builder | `src/screens/AdminTeamDetailScreen.tsx` | PLANNED | FE | MEDIUM |
| Admin "Teams" Tab (real) | `navigation/StitchNavigator.js` | PENDING | FE | HIGH |
| Admin "Analytics" Tab (real) | `navigation/StitchNavigator.js` | PENDING | FE | MEDIUM |
| DAR Algorithm | `src/utils/useDARAlgorithm.ts` | DONE | FE | — |
| EMA Calculation | `src/utils/analytics.ts` | DONE | FE | — |
| V1→V2 Field Mapping | `src/utils/analytics.ts` | DONE | FE | — |
| Questionnaire Templates (5 sports) | `src/utils/questionnaireTemplates.ts` | DONE | FE | — |
| Default Questionnaire Seeding | `src/utils/questionnaireTemplates.ts` | DONE | FE | — |
| FCM Service Worker | `public/firebase-messaging-sw.js` | DONE | BE | — |
| FCM Initialization | `src/services/fcmService.js` | DONE | FE | — |
| Web Push Token Registration | `src/services/webNotifications.ts` | DONE | FE | — |
| Foreground Notification Display | `src/services/fcmService.js` | DONE | FE | — |
| Questionnaire Available CF (CRON 1min) | `functions/index.js` | DONE | BE | — |
| Questionnaire Reminder CF (CRON 5min) | `functions/index.js` | DONE | BE | — |
| Test Notification CF | `functions/index.js` | DONE | BE | — |
| 24h Token Re-Registration | `src/services/fcmService.js` | DONE | FE | — |
| ICS Calendar Sync CRON (15min) | `functions/index.js` | DONE | BE | — |
| ICS Calendar Sync Manual | `functions/index.js` | DONE | BE | — |
| SSRF Protection | `functions/index.js` | DONE | BE | — |
| ICS Hash-Based Upsert | `functions/index.js` | DONE | BE | — |
| Questionnaire Auto-Link (CF) | `functions/index.js` | DONE | BE | — |
| Team Membership CF | `functions/index.js` | DONE | BE | — |
| Lookup Team by Code CF | `functions/index.js` | DONE | BE | — |
| Orphan Event Deletion | `functions/index.js` | DONE | BE | — |
| Sync Status Tracking | `functions/index.js` | DONE | BE | — |
| GDPR Anonymization CF | `functions/index.js` | DONE | BE | — |
| Firestore Security Rules (V2) | `firestore.rules` | DONE | BE | — |
| Response Composite Indexes | `firestore.indexes.json` | DONE | BE | — |
| useIsDesktop Hook | `src/hooks/useIsDesktop.ts` | DONE | FE | — |
| Design System Tokens | `src/constants/theme.ts` | DONE | FE | — |
| Build Pipeline (web:build) | `package.json` | DONE | INFRA | — |
| PWA Install Banner | `src/components/PWAInstallBanner.tsx` | DONE | FE | — |
| SplashScreen | `src/components/SplashScreen.tsx` | DONE | FE | — |

---

## APPENDIX: KEY CONSTANTS & CONFIGURATION

### App URLs
- **Production:** `https://champion-track-pro.vercel.app`
- **Firebase Project:** `championtrackpro`

### Notification Timing
- Questionnaire opens: immediately after `training.endUtc`
- Questionnaire closes: 5 hours after `training.endUtc`
- Reminder delay: 3 hours after training end
- CRON intervals: available notification = every 1 min, reminder = every 5 min, calendar sync = every 15 min

### DAR Algorithm Thresholds
- EMA window: 28 days
- GREEN zone: deviation within ±15%
- BLUE zone (under-load): deviation < -15%
- YELLOW zone (spike): deviation > +15%
- Minimum data points for classification: 3

### Test Data (Dev/Staging)
- Test team: TRAINING TEST (`Ri8kpStgWp9yymtS71tb`)
- Test coach UID: `fqXEQa0rjPdQcsCEcORWefOSzWw1`
- Test athlete UID: `84CKZH4GvTbxuK6g7bX73lQaaF32`

### Questionnaire Templates (seeded)
- `tpl-basketball-any` — Basketball Any Session (default)
- `tpl-basketball-game` — Basketball Game Day
- `tpl-handball-any` — Handball Any Session (default)
- `tpl-soccer-any` — Soccer Any Session (default)
- `tpl-generic-any` — Generic Any Session (default)

### V3 Metric Keys
`tankLevel`, `cardioLoad` (inverted), `legBounce`, `motorControl`, `tacticalSharpness`, `teamChemistry`

### V2 Metric Keys (legacy, still in analytics)
`cardioLoad`, `neuroLoad`, `sleepQuality`, `stressLevel`, `motorControl`, `tacticalLucidity`, `sessionRPE`

### V1 French Fields (legacy responses)
`impactCardiaque`, `impactMusculaire`, `sommeil`, `nervosite`, `technique`, `tactique`, `fatigue`
