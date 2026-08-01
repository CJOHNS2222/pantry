# OpenRouter Setup (AI Fallback / Primary Path)

`services/openRouterService.ts` provides an OpenRouter (and Groq-compatible) fallback for AI-powered recipe search/generation when Gemini is unavailable or disabled, mirroring the shape of `geminiService.ts`.

## When It's Used

- As a fallback when `services/geminiService.ts` calls fail or hit quota.
- As the **primary** AI path in builds where the Gemini route is disabled via feature flag (`services/featureFlags.ts` `canUseGemini`) - in that mode all `searchRecipes`-style calls go through OpenRouter instead of Gemini.

## Environment Variables

```env
VITE_OPENROUTER_API_KEY=your_openrouter_api_key
VITE_OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
VITE_OPENROUTER_MODEL=your_openrouter_text_model
VITE_OPENROUTER_VISION_MODEL=your_openrouter_vision_model
```

Get an API key at [openrouter.ai/keys](https://openrouter.ai/keys). `VITE_OPENROUTER_MODEL` / `VITE_OPENROUTER_VISION_MODEL` should be OpenRouter model slugs (e.g. a Llama/Mistral/Gemini-via-OpenRouter text model and a vision-capable model for barcode/photo flows).

## Usage Limits

OpenRouter calls are gated by the same free/premium/family tier limits as Gemini - `UsageService.canUseGemini(user)` is checked before every OpenRouter call in `openRouterService.ts` (search, generation, and vision paths), and usage is recorded the same way, so switching providers never bypasses tier caps (see `.claude/audits/FIXES.md` F14).

## Related

- `services/geminiService.ts` - primary AI provider, same request/response shapes.
- `services/featureFlags.ts` - `canUseGemini()` decides Gemini vs. OpenRouter routing.
- `services/usageService.ts` - shared usage accounting for both providers.
