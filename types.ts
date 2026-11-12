
export type AspectRatio = '1:1' | '3:4' | '4:3' | '9:16' | '16:9' | 'custom';
export type ImageSize = '1K' | '2K' | '4K';
export type ModelType = 
  | 'gemini-3.1-flash-lite-image'
  | 'gemini-2.5-flash-image' 
  | 'gemini-3.1-flash-image' 
  | 'gemini-3.1-flash-image-preview' 
  | 'gemini-3-pro-image' 
  | 'gemini-3-pro-image-preview' 
  | 'imagen-3.0-generate-002' 
  | 'imagen-4.0-generate-001' 
  | 'all';

export interface CustomDimensions {
  width: number;
  height: number;
}

export type ReferenceRole = 'style' | 'character' | 'subject' | 'custom';
export type ReferenceStrength = 'subtle' | 'balanced' | 'strong' | 'exact'; // 25%, 50%, 75%, 100%

export interface SourceImage {
  id?: string;
  data: string; // base64 string
  mimeType: string;
  role?: ReferenceRole;
  strength?: ReferenceStrength; // Defaults to 'balanced' (50%)
  customInstruction?: string; // Free-form custom direction
}

export interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  negativePrompt?: string;
  fullPrompt?: string; // Full composite prompt sent to the model including negative constraints & steering guidelines
  sourceImagesCount?: number;
  model: ModelType;
  timestamp: number;
  aspectRatio: AspectRatio;
  customDimensions?: CustomDimensions;
  textOutput?: string;
  liked?: boolean;
}

export type SafetyFilterLevel = 'block_none' | 'block_only_high' | 'block_medium_and_above';

export interface GenerationSettings {
  prompt: string;
  negativePrompt?: string;
  aspectRatio: AspectRatio;
  customDimensions?: CustomDimensions;
  imageSize: ImageSize;
  model: ModelType;
  sourceImages: SourceImage[];
  safetyFilter?: SafetyFilterLevel;
}

declare global {
  /**
   * The AIStudio interface defines the methods for managing API keys.
   * Declaring it inside the global block ensures it correctly matches and merges
   * with the expected global type in the execution environment.
   */
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }

  interface Window {
    /**
     * The aistudio property is used for managing API keys in specific model contexts.
     * We remove the 'readonly' modifier to ensure this declaration is identical 
     * to the one already present in the global scope, avoiding modifier mismatch errors.
     */
    // Fix: Removed 'readonly' modifier to match other existing declarations of 'aistudio'.
    aistudio: AIStudio;
  }
}