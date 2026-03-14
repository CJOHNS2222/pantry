If you need to update the website in the future, just run firebase deploy --only hosting and it will deploy to the website site. If you want to deploy the app, you can temporarily change the "site" field back to the original site name.





# Firebase App Distribution Setup

This document explains how to use Firebase App Distribution to distribute your Smart Pantry app to testers.

## Prerequisites

1. **Firebase Project**: Make sure your app is registered with Firebase
2. **Firebase CLI**: Install the Firebase CLI (`npm install -g firebase-tools`)
3. **Authentication**: Authenticate with Firebase using one of these methods:
   - Firebase CLI: `firebase login`
   - Service Account Key (for CI/CD)

## Configuration Files

### Release Notes
- **File**: `android/release-notes.txt`
- **Purpose**: Contains release notes for each build
- **Update**: Edit this file before each release with new features and fixes

### Testers List
- **File**: `android/testers.txt`
- **Purpose**: List of email addresses for testers
- **Format**: One email per line
- **Update**: Add/remove tester emails as needed

## Building and Distributing

### Method 1: Using Firebase CLI Authentication (Recommended for local development)

1. **Login to Firebase**:
   ```bash
   firebase login
   ```

2. **Build and distribute**:
   ```bash
   cd android
   ./gradlew assembleRelease appDistributionUploadRelease
npm run sync-release-notes && npm run build && cd android && ./gradlew assembleRelease appDistributionUploadRelease
   ```

### Method 2: Using Firebase Token (For CI/CD)

1. **Get Firebase Token**:
   ```bash
   firebase login:ci
   ```
   This will output a token like `1/a1b2c3d4e5f67890`

2. **Set environment variable**:
   ```bash
   export FIREBASE_TOKEN=your_token_here
   ```

3. **Build and distribute**:
   ```bash
   cd android
   ./gradlew assembleRelease appDistributionUploadRelease
   ```

### Method 3: Using Service Account (For CI/CD)

1. **Create Service Account Key** in Firebase Console
2. **Download JSON key file**
3. **Configure in build.gradle** or use environment variable

## Gradle Tasks Available

- `assembleRelease`: Build the APK
- `appDistributionUploadRelease`: Upload to App Distribution
- `appDistributionAddTesters`: Add new testers
- `appDistributionRemoveTesters`: Remove testers

## Command Line Overrides

You can override configuration values:

```bash
./gradlew appDistributionUploadRelease \
  --releaseNotes="Custom release notes" \
  --testers="new-tester@example.com"
```

## Managing Testers

### Add Testers
```bash
./gradlew appDistributionAddTesters \
  --projectNumber=YOUR_PROJECT_NUMBER \
  --emails="tester1@example.com,tester2@example.com"
```

### Remove Testers
```bash
./gradlew appDistributionRemoveTesters \
  --projectNumber=YOUR_PROJECT_NUMBER \
  --emails="tester1@example.com"
```

## Troubleshooting

### Common Issues

1. **Authentication Failed**:
   - Make sure you're logged in with `firebase login`
   - Or set the `FIREBASE_TOKEN` environment variable
   - Or configure service account credentials

2. **Build Fails**:
   - Ensure you have the correct signing configuration
   - Check that all dependencies are available

3. **Upload Fails**:
   - Verify your Firebase project configuration
   - Check that the package name matches your Firebase app

### Debug Mode
Enable stacktrace in `gradle.properties`:
```
firebaseAppDistribution.stacktrace=true
```

## Firebase Console

After successful upload, you'll get links to:
- **Firebase Console**: Manage releases and testers
- **Testing URI**: Direct link for testers to download
- **Binary Download**: Direct APK download link

Monitor tester progress and feedback in the Firebase App Distribution dashboard.