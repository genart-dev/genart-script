/**
 * Source-level preprocessor — runs before tokenization.
 *
 * ## paramset — parameter templates
 *
 * Syntax:
 *   paramset bristle(dabWidth, bristles, alphaMin, alphaMax, dabs):
 *     param {prefix}DabWidth {dabWidth} range:4..40 step:1
 *
 *   bristle sky(19, 6, 0.4, 0.8, 1800)
 *
 * ## bristlePass — declarative bristle-stroke pass (mask-based)
 *
 * Syntax:
 *   bristlePass sky seed:100 mask:skyMask texture:smooth:
 *     count: skyDabs
 *     width: skyDabWidth
 *     bristles: skyBristles
 *     alpha: [skyAlphaMin, skyAlphaMax]
 *     angle: flowAngle * flowInfluence * 0.3
 *     exclude: bolt.excludes(pos.x, pos.y, 30)
 *     scatter: 0.15 + (maskAlpha / 255) * 0.6
 *     color: [floor(lerp(190, 220, rng())), ...]
 *     jitter: colorJitter + 4
 *     blend: screen
 *
 * ## forcePass — declarative bristle-stroke pass (force-path-based)
 *
 * Syntax:
 *   forcePass boltCore seed:777 path:bolt radius:35 texture:impasto:
 *     count: boltCoreDabs
 *     sparse: 0.35
 *     width: lerp(boltDabWidth * 1.2, boltDabWidth * 0.6, proximity)
 *     bristles: floor(lerp(boltBristles, 4, proximity))
 *     alpha: lerp(0.4, 0.9, proximity)
 *     angle: path.angleAt(pos.x, pos.y, flowAngle) + (rng() - 0.5) * 0.6
 *     color: [floor(lerp(baseColor[0], 250, proximity)), ...]
 *     blend: screen
 *
 * Assumes in scope: positions, base, ctx, dabDensity, scene
 */

interface ParamSetDef {
  name: string;
  templateParams: string[];
  bodyLines: string[];
}

interface PassConfig {
  name: string;
  seed: string;
  texture: string;
  count: string;
  width: string;
  bristles: string;
  alphaMin: string;
  alphaMax: string;
  angle: string;
  exclude?: string;
  jitter?: string;
  steps?: string;
  stepSize?: string;
  countMul?: string;
  color?: string;
  scatter?: string;
  blend?: string;
  // bristlePass-specific — either mask or layer (layer auto-generates mask)
  mask?: string;
  layer?: string;
  // forcePass-specific
  path?: string;
  radius?: string;
  sparse?: string;
}

/**
 * Run all preprocessing passes: paramset expansion, then pass directive expansion.
 */
export function preprocess(source: string): string {
  let result = joinMultiLineStrings(source);
  result = joinMetadataContinuations(result);
  result = expandParamSets(result);
  result = expandFlowDirective(result);
  result = expandUnderpaintingDirective(result);
  result = expandPassDirectives(result);
  return result;
}

// Keep the old name as an alias for backward compat
export { preprocess as expandParamSets };

/**
 * Join multi-line strings: if a line has an unclosed `"`, join subsequent lines
 * until the closing `"` is found. Joined with a single space.
 */
function joinMultiLineStrings(source: string): string {
  const lines = source.split("\n");
  const output: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;
    // Count unescaped quotes — if odd, string spans to next line
    let quoteCount = 0;
    for (let j = 0; j < line.length; j++) {
      if (line[j] === '"' && (j === 0 || line[j - 1] !== "\\")) quoteCount++;
    }

    if (quoteCount % 2 === 0) {
      output.push(line);
      i++;
    } else {
      // Unclosed string — join lines until we find the closing quote
      let joined = line;
      i++;
      while (i < lines.length) {
        const next = lines[i]!.trimStart();
        joined += " " + next;
        i++;
        let nextQuotes = 0;
        for (let j = 0; j < next.length; j++) {
          if (next[j] === '"' && (j === 0 || next[j - 1] !== "\\")) nextQuotes++;
        }
        if (nextQuotes % 2 === 1) break; // Found the closing quote
      }
      output.push(joined);
    }
  }

  return output.join("\n");
}

