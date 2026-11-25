# telegram-apk: send the Android test APK to a Telegram chat

A small separate service (no dependencies, Node 20+) that posts the debug APK to a Telegram group, so it can be installed on a phone without cables. It is a delivery tool for test builds, not part of the app.

## Set up (once)

```
cp services/telegram-apk/.env.example services/telegram-apk/.env     # git ignores .env
# fill TELEGRAM_TOKEN (from @BotFather) and TELEGRAM_CHAT_ID_<NAME> (the group id, starts with -100)
npm run apk:check        # proves the token and the chat work; posts nothing
```

The bot must be a member of the group (for a supergroup, being a member is enough to post documents).

## Use

```
npm run apk:send                       # shows the chat and the caption, asks "[y/N]", then sends app-debug.apk
npm run apk:send -- --build --yes      # builds the APK first, sends without asking
npm run apk:send -- --dry-run          # shows what would be sent, sends nothing
npm run apk:send -- --note "test the Back button" --chat FOXRISK --file path/to/other.apk
```

The message has the commit, the size and the sha256 of the file. On the phone: open Telegram, tap the file, download, tap again to install (allow "install unknown apps" for Telegram when asked). To check it is the same file: compare the sha256 (`sha256sum app-debug.apk` on the computer).

## Safety

- It always asks before posting, naming the chat, because other members of the group will see the file. `--yes` skips the question; without a terminal it refuses to ask and stops.
- The token lives only in `.env` (ignored by git) or in the environment, and is replaced by `***` in any error. `scripts/secret-scan.sh` looks for bot tokens in tracked files.
- A bot token is a password: if it was pasted anywhere (a chat, a ticket, an AI conversation), revoke it in @BotFather (`/revoke`) and put the new one in `.env`.
- Only an `.apk` that is a real zip, at most 50 MB (Telegram's limit for bots), is sent.

## Layout and tests

```
send-apk.mjs        the command line (asks, then sends)
lib/env.mjs         reads .env and the environment
lib/apk.mjs         validates the APK, writes the caption
lib/telegram.mjs    getMe, getChat, sendMessage, sendDocument (the only code that talks to Telegram)
postman/            collection + environment (empty values) to try the same calls by hand
test/               node --test, against a fake Telegram server (npm run test:services)
```

Tests never reach the real Telegram: `TELEGRAM_API_BASE` points them at a local fake.
