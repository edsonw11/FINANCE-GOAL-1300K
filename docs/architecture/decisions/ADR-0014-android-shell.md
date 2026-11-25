# ADR-0014: Android app as a Capacitor shell (Phase 8)

Status: accepted. Context: the product needs an Android app; the web app is plain HTML/CSS/JS with local storage and an offline-first design (ADR-0008).

## Decisions

1. **Same app, a native shell.** Capacitor 8 wraps `dist/index.html` (one file, everything inlined). No second code base. `appId` is `com.everfox.app` (**to be confirmed before the first Play Store upload: it cannot change afterwards**).
2. **Offline first, no network in the shell for now.** The page for the shell (`scripts/build-mobile.py`) carries its own Content-Security-Policy meta tag: scripts pinned by sha256, `connect-src 'none'`. The Android app keeps its data on the phone. Sync is switched off inside the shell (`isNative()` → the sync layer reports "unavailable").
3. **Why sync waits.** The API's login is a cookie session on the API's own origin (ADR-0009: BFF, SameSite, CSRF by `Origin`). The shell runs on `https://localhost`, another origin: cookies, CSRF and the OIDC redirect do not carry over. The phone needs its own sign-in (system browser + app link + a token kept in the Android Keystore, with matching server routes). That is a separate step with its own threat model, not a patch on this one.
4. **Backup leaves through the share sheet.** A WebView does not download a Blob link. `ui/native-bridge.js` writes the JSON to the app cache and opens the system share sheet (`@capacitor/filesystem`, `@capacitor/share`, reached as `Capacitor.Plugins.*`, no bundler needed). A cancelled sheet or a write failure does not mark the backup as done.
5. **Hardening of the shell.** `allowBackup="false"` (personal finance data does not go to cloud backup by default), no cleartext, no mixed content, WebView debugging off.
6. **Build.** `scripts/mobile.sh` (`doctor`, `web`, `sync`, `apk`). The Capacitor CLI needs Node 22; the script fetches it for that command only. CI builds the debug APK on every push and keeps it as an artifact.

## Consequences and known limits

- Not proven on a device or emulator in this phase (none available here): what is proven is the web page under its policy with a scripted Capacitor (`tests/smoke-native.js`), the bridge logic (unit tests) and the APK's contents (CI).
- A WebView old enough to lack `DOCUMENT_START_SCRIPT` makes Capacitor inject its bridge as an inline script, which this policy blocks: the app would run as in a browser (offline, no native share). Current WebViews are updated through the Play Store; raise `minSdk` or add the hash if it matters.
- The hardware Back button is Capacitor's default (it leaves the app when there is no browser history); sheets are not wired to it yet.
- INTERNET stays in the manifest for the future sign-in/sync; the policy, not the permission, keeps the app offline today.