/**
 * Join metadata continuation lines: if a metadata directive (title, subtitle,
 * philosophy, compositionLevel) is followed by indented lines, join them as
 * a single value.
 */
function joinMetadataContinuations(source: string): string {
  const META_RE = /^(title|subtitle|philosophy|compositionLevel)\s/;
  const lines = source.split("\n");
  const output: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;
    if (META_RE.test(line.trim())) {
      let joined = line;
      i++;
      // Consume indented continuation lines
      while (i < lines.length) {
        const next = lines[i]!;
        // Continuation: starts with whitespace and isn't a blank line or new directive
        if (next.length > 0 && /^\s+/.test(next) && !META_RE.test(next.trim())) {
          joined += " " + next.trim();
          i++;
        } else {
          break;
        }
      }
      output.push(joined);
    } else {
      output.push(line);
      i++;
    }
  }

  return output.join("\n");
}

function expandParamSets(source: string): string {
  const lines = source.split("\n");
  const defs = new Map<string, ParamSetDef>();
  const output: string[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    const defMatch = line.match(/^paramset\s+(\w+)\s*\(([^)]*)\)\s*:\s*$/);

    if (defMatch) {
      const name = defMatch[1]!;
      const templateParams = defMatch[2]!.split(",").map(s => s.trim()).filter(Boolean);
      const bodyLines: string[] = [];
      i++;

      while (i < lines.length) {
        const bodyLine = lines[i]!;
        if (bodyLine.trim() === "") { i++; continue; }
        if (/^\s+/.test(bodyLine)) {
          bodyLines.push(bodyLine.replace(/^\s{2}/, ""));
          i++;
        } else {
          break;
        }
      }

      defs.set(name, { name, templateParams, bodyLines });
      continue;
    }

    // Check for paramset instantiation: `name prefix(val1, val2, ...)`
    const instMatch = line.match(/^(\w+)\s+(\w+)\s*\(([^)]*)\)\s*$/);
    if (instMatch && defs.has(instMatch[1]!)) {
      const def = defs.get(instMatch[1]!)!;
      const prefix = instMatch[2]!;
      const values = instMatch[3]!.split(",").map(s => s.trim());

      const subs: Record<string, string> = { prefix };
      for (let j = 0; j < def.templateParams.length; j++) {
        subs[def.templateParams[j]!] = values[j] ?? "0";
      }

      for (const bodyLine of def.bodyLines) {
        let expanded = bodyLine;
        expanded = expanded.replace(/\{(\w+)\}/g, (_, key) => subs[key] ?? `{${key}}`);
        output.push(expanded);
      }

      i++;
      continue;
    }

    output.push(line);
    i++;
  }

  return output.join("\n");
}

/** Count net bracket depth change in a string. */
function bracketBalance(s: string): number {
  let depth = 0;
  for (const ch of s) {
    if (ch === "(" || ch === "[" || ch === "{") depth++;
    else if (ch === ")" || ch === "]" || ch === "}") depth--;
  }
  return depth;
}

function parsePassBody(lines: string[], startIdx: number, headerIndent: string): { config: Record<string, string>; nextIdx: number } {
  const config: Record<string, string> = {};
  let i = startIdx;
  // Body lines must be indented MORE than the header
  const minIndent = headerIndent.length + 2;
  let lastKey: string | undefined;

  while (i < lines.length) {
    const bodyLine = lines[i]!;
    if (bodyLine.trim() === "") { i++; continue; }
    // Check that line is indented deeper than the header
    const lineIndent = bodyLine.match(/^(\s*)/)?.[1]?.length ?? 0;
    if (lineIndent >= minIndent) {
      const kvMatch = bodyLine.trim().match(/^(\w+)\s*:\s*(.+)$/);
      if (kvMatch) {
        lastKey = kvMatch[1]!;
        let value = kvMatch[2]!.trim();
        i++;
        // If value has unclosed brackets, consume continuation lines
        let depth = bracketBalance(value);
        while (depth > 0 && i < lines.length) {
          const contLine = lines[i]!;
          if (contLine.trim() === "") { i++; continue; }
          const contIndent = contLine.match(/^(\s*)/)?.[1]?.length ?? 0;
          if (contIndent >= minIndent) {
            value += " " + contLine.trim();
            depth += bracketBalance(contLine);
            i++;
          } else {
            break;
          }
        }
        config[lastKey] = value;
      } else if (lastKey) {
        // Continuation line (no key:) — append to previous value
        config[lastKey] += " " + bodyLine.trim();
        i++;
      } else {
        i++;
      }
    } else {
      break;
    }
  }

  return { config, nextIdx: i };
}

