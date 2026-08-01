# Android project notes

## `google-services.json` provisioning

`android/app/google-services.json` is intentionally **gitignored** (see `.gitignore`),
unlike the equivalent web config (`VITE_firebaseConfig.ts`, which is committed — Firebase
web/Android client config isn't secret by itself, access is enforced by Firestore
rules/App Check rather than by hiding these values). It's kept out of git because it's
generated per-developer from the Firebase console and tends to drift/duplicate across
local setups; a stale or wrong committed copy would silently break `google-services`
plugin builds for everyone else.

Before building `android/` (`./gradlew assembleDebug`, `npx cap run android`, etc.), pull
your own copy from the Firebase console: **Project settings → General → Your apps →
Android app (`com.smart.pantry`) → `google-services.json`**, and place it at
`android/app/google-services.json`.

## SDK version / toolchain single source of truth

SDK levels and library versions are currently split across three files by necessity, not
by accident:

- **`android/variables.gradle`** — authoritative for `minSdkVersion`, `compileSdkVersion`,
  `targetSdkVersion`, `kotlin_version`, and the various `androidx*Version` values. This
  file is consumed via `rootProject.ext.*` by every Capacitor plugin under
  `node_modules/@capacitor/*/android/build.gradle` (third-party/generated — those files
  can't be repointed at the Gradle version catalog) **and** by `android/app/build.gradle`'s
  `minSdk`/`targetSdk`, so the app module and plugin modules can't drift apart.
- **`android/gradle/libs.versions.toml`** — the modern Gradle version catalog, authoritative
  for `agp`, `compileSdk`, and first-party app dependency versions (Firebase BOM, AndroidX
  libs referenced directly by `android/app/build.gradle`, etc.).
- **`android/build.gradle`** — the `buildscript { classpath 'com.android.tools.build:gradle:...' }`
  line duplicates `libs.versions.toml`'s `agp` value. This block resolves before the
  version catalog is available, so it can't reference `libs.versions.agp.get()` directly.

**When bumping AGP or compileSdk**, update both `libs.versions.toml` and the matching
value in `variables.gradle` (`compileSdkVersion`) / `build.gradle` (the `classpath`
line) by hand — they're documented with cross-reference comments at each definition site
so it's easy to find the other copy.
