# Stock & Spoon - Website Deployment Guide

## Overview

Stock & Spoon now includes a beautiful marketing website alongside the PWA app. The website serves as a landing page to showcase the app's features and drive user acquisition.

## Architecture

- **Landing Page** (`/`): Marketing website with feature highlights, screenshots, and call-to-action buttons
- **Web App** (`/app`): Full PWA application with all functionality
- **PWA Support**: Installable as a progressive web app from any modern browser

## Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Visit:
# - Landing page: http://localhost:3000/
# - Web app: http://localhost:3000/app
```

## Production Build

```bash
# Build for production
npm run build

# The dist/ folder contains all files needed for deployment
```

## Deployment Options

### 1. Static Hosting (Recommended)

Deploy the `dist/` folder to any static hosting service:

- **Vercel**: `vercel --prod`
- **Netlify**: Drag and drop the `dist/` folder
- **GitHub Pages**: Use GitHub Actions to deploy
- **AWS S3 + CloudFront**: Static website hosting
- **Firebase Hosting**: `firebase deploy --only hosting`

### 2. Server Configuration

If deploying to a server with routing, ensure:

- All routes (`/*`) serve `index.html`
- Static assets are served from `/assets/`
- Proper MIME types for `.webmanifest` and `.js` files

### 3. CDN Deployment

For global distribution:

```bash
# Example: Deploy to AWS CloudFront
aws s3 sync dist/ s3://your-bucket-name --delete
aws cloudfront create-invalidation --distribution-id YOUR_DISTRIBUTION_ID --paths "/*"
```

## Key Features

### Landing Page
- Responsive design for all devices
- Feature showcase with icons and descriptions
- App screenshots (using pantry images as placeholders)
- Call-to-action buttons linking to the web app
- SEO optimized with meta tags and Open Graph

### Web App
- Full PWA functionality
- Offline support via service worker
- Installable on desktop and mobile
- Firebase integration for data sync
- Household sharing capabilities

## SEO & Social Sharing

The landing page includes:
- Meta tags for search engines
- Open Graph tags for Facebook sharing
- Twitter Card support
- Structured data for rich snippets

## Mobile App Integration

The website complements the mobile app:
- Same branding and design language
- Links to app stores (when published)
- PWA installation prompts
- Cross-platform compatibility

## Performance

- Lazy-loaded images and components
- Optimized bundle splitting
- Service worker for caching
- Fast loading with Vite build system

## Analytics

The website includes hooks for:
- Google Analytics
- Firebase Analytics
- Custom event tracking

## Maintenance

### Updating Content
1. Edit `src/components/LandingPage.tsx` for landing page content
2. Edit `App.tsx` for app functionality
3. Update `public/manifest.webmanifest` for PWA metadata

### Adding Screenshots
1. Add new images to `public/images/`
2. Update the LandingPage component to reference them
3. Rebuild and redeploy

### Feature Updates
1. Develop new features in the app
2. Update landing page content to reflect changes
3. Test both landing page and app functionality

## Troubleshooting

### Common Issues

1. **Routing not working**: Ensure your hosting provider serves `index.html` for all routes
2. **PWA not installing**: Check that `manifest.webmanifest` is served with correct MIME type
3. **Images not loading**: Verify image paths in the landing page component
4. **Build failing**: Check for TypeScript errors and missing dependencies

### Debug Commands

```bash
# Check build output
npm run build
ls -la dist/

# Test locally
npm run dev

# Validate PWA
npx lighthouse http://localhost:3000/app
```

## Future Enhancements

- [ ] Add blog section for recipes and tips
- [ ] Implement user testimonials
- [ ] Add pricing/subscription information
- [ ] Integrate with app stores for direct downloads
- [ ] Add multi-language support
- [ ] Implement A/B testing for landing page optimization