function parseAlpha(value: string): { min: string; max: string } | null {
  const arrMatch = value.match(/^\[([^,]+),\s*([^\]]+)\]$/);
  if (arrMatch) {
    return { min: arrMatch[1]!.trim(), max: arrMatch[2]!.trim() };
  }
  return null;
}

function buildPassConfig(base: Partial<PassConfig>, kv: Record<string, string>, declaredParams?: Set<string>): PassConfig {
  const config: PassConfig = {
    name: base.name ?? "pass",
    seed: base.seed ?? "0",
    texture: base.texture ?? "smooth",
    count: "1000",
    width: "10",
    bristles: "6",
    alphaMin: "0.3",
    alphaMax: "0.8",
    angle: "flowAngle",
    ...base,
  };

  // Auto-bind from paramset naming convention: {name}Dabs, {name}DabWidth, etc.
  if (declaredParams && config.name) {
    const n = config.name;
    if (!kv.count && declaredParams.has(`${n}Dabs`)) kv.count = `${n}Dabs`;
    if (!kv.width && declaredParams.has(`${n}DabWidth`)) kv.width = `${n}DabWidth`;
    if (!kv.bristles && declaredParams.has(`${n}Bristles`)) kv.bristles = `${n}Bristles`;
    if (!kv.alpha && declaredParams.has(`${n}AlphaMin`) && declaredParams.has(`${n}AlphaMax`)) {
      kv.alpha = `[${n}AlphaMin, ${n}AlphaMax]`;
    }
  }

  for (const [key, value] of Object.entries(kv)) {
    switch (key) {
      case "count": config.count = value; break;
      case "width": config.width = value; break;
      case "bristles": config.bristles = value; break;
      case "alpha": {
        const parsed = parseAlpha(value);
        if (parsed) {
          config.alphaMin = parsed.min;
          config.alphaMax = parsed.max;
        } else {
          // Single expression — use directly as alpha (no lerp)
          config.alphaMin = value;
          config.alphaMax = value;
        }
        break;
      }
      case "angle": config.angle = value; break;
      case "exclude": config.exclude = value; break;
      case "jitter": config.jitter = value; break;
      case "steps": config.steps = value; break;
      case "stepSize": config.stepSize = value; break;
      case "countMul": config.countMul = value; break;
      case "color": config.color = value; break;
      case "scatter": config.scatter = value; break;
      case "blend": config.blend = value; break;
      case "sparse": config.sparse = value; break;
    }
  }

  return config;
}

/**
 * Expand exclude shorthand: `varName(radius)` → `varName.excludes(pos.x, pos.y, radius)`
 * Only matches a bare `ident(args)` pattern — skips if the expression already contains dots
 * (e.g., `bolt.excludes(...)` passes through unchanged).
 */
function expandExcludeShorthand(expr: string): string {
  // Only expand simple `name(args)` — no dots anywhere in the expression
  if (expr.includes(".")) return expr;
  return expr.replace(/^(\w+)\(([^)]+)\)$/, (_, name, args) => {
    return `${name}.excludes(pos.x, pos.y, ${args})`;
  });
}

