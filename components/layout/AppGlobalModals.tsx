import React, { Suspense } from 'react';
import { useIntl } from 'react-intl';
import { User, Household, PantryItem, StructuredRecipe, DayPlan, CustomCategory } from '../../types';
import { Tab } from '../../types/app';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import ExpiredItemsLaunchSheet from '../pantry/ExpiredItemsLaunchSheet';
import { ContextualTutorial } from '../auth-onboarding/ContextualTutorial';
import { FeatureTooltip } from '../auth-onboarding/FeatureTooltip';
import HapticService from '../../services/hapticService';
import { log } from '../../services/logService';
import { recordMilestone } from '../../services/onboardingMilestoneService';
import DatabaseMonitoringService from '../../services/databaseMonitoringService';

// Lazy loaded modals
const DatabaseAnalytics = React.lazy(() => import('../admin-analytics/DatabaseAnalytics').then(m => ({ default: m.default })));
const HouseholdManager = React.lazy(() => import('../household/Household').then(m => ({ default: m.HouseholdManager })));
const HouseholdInviteModal = React.lazy(() => import('../household/HouseholdInviteModal').then(m => ({ default: m.HouseholdInviteModal })));
const ModernOnboardingFlow = React.lazy(() => import('../auth-onboarding/ModernOnboardingFlow').then(m => ({ default: m.ModernOnboardingFlow })));
const RiskAssessmentQuestionnaire = React.lazy(() => import('../ui/RiskAssessmentQuestionnaire'));
const ItemDetailModal = React.lazy(() => import('../pantry/ItemDetailModal'));
const ExpiredItemsModal = React.lazy(() => import('../pantry/ExpiredItemsModal'));
const RecipeFinderModalSection = React.lazy(() => import('../recipe-finder/RecipeFinderModalSection').then(m => ({ default: m.RecipeFinderModalSection })));
const GeminiTokenDebugger = React.lazy(() => import('../ui/GeminiTokenDebugger').then(m => ({ default: m.GeminiTokenDebugger })));
const WhatsNewModal = React.lazy(() => import('../auth-onboarding/WhatsNewModal').then(m => ({ default: m.WhatsNewModal })));
const FeatureDiscoveryManager = React.lazy(() => import('../auth-onboarding/FeatureDiscovery').then(m => ({ default: m.FeatureDiscoveryManager })));

interface AppGlobalModalsProps {
  user: User;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  household: Household | null;
  setHousehold: React.Dispatch<React.SetStateAction<Household | null>>;
  inventory: PantryItem[];
  mealPlan: DayPlan[];
  savedRecipesCount: number;
  customCategories: CustomCategory[];
  isAdmin: boolean;
  recipeSaveLimitExceeded: boolean;
  mealPlanLimitExceeded: boolean;
  showRiskQuestionnaire: boolean;
  handleRiskQuestionnaireComplete: (level: number, sensitive?: boolean) => Promise<void>;
  updateItem: (index: number, updates: Partial<PantryItem>) => Promise<void>;
  deleteItem: (index: number) => Promise<void>;
  deleteItems: (indices: number[], disposalReason?: 'thrown_away' | 'cooked' | 'remove') => Promise<void>;
  handleAddToPlan: (recipe: StructuredRecipe, dayIndex?: number, mealType?: 'breakfast' | 'lunch' | 'dinner') => void;
  handleSaveRecipe: (recipe: StructuredRecipe) => Promise<void>;
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  handleDeleteRecipe: (recipe: any) => void;
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  submitRating: (rating: any) => void;
  handleMarkAsMade: (recipe: StructuredRecipe) => void;
  addToShoppingList: (items: (string | { item: string; source: string; notes?: string })[]) => void;
  setActiveTab: (tab: Tab) => void;
  addToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning', ttl?: number) => void;
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  modals: any;
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  notificationHandlers: any;
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  featureMilestones: any;
}

const LoadingSpinner: React.FC = () => (
  <div className="flex items-center justify-center py-4">
    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--accent-color)]"></div>
  </div>
);

