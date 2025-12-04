import React, { useState, useRef } from 'react';
import { Camera, Upload, Loader2, Plus, Trash2, CheckCircle2, Scan } from 'lucide-react';
import { analyzePantryImage } from '../services/geminiService';
import { PantryItem, LoadingState } from '../types';

export const PantryScanner: React.FC = () => {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [rawBase64, setRawBase64] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>("");
  const [inventory, setInventory] = useState<PantryItem[]>([]);
  const [loadingState, setLoadingState] = useState<LoadingState>(LoadingState.IDLE);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset state
    setInventory([]);
    setErrorMsg(null);
    setLoadingState(LoadingState.IDLE);
    setMimeType(file.type);

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setImagePreview(result);
      
      // Extract raw base64 string (remove data:image/xxx;base64, prefix)
      const base64Data = result.split(',')[1];
      setRawBase64(base64Data);
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyze = async () => {
    if (!rawBase64) return;

    setLoadingState(LoadingState.LOADING);
    setErrorMsg(null);

    try {
      const items = await analyzePantryImage(rawBase64, mimeType);
      if (items.length === 0) {
        setErrorMsg("No items detected. Try a clearer photo.");
        setLoadingState(LoadingState.ERROR);
      } else {
        setInventory(items);
        setLoadingState(LoadingState.SUCCESS);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("Failed to analyze image. Please try again.");
      setLoadingState(LoadingState.ERROR);
    }
  };

  const removeItem = (index: number) => {
    setInventory(prev => prev.filter((_, i) => i !== index));
  };

  const resetScanner = () => {
    setImagePreview(null);
    setRawBase64(null);
    setInventory([]);
    setLoadingState(LoadingState.IDLE);
    setErrorMsg(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="bg-white p-6 rounded-3xl shadow-lg border border-gray-100/50 backdrop-blur-sm">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Scan className="w-6 h-6 text-emerald-600" />
              Pantry Scanner
            </h2>
            <p className="text-gray-500 mt-1">Snap a photo to instantly digitize your inventory.</p>
          </div>
          {imagePreview && (
             <button onClick={resetScanner} className="text-sm text-gray-400 hover:text-red-500 transition-colors">
               Clear
             </button>
          )}
        </div>

        {/* Image Upload Area */}
        <div 
          className="relative group cursor-pointer transition-all duration-300"
          onClick={() => fileInputRef.current?.click()}
        >
          {imagePreview ? (
            <div className="relative rounded-2xl overflow-hidden aspect-video bg-gray-100 ring-4 ring-emerald-50 shadow-inner">
              <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
                <p className="text-white font-medium flex items-center gap-2 bg-white/20 px-4 py-2 rounded-full backdrop-blur-md border border-white/30">
                  <Camera className="w-5 h-5" /> Change Photo
                </p>
              </div>
            </div>
          ) : (
            <div className="border-3 border-dashed border-emerald-100 rounded-2xl bg-gradient-to-br from-emerald-50/50 to-white hover:from-emerald-50 hover:to-emerald-50/30 transition-all aspect-video flex flex-col items-center justify-center text-emerald-600 gap-4 group-hover:border-emerald-300 shadow-sm">
              <div className="p-4 bg-white rounded-full shadow-lg shadow-emerald-100 group-hover:scale-110 transition-transform">
                <Upload className="w-8 h-8 text-emerald-500" />
              </div>
              <div className="text-center">
                <p className="font-bold text-lg text-emerald-900">Upload Pantry Photo</p>
                <p className="text-sm text-emerald-600/70 mt-1">Tap to open camera or gallery</p>
              </div>
            </div>
          )}
          <input 
            type="file" 
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            capture="environment"
            className="hidden"
          />
        </div>

        {/* Analyze Button */}
        {imagePreview && loadingState !== LoadingState.SUCCESS && (
          <button
            onClick={handleAnalyze}
            disabled={loadingState === LoadingState.LOADING}
            className={`w-full mt-6 py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-all transform active:scale-95 ${
              loadingState === LoadingState.LOADING 
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                : 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:shadow-lg hover:shadow-emerald-500/30'
            }`}
          >
            {loadingState === LoadingState.LOADING ? (
              <>
                <Loader2 className="w-6 h-6 animate-spin" />
                Processing with Gemini...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-6 h-6" />
                Analyze Inventory
              </>
            )}
          </button>
        )}
        
        {errorMsg && (
          <div className="mt-4 p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-center font-medium animate-pulse">
            {errorMsg}
          </div>
        )}
      </div>

      {/* Results List */}
      {inventory.length > 0 && (
        <div className="space-y-4 animate-fade-in-up">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <span className="bg-emerald-100 text-emerald-800 text-xs px-2 py-1 rounded-full">{inventory.length}</span>
              Items Detected
            </h3>
            <button className="text-emerald-600 text-sm font-medium hover:text-emerald-700 flex items-center gap-1 transition-colors">
              <Plus className="w-4 h-4" /> Add Item
            </button>
          </div>
          
          <div className="grid grid-cols-1 gap-3">
            {inventory.map((item, idx) => (
              <div key={idx} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between group hover:border-emerald-200 transition-all hover:shadow-md">
                <div className="flex-1">
                  <h4 className="font-bold text-gray-800 text-lg">{item.item}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs px-2.5 py-0.5 bg-emerald-50 text-emerald-700 rounded-md font-medium border border-emerald-100/50">
                      {item.category}
                    </span>
                    <span className="text-xs text-gray-400 font-medium">
                       • {item.quantity_estimate}
                    </span>
                  </div>
                </div>
                <button 
                  onClick={() => removeItem(idx)}
                  className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                  aria-label="Remove item"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
