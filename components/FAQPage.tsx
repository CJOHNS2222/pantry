import React, { useState } from 'react';
import { ArrowLeft, Search, ChevronDown, ChevronRight } from 'lucide-react';

// FAQ Data Structure
interface FAQItem {
  id: string;
  category: string;
  question: string;
  answer: string;
  keywords: string[];
}

const FAQ_DATA: FAQItem[] = [
  // Plans & Limits
  {
    id: 'plans-1',
    category: 'Plans & Limits',
    question: 'What are the limits on the Free plan?',
    answer: 'The Free plan includes the following limits:\n\n• **Saved Recipes**: Up to 10 recipes saved\n• **AI Scans**: 5 per week (pantry scans, receipt scanning, AI kitchen assistant)\n• **Meal Plan Entries**: 3 per week\n• **Meal Plan View**: Current week only (no monthly calendar)\n• **Custom Categories**: 1 custom pantry category\n• **Grocery Cost Estimator**: First 5 ingredients shown\n\nWhen you reach a limit, you\'ll see an upgrade prompt. Upgrade to Premium or Family via Settings → More → Subscription.',
    keywords: ['free plan', 'limits', 'upgrade', 'cap', 'restrict', 'categories', 'meal plan', 'recipes', 'ai scans']
  },
  {
    id: 'plans-2',
    category: 'Plans & Limits',
    question: 'What does Premium unlock?',
    answer: 'Premium unlocks:\n\n• **Up to 20 saved recipes**\n• **Unlimited meal plan entries**\n• **15 AI scans per week**\n• **Unlimited custom pantry categories**\n• **Full grocery cost estimator** (all ingredients)\n• **Monthly calendar view** in Meal Planner\n• **Up to 3 household members**\n\nUpgrade via Settings → More → Subscription on an Android device through Google Play Billing.',
    keywords: ['premium', 'upgrade', 'unlock', 'features', 'subscription', 'paid']
  },
  {
    id: 'plans-3',
    category: 'Plans & Limits',
    question: 'How do I upgrade my plan?',
    answer: 'To upgrade:\n\n1. Go to **Settings** (gear icon)\n2. Tap the **More** tab\n3. Open **Subscription**\n4. Tap **View Plans** and choose Premium or Family\n5. Complete the purchase through **Google Play Billing**\n\nYour subscription status syncs automatically. On iOS or web, use an Android device with Play Store access to complete the upgrade.\n\nYou can also view your current usage at any time under **Settings → Account → Usage & Limits**.',
    keywords: ['upgrade', 'premium', 'family', 'subscribe', 'google play', 'billing', 'purchase']
  },

  // Getting Started
  {
    id: 'getting-started-1',
    category: 'Getting Started',
    question: 'How do I add items to my pantry?',
    answer: 'You can add items to your pantry in several ways:\n\n1. **Manual Entry**: Tap the "+" button in the Pantry tab and fill in the item details\n2. **Barcode Scanning**: Use the camera button to scan product barcodes\n3. **Voice Input**: Use the microphone button to speak item names\n4. **Bulk Import**: Import multiple items from a CSV file using the Import feature\n\nFor best results, include expiration dates, quantities, and storage locations when adding items.',
    keywords: ['add', 'pantry', 'items', 'scan', 'barcode', 'voice', 'import', 'csv']
  },
  {
    id: 'getting-started-2',
    category: 'Getting Started',
    question: 'How do I set up my household for sharing?',
    answer: 'To set up household sharing:\n\n1. Go to Settings > Household\n2. Tap "Create Household" or "Join Household"\n3. If creating, give your household a name\n4. Share the invite code with family members\n5. Each member can join using the code\n\nOnce set up, you can share pantry items, shopping lists, and meal plans with your household.',
    keywords: ['household', 'sharing', 'family', 'invite', 'join', 'create']
  },
  {
    id: 'getting-started-3',
    category: 'Getting Started',
    question: 'What are the different tabs and what do they do?',
    answer: 'Stock & Spoon has several main tabs:\n\n• **Pantry**: View and manage your food inventory\n• **Shopping**: Create and manage shopping lists\n• **Meal Planner**: Plan meals and find recipes\n• **Community**: Share recipes and connect with others\n• **Settings**: Customize your app preferences\n\nEach tab is designed to help you manage different aspects of your food inventory and meal planning.',
    keywords: ['tabs', 'navigation', 'pantry', 'shopping', 'meal planner', 'community', 'settings']
  },

  {
    id: 'getting-started-4',
    category: 'Getting Started',
    question: 'What is the Recipes (Chef) tab?',
    answer: 'The Recipes tab — labelled **Chef** in the bottom navigation — is your recipe hub:\n\n• **Smart Recommendations** (collapsed card at the top) — personalised suggestions based on your current pantry inventory, expiring items, and time of day. Tap to expand and see which saved recipes you can cook right now.\n• **Recipe Finder** — search for new recipes by keyword, dietary tag, or cuisine. Toggle **"Use pantry items"** to restrict results to what you already have at home.\n• **Saved Recipes** — all recipes you have bookmarked appear here. Tap the heart/bookmark icon on any recipe to save it.\n• **Add to Meal Plan** — tap any recipe and choose **Add to Plan** to push it straight into the Meal Planner calendar.\n\nRecipes found here can also be opened in **Cooking Mode** for step-by-step distraction-free guidance.',
    keywords: ['recipes tab', 'chef tab', 'recipe finder', 'smart recommendations', 'saved recipes', 'browse recipes', 'recipe search', 'pantry items']
  },

  // Pantry Management
  {
    id: 'pantry-1',
    category: 'Pantry Management',
    question: 'How do I track expiration dates?',
    answer: 'Expiration dates are automatically tracked when you add items:\n\n1. When adding an item, enter the expiration date\n2. Items are color-coded by freshness:\n   - Green: Fresh (more than 7 days)\n   - Yellow: Expiring soon (3-7 days)\n   - Red: Expired or expiring today\n3. Set up notifications in Settings to get alerts\n4. Use the "Expired Items" filter to see items that need attention\n\nThe app uses FEFO (First Expired, First Out) to help you use older items first.',
    keywords: ['expiration', 'dates', 'freshness', 'notifications', 'fefo', 'expired', 'alerts']
  },
  {
    id: 'pantry-2',
    category: 'Pantry Management',
    question: 'What are batches and how do they work?',
    answer: 'Batches help you track multiple purchases of the same item:\n\n• **Independent Expiration**: Each batch has its own expiration date\n• **Quantity Tracking**: Track how much of each batch you have\n• **Smart Consumption**: The app suggests using older batches first (FEFO)\n• **Automatic Alerts**: Get notified when specific batches are expiring\n\nFor example, if you buy milk twice in one week, each carton becomes a separate batch with its own expiration date.',
    keywords: ['batches', 'expiration', 'fefo', 'quantity', 'tracking', 'consumption']
  },
  {
    id: 'pantry-3',
    category: 'Pantry Management',
    question: 'How do I handle opened items with different shelf lives?',
    answer: 'For items that change shelf life after opening:\n\n1. Mark an item as "Opened" when you first use it\n2. Set the "Opened Expiry" date (usually found on the package)\n3. The app will track both original and opened expiration dates\n4. Get reminders when opened items are approaching their use-by date\n\nThis is especially useful for items like opened cans, dairy products, and condiments.',
    keywords: ['opened', 'expiry', 'shelf life', 'opened expiry', 'use-by', 'reminders']
  },
  {
    id: 'pantry-4',
    category: 'Pantry Management',
    question: 'What are "immortal" items and when should I use them?',
    answer: 'Immortal items are things that don\'t expire:\n\n• **Pantry Staples**: Salt, sugar, rice, pasta, canned goods\n• **Non-perishables**: Dried beans, spices, baking soda\n• **Household Items**: Cleaning supplies, paper products\n\nMark items as immortal to prevent false expiration alerts. These items will never show up in expiration warnings but can still be included in shopping lists when quantities get low.',
    keywords: ['immortal', 'non-perishable', 'staples', 'expiration', 'never expires']
  },
  {
    id: 'pantry-5',
    category: 'Pantry Management',
    question: 'What is the difference between Best By, Use By, and Sell By dates?',
    answer: 'These three labels mean different things — and only two of them belong in Stock & Spoon:\n\n• **Best By / Best If Used By** — a quality date set by the manufacturer. The food is safe to eat after this date but may lose flavour, texture, or aroma. Most pantry staples (cereal, crackers, canned goods, frozen vegetables) carry this label. Choose "Best By" in the app for these items.\n\n• **Use By** — the last date the manufacturer recommends for peak quality and, for many perishables, safety. Dairy, fresh meat, deli items, and prepared foods often carry this label. The app treats Use By dates with higher urgency (shorter alert window). Choose "Use By" for these items.\n\n• **Sell By** — an inventory and restocking date for the store, not a safety date for you. Milk purchased on the sell-by date is typically fine for 5–7 more days if properly refrigerated. You do not need to enter sell-by dates — find the best-by or use-by date on the package instead.\n\nWhen in doubt, choose "Best By." Stock & Spoon uses this as the safer default for most items.',
    keywords: ['best by', 'use by', 'sell by', 'expiration', 'date label', 'safety', 'quality', 'food date', 'printed date']
  },
  {
    id: 'pantry-6',
    category: 'Pantry Management',
    question: 'How does the app handle items I put in the freezer?',
    answer: 'When you change an item\'s storage location to Freezer (tap the item, change Storage Location, then save), Stock & Spoon automatically extends its expiry to the USDA-recommended freezer shelf life:\n\n• Ground beef / hamburger — 4 months\n• Chicken, turkey, duck — 9 months\n• Beef steaks / roasts, lamb, veal — 9 months\n• Pork, ham, sausage, bacon — 6 months\n• Lean fish (cod, tilapia, halibut) — 6 months\n• Salmon and other fatty fish — 3 months\n• Shrimp and shellfish — 4 months\n• Deli / cured meats — 2 months\n• Bread and baked goods — 3 months\n• Everything else — 4 months\n\nFrozen items only show expiry alerts within 30 days of the expected use-by date, and the language is gentler: "best used within N days (frozen)" rather than urgent red warnings.\n\nYou can always tap the item and override the date manually — the app trusts your judgment.',
    keywords: ['freezer', 'frozen', 'shelf life', 'usda', 'chicken', 'beef', 'ground meat', 'auto expiry', 'freeze date', 'storage location']
  },
  {
    id: 'pantry-7',
    category: 'Pantry Management',
    question: 'Why don\'t dry goods and canned items get automatic expiry dates?',
    answer: 'Pasta, rice, flour, canned goods, cereals, crackers, spices, and similar shelf-stable items typically last 1–4 years and pose very little food-safety risk before that. Auto-assigning expiry dates to these would create a constant stream of low-value alerts, making it harder to notice the ones that actually matter — fresh meat, dairy, and produce.\n\nIf a package has a printed best-by date you care about, you can set it manually. Tap the item, tap the Expiration field, and choose a date.\n\nItems that genuinely never expire (salt, sugar, honey) can be flagged as "Shelf Stable" from the item detail screen. That permanently silences all expiry alerts for that item.',
    keywords: ['dry goods', 'canned', 'pasta', 'rice', 'no expiry', 'shelf stable', 'immortal', 'auto date', 'cereal', 'flour', 'pantry staple']
  },
  {
    id: 'shopping-1',
    category: 'Shopping Lists',
    question: 'How do I create a shopping list?',
    answer: 'Create shopping lists in multiple ways:\n\n1. **Auto-generated**: The app suggests items based on your meal plan\n2. **Manual Creation**: Tap "+" in the Shopping tab to add items\n3. **From Recipes**: Add all ingredients from a recipe at once\n4. **Smart Suggestions**: Get suggestions for pantry staples and frequently used items\n5. **Voice Input**: Use the microphone to add items by speaking\n\nLists are automatically organized by store aisle for efficient shopping.',
    keywords: ['shopping list', 'create', 'auto-generated', 'recipes', 'voice', 'aisle', 'suggestions']
  },
  {
    id: 'shopping-2',
    category: 'Shopping Lists',
    question: 'How does auto-restock work?',
    answer: 'Auto-restock automatically adds depleted items to your shopping list:\n\n1. **Mark Items**: In Settings, mark which items are "auto-restock staples"\n2. **Low Quantity Alerts**: When quantities get low, items are automatically added\n3. **Smart Timing**: Only adds items when you\'re actually running low\n4. **Household Sharing**: Works across household members\n\nThis ensures you never run out of essential pantry items without manual tracking.',
    keywords: ['auto-restock', 'staples', 'low quantity', 'automatic', 'household']
  },
  {
    id: 'shopping-3',
    category: 'Shopping Lists',
    question: 'How do I organize my shopping list by store layout?',
    answer: 'Shopping lists are automatically organized by store aisle:\n\n1. **Default Layout**: Uses standard grocery store organization\n2. **Custom Layout**: Customize aisle names in Settings > Store Layout\n3. **Multiple Stores**: Add named store profiles (e.g. Whole Foods, Costco) with independent aisle orders — switch between them using the store picker on the shopping list screen\n4. **Drag & Drop**: Reorder aisles within each store profile\n5. **Check Off**: Mark items as you shop to track progress\n\nThis saves time by grouping similar items together during shopping.',
    keywords: ['store layout', 'aisle', 'organize', 'custom', 'drag drop', 'check off']
  },

  // Meal Planning
  {
    id: 'meal-planning-1',
    category: 'Meal Planning',
    question: 'How do I plan meals for the week?',
    answer: 'Weekly meal planning is easy:\n\n1. **Open Meal Planner**: Go to the Meal Planner tab\n2. **Select Days**: Choose which days to plan\n3. **Add Recipes**: Search for recipes or use saved ones\n4. **Auto Shopping List**: Automatically generate shopping lists from your plan\n5. **Nutritional Info**: See nutritional breakdown for each day\n6. **Household Sharing**: Share meal plans with family members\n\nThe app considers your dietary preferences and available pantry items when suggesting recipes.',
    keywords: ['meal planning', 'weekly', 'recipes', 'shopping list', 'nutritional', 'dietary']
  },
  {
    id: 'meal-planning-2',
    category: 'Meal Planning',
    question: 'How do I find and save recipes?',
    answer: 'Finding and saving recipes:\n\n1. **Search**: Use the recipe search in Meal Planner\n2. **AI Suggestions**: Get personalized recipe recommendations\n3. **Save Recipes**: Tap the heart icon to save favorites\n4. **Rate & Review**: Rate recipes you\'ve tried\n5. **Filter by Preferences**: Recipes respect your dietary restrictions\n6. **Offline Access**: Saved recipes work offline\n\nRecipes include nutritional information, ingredient lists, and step-by-step instructions.',
    keywords: ['recipes', 'search', 'save', 'ai suggestions', 'rate', 'filter', 'offline']
  },
  {
    id: 'meal-planning-3',
    category: 'Meal Planning',
    question: 'How does the app handle dietary restrictions in recipes?',
    answer: 'Dietary restrictions are automatically considered:\n\n1. **Recipe Filtering**: Only shows recipes that match your preferences\n2. **Allergy Alerts**: Highlights ingredients you\'re allergic to\n3. **Substitution Suggestions**: Suggests alternatives for restricted ingredients\n4. **Nutritional Labels**: Shows dietary information (vegan, gluten-free, etc.)\n5. **Household Preferences**: Considers all household members\' restrictions\n\nSet your preferences in Settings > Food Safety for personalized recipe recommendations.',
    keywords: ['dietary restrictions', 'allergies', 'filtering', 'substitutions', 'household']
  },

  // Recipes & Cooking
  {
    id: 'recipes-1',
    category: 'Recipes & Cooking',
    question: 'How do I use recipes in meal planning?',
    answer: 'Using recipes in meal planning:\n\n1. **Find Recipe**: Search for recipes in the Meal Planner\n2. **Add to Plan**: Drag recipes to specific days/meals\n3. **Scale Recipe**: Adjust serving sizes as needed\n4. **Auto Shopping**: Ingredients automatically added to shopping list\n5. **Pantry Check**: See which ingredients you already have\n6. **Cooking Mode**: Step-by-step cooking instructions\n\nThe app tracks which ingredients you use from your pantry.',
    keywords: ['recipes', 'meal planning', 'scale', 'shopping', 'pantry check', 'cooking mode']
  },
  {
    id: 'recipes-2',
    category: 'Recipes & Cooking',
    question: 'What is cooking mode and how do I use it?',
    answer: 'Cooking mode provides distraction-free cooking:\n\n1. **Enter Mode**: Tap "Start Cooking" on any recipe\n2. **Step-by-Step**: Large, clear instructions one step at a time\n3. **Timer Integration**: Built-in timers for cooking steps\n4. **Hands-Free**: Voice guidance for hands-free cooking\n5. **Progress Tracking**: See your progress through the recipe\n6. **Pause/Resume**: Pause and resume cooking as needed\n\nPerfect for following complex recipes without distractions.',
    keywords: ['cooking mode', 'step-by-step', 'timer', 'voice', 'hands-free', 'progress']
  },
  {
    id: 'recipes-3',
    category: 'Recipes & Cooking',
    question: 'How do I handle leftovers and food waste?',
    answer: 'Managing leftovers effectively:\n\n1. **Leftover Mode**: Mark items as leftovers when cooking\n2. **Storage Tracking**: Track how leftovers are stored\n3. **Use Suggestions**: Get suggestions for using leftovers\n4. **Expiration Alerts**: Special alerts for leftover items\n5. **Waste Analytics**: Track and analyze food waste patterns\n6. **Persona Settings**: Customize leftover safety preferences\n\nThe app helps reduce food waste with smart suggestions and tracking.',
    keywords: ['leftovers', 'food waste', 'storage', 'analytics', 'persona', 'suggestions']
  },

  // Household & Sharing
  {
    id: 'household-1',
    category: 'Household & Sharing',
    question: 'How do I manage multiple household members?',
    answer: 'Managing household members:\n\n1. **Add Members**: Invite family members to join your household\n2. **Individual Preferences**: Each member can set their own dietary preferences\n3. **Shared Resources**: Pantry, shopping lists, and meal plans are shared\n4. **Permission Levels**: Control what each member can do\n5. **Activity Feed**: See what other members are doing\n6. **Notifications**: Get notified of important household activities\n\nPerfect for families, roommates, or shared kitchens.',
    keywords: ['household', 'members', 'sharing', 'preferences', 'permissions', 'activity']
  },
  {
    id: 'household-2',
    category: 'Household & Sharing',
    question: 'How do I share shopping lists with my household?',
    answer: 'Sharing shopping lists:\n\n1. **Automatic Sharing**: Lists created in a household are automatically shared\n2. **Real-time Updates**: See changes as other members add/remove items\n3. **Assignment**: Tap the person icon on any item to assign it to a household member\n4. **Notes**: Tap the message icon on any item to add a note visible to all members (e.g. "low fat" or "organic only")\n5. **Check-off**: Mark items as purchased in real-time\n6. **History**: View past shopping lists and purchases\n\nCollaborative shopping made easy for busy households.',
    keywords: ['shopping lists', 'sharing', 'real-time', 'assignment', 'check-off', 'comments']
  },
  {
    id: 'household-3',
    category: 'Household & Sharing',
    question: 'What are household permissions and how do they work?',
    answer: 'Household permissions control access:\n\n• **Owner**: Full control over household settings and members\n• **Manager**: Can add/remove items, create lists, manage recipes\n• **Member**: Can view and use shared resources\n• **Guest**: Limited access, read-only for most features\n\nPermissions ensure everyone has appropriate access while maintaining household organization.',
    keywords: ['permissions', 'owner', 'manager', 'member', 'guest', 'access control']
  },

  // Settings & Preferences
  {
    id: 'settings-1',
    category: 'Settings & Preferences',
    question: 'How do I customize notifications?',
    answer: 'Customizing notifications:\n\n1. **Go to Settings**: Open Settings > Notifications\n2. **Alert Types**: Choose what to be notified about\n   - Expiration alerts\n   - Shopping reminders\n   - Meal planning suggestions\n   - Household activities\n3. **Timing**: Set when you want to receive notifications\n4. **Frequency**: Control how often you get reminded\n5. **Quiet Hours**: Set times when you don\'t want notifications\n\nNotifications help you stay on top of your food inventory and meal planning.',
    keywords: ['notifications', 'alerts', 'timing', 'frequency', 'quiet hours', 'customize']
  },
  {
    id: 'settings-2',
    category: 'Settings & Preferences',
    question: 'How do I set up dietary preferences?',
    answer: 'Setting dietary preferences:\n\n1. **Food Safety Section**: Go to Settings > Food Safety\n2. **Dietary Restrictions**: Check all that apply (vegetarian, vegan, etc.)\n3. **Allergies**: Mark ingredients you\'re allergic to\n4. **Favorite Cuisines**: Choose cuisines you prefer\n5. **Preferred Proteins**: Select proteins you like\n6. **Household Members**: Set individual preferences for each person\n\nThese preferences affect recipe suggestions, shopping lists, and meal planning.',
    keywords: ['dietary preferences', 'restrictions', 'allergies', 'cuisines', 'proteins', 'food safety']
  },
  {
    id: 'settings-3',
    category: 'Settings & Preferences',
    question: 'How do I change the app theme and appearance?',
    answer: 'Customizing appearance:\n\n1. **Theme Settings**: Go to Settings > Theme Settings\n2. **Color Mode**: Choose between light and dark themes\n3. **Accent Color**: Pick your preferred accent color\n4. **Background**: Customize background colors if desired\n5. **Text Colors**: Adjust text colors for readability\n6. **Reset Option**: Use "Reset to Default" to restore original settings\n\nThe app adapts to your visual preferences while maintaining readability.',
    keywords: ['theme', 'appearance', 'colors', 'dark mode', 'light mode', 'accent']
  },

  // Offline & Sync
  {
    id: 'offline-1',
    category: 'Offline & Sync',
    question: 'How does the app work offline?',
    answer: 'Offline functionality:\n\n1. **Full Access**: Most features work without internet\n2. **Local Storage**: Data is stored locally on your device\n3. **Sync When Online**: Changes automatically sync when connected\n4. **Offline Recipes**: Saved recipes are available offline\n5. **Offline Shopping**: Create and manage lists without connection\n6. **Smart Caching**: Frequently used data is cached for offline access\n\nYou can use the app fully even without internet access.',
    keywords: ['offline', 'sync', 'local storage', 'no internet', 'caching', 'sync']
  },
  {
    id: 'offline-2',
    category: 'Offline & Sync',
    question: 'How do I ensure my data is backed up?',
    answer: 'Data backup and security:\n\n1. **Automatic Sync**: Data automatically syncs to the cloud\n2. **Cross-Device**: Access your data on multiple devices\n3. **Backup Frequency**: Data is backed up in real-time\n4. **Data Security**: All data is encrypted in transit and at rest\n5. **Export Option**: Export your data for personal backup\n6. **Recovery**: Restore data if you switch devices\n\nYour food inventory and preferences are safely stored and backed up.',
    keywords: ['backup', 'security', 'sync', 'cross-device', 'encryption', 'export']
  },

  // Troubleshooting
  {
    id: 'troubleshooting-1',
    category: 'Troubleshooting',
    question: 'Why aren\'t my changes syncing across devices?',
    answer: 'Sync issues troubleshooting:\n\n1. **Check Connection**: Ensure you have internet access\n2. **Sign In**: Make sure you\'re signed in to the same account\n3. **Wait for Sync**: Changes may take a moment to sync\n4. **Refresh App**: Try closing and reopening the app\n5. **Check Settings**: Verify sync settings are enabled\n6. **Contact Support**: If issues persist, contact support\n\nMost sync issues resolve automatically within a few minutes.',
    keywords: ['sync', 'devices', 'connection', 'sign in', 'refresh', 'support']
  },
  {
    id: 'troubleshooting-2',
    category: 'Troubleshooting',
    question: 'How do I fix barcode scanning issues?',
    answer: 'Barcode scanning troubleshooting:\n\n1. **Camera Permission**: Ensure camera access is granted\n2. **Lighting**: Make sure barcode is well-lit\n3. **Distance**: Hold camera 6-12 inches from barcode\n4. **Stability**: Keep camera steady while scanning\n5. **Clean Barcode**: Ensure barcode isn\'t damaged or dirty\n6. **Manual Entry**: Use manual entry as backup\n7. **Update App**: Ensure you have the latest app version\n\nBarcode scanning works best in good lighting with steady hands.',
    keywords: ['barcode', 'scanning', 'camera', 'lighting', 'permission', 'manual entry']
  },
  {
    id: 'troubleshooting-3',
    category: 'Troubleshooting',
    question: 'What should I do if the app is running slowly?',
    answer: 'Performance optimization:\n\n1. **Close Other Apps**: Free up device memory\n2. **Clear Cache**: Clear app cache in device settings\n3. **Update App**: Install latest version for performance improvements\n4. **Restart Device**: Sometimes a restart helps\n5. **Check Storage**: Ensure sufficient storage space\n6. **Reinstall**: As last resort, reinstall the app\n\nMost performance issues are resolved by clearing cache or updating the app.',
    keywords: ['slow', 'performance', 'cache', 'memory', 'storage', 'restart']
  },

  // Input Methods
  {
    id: 'input-1',
    category: 'Input Methods',
    question: 'How do I add items by voice?',
    answer: 'Voice input lets you add pantry items hands-free:\n\n1. Tap the **+** button in the Pantry tab to open the Quick Add panel\n2. Tap the **microphone icon** — the app will ask for microphone permission the first time\n3. Speak the item name clearly (e.g. "two litres of whole milk" or "chicken breast")\n4. The app transcribes your words into the name field — review and tap **Add**\n\n**Tips for best results:**\n• Speak in a quiet environment\n• Use your device\'s display language — the app matches your locale automatically\n• Say the quantity first, then the item (e.g. "three cans of tomatoes")\n• If recognition fails you\'ll see a message — tap the mic again to retry or just type\n\nVoice input requires microphone permission and works on Android and modern browsers. It is not available when the device is offline.',
    keywords: ['voice', 'microphone', 'speak', 'dictate', 'voice input', 'hands-free', 'mic', 'speech']
  },
  {
    id: 'input-2',
    category: 'Input Methods',
    question: 'How do AI camera scans work — pantry photo vs receipt?',
    answer: 'Stock & Spoon has two distinct AI scan modes:\n\n**Pantry / Shelf Photo Scan**\n• Tap the **camera icon** in the Pantry tab\n• Point at a shelf, fridge interior, or counter full of food\n• The AI detects individual items and adds them to a review list\n• Confirm, edit, or remove each detected item before saving\n• Works best with good lighting, items facing forward, and the label visible\n\n**Receipt Scan**\n• Tap **Scan Receipt** from the Pantry add menu\n• Photograph a printed or on-screen grocery receipt\n• The app uses OCR to extract item names and quantities\n• Falls back to AI analysis if OCR confidence is low\n• Works best on uncrumpled receipts with clear text in good light\n\nBoth modes count toward your weekly AI scan limit (5 scans/week on Free, 15 on Premium).',
    keywords: ['camera', 'scan', 'receipt', 'photo', 'ai scan', 'shelf', 'fridge', 'ocr', 'barcode', 'image']
  },
  {
    id: 'input-3',
    category: 'Input Methods',
    question: 'How do I import items from a CSV file?',
    answer: 'CSV import lets you add many items at once:\n\n1. Go to **Pantry tab → + → Import from CSV**\n2. Prepare a CSV file with columns: `name`, `quantity`, `unit`, `category`, `expiry` (YYYY-MM-DD), `location`\n3. Only `name` is required — all other columns are optional\n4. Select your file in the Import dialog and tap **Import**\n5. Review the detected items before confirming\n\n**CSV example:**\n```\nname,quantity,unit,category,expiry\nWhole Milk,2,litres,Dairy,2026-06-01\nChicken Breast,500,g,Meat,2026-05-08\n```\n\nCommon import issues:\n• Dates must be YYYY-MM-DD format\n• Use commas as the delimiter (not semicolons)\n• Save the file as plain text / UTF-8, not Excel .xlsx format',
    keywords: ['csv', 'import', 'bulk', 'file', 'upload', 'spreadsheet', 'columns', 'format']
  },

  // Pantry Management additions
  {
    id: 'pantry-8',
    category: 'Pantry Management',
    question: 'Can I undo a deletion or accidental edit?',
    answer: 'Yes — Stock & Spoon supports undo for the most recent item actions:\n\n• When you **delete an item**, a toast notification appears at the bottom of the screen with an **Undo** button. Tap it within 5 seconds to restore the item.\n• Bulk deletes and item edits are also undoable from the same toast.\n• Up to 20 recent actions are stored. If you need to reverse something older, check if the item is still in a household member\'s cache under **Settings → Data → Clear Cache**.\n\nThe undo history is stored locally on your device and resets if you sign out.',
    keywords: ['undo', 'delete', 'restore', 'accidental', 'reverse', 'toast', 'history', 'recover']
  },
  {
    id: 'pantry-9',
    category: 'Pantry Management',
    question: 'How do I use the freezer portion tracker?',
    answer: 'When you freeze items you often divide them into portions — the app tracks this separately:\n\n1. Tap any pantry item and change **Storage Location** to **Freezer**\n2. A freeze transition dialog appears — enter the **number of portions** and optionally a **freeze date**\n3. The app records each portion as a sub-quantity within the item\n4. When you defrost a portion, tap the item and use **Decrease Quantity** — the portion count decreases accordingly\n5. The expiry is automatically extended to USDA-recommended freezer shelf life (see "How does the app handle items I put in the freezer?" for exact timelines)\n\nFrozen items display a snowflake badge in the pantry list so they are easy to spot.',
    keywords: ['freezer', 'portions', 'freeze', 'defrost', 'thaw', 'freeze date', 'portion count', 'snowflake']
  },
  {
    id: 'pantry-10',
    category: 'Pantry Management',
    question: 'How does nutrition data work and how do I enable it?',
    answer: 'Stock & Spoon can show nutritional facts for pantry items:\n\n**To enable:**\n1. Go to **Settings → Shopping**\n2. Toggle on **Show Nutrition Data**\n\n**What you see:**\nCalories, protein, carbohydrates, fat, fibre, and sugar — sourced from the USDA FoodData Central database.\n\n**How it works:**\n• Tap any item to open its detail screen, then expand the **Nutrition** section\n• Data is fetched by matching the item name against the USDA database\n• Results are cached on your device for 90 days — repeat lookups are instant and work offline\n• If no match is found the app says "No nutrition data found for this item"\n• The feature requires an active internet connection for the first lookup of each item\n\nNutrition data is provided for informational purposes. Actual values vary by brand and preparation.',
    keywords: ['nutrition', 'calories', 'protein', 'carbs', 'fat', 'fibre', 'sugar', 'usda', 'food data', 'nutrition facts']
  },
  {
    id: 'pantry-11',
    category: 'Pantry Management',
    question: 'What are custom categories and how do I create one?',
    answer: 'Custom categories let you organise your pantry beyond the built-in groups (Produce, Dairy, Meat, etc.):\n\n1. Go to **Settings → Pantry → Manage Categories**\n2. Tap **+ New Category**\n3. Choose a name, icon, and colour\n4. Tap **Save**\n\nYour new category appears in the Pantry category filter and in the category picker when adding or editing items.\n\n**Plan limits:**\n• Free plan: 1 custom category\n• Premium: Unlimited custom categories\n• Family: Unlimited, shared across all household members\n\nCustom categories sync to the cloud and are available on all your devices.',
    keywords: ['custom categories', 'category', 'organise', 'pantry', 'icon', 'colour', 'create category', 'manage categories']
  },

  // Leftovers
  {
    id: 'leftovers-1',
    category: 'Leftovers',
    question: 'How do I quickly log leftovers?',
    answer: 'The Leftover Quick Capture button lets you log cooked food in seconds:\n\n1. Tap the **Leftovers** quick-action button in the Pantry tab (the pot icon)\n2. Type or speak what you cooked (e.g. "chicken stir-fry", "pasta bolognese")\n3. Set an approximate quantity and confirm\n4. The item is added to your pantry as a leftover with an expiry calculated from your **leftover persona** (see below)\n\n**Cooked rice** is treated specially: it is flagged with a stricter 4-hour room-temperature rule before refrigeration, in line with food safety guidance.\n\nLeftovers appear with a distinct badge so they are easy to spot and use up first.',
    keywords: ['leftovers', 'quick capture', 'cooked', 'log', 'leftover', 'pot', 'rice', 'food safety', 'quick add']
  },
  {
    id: 'leftovers-2',
    category: 'Leftovers',
    question: 'What are leftover personas and which one should I choose?',
    answer: 'Your leftover persona controls how aggressively the app applies food-safety windows to leftovers:\n\n• **Relaxed** — follows the safe-but-lenient end of guidance. Cooked meats and casseroles get up to 5 days in the fridge before an alert appears. Good for households that reheat thoroughly and are not at elevated health risk.\n\n• **Normal** (default) — follows standard USDA/NHS guidance. Most cooked meals get 3–4 days. A balanced choice for most households.\n\n• **Strict** — shorter windows, earlier alerts. Cooked chicken or fish gets 2 days; most things 2–3 days. Recommended for households with young children, pregnant members, elderly, or immunocompromised individuals.\n\nTo change your persona: **Settings → Food Safety → Leftover Safety Persona**.\n\nThese personas only affect *leftover* items. Regular pantry items always use their printed best-by or use-by date.',
    keywords: ['leftover persona', 'relaxed', 'normal', 'strict', 'food safety', 'expiry window', 'leftover settings', 'persona']
  },

  // Meal Planning additions
  {
    id: 'meal-planning-4',
    category: 'Meal Planning',
    question: 'What is the Meal Prep Planner and how does it work?',
    answer: 'The Meal Prep Planner helps you batch-cook multiple recipes at once to save time:\n\n1. Open the **Meal Planner tab** and tap **Meal Prep**\n2. Select 2 or more recipes you want to prep together\n3. The planner calculates **ingredient overlap** — items shared across recipes so you only chop, measure, or cook once\n4. Choose a prep duration: **3-day**, **5-day**, or **7-day** plan\n5. The planner shows total cook time, combined difficulty, and a consolidated ingredient list\n6. Tap **Add to Meal Plan** to push all selected recipes to the calendar at once\n\n**Tips:**\n• Recipes with overlapping vegetables or proteins give the biggest time savings\n• The combined shopping list is generated automatically from the full ingredient set\n• Premium and Family plans support longer prep durations and more simultaneous recipes',
    keywords: ['meal prep', 'batch cook', 'prep planner', 'ingredient overlap', 'cook time', 'difficulty', 'prep duration', '5 day', '7 day']
  },
  {
    id: 'meal-planning-5',
    category: 'Meal Planning',
    question: 'How do AI recipe search tips work?',
    answer: 'The Recipe Finder uses a combination of **Spoonacular** (a recipe database) and **Gemini AI** to find relevant recipes:\n\n**Getting better results:**\n• Toggle **"Use my pantry items"** — this sends your current inventory to the AI so it can suggest recipes you can actually make\n• Be specific: "quick 30-minute chicken pasta" returns better results than just "pasta"\n• Add dietary constraints in the search bar: "vegan high-protein breakfast"\n• Mentioning an ingredient you want to use up works well: "recipes with half a butternut squash"\n\n**Scan limits:**\n• Free: 5 AI recipe searches per week\n• Premium: 15 per week\n• Family: Unlimited\n\nResults from Spoonacular are cached so repeating a search does not count against your limit.',
    keywords: ['recipe search', 'ai recipe', 'gemini', 'spoonacular', 'search tips', 'pantry items', 'use pantry', 'recipe finder', 'ai search']
  },

  {
    id: 'meal-planning-6',
    category: 'Meal Planning',
    question: 'How do I copy, clear, or export my weekly meal plan?',
    answer: 'Three week-level actions are available in the Meal Planner toolbar, just above the day detail card:\n\n• **Clear week** (trash icon) — removes all meals from the currently displayed 7-day window. You will be asked to confirm before anything is deleted.\n\n• **Copy to next week** (copy icon) — duplicates all meals from the current week into the same days in the following week. Useful for meal-prepping routines you repeat regularly.\n\n• **Export .ics** (download icon) — downloads a standard calendar file containing all planned meals for the week. You can import this file into Google Calendar, Apple Calendar, Outlook, or any calendar app that supports the .ics format. Only days that have at least one meal scheduled are included in the export.\n\nAll three actions apply only to the week you are currently viewing. Navigate to a different week first if you want to act on a different period.',
    keywords: ['copy week', 'clear week', 'export calendar', 'ics', 'meal plan export', 'copy meals', 'delete week', 'calendar file', 'repeat meals', 'next week']
  },

  // Community
  {
    id: 'community-1',
    category: 'Community',
    question: 'What is the Community tab?',
    answer: 'The Community tab shows recipes that have been rated and reviewed by other Stock & Spoon users:\n\n• **Browse** top-rated community recipes with average star ratings\n• **Read comments** from users who have tried each recipe\n• **Rate a recipe yourself** — open a saved recipe, tap the star rating, and submit\n• **Save to your collection** — tap the bookmark icon to save a community recipe to your own library\n\nRecipes are ranked by average rating weighted by number of ratings, so heavily-reviewed recipes rise to the top over time.\n\nYour own ratings and comments are linked to your account and visible to other members. Only users who have saved a recipe can rate it.',
    keywords: ['community', 'ratings', 'reviews', 'rate recipe', 'community tab', 'star rating', 'comments', 'browse recipes']
  },

  // Shopping additions
  {
    id: 'shopping-4',
    category: 'Shopping Lists',
    question: 'How do I set up a custom store layout for my shopping list?',
    answer: 'The store layout editor lets you reorder shopping categories to match the physical layout of your regular grocery store:\n\n1. Go to **Settings → Shopping → Store Layout**\n2. Drag and drop the category rows into the order you walk through your store (e.g. Produce first, then Dairy, then Meat)\n3. Tap **Save Layout**\n\nThe Shopping tab will now present items grouped in your custom aisle order. If you shop at multiple stores, you can reset to the default at any time and re-arrange for whichever store you are visiting that day.\n\nCategories with no items in your current shopping list are hidden automatically so the list stays clean.',
    keywords: ['store layout', 'aisle order', 'custom layout', 'store editor', 'shopping order', 'drag', 'reorder', 'grocery store']
  },
  {
    id: 'shopping-5',
    category: 'Shopping Lists',
    question: 'How do price trends and the grocery cost estimator work?',
    answer: 'Stock & Spoon includes two price-awareness tools:\n\n**Price Trends (per item)**\n• Tap any pantry item and scroll to the **Price Trends** section\n• The app shows a price history graph based on crowdsourced price reports and the Open Prices API\n• Enable or disable this in **Settings → Shopping → Show Price Data**\n\n**Grocery Cost Estimator (shopping list)**\n• Open your Shopping List and look for the **Estimated Total** bar at the top\n• The estimator uses recent regional prices to approximate your shopping trip cost\n• Free plan shows the first 5 ingredients; Premium and Family show the full list\n\nPrice data is sourced from community submissions and public price databases. Actual store prices may differ. Prices are refreshed periodically and cached locally.',
    keywords: ['price', 'cost estimator', 'price trends', 'grocery cost', 'price history', 'open prices', 'shopping cost', 'estimate']
  },

  // Household additions
  {
    id: 'household-4',
    category: 'Household & Sharing',
    question: 'What is the household activity feed?',
    answer: 'The activity feed shows a running log of actions taken by household members:\n\n• Items added, removed, or updated in the shared pantry\n• Shopping list items ticked off or added\n• Meal plan changes\n• New recipes saved to the household library\n\nTo view the feed: tap the **household icon** at the top of the Pantry tab or visit **Settings → Household → Activity Feed**.\n\nEach event shows the member\'s name, avatar, the action taken, and a timestamp. The feed is visible to all household members and is stored for the last 30 days.\n\nNotifications for household activity can be enabled or muted per-event-type in **Settings → Notifications → Household Activity**.',
    keywords: ['activity feed', 'household feed', 'activity log', 'household activity', 'recent activity', 'timeline', 'household log']
  },

  // Settings additions
  {
    id: 'settings-4',
    category: 'Settings & Preferences',
    question: 'How do I turn AI features on or off?',
    answer: 'You can opt in or out of all AI-powered features at any time:\n\n1. Go to **Settings → AI & Privacy**\n2. Toggle **Enable AI Features (Gemini)** on or off\n\n**What opting out does:**\n• Disables Gemini AI for pantry photo scans, receipt analysis, and recipe search\n• Barcode scanning, manual entry, and Spoonacular recipe search still work\n• Your weekly AI scan counter is paused (usage limits still track separately)\n• No data is sent to Google Gemini while opted out\n\n**To re-enable:** return to the same toggle and turn it back on. All previously cached AI results remain on your device.\n\nIf you are on the Free plan, your 5 weekly AI scans reset every Monday regardless of opt-in status.',
    keywords: ['ai opt out', 'gemini', 'disable ai', 'privacy', 'ai features', 'opt in', 'opt out', 'turn off ai', 'ai toggle']
  },

  {
    id: 'settings-5',
    category: 'Settings & Preferences',
    question: 'How do I switch between imperial and metric units?',
    answer: 'Stock & Spoon can display quantities in either **Imperial** (cups, oz, lb, fl oz) or **Metric** (grams, ml, kg, litres) units:\n\n1. Go to **Settings** and open the **Account** tab\n2. Scroll to **Measurement System**\n3. Tap **Imperial** or **Metric**\n\nThe setting is saved to your profile and applied across the whole app — recipe ingredient quantities, pantry item weights, and the grocery cost estimator will all reflect your choice. It also affects how voice input interprets spoken quantities.',
    keywords: ['imperial', 'metric', 'units', 'measurement system', 'grams', 'cups', 'ounces', 'pounds', 'kilograms', 'litres', 'oz', 'lbs']
  },
  {
    id: 'settings-6',
    category: 'Settings & Preferences',
    question: 'How do I hide or rearrange the bottom navigation tabs?',
    answer: 'You can declutter the bottom bar by hiding tabs you do not use:\n\n1. Go to **Settings** and open the **Preferences** tab\n2. Scroll to the **Navigation Tabs** section\n3. Toggle off any tab you want to hide — **Shopping, Meal Planner, Recipes, Community,** or **Analytics**\n\n**Pantry** and **Settings** are always visible and cannot be hidden.\n\nHiding a tab does not delete any data — you can re-enable it at any time from the same screen. If you are on a hidden tab when you disable it, the app automatically redirects you to Pantry.',
    keywords: ['hide tab', 'navigation tabs', 'bottom bar', 'show tabs', 'hide navigation', 'tab visibility', 'remove tab', 'customize navigation']
  },

  // Plans & Limits additions
  {
    id: 'plans-4',
    category: 'Plans & Limits',
    question: 'What are the limits for guest (not signed in) users?',
    answer: 'You can use Stock & Spoon without creating an account, but with reduced limits:\n\n• **Pantry items**: Up to 20 items stored locally on your device\n• **Shopping list items**: Up to 30 items\n• **No cloud sync**: Data is only on the current device — if you uninstall or clear app storage, it is gone\n• **No household sharing**: Multi-device and family features require an account\n• **No undo history**: Undo is tied to your account\'s local storage\n\nWhen you reach the guest limit, the app will prompt you to create a free account to continue. Creating an account is free and all your existing guest data can be migrated across.\n\nSign up via **Settings → Account → Create Account**.',
    keywords: ['guest', 'no account', 'not signed in', 'guest limits', 'offline user', 'without account', 'item limit', 'guest cap']
  }
];

