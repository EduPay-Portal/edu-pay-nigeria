/**
 * XSS Protection & Input Sanitization Utilities
 * 
 * SECURITY NOTE: These are basic client-side protections.
 * Always validate and sanitize on the server side as well.
 */

// Escape HTML special characters to prevent XSS
export const escapeHtml = (text: string): string => {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };
  return text.replace(/[&<>"'/]/g, (char) => map[char]);
};

// Remove all HTML tags from string
export const stripHtml = (text: string): string => {
  return text.replace(/<[^>]*>/g, '');
};

// Sanitize user input for safe display
export const sanitizeInput = (input: string): string => {
  return stripHtml(escapeHtml(input.trim()));
};

// Validate and sanitize email addresses
export const sanitizeEmail = (email: string): string => {
  return email
    .trim()
    .toLowerCase()
    .replace(/[^\w@.-]/g, '');
};

// Sanitize numeric amounts (remove non-numeric characters except decimal)
export const sanitizeAmount = (amount: string): string => {
  return amount
    .replace(/[^\d.]/g, '')
    .replace(/(\..*)\./g, '$1'); // Keep only first decimal point
};

// Safe JSON parse with fallback value
export const safeJsonParse = <T>(json: string, fallback: T): T => {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
};

// Sanitize search queries to prevent SQL injection
export const sanitizeSearchQuery = (query: string): string => {
  return query
    .trim()
    .replace(/[;'"\\]/g, '') // Remove SQL special characters
    .slice(0, 100); // Limit length
};

// Sanitize file names for upload
export const sanitizeFileName = (fileName: string): string => {
  return fileName
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '_') // Replace unsafe characters
    .slice(0, 255); // Limit length
};

// Validate URL to prevent javascript: and data: protocols
export const isSafeUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:', 'mailto:'].includes(parsed.protocol);
  } catch {
    return false;
  }
};
