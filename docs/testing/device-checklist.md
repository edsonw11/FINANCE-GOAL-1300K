# Device checklist (a real phone)

## What was and was not run

- No physical phone is connected to this machine (`lsusb` shows no Android device). `adb` exists at `~/Android/Sdk/platform-tools/adb`; it is only missing from the PATH.
- An Android **emulator** was already running (`emulator-5554`, Pixel-like image, Android 15, API 35, x86_64). `scripts/mobile.sh test` was run on it: it built the test APK, installed it and ran `scripts/device-test.mjs`: **23 steps, 23 ok, 0 failed** (start and draw, status bar contrast in both themes, native plugins, CSP enforced in the real WebView, offline entry, data survives a kill, backup and share sheet, restore round trip, hardware Back closes a sheet, three screen sizes, dark theme, rotation, 1500 random touches with a fixed seed, no crash or ANR). Time to draw the screens: 10.7 s from launch (emulator, loaded machine).
- **This is not a test on a real phone.** The emulator has no real touch screen, no vendor WebView, no physical keyboard behaviour, no real file picker apps, and a fast CPU. Everything below is for a person to do.

## Checklist for a real phone (about 20 minutes)

Install the APK sent by `scripts/send-apk.sh`. Note the phone model, Android version, and the screen size and density (Settings, About phone).

| Area | What to do | Expected |
|---|---|---|
| Resolution and size | Open the app. Note width x height. Repeat on a small phone (width 360 or less) if you have one. | Nothing is cut at the sides; no horizontal scroll in any tab. |
| Navigation | Tap each bottom tab, then open and close a record, a sheet and a dialog. Use the Back gesture or button in each. | Back closes the sheet or dialog first; Back on the first screen leaves the app, not before. |
| Loading | Cold start (swipe the app away first). Count the seconds to the first screen. | Under about 5 s on a normal phone; no blank white screen. |
| Rotation | Rotate in the Resumo and in a form. | Data stays; layout fits; nothing typed is lost. |
| Virtual keyboard | Open "new record", tap the value, description and date fields. | The field being typed is visible above the keyboard; the Save button can be reached; the money field shows the numeric keyboard and masks as `R$ 1.234,56`. |
| Scrolling | Scroll the list of records (a year of test data from Ajustes), the report and the investments tab. | Smooth; the top bar and the bottom menu stay in place; no content hidden under the bars. |
| Forms | Save with an empty value; save an expense; edit it; delete it and use "Desfazer". | Inline message for the empty value; each action works once (no duplicate). |
| File upload | Ajustes, import: pick a real **CSV**, an **OFX** and a digital **PDF** from the phone's storage or Downloads; then a PDF with a password; then a photo. | CSV, OFX, PDF: a review list with the right dates and values. Password PDF: "Este PDF tem senha". Photo: refused with a reason. Importing the same file twice adds nothing. |
| Share and backup | Ajustes, export a backup; choose an app in the share sheet; then import that file back. | The sheet opens; after restore the data is the same. |
| Small screens | Font size set to the largest in Android settings; display size large. | Text wraps; buttons are still tappable; no overlap. |
| Dark theme | Switch the phone to dark while the app is open. | The app follows; the clock and icons in the status bar stay readable. |
| Loading states | Start an import of a large PDF. | Something shows that it is working; it can be cancelled or finishes. |
| Messages and alerts | Trigger: empty value, invalid file, offline backup, delete with undo, pay an invoice (partial and cancel). | Each message is in Portuguese, says what happened and what to do, and disappears or can be closed. |
| App lock (if on) | Turn the lock on, put the app in the background for a minute, open it again. | It asks for the PIN or the biometrics; Cancel does not open the data. |
| Interruptions | Receive a call or switch apps in the middle of a form, then return. | The form is as it was. |

Write the result of each row (ok, problem, not applicable) and the phone model, and keep the file with the release notes.
