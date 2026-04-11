import React from 'react';

const LandingPage: React.FC = () => {
  return (
    <div className="font-inter leading-relaxed text-gray-800 bg-gradient-to-br from-red-950 to-red-900 min-h-screen">
      <header className="bg-white/95 backdrop-blur-[10px] border-b border-white/20 fixed top-0 left-0 right-0 z-[1000] py-4">
        <nav className="max-w-7xl mx-auto px-5 flex justify-between items-center">
          <a href="/" className="font-playfair text-3xl font-bold text-red-950 no-underline">Stock & Spoon</a>
          <div className="flex gap-8 items-center">
            <a href="#features" className="text-red-950 no-underline font-medium">Features</a>
            <a href="#screenshots" className="text-red-950 no-underline font-medium">Screenshots</a>
            <a href="/app" className="bg-gradient-to-br from-red-700 to-red-950 text-white px-6 py-2 rounded-full no-underline font-semibold">Try It Now</a>
          </div>
        </nav>
      </header>

      <main>
        <section className="py-30 pb-20 text-center text-white">
          <div className="max-w-7xl mx-auto px-5">
            <h1 className="font-playfair text-6xl font-bold mb-4 bg-gradient-to-br from-yellow-400 to-orange-500 bg-clip-text text-transparent">Stock & Spoon</h1>
            <p className="text-xl mb-8 opacity-90 max-w-2xl mx-auto">AI-powered kitchen assistant that helps you manage your pantry, plan meals, and discover delicious recipes. Never waste food again!</p>
            <div className="flex gap-4 justify-center flex-wrap">
              <a href="/app" className="bg-gradient-to-br from-red-700 to-red-950 text-white px-8 py-4 rounded-full no-underline font-semibold text-lg">🚀 Launch App</a>
              <a href="#features" className="bg-white/20 text-white px-8 py-4 rounded-full no-underline font-semibold border-2 border-white/30">Learn More</a>
            </div>
          </div>
        </section>

        <section id="features" className="py-20 bg-white/5">
          <div className="max-w-7xl mx-auto px-5">
            <h2 className="text-center font-playfair text-5xl text-white mb-12">Powerful Features</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <div className="bg-white/10 backdrop-blur-[10px] rounded-3xl p-8 text-center border border-white/20">
                <div className="w-20 h-20 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-4 text-4xl">📱</div>
                <h3 className="text-white text-2xl mb-4">Smart Pantry Scanner</h3>
                <p className="text-white/80">Scan your pantry items with your camera. AI recognizes ingredients and automatically adds them to your inventory.</p>
              </div>
              <div className="bg-white/10 backdrop-blur-[10px] rounded-3xl p-8 text-center border border-white/20">
                <div className="w-20 h-20 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-4 text-4xl">🍽️</div>
                <h3 className="text-white text-2xl mb-4">AI Meal Planning</h3>
                <p className="text-white/80">Get personalized meal suggestions based on your available ingredients and dietary preferences.</p>
              </div>
              <div className="bg-white/10 backdrop-blur-[10px] rounded-3xl p-8 text-center border border-white/20">
                <div className="w-20 h-20 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-4 text-4xl">🛒</div>
                <h3 className="text-white text-2xl mb-4">Smart Shopping Lists</h3>
                <p className="text-white/80">Automatically generate shopping lists based on your meal plans and current pantry stock.</p>
              </div>
              <div className="bg-white/10 backdrop-blur-[10px] rounded-3xl p-8 text-center border border-white/20">
                <div className="w-20 h-20 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-4 text-4xl">📅</div>
                <h3 className="text-white text-2xl mb-4">Weekly Meal Planner</h3>
                <p className="text-white/80">Plan your meals for the entire week with drag-and-drop simplicity and nutritional insights.</p>
              </div>
              <div className="bg-white/10 backdrop-blur-[10px] rounded-3xl p-8 text-center border border-white/20">
                <div className="w-20 h-20 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-4 text-4xl">🤖</div>
                <h3 className="text-white text-2xl mb-4">AI Recipe Generator</h3>
                <p className="text-white/80">Discover new recipes using your available ingredients. Powered by advanced AI for creative cooking.</p>
              </div>
              <div className="bg-white/10 backdrop-blur-[10px] rounded-3xl p-8 text-center border border-white/20">
                <div className="w-20 h-20 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-4 text-4xl">👥</div>
                <h3 className="text-white text-2xl mb-4">Household Sharing</h3>
                <p className="text-white/80">Share your pantry and meal plans with family members. Perfect for households and roommates.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="py-20 text-center bg-gradient-to-br from-red-700/80 to-red-950/80">
          <div className="max-w-7xl mx-auto px-5">
            <h2 className="font-playfair text-5xl text-white mb-4">Ready to Revolutionize Your Kitchen?</h2>
            <p className="text-lg text-white/90 mb-8 max-w-2xl mx-auto">Join thousands of users who have transformed their cooking experience with Stock & Spoon.</p>
            <a href="/app" className="bg-gradient-to-br from-yellow-400 to-orange-500 text-red-950 px-8 py-4 rounded-full no-underline font-semibold text-lg inline-block">🍳 Start Cooking Smarter Today</a>
          </div>
        </section>
      </main>

      <footer className="py-10 bg-black/30 text-center text-white/70">
        <div className="max-w-7xl mx-auto px-5">
          <p>&copy; 2026 Stock & Spoon. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;