#!/usr/bin/env node
/**
 * generate-sitemap.mjs -- RETIRED 2026-10-30. Use regenerate-sitemap.mjs.
 *
 * This was the older of two scripts writing sitemap.xml, and they disagreed:
 * this one listed every product page (including the 4,548 now carrying
 * noindex), every URL with a trailing slash that 308s, and none of the
 * guides. Running it by mistake would undo the sitemap. It now refuses.
 */
console.error('generate-sitemap.mjs is retired: run  node scripts/regenerate-sitemap.mjs');
process.exit(1);
