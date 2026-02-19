import React, { useState, useEffect, useCallback } from 'react';
import { IonContent, IonPage, IonHeader, IonToolbar, IonTitle, IonList, IonItem, IonLabel, IonSpinner, IonAlert, IonInfiniteScroll, IonInfiniteScrollContent } from '@ionic/react';
import { RecipeRating } from '../types';
import { useDataManagement } from '../hooks/useDataManagement';

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
      console.error(err);
    }
    setIsLoading(false);
  }, [getCommunityRatings]);

  useEffect(() => {
    loadRatings();
  }, [loadRatings]);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Community Ratings</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        {isLoading ? (
          <IonSpinner />
        ) : error ? (
          <IonAlert
            isOpen={!!error}
            message={error}
            buttons={['OK']}
            onDidDismiss={() => setError(null)}
          />
        ) : (
          <IonList>
            {ratings.map(rating => (
              <IonItem key={rating.id}>
                <IonLabel>
                  <h2>{rating.recipeTitle}</h2>
                  <p>Rating: {rating.rating}</p>
                  <p>{rating.comment}</p>
                  <p>- {rating.userName}</p>
                </IonLabel>
              </IonItem>
            ))}
          </IonList>
        )}
      </IonContent>
    </IonPage>
  );
};

export default Community;
