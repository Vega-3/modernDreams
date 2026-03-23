/**
 * Convert a raw Anthropic API error string into a human-friendly message
 * with actionable guidance.
 */
export function friendlyApiError(raw: string): string {
  // Credit / billing errors
  if (raw.includes('credit balance') || raw.includes('too low')) {
    return (
      'Your Anthropic API account has no credits. ' +
      'Note: a Claude.ai Pro/Team subscription does NOT include API access — ' +
      'these are billed separately. ' +
      'Add credits at console.anthropic.com/settings/billing.'
    );
  }

  // Invalid / expired key
  if (
    raw.includes('invalid x-api-key') ||
    raw.includes('authentication_error') ||
    raw.includes('401')
  ) {
    return (
      'Invalid API key. Double-check that you copied the full key from ' +
      'console.anthropic.com/settings/api-keys and saved it in Settings.'
    );
  }

  // Rate limit
  if (raw.includes('rate_limit') || raw.includes('429')) {
    return 'Rate limit reached. Wait a minute and try again.';
  }

  // Overloaded
  if (raw.includes('overloaded') || raw.includes('529')) {
    return "Anthropic's servers are overloaded right now. Try again in a moment.";
  }

  // Permission denied (key lacks vision access or wrong tier)
  if (raw.includes('permission') || raw.includes('403')) {
    return (
      'Your API key does not have permission for this operation. ' +
      'Make sure you are using a standard API key from console.anthropic.com.'
    );
  }

  // Generic fallback — strip the boilerplate prefix Tauri adds
  return raw.replace(/^Anthropic API error \d+ \w+ \w+:\s*/, '').trim() || raw;
}
