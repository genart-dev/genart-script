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
  // bristlePass-specific
  mask?: string;
  // forcePass-specific
  path?: string;
  radius?: string;
  sparse?: string;
}

/**
 * Run all preprocessing passes: paramset expansion, then pass directive expansion.
 */
export function preprocess(source: string): string {
  let result = expandParamSets(source);
  result = expandPassDirectives(result);
  return result;
}

// Keep the old name as an alias for backward compat
export { preprocess as expandParamSets };

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

function parsePassBody(lines: string[], startIdx: number, headerIndent: string): { config: Record<string, string>; nextIdx: number } {
  const config: Record<string, string> = {};
  let i = startIdx;
  // Body lines must be indented MORE than the header
  const minIndent = headerIndent.length + 2;

  while (i < lines.length) {
    const bodyLine = lines[i]!;
    if (bodyLine.trim() === "") { i++; continue; }
    // Check that line is indented deeper than the header
    const lineIndent = bodyLine.match(/^(\s*)/)?.[1]?.length ?? 0;
    if (lineIndent >= minIndent) {
      const kvMatch = bodyLine.trim().match(/^(\w+)\s*:\s*(.+)$/);
      if (kvMatch) {
        config[kvMatch[1]!] = kvMatch[2]!.trim();
      }
      i++;
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

function buildPassConfig(base: Partial<PassConfig>, kv: Record<string, string>): PassConfig {
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

function emitStrokeOpts(config: PassConfig): string {
  const extraOpts: string[] = [];
  if (config.steps) extraOpts.push(`steps: ${config.steps}`);
  if (config.stepSize) extraOpts.push(`stepSize: ${config.stepSize}`);
  return extraOpts.length ? ", " + extraOpts.join(", ") : "";
}

function expandPassDirectives(source: string): string {
  const lines = source.split("\n");
  const output: string[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;

    // Match: bristlePass <name> seed:<N> mask:<expr> texture:<str> [blend:<mode>]:
    const bristleMatch = line.match(
      /^(\s*)bristlePass\s+(\w+)\s+seed:(\S+)\s+mask:(\S+)\s+texture:(\S+)(?:\s+blend:(\S+))?\s*:\s*$/
    );

    if (bristleMatch) {
      const indent = bristleMatch[1] ?? "";
      i++;
      const { config: kv, nextIdx } = parsePassBody(lines, i, indent);
      i = nextIdx;

      const config = buildPassConfig({
        name: bristleMatch[2]!,
        seed: bristleMatch[3]!,
        mask: bristleMatch[4]!,
        texture: bristleMatch[5]!,
        blend: bristleMatch[6],
      }, kv);

      emitBristlePass(output, indent, config);
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
      }, kv);

      emitForcePass(output, indent, config);
      continue;
    }

    output.push(line);
    i++;
  }

  return output.join("\n");
}

function emitBristlePass(output: string[], indent: string, config: PassConfig): void {
  const I = indent;
  const rng = `__bp_${config.name}_rng`;
  const countVar = `__bp_${config.name}_n`;
  const countExpr = config.countMul
    ? `floor((${config.count}) * dabDensity * (${config.countMul}))`
    : `floor((${config.count}) * dabDensity)`;
  const jitterExpr = config.jitter ?? "colorJitter";
  const extraStr = emitStrokeOpts(config);

  // Determine render target (ctx or offscreen buffer)
  const useBlend = !!config.blend;
  const targetCtx = useBlend ? `__bp_${config.name}_ctx` : "ctx";

  if (useBlend) {
    output.push(`${I}__bp_${config.name}_buf = buffer(w, h)`);
    output.push(`${I}${targetCtx} = __bp_${config.name}_buf.getContext("2d")`);
  }

  output.push(`${I}${rng} = mulberry32(${config.seed})`);
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
    output.push(`${I}  if ${config.exclude}:`);
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
