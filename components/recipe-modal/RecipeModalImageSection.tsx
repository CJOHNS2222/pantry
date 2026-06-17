import React from 'react';
import { ProgressiveImage } from '../ui/ProgressiveImage';
import { generateBlurDataURL } from '../../utils/appUtils';

interface RecipeModalImageSectionProps {
  editable: boolean;
  imagePreview: string | null;
  recipeImage: string | undefined;
  recipeTitle: string;
  setImageFile: React.Dispatch<React.SetStateAction<File | null>>;
  setImagePreview: React.Dispatch<React.SetStateAction<string | null>>;
}

export const RecipeModalImageSection: React.FC<RecipeModalImageSectionProps> = ({
  editable,
  imagePreview,
  recipeImage,
  recipeTitle,
  setImageFile,
  setImagePreview,
}) => {
  if (editable) {
    return (
      <div className="mb-4">
        <label className="block text-xs font-semibold mb-2">Photo</label>
        <div className="flex items-center gap-3">
          <input
            type="file"
            accept="image/*"
            onChange={(event) => {
              const file = event.target.files && event.target.files[0];
              if (file) {
                setImageFile(file);
                setImagePreview(URL.createObjectURL(file));
              }
            }}
          />
          {imagePreview && <img src={imagePreview} alt="preview" className="w-24 h-24 object-cover rounded" />}
        </div>
      </div>
    );
  }

  if (!recipeImage) {
    return null;
  }

  return (
    <div className="mb-6 rounded-lg overflow-hidden border border-theme">
      <ProgressiveImage
        src={recipeImage}
        alt={recipeTitle}
        className="w-full h-48"
        blurDataURL={generateBlurDataURL(400, 192)}
        placeholderSrc="/images/placeholder.svg"
      />
    </div>
  );
};