interface FAQPageProps {
  onBack: () => void;
}

export const FAQPage: React.FC<FAQPageProps> = ({ onBack }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const filteredFAQs = FAQ_DATA.filter(item => {
    if (!searchTerm) return true;

    const searchLower = searchTerm.toLowerCase();
    return (
      item.question.toLowerCase().includes(searchLower) ||
      item.answer.toLowerCase().includes(searchLower) ||
      item.category.toLowerCase().includes(searchLower) ||
      item.keywords.some(keyword => keyword.toLowerCase().includes(searchLower))
    );
  });

  const groupedFAQs = filteredFAQs.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, FAQItem[]>);

  const toggleItem = (id: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-theme-primary flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-theme-secondary bg-theme-secondary/50 backdrop-blur-sm">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-theme transition-colors text-theme-primary"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="font-medium">Back</span>
        </button>

        <h1 className="text-xl font-bold text-theme-primary">Help & FAQ</h1>

        <div className="w-16"></div> {/* Spacer for centering */}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Search Bar */}
        <div className="p-4 border-b border-theme-secondary">
          <div className="relative max-w-2xl mx-auto">
            <input
              type="text"
              placeholder="Search FAQ... (try: recipes, shopping, pantry, household)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-3 pl-12 text-sm border border-theme rounded-xl bg-theme-secondary text-theme-primary focus:border-theme-primary focus:outline-none transition-colors"
            />
            <div className="absolute left-4 top-3.5 text-theme-secondary">
              <Search className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Results Count */}
        {searchTerm && (
          <div className="px-4 py-2 bg-theme-secondary/30 border-b border-theme-secondary">
            <p className="text-sm text-theme-secondary text-center">
              Found {filteredFAQs.length} result{filteredFAQs.length !== 1 ? 's' : ''} for "{searchTerm}"
            </p>
          </div>
        )}

        {/* FAQ Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto p-4 space-y-6">
            {Object.entries(groupedFAQs).map(([category, items]) => (
              <div key={category} className="space-y-3">
                <h2 className="text-2xl font-bold text-theme-primary border-b border-theme-secondary pb-2">
                  {category}
                </h2>
                <div className="space-y-3">
                  {items.map((item) => (
                    <div key={item.id} className="bg-theme-secondary rounded-xl border border-theme overflow-hidden shadow-sm">
                      <button
                        onClick={() => toggleItem(item.id)}
                        className="w-full flex items-center justify-between p-6 text-left hover:bg-theme-primary/5 transition-colors"
                        aria-expanded={expandedItems.has(item.id)}
                        aria-controls={`faq-answer-${item.id}`}
                        id={`faq-trigger-${item.id}`}
                      >
                        <span className="text-base font-semibold text-theme-primary pr-4 leading-relaxed">
                          {item.question}
                        </span>
                        {expandedItems.has(item.id) ? (
                          <ChevronDown className="w-5 h-5 text-theme-primary flex-shrink-0" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-theme-primary flex-shrink-0" />
                        )}
                      </button>
                      {expandedItems.has(item.id) && (
                        <div
                          id={`faq-answer-${item.id}`}
                          role="region"
                          aria-labelledby={`faq-trigger-${item.id}`}
                          className="border-t border-theme px-6 py-5"
                        >
                          <div className="text-sm text-theme-secondary whitespace-pre-line leading-relaxed">
                            {item.answer}
                          </div>
                          <div className="mt-4 pt-4 border-t border-theme">
                            <div className="flex flex-wrap gap-2">
                              {item.keywords.slice(0, 6).map((keyword) => (
                                <span
                                  key={keyword}
                                  className="px-3 py-1 text-xs bg-theme-primary/10 text-theme-primary rounded-full border border-theme-primary/20"
                                >
                                  {keyword}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* No Results */}
            {filteredFAQs.length === 0 && searchTerm && (
              <div className="text-center py-12">
                <div className="max-w-md mx-auto">
                  <div className="w-16 h-16 bg-theme-secondary rounded-full flex items-center justify-center mx-auto mb-4">
                    <Search className="w-8 h-8 text-theme-secondary" />
                  </div>
                  <h3 className="text-lg font-semibold text-theme-primary mb-2">No results found</h3>
                  <p className="text-theme-secondary mb-4">
                    We couldn't find any FAQ items matching "{searchTerm}"
                  </p>
                  <p className="text-sm text-theme-secondary">
                    Try different keywords like: recipes, shopping, pantry, household, settings, offline
                  </p>
                </div>
              </div>
            )}

            {/* Contact Support */}
            <div className="bg-gradient-to-r from-theme-secondary to-theme-secondary/80 rounded-xl border border-theme p-6 text-center">
              <h3 className="text-lg font-semibold text-theme-primary mb-2">Still need help?</h3>
              <p className="text-theme-secondary mb-4 leading-relaxed">
                Can't find what you're looking for? Our support team is here to help with any questions or issues you might have.
              </p>
              <button className="inline-flex items-center gap-2 bg-theme-primary text-theme-secondary px-6 py-3 rounded-lg font-semibold hover:bg-theme-primary/90 transition-colors">
                <span>Contact Support</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};