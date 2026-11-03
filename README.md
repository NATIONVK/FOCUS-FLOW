# FOCUS FLOW

**Smart Study Timer & Productivity Tracker**  
Developed by **NATIONVK** · Author: **YEASIEN AHMED**

FOCUS FLOW is an offline-first study timer built with HTML, CSS, JavaScript and Capacitor. It includes Pomodoro, stopwatch, custom timer, subject tracking, analytics, tasks, notes, backup/restore and CSV export.

## Requirements
- Node.js 20+ (Node 22 recommended)
- npm
- Android Studio only if building locally
- GitHub account for cloud APK builds

## Run locally
```bash
npm install
npm run start
```
Open the Vite URL shown in the terminal.

## Build Android locally
```bash
npm install
npm run build
npx cap add android
npx cap sync android
npx cap open android
```
Build the APK from Android Studio, or:
```bash
cd android
./gradlew assembleDebug
```
APK output: `android/app/build/outputs/apk/debug/app-debug.apk`

## Build APK with GitHub Actions
1. Create a GitHub repository named `FOCUS-FLOW`.
2. Upload/push all project files to the repository root.
3. Open **Actions** and enable workflows if GitHub asks.
4. Run **Build FOCUS FLOW Android APK** using **Run workflow**, or push a commit to `main`/`master`.
5. Open the completed workflow run.
6. Download the artifact named `focus-flow-debug-apk`.
7. Extract the ZIP to get `app-debug.apk`.

The workflow creates a debug APK for testing. A Play Store release requires a signed release build and secure signing configuration.

## Features
- Pomodoro focus timer, stopwatch and custom timer
- Timestamp-based countdown so elapsed time can be recalculated after backgrounding
- Local notifications on native Android
- Subjects with color labels
- Daily goals, streak, weekly chart and study history
- Tasks and notes
- CSV export and JSON backup/restore
- Dark/light/system theme preference
- Local-first persistence using Capacitor Preferences on Android and localStorage in browser

## Notes / limitations
- Timer completion notifications are scheduled when the app is active and the timer completes. This initial version recalculates the timer from timestamps when the app returns to foreground; it does not yet install a persistent Android foreground service or an exact-alarm scheduler. Android may restrict background execution, so do not treat this initial build as an alarm-clock replacement.
- Language setting is saved, but full Bangla UI translation is a follow-up implementation.
- Analytics currently summarizes completed focus sessions. Break intervals are not added to study totals.
- Browser preview is for development; use the Android APK for native notifications and haptics.

## Project structure
```text
FOCUS-FLOW/
├── .github/workflows/build-android.yml
├── src/
│   ├── main.js
│   └── styles.css
├── index.html
├── package.json
├── capacitor.config.json
├── .gitignore
└── README.md
```

## Privacy
No account or server is required. Study records are stored locally on the device. Export a backup before clearing app data or uninstalling.
