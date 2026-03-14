import { fetchWithTimeout, type Product } from '@dispara/shared';

// ============================================
// Types
// ============================================

export type ImageStyle = 'clean' | 'bold' | 'minimal' | 'social' | 'story';

export interface ImageGeneratorOptions {
  withText?: boolean;
  textOverlay?: string;
  aspectRatio?: '1:1' | '4:5' | '9:16' | '16:9';
}

export interface GeneratedImage {
  imageUrl: string;
  style: ImageStyle;
  prompt: string;
  model: string;
  generatedAt: Date;
}

interface GeminiCandidate {
  content?: {
    parts?: Array<{
      text?: string;
      inlineData?: { mimeType: string; data: string };
    }>;
  };
}

interface GeminiResponse {
  candidates?: GeminiCandidate[];
  error?: { message: string };
}

// ============================================
// Prompt Templates per Style
// ============================================

const STYLE_TEMPLATES: Record<ImageStyle, {
  scene: string;
  lighting: string;
  composition: string;
  mood: string;
}> = {
  clean: {
    scene: 'Product photography on a pristine white background, studio setting',
    lighting: 'Soft diffused studio lighting, no harsh shadows',
    composition: 'Centered product, minimal negative space, professional catalog style',
    mood: 'Premium, trustworthy, professional e-commerce',
  },
  bold: {
    scene: 'Dynamic product shot with vibrant colored geometric background shapes',
    lighting: 'High contrast dramatic lighting with rim light',
    composition: 'Angled product placement, bold diagonal lines, eye-catching layout',
    mood: 'Energetic, urgent, attention-grabbing sale promotion',
  },
  minimal: {
    scene: 'Product on a neutral matte surface, Scandinavian aesthetic',
    lighting: 'Natural window light, gentle shadows',
    composition: 'Rule of thirds, generous whitespace, elegant simplicity',
    mood: 'Sophisticated, calm, curated selection',
  },
  social: {
    scene: 'Lifestyle flat lay with the product as hero, complementary props around it',
    lighting: 'Warm golden hour tones, Instagram-ready',
    composition: 'Top-down or 45-degree angle, social media square format',
    mood: 'Aspirational, shareable, lifestyle-oriented',
  },
  story: {
    scene: 'Vertical product showcase with gradient background, story-format layout',
    lighting: 'Neon accent lighting with dark background',
    composition: 'Vertical 9:16 format, product centered in upper third, space for text below',
    mood: 'Modern, mobile-first, swipe-up ready',
  },
};

const ASPECT_RATIOS: Record<string, string> = {
  '1:1': 'square format (1:1 aspect ratio)',
  '4:5': 'portrait format (4:5 aspect ratio, Instagram post)',
  '9:16': 'vertical format (9:16 aspect ratio, Stories/Reels)',
  '16:9': 'landscape format (16:9 aspect ratio, banner)',
};

// ============================================
// ImageGenerator
// ============================================

export class ImageGenerator {
  private readonly geminiApiKey: string;
  private readonly geminiApiKeyFallback?: string;
  private readonly model: string;

  constructor(
    geminiApiKey: string,
    options?: { fallbackKey?: string; model?: string },
  ) {
    this.geminiApiKey = geminiApiKey;
    this.geminiApiKeyFallback = options?.fallbackKey;
    this.model = options?.model ?? 'gemini-2.0-flash-exp';
  }

  async generatePromoImage(
    product: Product,
    style: ImageStyle = 'clean',
    options: ImageGeneratorOptions = {},
  ): Promise<GeneratedImage> {
    const prompt = this.buildPrompt(product, style, options);
    const imageBase64 = await this.callGeminiImageGen(prompt);

    return {
      imageUrl: `data:image/png;base64,${imageBase64}`,
      style,
      prompt,
      model: this.model,
      generatedAt: new Date(),
    };
  }

  buildPrompt(
    product: Product,
    style: ImageStyle,
    options: ImageGeneratorOptions = {},
  ): string {
    const template = STYLE_TEMPLATES[style];
    const aspectDesc = ASPECT_RATIOS[options.aspectRatio ?? '1:1'];

    const categoryHint = product.category
      ? `Product category: ${product.category}.`
      : '';

    let textInstruction = '';
    if (options.withText && options.textOverlay) {
      textInstruction = `Include text overlay: "${options.textOverlay}" in a clean, readable font.`;
    } else if (options.withText) {
      textInstruction = `Include a bold "${product.discountPercent}% OFF" badge in the corner.`;
    }

    return [
      `Create a promotional product image for e-commerce.`,
      `Product: ${product.name}.`,
      categoryHint,
      `Scene: ${template.scene}.`,
      `Lighting: ${template.lighting}.`,
      `Composition: ${template.composition}, ${aspectDesc}.`,
      `Mood: ${template.mood}.`,
      textInstruction,
      `The image must look professional, high-resolution, ready for social media marketing.`,
      `Do NOT include any watermarks or logos. Photorealistic quality.`,
    ].filter(Boolean).join(' ');
  }

  private async callGeminiImageGen(prompt: string): Promise<string> {
    const keys = [this.geminiApiKey];
    if (this.geminiApiKeyFallback) keys.push(this.geminiApiKeyFallback);

    let lastError: Error | null = null;

    for (const key of keys) {
      try {
        return await this.attemptGeminiCall(key, prompt);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.warn(`[ImageGenerator] Gemini call failed with key ...${key.slice(-6)}, trying next`);
      }
    }

    throw lastError ?? new Error('All Gemini API keys exhausted');
  }

  private async attemptGeminiCall(apiKey: string, prompt: string): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${apiKey}`;

    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ['IMAGE', 'TEXT'],
          temperature: 0.4,
        },
      }),
    }, 60_000);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API ${response.status}: ${errorText}`);
    }

    const data = await response.json() as GeminiResponse;

    if (data.error) {
      throw new Error(`Gemini error: ${data.error.message}`);
    }

    const parts = data.candidates?.[0]?.content?.parts;
    if (!parts) {
      throw new Error('Gemini returned no content parts');
    }

    const imagePart = parts.find(p => p.inlineData?.mimeType?.startsWith('image/'));
    if (!imagePart?.inlineData) {
      throw new Error('Gemini returned no image data');
    }

    return imagePart.inlineData.data;
  }
}
