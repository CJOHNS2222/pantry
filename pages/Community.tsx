import React, { useState, useEffect, useCallback } from 'react';
// Using plain HTML elements here to avoid optional Ionic dependency in non-native builds
import { RecipeRating } from '../types';
import { useDataManagement } from '../hooks/useDataManagement';
import { log } from '../services/logService';

const Community: React.FC = () => {
  const [ratings, setRatings] = useState<RecipeRating[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { getCommunityRatings } = useDataManagement();

  const loadRatings = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const communityRatings = await getCommunityRatings();
      setRatings(communityRatings);
    } catch (err: any) {
      setError('Could not load community ratings.');
      log.error('Failed to load community ratings:', { error: err?.message }, 'Community');
    }
    setIsLoading(false);
  }, [getCommunityRatings]);

  useEffect(() => {
    loadRatings();
  }, [loadRatings]);

  return (
    <div>
      <header>
        <div>
          <h1>Community Ratings</h1>
        </div>
      </header>
      <main>
        {isLoading ? (
          <span>Loading...</span>
        ) : error ? (
          <div role="alert">
            <p>{error}</p>
            <button onClick={() => setError(null)}>OK</button>
          </div>
        ) : (
          <ul>
            {ratings.map(r => (
              <li key={r.id}>
                <div>
                  <h3>{r.recipeTitle}</h3>
                  <p>Rating: {r.rating}</p>
                  <p>{r.comment}</p>
                  <p>- {r.userName}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
};

export default Community;
