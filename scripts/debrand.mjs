#!/usr/bin/env node
/**
 * debrand.mjs — one-shot migration: strip third-party brand attribution from the
 * skill, keeping everything that is not legally or technically required.
 *
 * Removed: company names used as attribution, event names, competitor style
 * names, and style-attribution version numbers.
 * Kept:    platform / framework / API names (nominative use — you cannot write
 *          `UIGlassEffect` without naming it) and SDK version numbers in
 *          toolchain contexts (factual, not promotional).
 *
 * Idempotent: running it twice produces no further change.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

/* Ordered: specific phrases first, generic fallbacks last. */
const RULES = [
  // --- company attribution, specific phrases -------------------------------
  ["Apple's WWDC25 guidance", "the platform guidance"],
  ["Apple's own controls", "the reference controls"],
  ["Apple's controls", "the reference controls"],
  ["Apple's shapes are continuous (squircle)", "Continuous (superellipse) shapes"],
  ["Apple's vibrancy idea", "the vibrancy idea"],
  ["Apple's lensing", "true lensing"],
  ["Apple's actual Liquid Glass", "the system material"],
  ["Apple's Liquid Glass (iOS 26 / macOS Tahoe 26, WWDC25)", "Liquid Glass"],
  ["Apple's Liquid Glass", "Liquid Glass"],
  ["**Apple's Liquid Glass** — the material from iOS 26 / macOS Tahoe 26 (WWDC25) —", "**Liquid Glass**"],
  ["the material from iOS 26 / macOS Tahoe 26 (WWDC25)", ""],
  ["Apple's new design language", "the Liquid Glass material"],
  ["Apple's new OS", "the latest OS"],
  ["Apple-futuristic", "material-forward"],
  ['Apple\'s "Reduce Transparency"', '"Reduce Transparency"'],
  ["Perfect parity with Apple's lensing", "Perfect parity with true lensing"],
  ["which is exactly the illegibility Apple avoids", "which is exactly the illegibility this avoids"],
  ["exactly what Apple asks you to remove", "exactly what the guidance asks you to remove"],
  ["Apple asks you to", "the guidance asks you to"],
  ["Remove custom backgrounds Apple wouldn't have", "Remove custom backgrounds the system wouldn't have"],
  ["tints to Apple blue", "tints to system blue"],
  ["the rule that makes it look Apple", "the rule that makes it read correctly"],
  ["reads as Apple", "reads as a real material"],
  ["the Apple look", "the reference look"],
  ["Apple Liquid Glass material", "Liquid Glass material"],
  ["Apple's Adopting Liquid Glass page", "the platform's adoption guide"],
  ["names from the iOS 26 SDK", "names from the current SDK"],
  ["when compiled against the iOS 26 SDK", "when compiled against a current SDK"],
  ["API names below are from the Xcode 26 / iOS 26 / macOS 26 SDK", "API names below are from the current SDK"],
  ["# Native Apple platforms —", "# Native platforms —"],
  ["for iOS 18 —", "for earlier releases —"],
  ["(macOS 26)", ""],
  ["(the Apple look)", "(the reference look)"],
  // competitor / generic style names
  ["generic glassmorphism", "generic frosted blur"],
  ["glassmorphism", "generic frosted blur"],
  ["frosted-glass", "frosted blur"],
  // --- style-attribution version numbers (SDK numbers stay) ---------------
  ["reproductor de música estilo iOS 26", "reproductor de música con material Liquid Glass"],
  ["the signature of iOS 26 tab bars", "the signature of a modern capsule tab bar"],
  ["'iOS 26 look'", "'material look'"],
  ["(WWDC25)", ""],
  ["WWDC25", ""],
  ["macOS Tahoe 26", ""],
  // --- generic fallbacks ---------------------------------------------------
  ["Apple's", ""],
  [/\bApple\b/g, ""],
  [/\s{2,}([,.])/g, "$1"],
  [/\s{2,}/g, " "],
  [/ +$/gm, ""],
];

const files = execSync(
  'git ls-files -z 2>/devnull || true',
  { encoding: "utf8" }
)
  .split("\0")
  .filter(Boolean);

let changed = 0;
for (const file of files) {
  if (!/\.(md|css|mjs|json|html|yml)$/.test(file)) continue;
  const before = readFileSync(file, "utf8");
  let after = before;
  for (const [from, to] of RULES) {
    after = typeof from === "string" ? after.split(from).join(to) : after.replace(from, to);
  }
  if (after !== before) {
    writeFileSync(file, after, "utf8");
    console.log(`rewrote ${file}`);
    changed++;
  }
}
console.log(`\n${changed} file(s) rewritten`);