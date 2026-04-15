# CHAMPIONTRACKPRO — Master Context & Brand Guidelines
# Colle ce bloc en début de chaque conversation Claude / Claude Code

---

## 🏢 PRODUCT

**Name:** ChampionTrackPro  
**Tagline EN:** "Make better decisions. Based on how your athletes actually feel."  
**Tagline FR:** "Prenez de meilleures décisions. Basées sur les vraies réactions de vos athlètes."  
**Category:** Athletic Performance Intelligence SaaS  
**Stage:** MVP — 0 paying clients. 1 validated experience with a French D1 handball club.  
**Go-to-market:** Direct outreach (email/DM) to US basketball coaches → 6-week free trial in exchange for testimonial.

**Core promise:**  
Help coaches make smarter training decisions by tracking how their athletes respond to each session — so they can perform more, better, more often.

**No direct competitor identified in the US market.**  
Reference universe: Hudl (video), Catapult (wearables), TeamBuildr (strength) — CTP sits at the intersection but focuses on post-training subjective response + analytics.

---

## 👥 USER ROLES

| Role | Device | Core Job |
|------|--------|----------|
| **Athlete** | Mobile only | Fill post-training questionnaires |
| **Coach** | Desktop | Monitor team, analyze performance, make decisions |
| **Admin** | Desktop | Manage multiple teams and coaches |

---

## 🛠 TECH STACK

| Layer | Tech |
|-------|------|
| Frontend | React Native Web + Expo |
| Database | Firebase / Firestore |
| Auth | Firebase Auth |
| Backend | Cloud Functions |
| Deploy | Vercel |
| Repo | GitHub — `main` branch |
| Code tool | Claude Code (terminal) |

---

## 📁 KEY FILES

```
navigation/StitchNavigator.js       → Main navigation (AthleteTabs / CoachTabs / AdminTabs)
screens/StitchLandingScreen.js      → Landing page
src/screens/CoachHomeScreen.tsx     → Coach home
src/screens/CoachScheduleScreen.tsx → Coach schedule/planning
src/screens/PerformanceDashboard.tsx→ Analytics (recharts)
src/screens/AdminHomeScreen.tsx     → Admin team selector
```

---

## 🎨 DESIGN SYSTEM

### Colors
```
Background:     #0A0F1E
Cards:          #0D1526
Accent cyan:    #00D4FF
Cyan dim:       rgba(0,212,255,0.08)
Cyan border:    rgba(0,212,255,0.14)
Muted text:     rgba(255,255,255,0.38)
Primary btn:    linear-gradient(135deg, #00BFFF, #0066FF)
Success:        #00FF9D
Warning:        #FFB800
```

### Typography
```
Display / Hero: Bebas Neue (letter-spacing: 2-10px)
UI / Body:      DM Sans (weights: 300, 400, 500, 600)
Mono / Labels:  Space Mono (letter-spacing: 1.5-4px, uppercase)
```

### Logo
```
File:           /logo/logo_final.jpeg   (NEVER use Windows absolute path)
Usage:          mixBlendMode: 'screen'
Fallback CSS:   font-family Palatino, "CHAMPIONTRACK" white + "PRO" cyan
```

### Rules
- Scrollbar hidden on all screens
- `useIsDesktop()` mandatory on all Coach and Admin screens
- All UI text in **English**
- Logo path always `/logo/filename` — never `C:\Users\...`

---

## 🧪 TEST DATA

```
Team:           TRAINING TEST
teamId:         Ri8kpStgWp9yymtS71tb
Athletes:       bball_pg_1 → bball_c_10 (10 basketball players, 90 days of data)
Coach test UID: fqXEQa0rjPdQcsCEcORWefOSzWw1
Coach email:    coachtest@gmail.com
```

---

## ⚙️ DEV RULES

```bash
# Deploy Firestore rules
firebase deploy --only firestore:rules

# After every fix — always commit
git add . && git commit -m "your message" && git push origin main
```

- Never use Windows absolute paths in code
- Never break existing navigation structure in StitchNavigator.js
- Always check useIsDesktop() is imported before using it
- Recharts is the charting library — do not replace it

---

## 🚧 ACTIVE WORK (update as you go)

| # | Task | Status |
|---|------|--------|
| 1 | Vercel build fix — commit `2b50c18` | 🔴 In progress |
| 2 | PerformanceDashboard dropdowns (Players/Position) | 🟡 Pending |
| 3 | AthleteDetailScreen — new screen from My Team | 🟡 Pending |
| 4 | Coach Profile — edit name + photo | 🟡 Pending |
| 5 | Logo — static image centered on landing | 🟢 Done |

---

## 🗣 TONE & VOICE

**EN:** Serious. Data-driven. Direct. No fluff. Speaks to high-level coaches who don't have time.  
**FR:** Professionnel. Précis. Orienté terrain. Pas de jargon marketing.

**Never say:** "revolutionary", "game-changer", "disruptive"  
**Always say:** "performance data", "athlete response", "training load", "readiness"
