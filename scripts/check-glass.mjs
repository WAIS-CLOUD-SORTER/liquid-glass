#!/usr/bin/env node
/**
 * check-glass.mjs — static checker for the Liquid Glass material rules.
 *
 * The rules in SKILL.md are only as good as the agent's ability to apply them
 * under pressure. This turns the ones that can be decided by reading source into
 * a command, so "did the fallbacks ship?" stops being a judgement call.
 * Zero dependencies, Node >= 18.
 *
 *   node scripts/check-glass.mjs path/to/file.css [more files...]
 *   node scripts/check-glass.mjs page.html --json
 *   node scripts/check-glass.mjs out.css --strict        # warnings fail too
 *   node scripts/check-glass.mjs --tokens               # token census
 *   node scripts/check-glass.mjs SKILL.md references/*.md   # vocabulary guard
 *
 * Options
 *   --base <path>   stylesheet whose tokens count as declared (default:
 *                   ../assets/liquid-glass.css next to this script).
 *                   Supplies *tokens only* — never features — so a file that
 *                   merely imports the base still gets told what it is missing.
 *   --json          machine-readable output, including rule rationale
 *   --strict        treat warnings as failures
 *   --tokens        print the custom properties declared by the base stylesheet
 *
 * Suppress one finding by putting this on the offending line (or the one below):
 *   transition: box-shadow 200ms ease;  /* check-glass: ignore one-shot state change *\/
 *
 * Exit codes: 0 clean, 1 findings, 2 bad invocation / unreadable input.
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve, extname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SUPPRESS = "check-glass: ignore";

/* ------------------------------------------------------------------ args -- */

function parseArgs(argv) {
  const files = [];
  const opts = { json: false, strict: false, tokens: false, base: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") opts.json = true;
    else if (a === "--strict") opts.strict = true;
    else if (a === "--tokens") opts.tokens = true;
    else if (a === "--base") {
      const next = argv[++i];
      if (next === undefined) fail("--base needs a path");
      opts.base = next;
    } else if (a === "--help" || a === "-h") {
      process.stdout.write(
        "check-glass.mjs — verify the Liquid Glass rules in a CSS/HTML/Markdown file\n\n" +
          "  node scripts/check-glass.mjs <file...> [--json] [--strict] [--base <css>] [--tokens]\n"
      );
      process.exit(0);
    } else if (a.startsWith("-")) fail(`unknown option: ${a}`);
    else files.push(a);
  }
  if (!opts.tokens && files.length === 0) fail("no input files (or use --tokens)");
  return { files, opts };
}

function fail(message) {
  process.stderr.write(`check-glass: ${message}\n`);
  process.exit(2);
}

/* ------------------------------------------------------------ text input -- */

/** File kind, so checks can opt out of inputs they cannot judge. */
function kindOf(file) {
  const ext = extname(file).toLowerCase();
  if (ext === ".html" || ext === ".htm") return "html";
  if (ext === ".md" || ext === ".markdown") return "md";
  return "css";
}

/**
 * Reduce a file to the CSS we can reason about, keeping a line offset so
 * findings point at real line numbers in the original file.
 */
function readCss(file) {
  const raw = readFileSync(file, "utf8");
  const kind = kindOf(file);

  if (kind === "html") {
    const out = [];
    const re = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
    let m;
    while ((m = re.exec(raw)) !== null) {
      const inner = m[1];
      out.push({ text: inner, line: lineOf(raw, m.index + m[0].indexOf(inner)) });
    }
    return out.length ? out : [{ text: "", line: 1 }];
  }

  if (kind === "md") {
    // Fenced code blocks only: prose mentions are documentation, but an example
    // inside a fence is exactly what gets copy-pasted into production.
    const out = [];
    const re = /```[^\n]*\n([\s\S]*?)```/g;
    let m;
    while ((m = re.exec(raw)) !== null) {
      out.push({ text: m[1], line: lineOf(raw, m.index) });
    }
    return out.length ? out : [{ text: "", line: 1 }];
  }

  return [{ text: raw, line: 1 }];
}

