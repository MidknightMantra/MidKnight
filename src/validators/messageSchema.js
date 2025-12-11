/**
 * Message and Input Validation Schemas
 * Validates user inputs, URLs, file sizes, etc.
 */

import { z } from 'zod';

/**
 * WhatsApp JID (Jabber ID) validation
 */
export const JIDSchema = z.string()
  .regex(
    /^(\d{10,15}|status)@(s\.whatsapp\.net|g\.us|broadcast)$/,
    'Invalid WhatsApp JID format'
  );

/**
 * Phone number validation (international format)
 */
export const PhoneNumberSchema = z.string()
  .regex(/^\+?\d{10,15}$/, 'Phone number must be 10-15 digits')
  .transform(val => val.replace(/\D/g, '')); // Remove non-digits

/**
 * URL validation
 */
export const URLSchema = z.string()
  .url('Invalid URL format')
  .refine(
    url => {
      try {
        const parsed = new URL(url);
        return ['http:', 'https:'].includes(parsed.protocol);
      } catch {
        return false;
      }
    },
    'URL must use HTTP or HTTPS protocol'
  );

/**
 * File size validation (in bytes)
 */
export const FileSizeSchema = z.number()
  .int('File size must be an integer')
  .nonnegative('File size cannot be negative')
  .max(100 * 1024 * 1024, 'File size cannot exceed 100 MB');

/**
 * YouTube/Video URL validation
 */
export const YouTubeURLSchema = z.string()
  .refine(
    url => {
      const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;
      return youtubeRegex.test(url);
    },
    'Invalid YouTube URL'
  );

/**
 * Search query validation
 */
export const SearchQuerySchema = z.string()
  .min(1, 'Search query cannot be empty')
  .max(500, 'Search query must be 500 characters or less')
  .refine(
    query => query.trim().length > 0,
    'Search query cannot be only whitespace'
  );

/**
 * Sticker text validation
 */
export const StickerTextSchema = z.string()
  .max(100, 'Sticker text must be 100 characters or less')
  .optional();

/**
 * Group name validation
 */
export const GroupNameSchema = z.string()
  .min(1, 'Group name cannot be empty')
  .max(25, 'Group name must be 25 characters or less')
  .refine(
    name => name.trim().length > 0,
    'Group name cannot be only whitespace'
  );

/**
 * Message text validation
 */
export const MessageTextSchema = z.string()
  .max(10000, 'Message text must be 10000 characters or less');

/**
 * Command arguments validation
 */
export const CommandArgsSchema = z.object({
  command: z.string().min(1),
  args: z.array(z.string()).default([]),
  text: z.string().default('')
});

/**
 * API Key validation
 */
export const APIKeySchema = z.string()
  .min(10, 'API key must be at least 10 characters')
  .max(200, 'API key must be 200 characters or less')
  .refine(
    key => /^[a-zA-Z0-9_-]+$/.test(key),
    'API key can only contain letters, numbers, hyphens, and underscores'
  );

/**
 * Validate a URL before downloading
 * @param {string} url - URL to validate
 * @returns {boolean} True if valid
 */
export function isValidURL(url) {
  return URLSchema.safeParse(url).success;
}

/**
 * Validate a phone number
 * @param {string} phone - Phone number to validate
 * @returns {boolean} True if valid
 */
export function isValidPhoneNumber(phone) {
  return PhoneNumberSchema.safeParse(phone).success;
}

/**
 * Validate file size before processing
 * @param {number} size - File size in bytes
 * @param {number} maxSizeMB - Maximum size in MB (default: 100)
 * @returns {boolean} True if within limits
 */
export function isValidFileSize(size, maxSizeMB = 100) {
  const schema = z.number()
    .int()
    .nonnegative()
    .max(maxSizeMB * 1024 * 1024);

  return schema.safeParse(size).success;
}

/**
 * Sanitize text input (remove potential injection attempts)
 * @param {string} text - Text to sanitize
 * @returns {string} Sanitized text
 */
export function sanitizeText(text) {
  if (typeof text !== 'string') return '';

  return text
    .replace(/<script[^>]*>.*?<\/script>/gi, '') // Remove script tags
    .replace(/<[^>]+>/g, '') // Remove HTML tags
    .trim();
}

/**
 * Validate and sanitize search query
 * @param {string} query - Search query
 * @returns {string} Sanitized query
 * @throws {Error} If validation fails
 */
export function validateSearchQuery(query) {
  const sanitized = sanitizeText(query);
  return SearchQuerySchema.parse(sanitized);
}

/**
 * Extract and validate URLs from text
 * @param {string} text - Text containing URLs
 * @returns {string[]} Array of valid URLs
 */
export function extractValidURLs(text) {
  const urlRegex = /https?:\/\/[^\s]+/g;
  const matches = text.match(urlRegex) || [];

  return matches.filter(url => isValidURL(url));
}

export default {
  JIDSchema,
  PhoneNumberSchema,
  URLSchema,
  FileSizeSchema,
  YouTubeURLSchema,
  SearchQuerySchema,
  StickerTextSchema,
  GroupNameSchema,
  MessageTextSchema,
  CommandArgsSchema,
  APIKeySchema,
  isValidURL,
  isValidPhoneNumber,
  isValidFileSize,
  sanitizeText,
  validateSearchQuery,
  extractValidURLs
};