export const AppGlobalModals: React.FC<AppGlobalModalsProps> = ({
  user,
  setUser,
  household,
  setHousehold,
  inventory,
  mealPlan,
  savedRecipesCount,
  customCategories,
  isAdmin,
  recipeSaveLimitExceeded,
  mealPlanLimitExceeded,
  showRiskQuestionnaire,
  handleRiskQuestionnaireComplete,
  updateItem,
  deleteItem,
  deleteItems,
  handleAddToPlan,
  handleSaveRecipe,
  handleDeleteRecipe,
  submitRating,
  handleMarkAsMade,
  addToShoppingList,
  setActiveTab,
  addToast,
  modals,
  notificationHandlers,
  featureMilestones,
}) => {
  const intl = useIntl();

  const completeOnboarding = async () => {
    modals.setShowOnboarding(false);
    localStorage.setItem('onboarding-completed', 'true');
    recordMilestone('onboarding-completed');
    if (user?.id) {
      const userRef = DatabaseMonitoringService.doc('users', user.id);
      await DatabaseMonitoringService.updateDoc(userRef, { hasSeenTutorial: true });
      setUser(prev => prev ? { ...prev, hasSeenTutorial: true } : prev);
    }
  };

  const savePersona = async (persona: string) => {
    if (user?.id) {
      const userRef = DatabaseMonitoringService.doc('users', user.id);
      await DatabaseMonitoringService.updateDoc(userRef, { 'profile.leftoverPersona': persona });
    }
  };

  const handleDiscoveryDismiss = async (featureId: string) => {
    if (user && !user.isGuest) {
      try {
        const userRef = DatabaseMonitoringService.doc('users', user.id);
        const updatedDiscoveries = user.discoveredFeatures
          ? [...user.discoveredFeatures, featureId]
          : [featureId];
        await DatabaseMonitoringService.updateDoc(userRef, {
          discoveredFeatures: updatedDiscoveries
        });
        setUser(prev => prev ? { ...prev, discoveredFeatures: updatedDiscoveries } : prev);
      } catch (error) {
        log.error('Failed to sync discovered feature to Firestore', { error, featureId }, 'App');
      }
    }
  };

  const confirmAddToPlan = (dayIndex: number, mealType: 'breakfast' | 'lunch' | 'dinner') => {
    if (modals.pendingRecipeForPlan && handleAddToPlan) {
      handleAddToPlan(modals.pendingRecipeForPlan, dayIndex, mealType);
      modals.setPendingRecipeForPlan(null);
      modals.setShowAddToPlanDialog(false);
    }
  };

  const handleRemoveExpiredItems = async (itemIds: string[], disposalReason?: string) => {
    try {
      const indices = itemIds
        .map(id => inventory.findIndex(item => item.id === id))
        .filter(index => index !== -1);

      if (indices.length > 0) {
        const reason = (disposalReason === 'cooked' || disposalReason === 'remove')
          ? disposalReason
          : 'thrown_away';
        await deleteItems(indices, reason);
      }
    } catch (error) {
      log.error('Failed to remove expired items', { error }, 'App');
      addToast('Failed to remove expired items', 'error');
      throw error;
    }
  };

  return (
    <>
      {modals.showHousehold && (
        <Suspense fallback={null}>
          <HouseholdManager
            user={user}
            household={household}
            setHousehold={setHousehold}
            onClose={() => modals.setShowHousehold(false)}
            setActiveTab={setActiveTab}
            addToast={addToast}
          />
        </Suspense>
      )}

      {modals.showOnboarding && user && (
        <Suspense fallback={null}>
          <ModernOnboardingFlow
            user={user}
            onComplete={() => {
              completeOnboarding().catch(error => {
                log.error('Failed to mark onboarding complete', { error }, 'App');
              });
            }}
            onPersonaSelected={(persona) => {
              savePersona(persona).catch(error => {
                log.error('Failed to save leftover persona from onboarding', { error }, 'App');
              });
            }}
            onOpenHousehold={() => { modals.setShowOnboarding(false); modals.setShowHousehold(true); }}
            onSkip={() => {
              completeOnboarding().catch(error => {
                log.error('Failed to mark onboarding complete (skip)', { error }, 'App');
              });
            }}
            onSaveRecipes={async (recipes) => {
              for (const r of recipes) {
                await handleSaveRecipe(r);
              }
            }}
            onAddIngredientsToList={async (items) => {
              await addToShoppingList(items.map(i => ({ item: i, source: 'onboarding' })));
            }}
            onScheduleRecipes={async (recipes, _startFromTomorrow) => {
              const today = new Date();
              for (let i = 0; i < recipes.length; i++) {
                const day = new Date(today);
                day.setDate(today.getDate() + 1 + i);
                const dateStr = day.toISOString().slice(0, 10);
                const dayIndex = mealPlan?.findIndex(d => d.date?.slice(0, 10) === dateStr) ?? -1;
                await handleAddToPlan(recipes[i], dayIndex >= 0 ? dayIndex : undefined, 'dinner');
              }
            }}
          />
        </Suspense>
      )}

      {showRiskQuestionnaire && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex flex-col justify-end sm:justify-center overflow-hidden">
          <div className="bg-theme-secondary w-full sm:max-w-2xl sm:mx-auto sm:rounded-3xl shadow-2xl relative flex flex-col max-h-[90vh] rounded-t-3xl mt-10 sm:mt-0 overflow-y-auto">
            <Suspense fallback={null}>
              <RiskAssessmentQuestionnaire
                userId={user.id}
                onComplete={(level: number, sensitive?: boolean) => {
                  handleRiskQuestionnaireComplete(level, sensitive)
                    .then(() => {
                      setUser(prev => prev ? { ...prev, profile: { ...prev.profile, riskLevel: level, sensitiveHealthMode: !!sensitive } } : prev);
                    })
                    .catch(error => {
                      log.debug('Risk questionnaire complete handler failed', { error }, 'App');
                    });
                }}
              />
            </Suspense>
          </div>
        </div>
      )}

      {modals.showHouseholdInviteModal && user && (
        <Suspense fallback={null}>
          <HouseholdInviteModal
            invites={modals.householdInvites}
            user={user}
            onClose={() => modals.setShowHouseholdInviteModal(false)}
            onAccept={notificationHandlers.handleHouseholdInviteAccept}
            onDecline={notificationHandlers.handleHouseholdInviteDecline}
          />
        </Suspense>
      )}

      {modals.notificationViewItem && (
        <Suspense fallback={null}>
          <ItemDetailModal
            item={modals.notificationViewItem.item}
            originalIndex={modals.notificationViewItem.index}
            onClose={() => modals.setNotificationViewItem(null)}
            onUpdateItem={updateItem}
            onDeleteItem={deleteItem}
            onAddToShoppingList={addToShoppingList}
            customCategories={customCategories}
          />
        </Suspense>
      )}

      {modals.showAddToPlanDialog && modals.pendingRecipeForPlan && (
        <Modal
          isOpen={modals.showAddToPlanDialog}
          onClose={() => {
            modals.setShowAddToPlanDialog(false);
            modals.setPendingRecipeForPlan(null);
          }}
          title={intl.formatMessage({ id: 'mealPlanner.addToMealPlan' })}
          size="sm"
        >
          <Modal.Body>
            <p className="mb-4 text-[var(--text-secondary)]">
              Select a day and meal for "{modals.pendingRecipeForPlan.title}"
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-[var(--text-primary)]">
                  {intl.formatMessage({ id: 'mealPlanner.day' })}
                </label>
                <select
                  className="w-full p-2 border border-[var(--border-color)] rounded bg-[var(--bg-secondary)] text-[var(--text-primary)]"
                  onChange={(e) => modals.setSelectedDayForPlan(parseInt(e.target.value))}
                  value={modals.selectedDayForPlan ?? 0}
                >
                  {mealPlan?.map((day, index) => (
                    <option key={day.date} value={index}>
                      {day.dayName} ({new Date(day.date).toLocaleDateString()})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-[var(--text-primary)]">
                  {intl.formatMessage({ id: 'mealPlanner.meal' })}
                </label>
                <select
                  className="w-full p-2 border border-[var(--border-color)] rounded bg-[var(--bg-secondary)] text-[var(--text-primary)]"
                  onChange={(e) => modals.setSelectedMealForPlan(e.target.value as 'breakfast' | 'lunch' | 'dinner')}
                  value={modals.selectedMealForPlan ?? 'dinner'}
                >
                  <option value="breakfast">{intl.formatMessage({ id: 'mealPlanner.breakfast' })}</option>
                  <option value="lunch">{intl.formatMessage({ id: 'mealPlanner.lunch' })}</option>
                  <option value="dinner">{intl.formatMessage({ id: 'mealPlanner.dinner' })}</option>
                </select>
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button
              variant="ghost"
              onClick={() => {
                modals.setShowAddToPlanDialog(false);
                modals.setPendingRecipeForPlan(null);
              }}
            >
              {intl.formatMessage({ id: 'common.cancel' })}
            </Button>
            <Button
              onClick={() => {
                if (modals.selectedDayForPlan !== null && modals.selectedMealForPlan) {
                  confirmAddToPlan(modals.selectedDayForPlan, modals.selectedMealForPlan);
                }
              }}
            >
              Add to Plan
            </Button>
          </Modal.Footer>
        </Modal>
      )}

      <Suspense fallback={null}>
        <WhatsNewModal suppress={modals.showOnboarding || modals.newlyUnlockedBadge !== null} />
      </Suspense>

      {user && !modals.showOnboarding && !modals.newlyUnlockedBadge && (
        <Suspense fallback={null}>
          <FeatureDiscoveryManager
            discoveries={featureMilestones.featureDiscoveries}
            user={user}
            onDiscoveryDismiss={handleDiscoveryDismiss}
          />
        </Suspense>
      )}

      {user && !modals.showOnboarding && !modals.newlyUnlockedBadge && featureMilestones.contextualTips.length > 0 && (
        <ContextualTutorial tips={featureMilestones.contextualTips} onTipDismiss={featureMilestones.dismissContextualTip} />
      )}

      {user && !modals.showOnboarding && !modals.newlyUnlockedBadge && (
        <FeatureTooltip
          target='[data-tutorial="household-button"]'
          title="Share Your Pantry"
          description="Invite household members to share your pantry, shopping list, and meal plan in real time."
          position="bottom"
          featureKey="household-spotlight"
          delay={2000}
        />
      )}

      {modals.showExpiredItemsModal && (
        <Suspense fallback={null}>
          <ExpiredItemsModal
            isOpen={modals.showExpiredItemsModal}
            onClose={() => {
              modals.setShowExpiredItemsModal(false);
              modals.setExpiredItemsModalSpecificItems(undefined);
            }}
            inventory={inventory}
            onRemoveItems={handleRemoveExpiredItems}
            householdId={household?.id}
            userId={user?.id}
            userName={user?.name}
            specificItems={modals.expiredItemsModalSpecificItems}
          />
        </Suspense>
      )}

      {modals.showExpiredLaunchSheet && (
        <ExpiredItemsLaunchSheet
          isOpen={modals.showExpiredLaunchSheet}
          onClose={() => modals.setShowExpiredLaunchSheet(false)}
          expiredItems={modals.expiredLaunchItems}
          onRemoveItems={async (ids) => {
            try {
              await handleRemoveExpiredItems(ids);
            } catch (error) {
              log.error('Failed to remove expired items on launch', { error }, 'App');
            }
          }}
        />
      )}

      <Suspense fallback={null}>
        <RecipeFinderModalSection
          showRecipeModal={modals.showGlobalRecipeModal}
          modalRecipe={modals.globalModalRecipe}
          setShowRecipeModal={modals.setShowGlobalRecipeModal}
          onAddToPlan={handleAddToPlan}
          handleModalSaveRecipe={handleSaveRecipe}
          onDeleteRecipe={handleDeleteRecipe}
          onRate={submitRating}
          onMarkAsMade={handleMarkAsMade}
          modalIsSavedView={modals.globalModalIsSavedView}
          recipeSaveLimitExceeded={recipeSaveLimitExceeded}
          mealPlanLimitExceeded={mealPlanLimitExceeded}
          savedRecipesCount={savedRecipesCount}
          user={user}
          inventory={inventory}
        />
      </Suspense>

      {isAdmin && (
        <Suspense fallback={<LoadingSpinner />}>
          <DatabaseAnalytics />
        </Suspense>
      )}
      <Suspense fallback={null}>
        <GeminiTokenDebugger isAdmin={isAdmin} />
      </Suspense>

      <canvas
        ref={modals.fireworksCanvasRef}
        className="pointer-events-none fixed inset-0 z-[9999] w-full h-full"
      />

      {modals.newlyUnlockedBadge && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-theme-secondary border border-theme rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl relative overflow-hidden animate-scale-in">
            <div className={`absolute -top-24 -left-24 w-48 h-48 rounded-full bg-gradient-to-br ${modals.newlyUnlockedBadge.color} opacity-20 blur-2xl`} />
            <div className={`absolute -bottom-24 -right-24 w-48 h-48 rounded-full bg-gradient-to-br ${modals.newlyUnlockedBadge.color} opacity-20 blur-2xl`} />

            <div className="relative z-10">
              <div className={`w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br ${modals.newlyUnlockedBadge.color} flex items-center justify-center text-4xl shadow-lg mb-4 animate-bounce`}>
                {modals.newlyUnlockedBadge.icon}
              </div>

              <span className="text-xs font-bold uppercase tracking-wider text-[var(--accent-color)]">Achievement Unlocked!</span>
              <h3 className="text-2xl font-extrabold text-theme-primary mt-1 mb-2">{modals.newlyUnlockedBadge.title}</h3>
              <p className="text-sm text-theme-secondary opacity-95 mb-6">{modals.newlyUnlockedBadge.description}</p>

              <div className="space-y-2">
                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  onClick={() => {
                    modals.setNewlyUnlockedBadge(null);
                    HapticService.light();
                  }}
                >
                  Awesome! 🚀
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
