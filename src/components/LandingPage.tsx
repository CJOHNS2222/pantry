import React from 'react';

const LandingPage: React.FC = () => {
  return (
    <div style={{
      fontFamily: 'Inter, sans-serif',
      lineHeight: '1.6',
      color: '#333',
      background: 'linear-gradient(135deg, #2A0A10 0%, #4A1A20 100%)',
      minHeight: '100vh'
    }}>
      <header style={{
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        padding: '1rem 0'
      }}>
        <nav style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '0 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <a href="/" style={{
            fontFamily: 'Playfair Display, serif',
            fontSize: '1.8rem',
            fontWeight: 700,
            color: '#2A0A10',
            textDecoration: 'none'
          }}>Smart Pantry Chef</a>
          <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
            <a href="#features" style={{
              color: '#2A0A10',
              textDecoration: 'none',
              fontWeight: 500
            }}>Features</a>
            <a href="#screenshots" style={{
              color: '#2A0A10',
              textDecoration: 'none',
              fontWeight: 500
            }}>Screenshots</a>
            <a href="/app" style={{
              background: 'linear-gradient(135deg, #8B2635 0%, #2A0A10 100%)',
              color: 'white',
              padding: '0.5rem 1.5rem',
              borderRadius: '25px',
              textDecoration: 'none',
              fontWeight: 600
            }}>Try It Now</a>
          </div>
        </nav>
      </header>

      <main>
        <section style={{
          padding: '120px 0 80px',
          textAlign: 'center',
          color: 'white'
        }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px' }}>
            <h1 style={{
              fontFamily: 'Playfair Display, serif',
              fontSize: '3.5rem',
              fontWeight: 700,
              marginBottom: '1rem',
              background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>Smart Pantry Chef</h1>
            <p style={{
              fontSize: '1.3rem',
              marginBottom: '2rem',
              opacity: 0.9,
              maxWidth: '600px',
              marginLeft: 'auto',
              marginRight: 'auto'
            }}>AI-powered kitchen assistant that helps you manage your pantry, plan meals, and discover delicious recipes. Never waste food again!</p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <a href="/app" style={{
                background: 'linear-gradient(135deg, #8B2635 0%, #2A0A10 100%)',
                color: 'white',
                padding: '1rem 2rem',
                borderRadius: '25px',
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: '1.1rem'
              }}>🚀 Launch App</a>
              <a href="#features" style={{
                background: 'rgba(255, 255, 255, 0.2)',
                color: 'white',
                padding: '1rem 2rem',
                borderRadius: '25px',
                textDecoration: 'none',
                fontWeight: 600,
                border: '2px solid rgba(255, 255, 255, 0.3)'
              }}>Learn More</a>
            </div>
          </div>
        </section>

        <section id="features" style={{
          padding: '80px 0',
          background: 'rgba(255, 255, 255, 0.05)'
        }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px' }}>
            <h2 style={{
              textAlign: 'center',
              fontFamily: 'Playfair Display, serif',
              fontSize: '2.5rem',
              color: 'white',
              marginBottom: '3rem'
            }}>Powerful Features</h2>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '2rem'
            }}>
              <div style={{
                background: 'rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(10px)',
                borderRadius: '20px',
                padding: '2rem',
                textAlign: 'center',
                border: '1px solid rgba(255, 255, 255, 0.2)'
              }}>
                <div style={{
                  width: '80px',
                  height: '80px',
                  background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1rem',
                  fontSize: '2rem'
                }}>📱</div>
                <h3 style={{ color: 'white', fontSize: '1.5rem', marginBottom: '1rem' }}>Smart Pantry Scanner</h3>
                <p style={{ color: 'rgba(255, 255, 255, 0.8)' }}>Scan your pantry items with your camera. AI recognizes ingredients and automatically adds them to your inventory.</p>
              </div>
              <div style={{
                background: 'rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(10px)',
                borderRadius: '20px',
                padding: '2rem',
                textAlign: 'center',
                border: '1px solid rgba(255, 255, 255, 0.2)'
              }}>
                <div style={{
                  width: '80px',
                  height: '80px',
                  background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1rem',
                  fontSize: '2rem'
                }}>🍽️</div>
                <h3 style={{ color: 'white', fontSize: '1.5rem', marginBottom: '1rem' }}>AI Meal Planning</h3>
                <p style={{ color: 'rgba(255, 255, 255, 0.8)' }}>Get personalized meal suggestions based on your available ingredients and dietary preferences.</p>
              </div>
              <div style={{
                background: 'rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(10px)',
                borderRadius: '20px',
                padding: '2rem',
                textAlign: 'center',
                border: '1px solid rgba(255, 255, 255, 0.2)'
              }}>
                <div style={{
                  width: '80px',
                  height: '80px',
                  background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1rem',
                  fontSize: '2rem'
                }}>🛒</div>
                <h3 style={{ color: 'white', fontSize: '1.5rem', marginBottom: '1rem' }}>Smart Shopping Lists</h3>
                <p style={{ color: 'rgba(255, 255, 255, 0.8)' }}>Automatically generate shopping lists based on your meal plans and current pantry stock.</p>
              </div>
              <div style={{
                background: 'rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(10px)',
                borderRadius: '20px',
                padding: '2rem',
                textAlign: 'center',
                border: '1px solid rgba(255, 255, 255, 0.2)'
              }}>
                <div style={{
                  width: '80px',
                  height: '80px',
                  background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1rem',
                  fontSize: '2rem'
                }}>📅</div>
                <h3 style={{ color: 'white', fontSize: '1.5rem', marginBottom: '1rem' }}>Weekly Meal Planner</h3>
                <p style={{ color: 'rgba(255, 255, 255, 0.8)' }}>Plan your meals for the entire week with drag-and-drop simplicity and nutritional insights.</p>
              </div>
              <div style={{
                background: 'rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(10px)',
                borderRadius: '20px',
                padding: '2rem',
                textAlign: 'center',
                border: '1px solid rgba(255, 255, 255, 0.2)'
              }}>
                <div style={{
                  width: '80px',
                  height: '80px',
                  background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1rem',
                  fontSize: '2rem'
                }}>🤖</div>
                <h3 style={{ color: 'white', fontSize: '1.5rem', marginBottom: '1rem' }}>AI Recipe Generator</h3>
                <p style={{ color: 'rgba(255, 255, 255, 0.8)' }}>Discover new recipes using your available ingredients. Powered by advanced AI for creative cooking.</p>
              </div>
              <div style={{
                background: 'rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(10px)',
                borderRadius: '20px',
                padding: '2rem',
                textAlign: 'center',
                border: '1px solid rgba(255, 255, 255, 0.2)'
              }}>
                <div style={{
                  width: '80px',
                  height: '80px',
                  background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1rem',
                  fontSize: '2rem'
                }}>👥</div>
                <h3 style={{ color: 'white', fontSize: '1.5rem', marginBottom: '1rem' }}>Household Sharing</h3>
                <p style={{ color: 'rgba(255, 255, 255, 0.8)' }}>Share your pantry and meal plans with family members. Perfect for households and roommates.</p>
              </div>
            </div>
          </div>
        </section>

        <section style={{
          padding: '80px 0',
          textAlign: 'center',
          background: 'linear-gradient(135deg, rgba(139, 38, 53, 0.8) 0%, rgba(42, 10, 16, 0.8) 100%)'
        }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px' }}>
            <h2 style={{
              fontFamily: 'Playfair Display, serif',
              fontSize: '2.5rem',
              color: 'white',
              marginBottom: '1rem'
            }}>Ready to Revolutionize Your Kitchen?</h2>
            <p style={{
              fontSize: '1.2rem',
              color: 'rgba(255, 255, 255, 0.9)',
              marginBottom: '2rem',
              maxWidth: '600px',
              marginLeft: 'auto',
              marginRight: 'auto'
            }}>Join thousands of users who have transformed their cooking experience with Smart Pantry Chef.</p>
            <a href="/app" style={{
              background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
              color: '#2A0A10',
              padding: '1rem 2rem',
              borderRadius: '25px',
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: '1.1rem',
              display: 'inline-block'
            }}>🍳 Start Cooking Smarter Today</a>
          </div>
        </section>
      </main>

      <footer style={{
        padding: '40px 0',
        background: 'rgba(0, 0, 0, 0.3)',
        textAlign: 'center',
        color: 'rgba(255, 255, 255, 0.7)'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px' }}>
          <p>&copy; 2026 Smart Pantry Chef. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;