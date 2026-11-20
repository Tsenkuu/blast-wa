/**
 * Dynamic message template engine
 * Resolves placeholders like {{A}}, {{B}}, {{C}}, {{nama}}, {{nomor}}, etc.
 */

export interface TemplateResolutionResult {
  text: string;
  unresolvedVariables: string[];
  resolvedVariables: Record<string, string>;
}

export function parseTemplateVariables(template: string): string[] {
  const matches = template.match(/\{\{([^}]+)\}\}/g);
  if (!matches) return [];
  const vars = matches.map(m => m.replace(/[{}]/g, '').trim());
  return Array.from(new Set(vars));
}

export function resolveTemplate(
  template: string,
  dataRecord: Record<string, any>,
  options: { removeUnresolved?: boolean; fallbackValue?: string } = {}
): TemplateResolutionResult {
  if (!template) {
    return {
      text: '',
      unresolvedVariables: [],
      resolvedVariables: {}
    };
  }

  const unresolved: string[] = [];
  const resolved: Record<string, string> = {};

  // Build lowercase lookup map for case-insensitive matching
  const lookupMap: Record<string, string> = {};
  for (const [key, val] of Object.entries(dataRecord)) {
    if (val !== undefined && val !== null) {
      lookupMap[key.trim().toLowerCase()] = String(val);
    }
  }

  // Regex to match {{variable}}
  const replacedText = template.replace(/\{\{([^}]+)\}\}/g, (match, varName) => {
    const trimmed = varName.trim();
    const lower = trimmed.toLowerCase();

    if (lower in lookupMap) {
      const val = lookupMap[lower];
      resolved[trimmed] = val;
      return val;
    } else {
      unresolved.push(trimmed);
      if (options.removeUnresolved) {
        return options.fallbackValue !== undefined ? options.fallbackValue : '';
      }
      return match; // keep original or fallback
    }
  });

  return {
    text: replacedText,
    unresolvedVariables: Array.from(new Set(unresolved)),
    resolvedVariables: resolved
  };
}

/**
 * Validate template against a sample dataset row
 */
export function validateTemplate(
  template: string,
  sampleRecord: Record<string, any>
): { isValid: boolean; missingVariables: string[] } {
  const requiredVars = parseTemplateVariables(template);
  const lookup = Object.keys(sampleRecord).map(k => k.trim().toLowerCase());

  const missing = requiredVars.filter(v => !lookup.includes(v.toLowerCase()));

  return {
    isValid: missing.length === 0,
    missingVariables: missing
  };
}