/**
 * Expand `flow gridSize:N turbulence:expr [seed:N]` into the standard painting infrastructure:
 *   use curl-flow-field
 *   use grid-placement
 *   base = renderLayers()
 *   __flow_rand = mulberry32(seed)
 *   scene = createCurlFlowField(...)
 *   positions = makeGrid(...)
 *
 * Also emits minWidth computation by scanning all *DabWidth params.
 */
function expandFlowDirective(source: string): string {
  const lines = source.split("\n");
  const output: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    // Match `flow` only when followed by named args (key:val) or alone on a line
    // Must not match `flowAngle = ...` or similar assignments
    const trimmed = line.trim();
    const m = trimmed === "flow" || /^flow\s+\w+:/.test(trimmed)
      ? line.match(/^(\s*)flow(?:\s+(.+))?\s*$/)
      : null;

    if (!m || trimmed.startsWith("//")) {
      output.push(line);
      continue;
    }

    const indent = m[1] ?? "";
    const argsStr = m[2] ?? "";

    // Parse named args: gridSize:300 turbulence:turbulence seed:42
    const args: Record<string, string> = {};
    for (const part of argsStr.match(/(\w+):(\S+)/g) ?? []) {
      const [key, val] = part.split(":");
      if (key && val) args[key] = val;
    }

    const gridSize = args.gridSize ?? "300";
    const turbulence = args.turbulence ?? "0.3";
    const seed = args.seed ?? "42";

    // Collect all *DabWidth params for minWidth computation
    const dabWidthParams: string[] = [];
    for (const srcLine of lines) {
      const pm = srcLine.match(/^\s*param\s+(\w*DabWidth)\b/);
      if (pm) dabWidthParams.push(pm[1]!);
    }

    // Emit implicit component dependencies
    output.push(`${indent}use curl-flow-field`);
    output.push(`${indent}use grid-placement`);
    output.push(``);

    // Emit infrastructure
    output.push(`${indent}base = renderLayers()`);
    output.push(`${indent}__flow_rand = mulberry32(${seed})`);
    output.push(`${indent}scene = createCurlFlowField({gridSize: ${gridSize}, waveScale: 2, turbulence: ${turbulence}, layers: [{scale: 1.0, weight: 0.5}]}, {seed: ${seed}, rand: __flow_rand, width: w, height: h})`);

    // minWidth from all DabWidth params
    if (dabWidthParams.length > 0) {
      let minExpr = dabWidthParams[0]!;
      for (let j = 1; j < dabWidthParams.length; j++) {
        minExpr = `min(${minExpr}, ${dabWidthParams[j]})`;
      }
      output.push(`${indent}__flow_minWidth = ${minExpr}`);
      output.push(`${indent}positions = makeGrid({left: 0, right: w, top: 0, bottom: h}, __flow_minWidth / 1.2, 0.4, __flow_rand)`);
    } else {
      // Fallback: use gridSize-based spacing
      output.push(`${indent}positions = makeGrid({left: 0, right: w, top: 0, bottom: h}, 10, 0.4, __flow_rand)`);
    }
  }

  return output.join("\n");
}

/**
 * Expand `underpainting seed:N [width:N] [bristles:N] [alpha:N] [jitter:expr] [exclude:expr]:` into
 * a full underpainting loop.
 */
