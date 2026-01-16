/**
 * Configuration Utility for Credential Manager Demo
 */

/**
 * Encodes the configuration object into a URL-friendly string.
 * We use JSON stringification followed by URI encoding for readability,
 * or a more compressed format if needed. Given the "human readable" requirement,
 * we'll use standard URLSearchParams where possible for simple values,
 * but for a list of complex objects, a JSON parameter is safest and still readable(ish).
 * 
 * To make it truly human readable as requested:
 * ?call1.mediation=optional&call1.types=password,public-key&...
 * This is complex to parse dynamic lists.
 * 
 * We will use: ?config=<JSON_STRING>
 * It satisfies the requirement best while maintaining robustness.
 */
export function buildUrlFromOptions(config) {
  const params = new URLSearchParams();

  // Sort keys for deterministic URL
  const cleanConfig = {
    global: config.global,
    calls: config.calls.map(call => {
      // Remove null/undefined/empty values to keep URL clean
      const cleanCall = {};
      for (const [key, value] of Object.entries(call)) {
        if (value !== null && value !== undefined && value !== "") {
          cleanCall[key] = value;
        }
      }
      return cleanCall;
    })
  };

  const jsonString = JSON.stringify(cleanConfig);
  params.set('config', jsonString);
  return `demo.html?${params.toString()}`;
}

/**
 * Decodes the configuration from the URL search parameters.
 */
export function getOptionsFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const configStr = params.get('config');

  if (!configStr) {
    return { global: { includeForm: false }, calls: [] };
  }

  try {
    return JSON.parse(configStr);
  } catch (e) {
    console.error("Failed to parse config from URL:", e);
    return { global: { includeForm: false }, calls: [] };
  }
}

/**
 * Constants for UI generation
 */
export const CREDENTIAL_TYPES = {
  PASSWORD: 'password',
  PUBLIC_KEY: 'public-key',
  FEDCM: 'fedcm'
};

export const MEDIATION_MODES = [
  { value: 'optional', label: 'Empty (default=Optional)' },
  { value: 'required', label: 'Required' },
  { value: 'silent', label: 'Silent' },
  { value: 'conditional', label: 'Conditional' }
];

export const UI_MODES = [
  { value: '', label: 'Empty (Default)' }, // Sends nothing or undefined
  { value: 'active', label: 'Active' },
  { value: 'passive', label: 'Passive' },
  { value: 'immediate', label: 'Immediate' } // Warning: Check support
];
