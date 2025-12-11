/**
 * Configuration Validation Schema
 * Uses Zod for runtime type checking and validation
 */

import { z } from 'zod';

/**
 * Schema for bot configuration
 * Validates environment variables and provides clear error messages
 */
export const ConfigSchema = z.object({
  // Bot Identity
  botName: z.string()
    .min(1, 'Bot name cannot be empty')
    .max(50, 'Bot name must be 50 characters or less')
    .default('Midknight'),

  prefix: z.string()
    .length(1, 'Prefix must be exactly 1 character')
    .regex(/[!.#$%&*@]/, 'Prefix must be a special character')
    .default('.'),

  // Session
  sessionId: z.string()
    .optional()
    .default(''),

  sessionDir: z.string()
    .min(1, 'Session directory cannot be empty')
    .default('./session'),

  // Owner Numbers
  ownerNumber: z.array(
    z.string()
      .regex(/^\d{10,15}$/, 'Owner number must be 10-15 digits')
  )
    .min(1, 'At least one owner number is required')
    .default(['254700000000']),

  // Features
  autoRead: z.boolean()
    .default(false),

  autoTyping: z.boolean()
    .default(true),

  autoReact: z.boolean()
    .default(true),

  // Anti-features
  antiCall: z.boolean()
    .default(false),

  // Limits
  maxDownloadSize: z.number()
    .int('Max download size must be an integer')
    .positive('Max download size must be positive')
    .max(500, 'Max download size cannot exceed 500 MB')
    .default(100),

  // Bot Mode
  mode: z.enum(['public', 'private', 'groups'], {
    errorMap: () => ({ message: 'Mode must be one of: public, private, groups' })
  })
    .default('public'),

  // Debug
  debug: z.boolean()
    .default(false),

  // Process self messages
  processSelfMessages: z.boolean()
    .default(true),

  // Auto-Join / Auto-Follow
  autoJoinGroupUrl: z.string().optional(),
  autoFollowChannelUrl: z.string().optional()
});

/**
 * Parse and validate raw configuration
 * @param {object} raw - Raw configuration object
 * @returns {object} Validated configuration
 * @throws {Error} If validation fails
 */
export function validateConfig(raw) {
  try {
    return ConfigSchema.parse(raw);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map(err =>
        `  - ${err.path.join('.')}: ${err.message}`
      ).join('\n');

      throw new Error(
        `Configuration validation failed:\n${errorMessages}\n\n` +
        `Please check your .env file and fix the above errors.`
      );
    }
    throw error;
  }
}

/**
 * Safely parse configuration with defaults
 * Logs errors but doesn't throw, using defaults instead
 * @param {object} raw - Raw configuration object
 * @returns {object} Validated configuration
 */
export function safeParseConfig(raw) {
  const result = ConfigSchema.safeParse(raw);

  if (!result.success) {
    console.error('⚠️  Configuration validation warnings:');
    result.error.errors.forEach(err => {
      console.error(`  - ${err.path.join('.')}: ${err.message}`);
    });
    console.error('Using default values where possible.\n');

    // Return defaults
    return ConfigSchema.parse({});
  }

  return result.data;
}

export default {
  ConfigSchema,
  validateConfig,
  safeParseConfig
};
