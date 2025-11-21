## Cloud Functions – Dev & Deploy Notes

### Overview
The following functions are implemented in `functions/index.js`:

- `importTeamCalendarFromUrl` (HTTP with CORS) – imports an ICS calendar on-demand.
- `importTeamCalendarFromUrlCallable` – callable version for native clients.
- `syncIcsNow` / `syncIcsNowHttp` – manual sync entry points.
- `syncIcsEvery10min` – Pub/Sub cron to keep trainings up-to-date.
- `createMembership`, `sendQuestionnaireAvailableNotifications`.

All of them share the core importer (`importTeamCalendarCore` / `syncTeam`) so that the Admin import initializes a team and the cron keeps it synced.

### Local development
1. Install the Firebase CLI and log in.
2. From the repo root run:
   ```bash
   cd functions
   npm install
   firebase emulators:start --only functions
   ```
3. Point the web app to the emulator by setting (e.g. in `.env.local` or shell):
   ```
   EXPO_PUBLIC_FUNCTIONS_BASE_URL=http://localhost:5001/championtrackpro/us-central1
   ```
4. Start Expo web (`npx expo start --web`) and use the Admin dashboard. The “Import from URL” button will call the emulator endpoint with the same auth token.

### Deployment requirements
- **Upgrade to the Blaze plan**. Firebase Cloud Functions now require Cloud Build + Artifact Registry, which cannot be enabled on the Spark (free) plan. Without Blaze, `firebase deploy` fails and the old (non-CORS) code remains live.
- Once upgraded, deploy only the relevant functions:
  ```bash
  cd functions
  firebase deploy --only functions:importTeamCalendarFromUrl,functions:importTeamCalendarFromUrlCallable,functions:syncIcsNow,functions:syncIcsNowHttp,functions:syncIcsEvery10min,functions:createMembership,functions:sendQuestionnaireAvailableNotifications
  ```

### Production note
Current CORS errors seen from `http://localhost:8081` are because **no Cloud Functions are deployed** (project is on Spark). After upgrading to Blaze and running the deploy command above, the HTTP endpoint will return the proper `Access-Control-Allow-Origin` headers and imports will work both locally and on Vercel.


