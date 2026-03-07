import React from 'react';
import { Heart, Shield, Clock, TrendingUp } from 'lucide-react';

interface RiskExplanationModalProps {
  onContinue: () => void;
  onSkip: () => void;
}

export const RiskExplanationModal: React.FC<RiskExplanationModalProps> = ({
  onContinue,
  onSkip
}) => {
  return (
    <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-theme-secondary rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-500 p-6 text-white relative">
          <div className="flex items-center justify-center gap-3">
            <Heart className="w-6 h-6" />
            <h2 className="text-2xl font-bold">Personalized Experience</h2>
            <Heart className="w-6 h-6" />
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">

          <div className="text-center mb-6">
            <p className="text-lg text-theme-primary font-medium mb-2">
              Help us understand your preferences
            </p>
            <p className="text-theme-secondary">
              Answer a few quick questions so we can personalize your Smart Pantry experience
            </p>
          </div>

          {/* Benefits */}
          <div className="space-y-4 mb-8">
            <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg">
              <Shield className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-blue-900 mb-1">Food Safety First</h3>
                <p className="text-sm text-blue-700">
                  We'll customize expiration alerts based on your comfort level with food freshness
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-green-50 rounded-lg">
              <Clock className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-green-900 mb-1">Smart Reminders</h3>
                <p className="text-sm text-green-700">
                  Get timely notifications about items that need attention in your pantry
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-purple-50 rounded-lg">
              <TrendingUp className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-purple-900 mb-1">Better Planning</h3>
                <p className="text-sm text-purple-700">
                  Receive personalized recipe suggestions and meal planning assistance
                </p>
              </div>
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-yellow-800">
              <strong>Quick & Optional:</strong> These questions take less than 2 minutes and you can change your preferences anytime in Settings.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onContinue}
              className="flex-1 bg-gradient-to-r from-blue-500 to-purple-500 hover:opacity-90 text-white py-3 px-6 rounded-xl font-semibold transition-all duration-200 transform hover:scale-[1.02] shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
            >
              Continue
              <Heart className="w-5 h-5" />
            </button>
            <button
              onClick={onSkip}
              className="px-6 py-3 bg-theme/10 hover:bg-theme/20 text-theme-secondary rounded-xl font-medium transition-colors"
            >
              Skip for now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};