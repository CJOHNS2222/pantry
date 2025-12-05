import React, { useState, useEffect } from 'react';
import { PantryScanner } from './components/PantryScanner';
import { RecipeFinder } from './components/RecipeFinder';
import { MealPlanner } from './components/MealPlanner';
import { Login } from './components/Login';
import { Tutorial } from './components/Tutorial';
import { HouseholdManager } from './components/Household';
import { ShoppingList } from './components/ShoppingList';
import { Community } from './components/Community';
import { ChefHat, ShoppingBasket, CalendarDays, UtensilsCrossed, Users, Sun, Moon, Download } from 'lucide-react';
import { User, PantryItem, DayPlan, StructuredRecipe, Household, ShoppingItem, SavedRecipe, RecipeRating } from './types';

enum Tab {
  PANTRY = 'PANTRY',
  SHOPPING = 'SHOPPING',
  MEALS = 'MEALS',
  RECIPES = 'RECIPES',
  COMMUNITY = 'COMMUNITY'
}

type Theme = 'dark' | 'light';

// Helper to safely parse JSON from localStorage
const safeParse = <T,>(key: string, fallback: T): T => {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch (e) {
    console.warn(`Error parsing ${key} from localStorage, resetting to default.`, e);
    return fallback;
  }
};

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.PANTRY);
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('theme') as Theme) || 'dark');
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  
  // User State
  const [user, setUser] = useState<User | null>(() => safeParse<User | null>('user', null));

  const [showTutorial, setShowTutorial] = useState(false);
  const [showHousehold, setShowHousehold] = useState(false);

  // Data States
  const [inventory, setInventory] = useState<PantryItem[]>(() => safeParse<PantryItem[]>('inventory', []));

  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>(() => safeParse<ShoppingItem[]>('shoppingList', []));

  const [savedRecipes, setSavedRecipes] = useState<SavedRecipe[]>(() => safeParse<SavedRecipe[]>('savedRecipes', []));

  const [ratings, setRatings] = useState<RecipeRating[]>(() => safeParse<RecipeRating[]>('ratings', []));

  const [mealPlan, setMealPlan] = useState<DayPlan[]>(() => safeParse<DayPlan[]>('mealPlan', []));

  const [household, setHousehold] = useState<Household>(() => {
      const defaultValue = { id: 'h1', name: 'My Family', members: [] };
      const parsed = safeParse<Household>('household', defaultValue);
      // Extra validation for household structure
      if (!parsed || !Array.isArray(parsed.members)) return defaultValue;
      return parsed;
  });

  // Handle Android Install Prompt
  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = () => {
    if (installPrompt) {
      installPrompt.prompt();
      installPrompt.userChoice.then((choiceResult: any) => {
        if (choiceResult.outcome === 'accepted') {
          setInstallPrompt(null);
        }
      });
    }
  };

  // Handle Android Back Button (History API)
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (event.state?.tab) {
        setActiveTab(event.state.tab);
      }
    };
    window.addEventListener('popstate', handlePopState);
    
    // Set initial state if needed
    if (!window.history.state) {
        window.history.replaceState({ tab: Tab.PANTRY }, '', '#pantry');
    }
    
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    window.history.pushState({ tab }, '', `#${tab.toLowerCase()}`);
  };

  // Apply Theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Init Meal Plan
  useEffect(() => {
    if (mealPlan.length === 0) {
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const today = new Date();
      const initialPlan: DayPlan[] = [];

      for (let i = 0; i < 7; i++) {
          const d = new Date(today);
          d.setDate(today.getDate() + i);
          initialPlan.push({
              date: d.toLocaleDateString(),
              dayName: days[d.getDay()],
              meals: []
          });
      }
      setMealPlan(initialPlan);
    }
  }, []);

  // Persistence
  useEffect(() => { localStorage.setItem('user', JSON.stringify(user)); }, [user]);
  useEffect(() => { localStorage.setItem('inventory', JSON.stringify(inventory)); }, [inventory]);
  useEffect(() => { localStorage.setItem('shoppingList', JSON.stringify(shoppingList)); }, [shoppingList]);
  useEffect(() => { localStorage.setItem('savedRecipes', JSON.stringify(savedRecipes)); }, [savedRecipes]);
  useEffect(() => { localStorage.setItem('ratings', JSON.stringify(ratings)); }, [ratings]);
  useEffect(() => { localStorage.setItem('mealPlan', JSON.stringify(mealPlan)); }, [mealPlan]);
  useEffect(() => { localStorage.setItem('household', JSON.stringify(household)); }, [household]);

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
    setHousehold(prev => {
        // Ensure prev and prev.members exist before accessing
        const currentMembers = prev?.members || [];
        if (!currentMembers.find(m => m.email === loggedInUser.email)) {
             return {
                 ...prev,
                 members: [...currentMembers, {
                     id: loggedInUser.id,
                     name: loggedInUser.name,
                     email: loggedInUser.email,
                     role: 'Admin',
                     status: 'Active'
                 }]
             };
        }
        return prev;
    });
    if (!loggedInUser.hasSeenTutorial) setShowTutorial(true);
  };

  const handleLogout = () => {
    if (confirm("Are you sure you want to log out?")) {
        localStorage.clear();
        setUser(null);
        window.location.reload();
    }
  };

  const handleAddToPlan = (recipe: StructuredRecipe) => {
    const newPlan = [...mealPlan];
    if (newPlan.length > 0) {
        newPlan[0].meals.push({
            id: Math.random().toString(36).substr(2, 9),
            recipe: recipe
        });
        setMealPlan(newPlan);
        alert(`Added ${recipe.title} to ${newPlan[0].dayName}.`);
        handleTabChange(Tab.MEALS);
    }
  };

  const handleSaveRecipe = (recipe: StructuredRecipe) => {
    if (savedRecipes.some(r => r.title === recipe.title)) {
      alert("Recipe already saved!");
      return;
    }
    const newSaved: SavedRecipe = {
      ...recipe,
      id: Math.random().toString(36).substr(2, 9),
      dateSaved: new Date().toLocaleDateString(),
      imagePlaceholder: `hsl(${Math.random() * 360}, 70%, 40%)`
    };
    setSavedRecipes(prev => [newSaved, ...prev]);
    alert("Recipe saved to favorites!");
  };

  const handleAddRating = (rating: RecipeRating) => {
    setRatings(prev => [rating, ...prev]);
  };

  if (!user) return <Login onLogin={handleLogin} />;

  return (
    <div className="min-h-screen flex flex-col max-w-md mx-auto bg-theme-primary shadow-2xl overflow-hidden relative border-x border-theme transition-colors duration-300">
      
      {showTutorial && <Tutorial onClose={() => setShowTutorial(false)} />}
      {showHousehold && (
        <HouseholdManager 
            user={user} 
            household={household} 
            setHousehold={setHousehold} 
            onClose={() => setShowHousehold(false)} 
        />
      )}

      {/* Header */}
      <header className="bg-theme-secondary p-4 pt-6 sticky top-0 z-20 shadow-md border-b border-theme transition-colors duration-300">
        <div className="flex justify-between items-center">
             <button 
                onClick={() => setShowHousehold(true)}
                className="flex items-center space-x-2 px-2 py-1 rounded-full hover:bg-black/5 transition-colors"
            >
                {user.avatar ? (
                    <img src={user.avatar} className="w-8 h-8 rounded-full border border-theme" alt="profile" />
                ) : (
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{backgroundColor: 'var(--accent-color)'}}>
                        {user.name.charAt(0).toUpperCase()}
                    </div>
                )}
            </button>
            
            <div className="flex flex-col items-center">
                 <h1 className="text-xl font-serif font-bold text-theme-primary" style={{color: 'var(--accent-color)'}}>
                    Smart Pantry Chef
                </h1>
                <span className="text-[10px] uppercase tracking-widest text-theme-secondary opacity-60">AI Kitchen Assistant</span>
            </div>

            <div className="flex items-center">
                {installPrompt && (
                    <button 
                        onClick={handleInstallClick}
                        className="p-2 text-theme-secondary hover:text-[var(--accent-color)] transition-colors animate-pulse"
                        title="Install App"
                    >
                        <Download className="w-5 h-5" />
                    </button>
                )}
                <button 
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    className="p-2 text-theme-secondary opacity-70 hover:opacity-100"
                >
                    {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>
            </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 scrollbar-hide bg-theme-primary relative">
        {activeTab === Tab.PANTRY && (
            <PantryScanner 
                inventory={inventory} 
                setInventory={setInventory} 
                addToShoppingList={(items) => {
                    const newItems = items.map(i => ({ id: Math.random().toString(36).substr(2,9), item: i, category: 'Manual', checked: false }));
                    setShoppingList(prev => [...prev, ...newItems]);
                    handleTabChange(Tab.SHOPPING);
                }}
            />
        )}
        
        {activeTab === Tab.SHOPPING && (
            <ShoppingList 
                items={shoppingList} 
                setItems={setShoppingList} 
                onMoveToPantry={(items) => {
                    const pantryItems = items.map(i => ({ item: i.item, category: i.category, quantity_estimate: '1' }));
                    setInventory(prev => [...prev, ...pantryItems]);
                }}
            />
        )}

        {activeTab === Tab.MEALS && (
            <MealPlanner 
                mealPlan={mealPlan} 
                setMealPlan={setMealPlan} 
                inventory={inventory}
                addToShoppingList={(items) => {
                    const newItems = items.map(i => ({ id: Math.random().toString(36).substr(2,9), item: i, category: 'Planned Meal', checked: false }));
                    setShoppingList(prev => [...prev, ...newItems]);
                    handleTabChange(Tab.SHOPPING);
                }}
            />
        )}
        
        {activeTab === Tab.RECIPES && (
            <RecipeFinder 
                onAddToPlan={handleAddToPlan} 
                onSaveRecipe={handleSaveRecipe}
                inventory={inventory}
                ratings={ratings}
                onRate={handleAddRating}
                savedRecipes={savedRecipes}
            />
        )}

        {activeTab === Tab.COMMUNITY && (
            <Community 
                ratings={ratings} 
                onAddToPlan={handleAddToPlan}
            />
        )}
      </main>

      {/* Navigation */}
      <nav className="bg-theme-secondary border-t border-theme fixed bottom-0 w-full max-w-md pb-safe z-30 shadow-[0_-5px_20px_rgba(0,0,0,0.1)] transition-colors duration-300">
        <div className="flex justify-around items-end pb-2 pt-1">
          {[
              { id: Tab.PANTRY, icon: ChefHat, label: 'Pantry' },
              { id: Tab.SHOPPING, icon: ShoppingBasket, label: 'Shop' },
              { id: Tab.MEALS, icon: CalendarDays, label: 'Plan' },
              { id: Tab.RECIPES, icon: UtensilsCrossed, label: 'Chef' },
              { id: Tab.COMMUNITY, icon: Users, label: 'Social' },
          ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex flex-col items-center justify-center flex-1 py-2 transition-all duration-300 ${
                  activeTab === tab.id ? '-translate-y-1' : 'opacity-60 hover:opacity-100'
                }`}
              >
                <div className={`p-1.5 rounded-full mb-0.5 transition-all ${
                    activeTab === tab.id ? 'bg-theme-primary shadow-lg border border-theme' : ''
                }`}>
                   <tab.icon className="w-5 h-5" style={{color: activeTab === tab.id ? 'var(--accent-color)' : 'var(--text-secondary)'}} />
                </div>
                <span className="text-[9px] uppercase font-bold tracking-wider text-theme-secondary">
                    {tab.label}
                </span>
              </button>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default App;