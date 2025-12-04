import React, { useState } from 'react';
import { PantryScanner } from './components/PantryScanner';
import { RecipeFinder } from './components/RecipeFinder';
import { ChefHat, ScanLine, Utensils } from 'lucide-react';

enum Tab {
  SCANNER = 'SCANNER',
  RECIPES = 'RECIPES'
}

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.SCANNER);

  return (
    <div className="min-h-screen flex flex-col max-w-3xl mx-auto bg-white shadow-xl min-h-[100dvh]">
      {/* Header */}
      <header className="bg-emerald-600 text-white p-4 sticky top-0 z-10 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ChefHat className="w-8 h-8" />
            <h1 className="text-xl font-bold tracking-tight">Smart Pantry</h1>
          </div>
          <div className="text-emerald-100 text-sm font-medium">
            Powered by Gemini
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-50">
        {activeTab === Tab.SCANNER ? (
          <PantryScanner />
        ) : (
          <RecipeFinder />
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="bg-white border-t border-gray-200 sticky bottom-0 pb-safe">
        <div className="flex justify-around">
          <button
            onClick={() => setActiveTab(Tab.SCANNER)}
            className={`flex flex-col items-center justify-center flex-1 p-3 transition-colors ${
              activeTab === Tab.SCANNER
                ? 'text-emerald-600 bg-emerald-50'
                : 'text-gray-500 hover:text-emerald-500 hover:bg-gray-50'
            }`}
          >
            <ScanLine className="w-6 h-6 mb-1" />
            <span className="text-xs font-medium">Inventory Scan</span>
          </button>
          
          <button
            onClick={() => setActiveTab(Tab.RECIPES)}
            className={`flex flex-col items-center justify-center flex-1 p-3 transition-colors ${
              activeTab === Tab.RECIPES
                ? 'text-emerald-600 bg-emerald-50'
                : 'text-gray-500 hover:text-emerald-500 hover:bg-gray-50'
            }`}
          >
            <Utensils className="w-6 h-6 mb-1" />
            <span className="text-xs font-medium">Recipe Finder</span>
          </button>
        </div>
      </nav>
    </div>
  );
};

export default App;