function expandUnderpaintingDirective(source: string): string {
  const lines = source.split("\n");
  const output: string[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    const m = line.match(
      /^(\s*)underpainting\s+seed:(\S+)(.*?)\s*:\s*$/
    );

    if (!m) {
      output.push(line);
      i++;
      continue;
    }

    const indent = m[1] ?? "";
    const seed = m[2]!;
    const rest = m[3] ?? "";

    // Parse body (optional keys like exclude:, count:)
    i++;
    const { config: kv, nextIdx } = parsePassBody(lines, i, indent);
    i = nextIdx;

    // Parse inline header args
    const headerArgs: Record<string, string> = {};
    for (const part of rest.match(/(\w+):(\S+)/g) ?? []) {
      const [key, val] = part.split(":");
      if (key && val) headerArgs[key] = val;
    }

    const width = headerArgs.width ?? "22";
    const bristles = headerArgs.bristles ?? "4";
    const alpha = headerArgs.alpha ?? "0.85";
    const jitterExpr = headerArgs.jitter ?? kv.jitter ?? "colorJitter + 5";
    const count = kv.count ?? "3000";
    const exclude = kv.exclude;

    const rng = `__up_rng`;

    output.push(`${indent}${rng} = mulberry32(${seed})`);
    output.push(`${indent}__up_count = floor((${count}) * dabDensity)`);
    output.push(`${indent}loop __up_count:`);
    output.push(`${indent}  pos = positions[i % positions.length]`);
    output.push(`${indent}  px = clamp(floor(pos.x), 0, w - 1)`);
    output.push(`${indent}  py = clamp(floor(pos.y), 0, h - 1)`);

    if (exclude) {
      output.push(`${indent}  if ${expandExcludeShorthand(exclude)}:`);
      output.push(`${indent}    continue`);
    }

    output.push(`${indent}  __up_color = colorAt(base, px, py)`);
    output.push(`${indent}  __up_angle = scene.flowAngleAt(pos.x, pos.y) * flowInfluence * 0.5`);
    output.push(`${indent}  renderBristleStroke(ctx, {x: pos.x, y: pos.y, angle: __up_angle, width: ${width}, bristleCount: ${bristles}, alpha: ${alpha}, rng: ${rng}, texture: "smooth", color: {mode: "single", palette: [__up_color], jitter: ${jitterExpr}}})`);
  }

  return output.join("\n");
}

function emitStrokeOpts(config: PassConfig): string {
  const extraOpts: string[] = [];
  if (config.steps) extraOpts.push(`steps: ${config.steps}`);
  if (config.stepSize) extraOpts.push(`stepSize: ${config.stepSize}`);
  return extraOpts.length ? ", " + extraOpts.join(", ") : "";
}

function collectDeclaredParams(source: string): Set<string> {
  const params = new Set<string>();
  for (const line of source.split("\n")) {
    const m = line.match(/^\s*param\s+(\w+)\b/);
    if (m) params.add(m[1]!);
  }
  return params;
}

function expandPassDirectives(source: string): string {
  const lines = source.split("\n");
  const output: string[] = [];
  /** Cache for auto-generated layer masks — avoids duplicate renderLayer() calls */
  const layerMaskCache = new Map<string, string>();
  /** All declared param names (for auto-bind) */
  const declaredParams = collectDeclaredParams(source);

  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;

    // Match: bristlePass|pass <name> seed:<N> (mask:<expr>|layer:<layerType>) texture:<str> [blend:<mode>]:
    const bristleMatch = line.match(
      /^(\s*)(?:bristlePass|pass)\s+(\w+)\s+seed:(\S+)\s+(?:mask:(\S+)|layer:(\S+))\s+texture:(\S+)(?:\s+blend:(\S+))?\s*:\s*$/
    );

    if (bristleMatch) {
      const indent = bristleMatch[1] ?? "";
      i++;
      const { config: kv, nextIdx } = parsePassBody(lines, i, indent);
      i = nextIdx;

      const maskOrLayer: Partial<PassConfig> = bristleMatch[4]
        ? { mask: bristleMatch[4] }
        : { layer: bristleMatch[5] };

      const config = buildPassConfig({
        name: bristleMatch[2]!,
        seed: bristleMatch[3]!,
        ...maskOrLayer,
        texture: bristleMatch[6]!,
        blend: bristleMatch[7],
      }, kv, declaredParams);

      emitBristlePass(output, indent, config, layerMaskCache);
      continue;
    }

    // Match: forcePass <name> seed:<N> path:<var> radius:<R> texture:<str> [blend:<mode>]:
    const forceMatch = line.match(
      /^(\s*)forcePass\s+(\w+)\s+seed:(\S+)\s+path:(\S+)\s+radius:(\S+)\s+texture:(\S+)(?:\s+blend:(\S+))?\s*:\s*$/
    );

    if (forceMatch) {
      const indent = forceMatch[1] ?? "";
      i++;
      const { config: kv, nextIdx } = parsePassBody(lines, i, indent);
      i = nextIdx;

      const config = buildPassConfig({
        name: forceMatch[2]!,
        seed: forceMatch[3]!,
        path: forceMatch[4]!,
        radius: forceMatch[5]!,
        texture: forceMatch[6]!,
        blend: forceMatch[7],
      }, kv, declaredParams);

      emitForcePass(output, indent, config);
      continue;
    }

    output.push(line);
    i++;
  }

  return output.join("\n");
}

