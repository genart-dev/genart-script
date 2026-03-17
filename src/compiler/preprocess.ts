/**
 * Source-level preprocessor — runs before tokenization.
 *
 * ## paramset — parameter templates
 *
 * Syntax:
 *   paramset bristle(dabWidth, bristles, alphaMin, alphaMax, dabs):
 *     param {prefix}DabWidth {dabWidth} range:4..40 step:1
 *     param {prefix}Bristles {bristles} range:3..12 step:1
 *
 *   bristle sky(19, 6, 0.4, 0.8, 1800)
 *
 * Expands to:
 *   param skyDabWidth 19 range:4..40 step:1
 *   param skyBristles 6 range:3..12 step:1
 *
 * ## bristlePass — declarative bristle-stroke pass
 *
 * Syntax:
 *   bristlePass sky seed:100 mask:skyMask texture:smooth:
 *     count: skyDabs
 *     width: skyDabWidth
 *     bristles: skyBristles
 *     alpha: [skyAlphaMin, skyAlphaMax]
 *     angle: flowAngle * flowInfluence * 0.3
 *     exclude: nearestBoltDist(pos.x, pos.y) < 30
 *     jitter: colorJitter
 *
 * Expands to a complete position loop with mask check, color sampling,
 * angle calculation, and renderBristleStroke call.
 *
 * Assumes in scope: positions, base, ctx, dabDensity, scene
 */

interface ParamSetDef {
  name: string;
  templateParams: string[];
  bodyLines: string[];
}

interface BristlePassConfig {
  name: string;
  seed: string;
  mask: string;
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
}

/**
 * Run all preprocessing passes: paramset expansion, then bristlePass expansion.
 */
export function preprocess(source: string): string {
  let result = expandParamSets(source);
  result = expandBristlePasses(result);
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

function expandBristlePasses(source: string): string {
  const lines = source.split("\n");
  const output: string[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;

    // Match: bristlePass <name> seed:<N> mask:<expr> texture:<str>:
    const headerMatch = line.match(
      /^(\s*)bristlePass\s+(\w+)\s+seed:(\S+)\s+mask:(\S+)\s+texture:(\S+)\s*:\s*$/
    );

    if (headerMatch) {
      const indent = headerMatch[1] ?? "";
      const name = headerMatch[2]!;
      const seed = headerMatch[3]!;
      const mask = headerMatch[4]!;
      const texture = headerMatch[5]!;
      i++;

      // Parse body key:value pairs
      const config: BristlePassConfig = {
        name, seed, mask, texture,
        count: "1000", width: "10", bristles: "6",
        alphaMin: "0.3", alphaMax: "0.8",
        angle: "flowAngle",
      };

      while (i < lines.length) {
        const bodyLine = lines[i]!;
        if (bodyLine.trim() === "") { i++; continue; }
        if (/^\s+/.test(bodyLine)) {
          const kvMatch = bodyLine.trim().match(/^(\w+)\s*:\s*(.+)$/);
          if (kvMatch) {
            const key = kvMatch[1]!;
            const value = kvMatch[2]!.trim();
            switch (key) {
              case "count": config.count = value; break;
              case "width": config.width = value; break;
              case "bristles": config.bristles = value; break;
              case "alpha": {
                // Parse [min, max] array
                const arrMatch = value.match(/^\[([^,]+),\s*([^\]]+)\]$/);
                if (arrMatch) {
                  config.alphaMin = arrMatch[1]!.trim();
                  config.alphaMax = arrMatch[2]!.trim();
                }
                break;
              }
              case "angle": config.angle = value; break;
              case "exclude": config.exclude = value; break;
              case "jitter": config.jitter = value; break;
              case "steps": config.steps = value; break;
              case "stepSize": config.stepSize = value; break;
              case "countMul": config.countMul = value; break;
            }
          }
          i++;
        } else {
          break;
        }
      }

      // Emit expanded code
      const I = indent;
      const rng = `__bp_${name}_rng`;
      const countVar = `__bp_${name}_n`;
      const countExpr = config.countMul
        ? `floor((${config.count}) * dabDensity * (${config.countMul}))`
        : `floor((${config.count}) * dabDensity)`;

      // Extra stroke options
      const extraOpts: string[] = [];
      if (config.steps) extraOpts.push(`steps: ${config.steps}`);
      if (config.stepSize) extraOpts.push(`stepSize: ${config.stepSize}`);
      const extraStr = extraOpts.length ? ", " + extraOpts.join(", ") : "";

      const jitterExpr = config.jitter ?? "colorJitter";

      output.push(`${I}${rng} = mulberry32(${seed})`);
      output.push(`${I}${countVar} = ${countExpr}`);
      output.push(`${I}loop ${countVar}:`);
      output.push(`${I}  pos = positions[i % positions.length]`);
      output.push(`${I}  px = clamp(floor(pos.x), 0, w - 1)`);
      output.push(`${I}  py = clamp(floor(pos.y), 0, h - 1)`);
      output.push(`${I}  __bp_a = alphaAt(${config.mask}, px, py)`);
      output.push(`${I}  if __bp_a < 10:`);
      output.push(`${I}    continue`);
      if (config.exclude) {
        output.push(`${I}  if ${config.exclude}:`);
        output.push(`${I}    continue`);
      }
      output.push(`${I}  __bp_color = colorAt(base, px, py)`);
      output.push(`${I}  flowAngle = scene.flowAngleAt(pos.x, pos.y)`);
      output.push(`${I}  __bp_angle = ${config.angle}`);
      output.push(`${I}  __bp_alpha = lerp(${config.alphaMin}, ${config.alphaMax}, ${rng}()) * (__bp_a / 255)`);
      output.push(`${I}  renderBristleStroke(ctx, {x: pos.x, y: pos.y, angle: __bp_angle, width: ${config.width}, bristleCount: ${config.bristles}, alpha: __bp_alpha, rng: ${rng}, texture: "${texture}", color: {mode: "single", palette: [__bp_color], jitter: ${jitterExpr}}${extraStr}})`);

      continue;
    }

    output.push(line);
    i++;
  }

  return output.join("\n");
}
