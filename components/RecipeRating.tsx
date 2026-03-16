import React, { useState, useRef, useEffect } from 'react';
import { Star, MessageSquare, Camera, Heart, X, ThumbsUp, Users, TrendingUp, ChefHat, Loader2 } from 'lucide-react';
import { RecipeRating, StructuredRecipe, RecipeFeedback, RecipePhoto, RecipeModification, RecipeCommunityStats } from '../types';
import { RecipeRatingService } from '../services/recipeRatingService';
import { RecipePhotoService } from '../services/recipePhotoService';
import { useAuth } from '../hooks/useAuth';
import { useToasts } from '../hooks/useToasts';
import { log } from '../services/logService';

interface RecipeRatingUIProps {
  recipeTitle: string;
  recipe: StructuredRecipe;
  onRatingSubmitted?: (rating: RecipeRating) => void;
  communityStats?: RecipeCommunityStats;
  householdId?: string;
}

export const RecipeRatingUI: React.FC<RecipeRatingUIProps> = ({
  recipeTitle,
  recipe,
  onRatingSubmitted,
  communityStats,
  householdId
}) => {
  const { user: contextUser } = useAuth();
  const { addToast } = useToasts();
  const [existingRating, setExistingRating] = useState<RecipeRating | null>(null);
  // Support prop user override for testing
  const user = (typeof (window as any).TEST_USER !== 'undefined') ? (window as any).TEST_USER : (contextUser ?? undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedVerdict, setSelectedVerdict] = useState<'make-again' | 'skip' | 'modify' | null>(null);
  const [selectedFeedback, setSelectedFeedback] = useState<Set<string>>(new Set());
  const [comment, setComment] = useState('');
  const [photos, setPhotos] = useState<RecipePhoto[]>([]);
  const [showModificationForm, setShowModificationForm] = useState(false);
  const [modificationText, setModificationText] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load existing rating on mount
  useEffect(() => {
    if (user && user.id) {
      loadExistingRating();
    }
  }, [user && user.id, recipeTitle]);

  const loadExistingRating = async () => {
    if (!user?.id) return;

    try {
      setIsLoading(true);
      const rating = await RecipeRatingService.getUserRating(recipeTitle, user.id);
      if (rating) {
        setExistingRating(rating);
        setSelectedVerdict(rating.wouldMakeAgain ? 'make-again' : rating.wouldMakeAgain === false ? 'skip' : null);
        setSelectedFeedback(new Set(rating.feedback?.map(f => f.type) || []));
        setComment(rating.comment || '');
        setPhotos(rating.photos || []);
        setIsSubmitted(true);
      }
    } catch (error) {
      log.error('Failed to load existing rating:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const verdictOptions = [
    { key: 'make-again', label: "I'd make again", icon: Heart, color: 'text-green-500' },
    { key: 'modify', label: 'Modify & try again', icon: ChefHat, color: 'text-blue-500' },
    { key: 'skip', label: 'Skip', icon: X, color: 'text-red-500' }
  ];

  const feedbackOptions = [
    { key: 'too-spicy', label: 'Too spicy', emoji: '🌶️' },
    { key: 'too-bland', label: 'Too bland', emoji: '🫠' },
    { key: 'too-time-consuming', label: 'Too time-consuming', emoji: '⏰' },
    { key: 'too-complicated', label: 'Too complicated', emoji: '🤯' },
    { key: 'love-it', label: 'Love it!', emoji: '❤️' },
    { key: 'family-favorite', label: 'Family favorite', emoji: '👨‍👩‍👧‍👦' },
    { key: 'easy-weeknight', label: 'Easy weeknight', emoji: '🍽️' },
    { key: 'impressive-guests', label: 'Impressive for guests', emoji: '🎉' }
  ];

  const handleVerdictSelect = (verdict: 'make-again' | 'skip' | 'modify') => {
    setSelectedVerdict(verdict);
  };

  const handleFeedbackToggle = (feedbackType: string) => {
    const newFeedback = new Set(selectedFeedback);
    if (newFeedback.has(feedbackType)) {
      newFeedback.delete(feedbackType);
    } else {
      newFeedback.add(feedbackType);
    }
    setSelectedFeedback(newFeedback);
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user?.id) return;

    // Validate file
    const validation = RecipePhotoService.validatePhotoFile(file);
    if (!validation.valid) {
      addToast(validation.error!, 'error');
      return;
    }

    try {
      setIsLoading(true);

      // Compress image if needed
      const compressedFile = await RecipePhotoService.compressImage(file);

      // Upload photo
      const photo = await RecipePhotoService.uploadRecipePhoto(
        compressedFile,
        recipeTitle,
        user.id,
        existingRating?.id || `temp_${Date.now()}`
      );

      setPhotos(prev => [...prev, photo]);
      addToast('Photo uploaded successfully!', 'info');
    } catch (error) {
      log.error('Photo upload failed:', error);
      addToast('Failed to upload photo. Please try again.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedVerdict) return;

    try {
      setIsSubmitting(true);

      // Use the provided `recipe` object directly — it should include recipe info at submit time.
      const enrichedRecipe: StructuredRecipe = recipe;

      const feedback: RecipeFeedback[] = Array.from(selectedFeedback).map(type => ({
        type: type as RecipeFeedback['type'],
        comment: type === 'love-it' ? comment : undefined
      }));

      const rating: RecipeRating = {
        id: existingRating?.id || `${recipeTitle}_${user?.id || 'anon'}_${Date.now()}`,
        recipeTitle,
        rating: selectedVerdict === 'make-again' ? 5 : selectedVerdict === 'modify' ? 3 : 1,
        comment,
        userName: user?.name || 'Anonymous User',
        userAvatar: user?.avatar,
        date: new Date().toISOString(),
        recipe: enrichedRecipe,
        wouldMakeAgain: selectedVerdict === 'make-again',
        feedback,
        photos,
        modifications: existingRating?.modifications || []
      };

      if (user?.id) {
        await RecipeRatingService.submitRating(rating, user.id, householdId);
      }

      setExistingRating(rating);
      setIsSubmitted(true);
      onRatingSubmitted?.(rating);
      addToast('Rating submitted successfully!', 'info');
    } catch (error) {
      console.error('Failed to submit rating:', error);
      addToast('Failed to submit rating. Please try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddModification = async () => {
    if (!modificationText.trim() || !user?.id) return;

    try {
      const modification: Omit<RecipeModification, 'id' | 'helpful'> = {
        type: 'changed-method',
        description: modificationText,
        userName: user.name || 'Anonymous',
        userAvatar: user.avatar,
        date: new Date().toISOString()
      };

      await RecipeRatingService.addModification(recipeTitle, modification, user.id);

      setModificationText('');
      setShowModificationForm(false);
      addToast('Modification suggestion added!', 'info');
    } catch (error) {
      console.error('Failed to add modification:', error);
      addToast('Failed to add modification. Please try again.', 'error');
    }
  };

  if (isSubmitted && existingRating) {
    return (
      <div className="bg-theme-secondary rounded-xl p-4 border border-theme animate-fade-in">
        <div className="text-center">
          <div className="flex justify-center items-center gap-2 mb-2">
            {selectedVerdict === 'make-again' && <Heart className="w-5 h-5 text-green-500 fill-green-500" />}
            {selectedVerdict === 'modify' && <ChefHat className="w-5 h-5 text-blue-500" />}
            {selectedVerdict === 'skip' && <X className="w-5 h-5 text-red-500" />}
            <span className="text-theme-primary font-medium">
              {verdictOptions.find(v => v.key === selectedVerdict)?.label}
            </span>
          </div>
          {selectedFeedback.size > 0 && (
            <div className="flex flex-wrap justify-center gap-1 mb-2">
              {Array.from(selectedFeedback).map(type => {
                const option = feedbackOptions.find(f => f.key === type);
                return option ? (
                  <span key={type} className="text-xs bg-theme-primary px-2 py-1 rounded-full text-theme-secondary">
                    {option.emoji} {option.label}
                  </span>
                ) : null;
              })}
            </div>
          )}
          <p className="text-sm text-theme-secondary">Thanks for your feedback!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-theme-secondary rounded-xl p-4 border border-theme mt-4" onClick={(e) => e.stopPropagation()}>
      {/* Community Stats Header */}
      {communityStats && (
        <div className="mb-4 p-3 bg-theme-primary rounded-lg border border-theme/50">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[var(--accent-color)]" />
              <span className="text-sm font-medium text-theme-primary">Community Rating</span>
            </div>
            <div className="text-sm text-theme-secondary">
              {communityStats.totalRatings} reviews
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1">
              <Heart className="w-4 h-4 text-green-500" />
              <span className="text-theme-primary">{communityStats.wouldMakeAgainPercentage}%</span>
              <span className="text-theme-secondary">would make again</span>
            </div>
            {communityStats.householdStats && (
              <div className="flex items-center gap-1">
                <TrendingUp className="w-4 h-4 text-blue-500" />
                <span className="text-theme-primary">{communityStats.householdStats.householdRatings}</span>
                <span className="text-theme-secondary">from household</span>
              </div>
            )}
          </div>
        </div>
      )}

      <h4 className="text-theme-primary font-serif text-lg mb-4 flex items-center gap-2">
        <Star className="w-4 h-4" /> Rate this recipe
      </h4>

      <form onSubmit={handleSubmit} onClick={(e) => e.stopPropagation()}>
        {/* Verdict Selection */}
        <div className="mb-4">
          <div className="text-sm text-theme-secondary mb-2">Would you make this again?</div>
          <div className="flex gap-2">
            {verdictOptions.map(option => {
              const Icon = option.icon;
              const isSelected = selectedVerdict === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => handleVerdictSelect(option.key as any)}
                  className={`flex-1 flex flex-col items-center gap-2 p-3 rounded-lg border transition-all ${
                    isSelected
                      ? 'border-[var(--accent-color)] bg-[var(--accent-color)]/10'
                      : 'border-theme bg-theme-primary hover:border-[var(--accent-color)]/50'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${option.color}`} />
                  <span className="text-xs font-medium text-theme-primary text-center">
                    {option.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Quick Feedback */}
        <div className="mb-4">
          <div className="text-sm text-theme-secondary mb-2">Quick feedback:</div>
          <div className="flex flex-wrap gap-2">
            {feedbackOptions.map(option => {
              const isSelected = selectedFeedback.has(option.key);
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => handleFeedbackToggle(option.key)}
                  className={`flex items-center gap-1 px-3 py-2 rounded-full text-xs transition-all ${
                    isSelected
                      ? 'bg-[var(--accent-color)] text-white'
                      : 'bg-theme-primary text-theme-primary hover:bg-theme-secondary border border-theme'
                  }`}
                >
                  <span>{option.emoji}</span>
                  <span>{option.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Comment */}
        <div className="relative mb-4">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            placeholder="Share your thoughts or tips..."
            className="w-full bg-theme-primary text-theme-primary border border-theme rounded-lg p-3 text-sm focus:border-[var(--accent-color)] focus:outline-none resize-none h-20 placeholder-theme-secondary/50"
          />
          <MessageSquare className="absolute right-3 bottom-3 w-4 h-4 text-theme-secondary/50" />
        </div>

        {/* Photo Upload */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Camera className="w-4 h-4 text-theme-secondary" />
            <span className="text-sm text-theme-secondary">Add photos of your result</span>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoUpload}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 p-3 border-2 border-dashed border-theme rounded-lg text-theme-secondary hover:border-[var(--accent-color)] hover:text-[var(--accent-color)] transition-colors disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Camera className="w-5 h-5" />
            )}
            <span>{isLoading ? 'Uploading...' : 'Upload Photo'}</span>
          </button>
          {photos.length > 0 && (
            <div className="flex gap-2 mt-2 overflow-x-auto">
              {photos.map(photo => (
                <img
                  key={photo.id}
                  src={photo.url}
                  alt="Recipe result"
                  className="w-16 h-16 rounded-lg object-cover border border-theme"
                />
              ))}
            </div>
          )}
        </div>

        {/* Modification Suggestion */}
        <div className="mb-4">
          <button
            type="button"
            onClick={() => setShowModificationForm(!showModificationForm)}
            className="flex items-center gap-2 text-sm text-[var(--accent-color)] hover:underline"
          >
            <ChefHat className="w-4 h-4" />
            Suggest a modification
          </button>
          {showModificationForm && (
            <div className="mt-2 p-3 bg-theme-primary rounded-lg border border-theme">
              <textarea
                value={modificationText}
                onChange={(e) => setModificationText(e.target.value)}
                placeholder="Describe your modification (e.g., 'Add garlic', 'Use less salt', 'Bake instead of fry')"
                className="w-full bg-theme-secondary text-theme-primary border border-theme rounded p-2 text-sm focus:border-[var(--accent-color)] focus:outline-none resize-none h-16"
              />
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={handleAddModification}
                  disabled={!modificationText.trim()}
                  className="flex-1 bg-[var(--accent-color)] text-white px-3 py-2 rounded text-sm hover:bg-[var(--accent-color)]/90 transition-colors disabled:opacity-50"
                >
                  Add Suggestion
                </button>
                <button
                  type="button"
                  onClick={() => setShowModificationForm(false)}
                  className="px-3 py-2 text-theme-secondary hover:text-theme-primary transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={!selectedVerdict || isSubmitting}
          onClick={(e) => e.stopPropagation()}
          className="w-full bg-[var(--accent-color)] text-white py-3 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--accent-color)]/90 flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Submitting...
            </>
          ) : (
            'Submit Rating'
          )}
        </button>
      </form>
    </div>
  );
};