function emitBristlePass(output: string[], indent: string, config: PassConfig, layerMaskCache?: Map<string, string>): void {
  const I = indent;
  const rng = `__bp_${config.name}_rng`;
  const countVar = `__bp_${config.name}_n`;
  const countExpr = config.countMul
    ? `floor((${config.count}) * dabDensity * (${config.countMul}))`
    : `floor((${config.count}) * dabDensity)`;
  const jitterExpr = config.jitter ?? "colorJitter";
  const extraStr = emitStrokeOpts(config);

  // Auto-generate mask from layer: declaration
  if (config.layer && !config.mask) {
    const cache = layerMaskCache ?? new Map<string, string>();
    let maskVar = cache.get(config.layer);
    if (!maskVar) {
      maskVar = `__mask_${config.layer.replace(/[^a-zA-Z0-9]/g, "_")}`;
      cache.set(config.layer, maskVar);
      output.push(`${I}${maskVar} = renderLayer("${config.layer}")`);
    }
    config.mask = maskVar;
  }

  // Determine render target (ctx or offscreen buffer)
  const useBlend = !!config.blend;
  const targetCtx = useBlend ? `__bp_${config.name}_ctx` : "ctx";

  if (useBlend) {
    output.push(`${I}__bp_${config.name}_buf = buffer(w, h)`);
    output.push(`${I}${targetCtx} = __bp_${config.name}_buf.getContext("2d")`);
  }

  output.push(`${I}${rng} = mulberry32(${config.seed})`);
  output.push(`${I}rng = ${rng}`);
  output.push(`${I}${countVar} = ${countExpr}`);
  output.push(`${I}loop ${countVar}:`);
  output.push(`${I}  pos = positions[i % positions.length]`);
  output.push(`${I}  px = clamp(floor(pos.x), 0, w - 1)`);
  output.push(`${I}  py = clamp(floor(pos.y), 0, h - 1)`);

  if (config.scatter) {
    // Probabilistic scatter: maskAlpha available in expression
    output.push(`${I}  maskAlpha = alphaAt(${config.mask}, px, py)`);
    output.push(`${I}  if ${rng}() > (${config.scatter}):`);
    output.push(`${I}    continue`);
  } else {
    // Standard hard threshold
    output.push(`${I}  __bp_a = alphaAt(${config.mask}, px, py)`);
    output.push(`${I}  if __bp_a < 10:`);
    output.push(`${I}    continue`);
  }

  if (config.exclude) {
    output.push(`${I}  if ${expandExcludeShorthand(config.exclude)}:`);
    output.push(`${I}    continue`);
  }

  // Color: custom expression or sample from base
  if (config.color) {
    output.push(`${I}  __bp_color = ${config.color}`);
  } else {
    output.push(`${I}  __bp_color = colorAt(base, px, py)`);
  }

  output.push(`${I}  flowAngle = scene.flowAngleAt(pos.x, pos.y)`);
  output.push(`${I}  __bp_angle = ${config.angle}`);

  // Alpha: scale by mask value (use maskAlpha if scatter, else __bp_a)
  const maskVar = config.scatter ? "maskAlpha" : "__bp_a";
  if (config.alphaMin === config.alphaMax) {
    // Single alpha expression (no lerp)
    output.push(`${I}  __bp_alpha = ${config.alphaMin}`);
  } else {
    output.push(`${I}  __bp_alpha = lerp(${config.alphaMin}, ${config.alphaMax}, ${rng}()) * (${maskVar} / 255)`);
  }

  output.push(`${I}  renderBristleStroke(${targetCtx}, {x: pos.x, y: pos.y, angle: __bp_angle, width: ${config.width}, bristleCount: ${config.bristles}, alpha: __bp_alpha, rng: ${rng}, texture: "${config.texture}", color: {mode: "single", palette: [__bp_color], jitter: ${jitterExpr}}${extraStr}})`);

  if (useBlend) {
    output.push(`${I}draw __bp_${config.name}_buf 0 0 blend:${config.blend}`);
  }
}

