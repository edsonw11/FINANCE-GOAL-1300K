# ADR-0014: Android app as a Capacitor shell (Phase 8)

Status: accepted. Context: the product needs an Android app; the web app is plain HTML/CSS/JS with local storage and an offline-first design (ADR-0008).

## Decisions

1. **Same app, a native shell.** Capacitor 8 wraps `dist/index.html` (one file, everything inlined). No second code base. `appId` is `com.everfox.app` (**to be confirmed before the first Play Store upload: it cannot change afterwards**).
2. **Offline first, no network in the shell for now.** The page for the shell (`scripts/build-mobile.py`) carries its own Content-Security-Policy meta tag: scripts pinned by sha256, `connect-src 'none'`. The Android app keeps its data on the phone. Sync is switched off inside the shell (`isNative()` → the sync layer reports "unavailable").
3. **Why sync waits.** The API's login is a cookie session on the API's own origin (ADR-0009: BFF, SameSite, CSRF by `Origin`). The shell runs on `https://localhost`, another origin: cookies, CSRF and the OIDC redirect do not carry over. The phone needs its own sign-in (system browser + app link + a token kept in the Android Keystore, with matching server routes). That is a separate step with its own threat model, not a patch on this one.
4. **Backup leaves through the share sheet.** A WebView does not download a Blob link. `ui/native-bridge.js` writes the JSON to the app cache and opens the system share sheet (`@capacitor/filesystem`, `@capacitor/share`, reached as `Capacitor.Plugins.*`, no bundler needed). A cancelled sheet or a write failure does not mark the backup as done.
5. **Hardening of the shell.** `allowBackup="false"` (personal finance data does not go to cloud backup by default), no cleartext, no mixed content, WebView debugging off.
6. **Build.** `scripts/mobile.sh` (`doctor`, `web`, `sync`, `apk`). The Capacitor CLI needs Node 22; the script fetches it for that command only. CI builds the debug APK on every push and keeps it as an artifact.

7. **The Back button is the app's.** The Android WebView does not give a `<dialog>` the Back gesture, so Capacitor left the app with a sheet open (found on the emulator). `ui/native-bridge.js` handles `@capacitor/app`'s `backButton`: the innermost thing closes first (confirmation, other dialogs, sheet level, sheet), then any tab goes back to the summary, and only then the app is left.
8. **Bars follow the theme.** The area behind the status and gesture bars is the page's own background in light and dark (`values/` and `values-night/everfox_colors.xml`); `MainActivity` re-resolves the icon style when the system theme changes while the app is open (the SystemBars plugin kept the old one: dark clock on a dark bar).
9. **Tested on a virtual phone.** `scripts/mobile.sh test` builds the APK with WebView debugging (`MOBILE_DEBUG=1`, only in the generated copy of the config), installs it and runs `scripts/device-test.mjs` through the DevTools protocol and adb: startup, plugins, CSP in force, offline use, data surviving a kill, share sheet, backup file and full restore, Back behaviour, 3 screen sizes, dark theme, rotation, pixel checks of the bars, and 1500 random touches. Defects it found and that are fixed: Back left the app with a sheet open; the budget field of Categorias overflowed a 360 dp screen; the strip behind the bars was grey in dark mode; status icons stayed dark after a live switch to dark mode.

## Consequences and known limits

- Proven on an Android 15 emulator (API 35, WebView 124) by `scripts/device-test.mjs`, in the browser with a scripted Capacitor (`tests/smoke-native.js`), by unit tests and by the APK checks in CI. **Not yet on a physical phone**, on other Android versions, or on a WebView 140 or newer (where `env(safe-area-inset-*)` works natively). The emulator test is not part of CI (it needs hardware acceleration and takes minutes); run it before a release.
- A WebView old enough to lack `DOCUMENT_START_SCRIPT` makes Capacitor inject its bridge as an inline script, which this policy blocks: the app would run as in a browser (offline, no native share). Current WebViews are updated through the Play Store; raise `minSdk` or add the hash if it matters.
- In landscape the fixed header (title, tabs and the report buttons) takes about 45% of the height of a phone. It works, but it is uncomfortable; locking phones to portrait is an option (not done).
- INTERNET stays in the manifest for the future sign-in/sync; the policy, not the permission, keeps the app offline today.
