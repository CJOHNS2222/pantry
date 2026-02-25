#!/bin/bash

# Stock & Spoon Website Deployment Script
# This script helps deploy the website to various hosting platforms

set -e

echo "🚀 Stock & Spoon Website Deployment"
echo "====================================="

# Check if dist exists
if [ ! -d "dist" ]; then
    echo "❌ dist/ directory not found. Run 'npm run build' first."
    exit 1
fi

echo "✅ Build found in dist/"

# Choose deployment method
echo ""
echo "Choose deployment method:"
echo "1. Vercel"
echo "2. Netlify"
echo "3. Firebase Hosting"
echo "4. GitHub Pages"
echo "5. Manual (just build)"
echo ""

read -p "Enter choice (1-5): " choice

case $choice in
    1)
        echo "📦 Deploying to Vercel..."
        if ! command -v vercel &> /dev/null; then
            echo "Installing Vercel CLI..."
            npm install -g vercel
        fi
        vercel --prod
        ;;
    2)
        echo "📦 Deploying to Netlify..."
        if ! command -v netlify &> /dev/null; then
            echo "Installing Netlify CLI..."
            npm install -g netlify-cli
        fi
        netlify deploy --prod --dir dist
        ;;
    3)
        echo "📦 Deploying to Firebase Hosting..."
        if ! command -v firebase &> /dev/null; then
            echo "Installing Firebase CLI..."
            npm install -g firebase-tools
        fi
        firebase deploy --only hosting
        ;;
    4)
        echo "📦 Preparing for GitHub Pages..."
        echo "Manual steps:"
        echo "1. Push the dist/ contents to your gh-pages branch"
        echo "2. Enable GitHub Pages in repository settings"
        echo "3. Set source to 'gh-pages branch'"
        ;;
    5)
        echo "✅ Build ready for manual deployment"
        echo "Upload the contents of dist/ to your hosting provider"
        ;;
    *)
        echo "❌ Invalid choice"
        exit 1
        ;;
esac

echo ""
echo "🎉 Deployment complete!"
echo "🌐 Your website should be live at the provided URL"
echo ""
echo "Don't forget to:"
echo "- Test the landing page (/) and web app (/app)"
echo "- Verify PWA installation works"
echo "- Check mobile responsiveness"