function emitForcePass(output: string[], indent: string, config: PassConfig): void {
  const I = indent;
  const rng = `__fp_${config.name}_rng`;
  const countVar = `__fp_${config.name}_n`;
  const pathVar = config.path!;
  const radius = config.radius!;
  const countExpr = config.countMul
    ? `floor((${config.count}) * dabDensity * (${config.countMul}))`
    : `floor((${config.count}) * dabDensity)`;
  const jitterExpr = config.jitter ?? "colorJitter";
  const extraStr = emitStrokeOpts(config);

  // Determine render target
  const useBlend = !!config.blend;
  const targetCtx = useBlend ? `__fp_${config.name}_ctx` : "ctx";

  if (useBlend) {
    output.push(`${I}__fp_${config.name}_buf = buffer(w, h)`);
    output.push(`${I}${targetCtx} = __fp_${config.name}_buf.getContext("2d")`);
  }

  output.push(`${I}${rng} = mulberry32(${config.seed})`);
  output.push(`${I}rng = ${rng}`);
  output.push(`${I}${countVar} = ${countExpr}`);
  output.push(`${I}loop ${countVar}:`);
  output.push(`${I}  pos = positions[i % positions.length]`);
  output.push(`${I}  px = clamp(floor(pos.x), 0, w - 1)`);
  output.push(`${I}  py = clamp(floor(pos.y), 0, h - 1)`);

  // Distance check against force-path
  output.push(`${I}  __fp_dist = ${pathVar}.distAt(pos.x, pos.y)`);
  output.push(`${I}  if __fp_dist > ${radius}:`);
  output.push(`${I}    continue`);

  // Sparse skip
  if (config.sparse) {
    output.push(`${I}  if ${rng}() > ${config.sparse}:`);
    output.push(`${I}    continue`);
  }

  // proximity: 0 at edge, 1 at path center
  output.push(`${I}  proximity = clamp(1 - __fp_dist / ${radius}, 0, 1)`);

  // Substitute `path.` → actual path variable in expressions
  const sub = (expr: string) => expr.replace(/\bpath\./g, `${pathVar}.`);

  // Base color from composite (available as baseColor in expressions)
  output.push(`${I}  baseColor = colorAt(base, px, py)`);

  output.push(`${I}  flowAngle = scene.flowAngleAt(pos.x, pos.y)`);
  output.push(`${I}  __fp_angle = ${sub(config.angle)}`);

  // Color: custom expression or use baseColor
  if (config.color) {
    output.push(`${I}  __fp_color = ${sub(config.color)}`);
  } else {
    output.push(`${I}  __fp_color = baseColor`);
  }

  // Alpha: single expression (forcePass typically uses proximity-based expressions, not [min, max])
  if (config.alphaMin === config.alphaMax) {
    output.push(`${I}  __fp_alpha = ${config.alphaMin}`);
  } else {
    output.push(`${I}  __fp_alpha = lerp(${config.alphaMin}, ${config.alphaMax}, ${rng}())`);
  }

  output.push(`${I}  renderBristleStroke(${targetCtx}, {x: pos.x, y: pos.y, angle: __fp_angle, width: ${config.width}, bristleCount: ${config.bristles}, alpha: __fp_alpha, rng: ${rng}, texture: "${config.texture}", color: {mode: "single", palette: [__fp_color], jitter: ${jitterExpr}}${extraStr}})`);

  if (useBlend) {
    output.push(`${I}draw __fp_${config.name}_buf 0 0 blend:${config.blend}`);
  }
}
