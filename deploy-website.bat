@echo off
REM Smart Pantry Chef Website Deployment Script
REM This script helps deploy the website to various hosting platforms

echo 🚀 Smart Pantry Chef Website Deployment
echo =====================================

REM Check if dist exists
if not exist "dist" (
    echo ❌ dist/ directory not found. Run 'npm run build' first.
    pause
    exit /b 1
)

echo ✅ Build found in dist/

REM Choose deployment method
echo.
echo Choose deployment method:
echo 1. Vercel
echo 2. Netlify
echo 3. Firebase Hosting
echo 4. GitHub Pages
echo 5. Manual (just build)
echo.

set /p choice="Enter choice (1-5): "

if "%choice%"=="1" goto vercel
if "%choice%"=="2" goto netlify
if "%choice%"=="3" goto firebase
if "%choice%"=="4" goto github
if "%choice%"=="5" goto manual
goto invalid

:vercel
echo 📦 Deploying to Vercel...
call npx vercel --prod
goto end

:netlify
echo 📦 Deploying to Netlify...
call npx netlify-cli deploy --prod --dir dist
goto end

:firebase
echo 📦 Deploying to Firebase Hosting...
call npx firebase-tools deploy --only hosting
goto end

:github
echo 📦 Preparing for GitHub Pages...
echo Manual steps:
echo 1. Push the dist/ contents to your gh-pages branch
echo 2. Enable GitHub Pages in repository settings
echo 3. Set source to 'gh-pages branch'
goto end

:manual
echo ✅ Build ready for manual deployment
echo Upload the contents of dist/ to your hosting provider
goto end

:invalid
echo ❌ Invalid choice
pause
exit /b 1

:end
echo.
echo 🎉 Deployment complete!
echo 🌐 Your website should be live at the provided URL
echo.
echo Don't forget to:
echo - Test the landing page (/) and web app (/app)
echo - Verify PWA installation works
echo - Check mobile responsiveness
echo.
pause