function lineOf(text, index) {
  let line = 1;
  const stop = Math.min(index, text.length);
  for (let i = 0; i < stop; i++) if (text.charCodeAt(i) === 10) line++;
  return line;
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Strip a flattened at-rule prefix so a selector reads cleanly. */
const clean = (s) => s.replace(/^@media[^{]*\{\s*/, "").replace(/\}\s*$/, "").trim();

/* ------------------------------------------------------------- extraction - */

const RE_PROP_DECL = /(^|[;{\s])(--[\w-]+)\s*:/g;
const RE_PROP_AT = /@property\s+(--[\w-]+)/g;
const RE_PROP_JS = /setProperty\(\s*["'`](--[\w-]+)/g;
const RE_VAR = /var\(\s*(--[\w-]+)\s*(,)?/g;
const RE_PROP_VALUE = /(^|[;{\s])(--[\w-]+)\s*:\s*([^;}]+)/g;

/** Custom properties this text *declares*: assignment, @property, or JS write. */
function declaredProps(text) {
  const set = new Set();
  for (const re of [RE_PROP_DECL, RE_PROP_AT, RE_PROP_JS]) {
    re.lastIndex = 0;
    let m;
    // The three patterns capture differently; the property name is always last.
    while ((m = re.exec(text)) !== null) set.add(m.at(-1));
  }
  return set;
}

/** Custom properties this text *reads* via var(), and whether a fallback exists. */
function usedProps(text) {
  const map = new Map();
  RE_VAR.lastIndex = 0;
  let m;
  while ((m = RE_VAR.exec(text)) !== null) {
    map.set(m[1], map.get(m[1]) || Boolean(m[2]));
  }
  return map;
}

/** token -> normalised first declaration value, used for drift detection. */
function propValues(text) {
  const map = new Map();
  RE_PROP_VALUE.lastIndex = 0;
  let m;
  while ((m = RE_PROP_VALUE.exec(text)) !== null) {
    const value = m[3].replace(/\s+/g, " ").trim().toLowerCase();
    if (value && !map.has(m[2])) map.set(m[2], value);
  }
  return map;
}

/**
 * Split CSS into rule chunks. Comments are blanked rather than removed so every
 * offset — and therefore every reported line number — stays accurate. Nested
 * at-rules flatten, so a media block's inner rules report a selector prefixed
 * with the at-keyword; `clean` strips that back off.
 */
function ruleBlocks(text) {
  const blocks = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    blocks.push({
      selector: blank(m[1]).replace(/\s+/g, " ").trim(),
      body: blank(m[2]),
      offset: m.index,
    });
  }
  return blocks;
}

/** Replace comment bodies with spaces, preserving length and line structure. */
function blank(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, " "));
}

/**
 * Split a selector list on top-level commas only — commas inside :is()/:where()
 * are part of one selector, not a boundary between two.
 */
function splitSelectorList(selector) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < selector.length; i++) {
    const ch = selector[i];
    if (ch === "(" || ch === "[") depth++;
    else if (ch === ")" || ch === "]") depth--;
    else if (ch === "," && depth === 0) {
      parts.push(selector.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(selector.slice(start));
  return parts.map((p) => p.trim()).filter(Boolean);
}

/* ----------------------------------------------------------------- checks - */

/** Selectors that suggest "a person reads this", not "a person taps this". */
const READ_SELECTOR =
  /(^|[\s,>+~(])(p|h[1-6]|li|td|th|article|main|section|\.card|\.metric|\.stat|\.cell|\.row|\.copy|\.body|\.content|\.text|\.list|\.table|\.chart|\.tile|\.item|\.entry|\.paragraph)([\s,>+~:#.\[-]|$)/;

/**
 * A token value worth hunting for as a literal: self-contained enough that
 * writing it out by hand is clearly a mistake. A bare `255 255 255` is not —
 * that is a legitimate argument to rgb() — so it is excluded.
 */
const WORTH_MATCHING = /^(#|rgba?\(|hsla?\(|oklch\(|oklab\(|lab\(|lch\(|color\()/;

const CHECKS = [
  {
    id: "dangling-var",
    level: "error",
    title: "var() reads a custom property nothing declares",
    why: "An undefined custom property makes the whole declaration invalid at computed-value time, so the property silently falls back to its initial value: a border-radius collapses to 0, a colour flips to the wrong side. var(--x, fallback) is fine, because the fallback carries the value.",
    run(ctx) {
      for (const [name, hasFallback] of ctx.used) {
        if (hasFallback || ctx.declared.has(name) || ctx.baseDeclared.has(name)) continue;
        const idx = ctx.text.indexOf(`var(${name}`);
        ctx.report(`var(${name}) is never declared`, { index: idx === -1 ? null : idx });
      }
    },
  },
  {
    id: "hardcoded-token",
    level: "warn",
    title: "A token's literal value is written out instead of referenced",
    why: "This is how a stylesheet and its documentation drift apart: the literal is correct today and silently wrong the first time someone retunes the token.",
    run(ctx) {
      // ctx.values is token -> value, so each entry is [token, value].
      const literals = [...ctx.values].filter(([, v]) => WORTH_MATCHING.test(v));
      if (literals.length === 0) return;
      for (const block of ctx.blocks) {
        // Strip declarations first: `--x: <value>` is the definition site, not a hit.
        const body = block.body.replace(/(^|[;{\s])(--[\w-]+)\s*:[^;]*/g, "$1");
        for (const [token, value] of literals) {
          const idx = body.indexOf(value);
          if (idx === -1) continue;
          ctx.report(`literal \`${value}\` duplicates ${token} — use var(${token})`, {
            selector: block.selector,
            index: block.offset + block.selector.length + 1 + idx,
          });
        }
      }
    },
  },
  {
    id: "animated-filter",
    level: "error",
    title: "A transition animates a filter or a blur",
    why: "Animating backdrop-filter or filter re-rasterises the backdrop every frame and drops frames on scroll. Animate transform and opacity, and let the material arrive by scaling and fading.",
    run(ctx) {
      const expensive = ["backdrop-filter", "-webkit-backdrop-filter", "blur(", "filter:"];
      const re = /(transition|transition-property)\s*:\s*([^;}]+)/g;
      let m;
      while ((m = re.exec(ctx.text)) !== null) {
        const value = m[2].toLowerCase();
        const hit = expensive.find((h) => value.includes(h));
        if (hit) ctx.report(`transition animates \`${hit}\``, { index: m.index });
      }
      const kf = /@keyframes\s+([\w-]+)\s*\{/g;
      while ((m = kf.exec(ctx.text)) !== null) {
        const end = ctx.text.indexOf("\n}", m.index);
        const body = ctx.text.slice(m.index, end === -1 ? ctx.text.length : end).toLowerCase();
        const hit = expensive.find((h) => body.includes(h));
        if (hit) ctx.report(`@keyframes ${m[1]} animates \`${hit}\``, { index: m.index });
      }
    },
  },
  {
    id: "animated-shadow",
    level: "warn",
    title: "A transition animates box-shadow",
    why: "Usually a mistake, occasionally legitimate: a one-shot state cross-fade on a surface that is not otherwise animating is fine, anything per-frame is not. Suppress with a reason if this one is deliberate.",
    run(ctx) {
      const re = /transition(?:-property)?\s*:[^;}]*box-shadow[^;}]*/g;
      let m;
      while ((m = re.exec(ctx.text)) !== null) {
        ctx.report("transition animates `box-shadow`", { index: m.index });
      }
    },
  },
  {
    id: "nested-glass",
    level: "warn",
    title: "Glass nested inside glass",
    why: "An inner glass surface samples the outer one's already-filtered output, so it costs twice and looks milky. Keep one glass layer and give the inner element a flat highlight or a near-opaque lens instead.",
    run(ctx) {
      // A selector is "glass inside glass" when its own subject is a glass
      // surface *and* that same subject appears again behind a combinator.
      // `.glass .glass` qualifies; `.glass :where(h1, p)` does not, because the
      // descendant there is text, not another surface. Each part of a selector
      // list is judged on its own.
      const isGlassyBase = (s) => /(\.glass[\w-]*|backdrop-blur)/.test(s);
      for (const block of ctx.blocks) {
        for (const selector of splitSelectorList(clean(block.selector))) {
          const cut = selector.search(/[\s>+~]/);
          if (cut === -1) continue;
          // Strip pseudo-classes and attribute selectors to get the surface itself.
          const base = selector
            .slice(0, cut)
            .replace(/:[a-z-]+(\([^)]*\))?/gi, "")
            .replace(/\[[^\]]*\]/g, "")
            .trim();
          if (!base || !isGlassyBase(base)) continue;
          const rest = selector.slice(cut);
          if (!new RegExp(`(?:^|[\\s>+~])${escapeRe(base)}(?![\\w-])`).test(rest)) continue;
          ctx.report(`\`${selector}\` puts glass inside \`${base}\``, {
            selector: block.selector,
            index: block.offset,
          });
        }
      }
    },
  },
  {
    id: "reading-surface",
    level: "warn",
    title: "A surface that holds text sits below 0.85 fill",
    why: "Fill is body opacity. Below 0.85 the reader is decoding text through a blur plus a moving backdrop. This is the most common way a Liquid Glass build becomes unreadable, and the failure this skill exists to prevent.",
    run(ctx) {
      for (const block of ctx.blocks) {
        if (!READ_SELECTOR.test(block.selector)) continue;
        const re = /--glass-fill\s*:\s*([\d.]+)/g;
        let m;
        while ((m = re.exec(block.body)) !== null) {
          const v = Number(m[1]);
          if (v >= 0.3 && v < 0.85) {
            ctx.report(
              `\`${clean(block.selector)}\` sets --glass-fill: ${m[1]} on a reading surface (need >= 0.85)`,
              { selector: block.selector, index: block.offset + block.selector.length + 1 + m.index }
            );
          }
        }
      }
    },
  },
  {
    id: "missing-a11y-fallback",
    level: "warn",
    appliesTo: ["css", "html"],
    title: "A required accessibility or compatibility fallback is absent",
    why: "These blocks are the difference between glass that adapts and glass that excludes people. Cheap to ship, impossible to retrofit without touching every surface. An @import-ed stylesheet counts as providing them — --base supplies tokens only, never features.",
    run(ctx) {
      for (const [feature, label] of [
        ["prefers-reduced-transparency", "reduced transparency"],
        ["prefers-reduced-motion", "reduced motion"],
        ["prefers-contrast", "increased contrast"],
        ["forced-colors", "Windows High Contrast"],
      ]) {
        if (!ctx.features.includes(feature)) {
          ctx.report(`no \`${feature}\` block — no ${label} path`);
        }
      }
      const hasFallback =
        /@supports\s+not\s*\([^)]*backdrop-filter/.test(ctx.features) ||
        ctx.features.includes(".glass--solid");
      if (!hasFallback) {
        ctx.report(
          "no `@supports not (backdrop-filter…)` block and no `.glass--solid` — engines without backdrop-filter render translucent-on-nothing"
        );
      }
    },
  },
  {
    id: "missing-color-scheme",
    level: "warn",
    appliesTo: ["css", "html"],
    title: "Tokens are used but `color-scheme` is never set",
    why: "Without it the scrollbar, form controls and canvas stay light under a dark theme, and prefers-color-scheme has nothing to hook into.",
    run(ctx) {
      if (ctx.declared.size === 0 && ctx.used.size === 0) return;
      if (!/color-scheme\s*:/.test(ctx.features)) {
        ctx.report("declares custom properties but never sets `color-scheme`");
      }
    },
  },
];

const levelOf = (rule) => CHECKS.find((c) => c.id === rule)?.level ?? "warn";

/**
 * Text of the stylesheets this file pulls in with `@import` / `<link>`, resolved
 * relative to the file. Used only to decide whether a *feature* (an
 * accessibility block, `color-scheme`) is inherited rather than written here —
 * importing a stylesheet that provides them is a legitimate architecture, and
 * nagging about it would just teach people to ignore the output.
 */
function importedText(file, depth = 0) {
  if (depth > 4) return "";
  const raw = readFileSync(file, "utf8");
  const dir = dirname(resolve(file));
  const refs = [];
  for (const re of [
    /@import\s+(?:url\()?["']([^"')]+)["']/g,
    /<link\b[^>]*\brel=["']stylesheet["'][^>]*\bhref=["']([^"']+)["']/gi,
  ]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(raw)) !== null) refs.push(m[1]);
  }
  let out = "";
  for (const ref of refs) {
    if (/^(https?:)?\/\//.test(ref)) continue; // remote: cannot read it
    const target = resolve(dir, ref.split("?")[0]);
    if (!existsSync(target) || !/\.(css|scss|sass|less)$/i.test(target)) continue;
    try {
      out += "\n" + readFileSync(target, "utf8") + importedText(target, depth + 1);
    } catch {
      // unreadable import: say nothing rather than guess
    }
  }
  return out;
}

/* ------------------------------------------------------------------- main - */

function analyse(file, baseText, raw) {
  const kind = kindOf(file);
  const chunks = readCss(file);

  // Concatenate the chunks once, remembering where each starts, so an offset
  // found by a check can be turned into a line number in the *original* file —
  // which matters for HTML with several <style> blocks and Markdown with many
  // fenced examples.
  let cursor = 0;
  const pieces = chunks.map((c) => {
    const start = cursor;
    cursor += c.text.length + 1; // +1 for the newline join() adds
    return { text: c.text, fileLine: c.line, start };
  });
  const text = pieces.map((p) => p.text).join("\n");
  const inherited = importedText(file);

  const toFileLine = (index) => {
    for (let i = pieces.length - 1; i >= 0; i--) {
      if (index >= pieces[i].start) {
        return lineOf(pieces[i].text, index - pieces[i].start) + pieces[i].fileLine - 1;
      }
    }
    return 1;
  };

  const rawLines = raw.split(/\r?\n/);

  const ctx = {
    file,
    kind,
    text,
    blocks: ruleBlocks(text),
    declared: declaredProps(text),
    used: usedProps(text),
    values: propValues(text),
    baseDeclared: declaredProps(baseText),
    /** Text of @import-ed stylesheets — counts for feature presence only. */
    features: text + "\n" + inherited,
    findings: [],
    /** Set by the runner, so a check never has to name its own rule twice. */
    currentRule: null,
    report(message, { selector = null, index = null } = {}) {
      const rule = ctx.currentRule;
      ctx.findings.push({
        rule,
        level: levelOf(rule),
        message,
        selector,
        line: index === null ? null : toFileLine(index),
      });
    },
  };

  for (const check of CHECKS) {
    if (check.appliesTo && !check.appliesTo.includes(kind)) continue;
    ctx.currentRule = check.id;
    check.run(ctx);
  }

  // Honour per-line suppressions. The comment may sit on the offending line,
  // on the line above it (when the property is on the next line), or just below.
  ctx.findings = ctx.findings.filter((f) => {
    if (f.line === null) return true;
    const at = f.line - 1; // rawLines is 0-indexed
    return ![at - 1, at, at + 1].some((i) => (rawLines[i] ?? "").includes(SUPPRESS));
  });

  return ctx;
}

function tokenCensus(baseText) {
  const values = propValues(baseText);
  return [...declaredProps(baseText)]
    .sort()
    .map((name) => ({ name, value: values.get(name) ?? null }));
}

function main() {
  const { files, opts } = parseArgs(process.argv.slice(2));
  const basePath = resolve(opts.base ?? resolve(HERE, "..", "assets", "liquid-glass.css"));

  if (opts.tokens) {
    if (!existsSync(basePath)) fail(`base stylesheet not found: ${basePath}`);
    const tokens = tokenCensus(readFileSync(basePath, "utf8"));
    if (opts.json) {
      process.stdout.write(JSON.stringify({ base: basePath, tokens }, null, 2) + "\n");
    } else {
      process.stdout.write(
        `${tokens.length} custom properties declared in ${relative(process.cwd(), basePath)}\n`
      );
      for (const t of tokens) {
        process.stdout.write(`  ${t.name.padEnd(20)} ${t.value ?? "(registered only)"}\n`);
      }
    }
    return;
  }

  let baseText = "";
  if (existsSync(basePath)) baseText = readFileSync(basePath, "utf8");

  const results = [];
  for (const file of files) {
    if (!existsSync(file)) fail(`no such file: ${file}`);
    let raw;
    try {
      raw = readFileSync(file, "utf8");
    } catch (err) {
      fail(`could not read ${file}: ${err.message}`);
    }
    results.push(analyse(file, baseText, raw));
  }

  const findings = results.flatMap((r) => r.findings);
  const errors = findings.filter((f) => f.level === "error").length;
  const warnings = findings.length - errors;
  const failed = errors > 0 || (opts.strict && warnings > 0);

  if (opts.json) {
    process.stdout.write(
      JSON.stringify(
        {
          ok: !failed,
          files: results.map((r) => ({
            file: r.file,
            customPropertiesDeclared: r.declared.size,
            customPropertiesUsed: r.used.size,
            findings: r.findings,
          })),
          summary: { errors, warnings },
          rules: CHECKS.map(({ id, level, title, why, appliesTo }) => ({
            id,
            level,
            title,
            why,
            appliesTo: appliesTo ?? ["css", "html", "md"],
          })),
        },
        null,
        2
      ) + "\n"
    );
  } else {
    for (const result of results) {
      process.stdout.write(`\n${result.file}\n`);
      if (result.findings.length === 0) {
        process.stdout.write(`  ok — ${result.used.size} custom properties read, all resolve\n`);
        continue;
      }
      for (const f of result.findings) {
        const at = f.line ? `:${f.line}` : "";
        const sel = f.selector ? `  <- ${clean(f.selector).slice(0, 64)}` : "";
        process.stdout.write(
          `  ${f.level.toUpperCase().padEnd(5)} ${f.rule}${at}  ${f.message}${sel}\n`
        );
      }
    }
    process.stdout.write(
      `\n${errors} error(s), ${warnings} warning(s) across ${results.length} file(s)\n` +
        (findings.length ? "Run with --json for the rationale behind each rule.\n" : "")
    );
  }

  process.exit(failed ? 1 : 0);
}

main();