# SteamLite Messages

A messenger made only for chatting with your Steam friends. It uses the same account and the same server as
SteamLite and SteamLite Mobile (SteamLite Online), so your chats, friends and streaks are the same everywhere.

Chats with seen/delivered ticks, typing indicators, photos, GIFs, voice messages, replies, reactions, polls,
group chats (with pictures), friend streaks, scheduled messages, starred messages, archive, mute, a friend QR code,
quiet hours, app lock, themes and wallpapers.

## Build

Open this folder in Android Studio, or run `gradlew assembleRelease`. The release key lives in `signing/`
(never uploaded). Push notifications need `app/google-services.json` (not in the repo).
If that file does not contain `com.steamlite.messages`, the Firebase settings inside it are used as they are.
To give this app its own Firebase registration, add an Android app with the package `com.steamlite.messages` in the
Firebase console and replace the file.

## Layout

| Folder | What it is |
| --- | --- |
| `app/src/main/assets/www/` | the screens (HTML, CSS, JavaScript) |
| `app/src/main/java/com/steamlite/messages/` | the Android shell: notifications, voice recording, photo picker, updates |
