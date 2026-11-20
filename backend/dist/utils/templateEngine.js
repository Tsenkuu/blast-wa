"use strict";
/**
 * Dynamic message template engine
 * Resolves placeholders like {{A}}, {{B}}, {{C}}, {{nama}}, {{nomor}}, etc.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseTemplateVariables = parseTemplateVariables;
exports.resolveTemplate = resolveTemplate;
exports.validateTemplate = validateTemplate;
function parseTemplateVariables(template) {
    const matches = template.match(/\{\{([^}]+)\}\}/g);
    if (!matches)
        return [];
    const vars = matches.map(m => m.replace(/[{}]/g, '').trim());
    return Array.from(new Set(vars));
}
function resolveTemplate(template, dataRecord, options = {}) {
    if (!template) {
        return {
            text: '',
            unresolvedVariables: [],
            resolvedVariables: {}
        };
    }
    const unresolved = [];
    const resolved = {};
    // Build lowercase lookup map for case-insensitive matching
    const lookupMap = {};
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
        }
        else {
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
function validateTemplate(template, sampleRecord) {
    const requiredVars = parseTemplateVariables(template);
    const lookup = Object.keys(sampleRecord).map(k => k.trim().toLowerCase());
    const missing = requiredVars.filter(v => !lookup.includes(v.toLowerCase()));
    return {
        isValid: missing.length === 0,
        missingVariables: missing
    };
}
