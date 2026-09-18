# Coffee marketplace home

The public storefront now leads with coffee, origin, roast, and grind. Its copy and metadata are available in Spanish, English, and Portuguese, without cryptocurrency terminology. Account controls show the person's name or a translated account label instead of an address. Payment and authentication integrations are unchanged.

The catalogue keeps server-side search and filtering. Price sorting applies to the returned products. Filter options persist when results narrow; users can remove individual filters or clear all of them, including the search. Mobile filters collapse below 1024px. Product cards use real links, accessible quantity controls, stock limits, and a fallback for missing or broken images. Empty catalogues, empty searches, loading, and request failures have distinct states.

## Hero asset

- Asset: `webapp/public/images/coffee-ritual.webp` (1200 × 800, approximately 140 KiB).
- Created with the built-in ImageGen tool, then optimized as WebP for this repository.
- Editorial decoration; it does not represent a particular seller's product.
- Final generation prompt:

> Use case: photorealistic-natural. Create one editorial lifestyle photograph for the hero of a modern Costa Rican specialty coffee marketplace. Landscape 3:2 composition. Close, elevated view of a warm ivory handmade ceramic cup filled with black coffee, a small walnut wooden scoop with roasted coffee beans and a few loose beans on natural oatmeal linen on a warm cream stone countertop. A leafy coffee branch enters subtly from upper right. Morning sunlight from the side with beautiful soft leaf shadows; rich coffee brown, warm sand and muted forest green palette, authentic tactile materials, relaxed refined independent coffee shop mood. Cup and scoop arranged centrally with generous margins for cropping to square. No people, no packaging, no text, no branding, no watermarks, no graphics. This is a photographic asset only, not a website screenshot.

## Verification

- TypeScript and production build pass.
- Browser checks with the local API: ascending price order, adding/increasing/decreasing/removing cart quantities, search with no matches, clearing search and filters, roast filtering, retained filter options, and English/Spanish/Portuguese copy.
- Responsive checks cover desktop and mobile; keyboard controls have visible focus styles and labels.
- Existing integration warnings remain: Privy's optional `@farcaster/mini-app-solana` module, Next.js middleware deprecation, stale Browserslist data, and a browser hydration warning from the wallet kit adding styles to the root element.
