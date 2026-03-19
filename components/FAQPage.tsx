import React, { useState } from 'react';
import { ArrowLeft, Search, ChevronDown, ChevronRight, AlertTriangle, Heart, X } from 'lucide-react';

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

  // Shopping Lists
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
    answer: 'Shopping lists are automatically organized by store aisle:\n\n1. **Default Layout**: Uses standard grocery store organization\n2. **Custom Layout**: Customize aisle names in Settings > Store Layout\n3. **Drag & Drop**: Reorder items within aisles as needed\n4. **Check Off**: Mark items as you shop to track progress\n5. **Store-Specific**: Create different layouts for different stores\n\nThis saves time by grouping similar items together during shopping.',
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
    answer: 'Sharing shopping lists:\n\n1. **Automatic Sharing**: Lists created in a household are automatically shared\n2. **Real-time Updates**: See changes as other members add/remove items\n3. **Assignment**: Assign items to specific people for shopping\n4. **Check-off**: Mark items as purchased in real-time\n5. **Comments**: Add notes to items for other shoppers\n6. **History**: View past shopping lists and purchases\n\nCollaborative shopping made easy for busy households.',
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
                        <div className="border-t border-theme px-6 py-5">
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