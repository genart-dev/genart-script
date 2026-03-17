/**
 * Paramset preprocessor — expands paramset templates before tokenization.
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
 */

interface ParamSetDef {
  name: string;
  templateParams: string[];
  bodyLines: string[];
}

export function expandParamSets(source: string): string {
  const lines = source.split("\n");
  const defs = new Map<string, ParamSetDef>();
  const output: string[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    const defMatch = line.match(/^paramset\s+(\w+)\s*\(([^)]*)\)\s*:\s*$/);

    if (defMatch) {
      // Parse paramset definition
      const name = defMatch[1]!;
      const templateParams = defMatch[2]!.split(",").map(s => s.trim()).filter(Boolean);
      const bodyLines: string[] = [];
      i++;

      // Collect indented body lines
      while (i < lines.length) {
        const bodyLine = lines[i]!;
        // Empty lines inside the block are preserved
        if (bodyLine.trim() === "") { i++; continue; }
        // Check if indented (starts with whitespace)
        if (/^\s+/.test(bodyLine)) {
          // Strip the leading indentation (first level only)
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

      // Build substitution map
      const subs: Record<string, string> = { prefix };
      for (let j = 0; j < def.templateParams.length; j++) {
        subs[def.templateParams[j]!] = values[j] ?? "0";
      }

      // Expand body lines with substitutions
      for (const bodyLine of def.bodyLines) {
        let expanded = bodyLine;
        // Replace {key} placeholders
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
