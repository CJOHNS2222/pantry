Robo directives for Firebase Test Lab

This folder contains a template Robo directives file you can use with `gcloud firebase test android run`.

Steps to run manually

1. Edit `robo-directives.json` and replace the following placeholders:
   - `com.your.app.package` → your Android app package (see `android/app/src/main/AndroidManifest.xml`).
   - `com.your.app.package:id/email_input` → resource name or other selector for your email field.
   - `com.your.app.package:id/password_input` → resource name or selector for your password field.
   - `com.your.app.package:id/login_button` → resource name for the login button.
   - `<EMAIL>` and `<PASSWORD>` → replace with a test account's credentials. Avoid using production credentials in CI.

2. Run the Robo test with gcloud (example):

```bash
gcloud firebase test android run \
  --type robo \
  --app android/app/build/outputs/apk/debug/app-debug.apk \
  --robo-directives testlab/robo/robo-directives.json \
  --device model=shiba,version=30 \
  --timeout 30m
```

Notes and recommendations

- For hybrid/webview apps the Robo runner may not see web elements. If your app renders in a WebView, prefer an Espresso/instrumentation test that performs the login using the web layer's test hooks or use accessibility labels.
- Do NOT commit real credentials. Instead, create a test-only account and replace the placeholders locally before running, or load credentials from a secure secret store and generate the directives at runtime.
- If resource names are unknown, run `adb shell uiautomator dump` on a device to inspect view hierarchy, or run one Robo attempt and download the UI hierarchy from the Test Lab GCS output.

If you want, I can generate an Espresso test that performs the login and is safe to run in Test Lab (no plaintext credentials in the repo). Tell me if you'd like that.
