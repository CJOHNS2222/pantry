import fs from 'fs';
import path from 'path';

const componentMap = {
    "Login": "auth-onboarding", "FirstTimeFlow": "auth-onboarding", "ModernOnboarding": "auth-onboarding", "ModernOnboardingFlow": "auth-onboarding", "ValueDemo": "auth-onboarding", "ContextualTutorial": "auth-onboarding", "FeatureDiscovery": "auth-onboarding", "ProgressiveFeature": "auth-onboarding", "WhatsNewModal": "auth-onboarding", "FeatureTooltip": "auth-onboarding",
    "Household": "household", "HouseholdActivityFeed": "household", "HouseholdInviteModal": "household", "HouseholdShoppingShare": "household", "HouseholdStatusIndicator": "household", "Community": "household",
    "EnhancedShoppingListItem": "shopping-list", "GroceryCostEstimator": "shopping-list", "ShoppingList": "shopping-list", "ShoppingListAnalytics": "shopping-list", "SmartShoppingListOrganizer": "shopping-list", "SmartShoppingSuggestions": "shopping-list", "StoreLayoutEditor": "shopping-list", "OfflineShoppingIndicator": "shopping-list",
    "MealPlanner": "recipes-meals", "MealPrepPlanner": "recipes-meals", "RecipeFinder": "recipes-meals", "RecipeModal": "recipes-meals", "PopularRecipes": "recipes-meals", "RecipeRecommendations": "recipes-meals", "RecipeRating": "recipes-meals", "RecipeRatingPage": "recipes-meals", "CookingMode": "recipes-meals", "RecipeCommunityInsights": "recipes-meals",
    "PantryScanner": "pantry", "PantryHealthScore": "pantry", "PantryAnalytics": "pantry", "ItemDetailModal": "pantry", "QuickAdd": "pantry", "QuickAddModal": "pantry", "ImportModal": "pantry", "ExpirationDatePicker": "pantry", "ExpiredItemsLaunchSheet": "pantry", "ExpiredItemsModal": "pantry", "FreezeTransitionModal": "pantry", "QuantityUnitPicker": "pantry", "VisualQuantitySelector": "pantry", "PortionSelector": "pantry", "SmartCategorySelector": "pantry", "SmartRecommendations": "pantry", "StorageLocationIndicator": "pantry", "CategoryManager": "pantry", "BatchOperations": "pantry", "PriceTrends": "pantry",
    "LeftoverAnalytics": "leftovers", "LeftoverPersonaQuestionnaire": "leftovers", "LeftoverQuickCapture": "leftovers", "LeftoversHotZone": "leftovers",
    "DatabaseAnalytics": "admin-analytics", "MonitoringDashboard": "admin-analytics", "PerformanceMonitoringDashboard": "admin-analytics", "UserBehaviorAnalytics": "admin-analytics", "UsageIndicator": "admin-analytics", "RemoteConfigDebugPanel": "admin-analytics",
    "Settings": "settings", "NotificationSettings": "settings", "SubscriptionManager": "settings", "FAQPage": "settings", "PremiumFeature": "settings",
    "AdMobBanner": "ui", "AppBadge": "ui", "ComponentErrorBoundary": "ui", "ErrorBoundary": "ui", "GeminiLoadingOverlay": "ui", "GeminiTokenDebugger": "ui", "GlobalUpdatePrompt": "ui", "NotificationBanner": "ui", "PendingNotifications": "ui", "ContextualPermissions": "ui", "OnlineIndicator": "ui", "ProgressiveImage": "ui", "SkeletonLoader": "ui", "SyncIndicator": "ui", "VersionUpdate": "ui", "RiskAssessmentQuestionnaire": "ui", "RiskExplanationModal": "ui", "SectionStatePanel": "ui"
};

function getAllFiles(dirPath, arrayOfFiles) {
  const files = fs.readdirSync(dirPath);
  arrayOfFiles = arrayOfFiles || [];
  files.forEach(function(file) {
    if (fs.statSync(dirPath + "/" + file).isDirectory()) {
      if (file !== 'node_modules' && file !== 'dist' && file !== '.git' && file !== 'android' && file !== 'ios') {
        arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles);
      }
    } else {
      if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        arrayOfFiles.push(path.join(dirPath, file));
      }
    }
  });
  return arrayOfFiles;
}

const allFiles = getAllFiles(process.cwd());
let modifiedFiles = 0;

for (const filePath of allFiles) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;
    
    const importRegex = /(import|export)\s+(?:.*?)\s+from\s+['"]([^'"]+)['"]|import\(['"]([^'"]+)['"]\)/g;
    
    content = content.replace(importRegex, (match, p1, p2, p3) => {
        let isDynamic = false;
        let importPath = p2;
        if (!importPath) {
            importPath = p3;
            isDynamic = true;
        }
        
        if (!importPath.startsWith('.')) return match;
        
        // Find if current file is one of the strictly moved files
        let fileBasename = path.basename(filePath);
        if (fileBasename.endsWith('.tsx')) fileBasename = fileBasename.slice(0, -4);
        if (fileBasename.endsWith('.ts')) fileBasename = fileBasename.slice(0, -3);
        
        const targetFolderForFile = componentMap[fileBasename];
        const isMovedComponent = targetFolderForFile && filePath.toLowerCase().includes(`\\components\\${targetFolderForFile}\\${path.basename(filePath)}`.toLowerCase());
        
        let oldDir = path.dirname(filePath);
        if (isMovedComponent) {
            oldDir = path.dirname(oldDir); // it moved down one level
        }
        
        const targetAbs = path.resolve(oldDir, importPath);
        
        let targetBasename = path.basename(targetAbs);
        if (targetBasename.endsWith('.tsx')) targetBasename = targetBasename.slice(0, -4);
        if (targetBasename.endsWith('.ts')) targetBasename = targetBasename.slice(0, -3);
        
        let actualTargetAbs = targetAbs;
        let targetFolder = componentMap[targetBasename];
        
        if (targetFolder && targetAbs.toLowerCase().includes(path.join(process.cwd(), 'components', targetBasename).toLowerCase())) {
           actualTargetAbs = path.join(process.cwd(), 'components', targetFolder, targetBasename);
        }
        
        let rel = path.relative(path.dirname(filePath), actualTargetAbs);
        rel = rel.replace(/\\/g, '/');
        if (!rel.startsWith('.')) {
            rel = './' + rel;
        }
        
        if (!importPath.endsWith('.tsx') && !importPath.endsWith('.ts') && rel.endsWith('.tsx')) {
            rel = rel.slice(0, -4);
        } else if (!importPath.endsWith('.tsx') && !importPath.endsWith('.ts') && rel.endsWith('.ts')) {
            rel = rel.slice(0, -3);
        }
        
        if (isDynamic) {
            return `import('${rel}')`;
        } else {
            return match.replace(/['"]([^'"]+)['"]/, `'${rel}'`);
        }
    });
    
    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        modifiedFiles++;
    }
}
console.log(`Imports fixed in ${modifiedFiles} files.`);
