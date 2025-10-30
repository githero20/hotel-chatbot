/**
 * Input sanitization and validation to prevent prompt injection attacks
 */

import { z } from "zod";

/**
 * Sanitize user input by removing dangerous characters and patterns
 */
export function sanitizeInput(input: string): string {
  if (!input) return "";

  let sanitized = input;

  // 1. Remove control characters (except newlines and tabs)
  sanitized = sanitized.replace(
    /[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F]/g,
    ""
  );

  // 2. Normalize whitespace
  sanitized = sanitized.replace(/\r\n/g, "\n");
  sanitized = sanitized.replace(/\t/g, " ");

  // 3. Remove code blocks that might contain injection attempts
  sanitized = sanitized.replace(/```[\s\S]*?```/g, "[code block removed]");
  sanitized = sanitized.replace(/`([^`]+)`/g, "$1");

  // 4. Remove HTML/XML tags
  sanitized = sanitized.replace(/<[^>]*>/g, "");

  // 5. Limit consecutive newlines
  sanitized = sanitized.replace(/\n{4,}/g, "\n\n\n");

  // 6. Trim and limit length per line
  sanitized = sanitized
    .split("\n")
    .map((line) => line.trim())
    .map((line) => (line.length > 500 ? line.slice(0, 500) + "..." : line))
    .join("\n");

  return sanitized.trim();
}

/**
 * Detect common prompt injection patterns
 */
const INJECTION_PATTERNS = [
  // Direct instruction attempts
  /ignore\s+(the\s+)?above\b/i,
  /ignore\s+(all|the\s+)?(previous|above|prior)\s+(instructions?|prompts?|commands?)/i,
  /disregard\s+(all\s+)?(previous|above|prior)/i,
  /forget\s+(all\s+)?(previous|above|prior)/i,

  // Role manipulation
  /you\s+are\s+now/i,
  /act\s+as\s+(a|an)\s+/i,
  /pretend\s+to\s+be/i,
  /simulate\s+(being|a|an)/i,

  // System prompt attempts
  /system\s*:\s*/i,
  /<\s*system\s*>/i,
  /\[system\]/i,

  // Tool/function manipulation
  /tool_calls?\s*[:=]/i,
  /function\s*[:=]\s*\{/i,
  /execute\s+(this|the)\s+(code|script|function)/i,

  // Sensitive data extraction
  /show\s+(me\s+)?(your\s+)?(system\s+)?prompt/i,
  /reveal\s+(your\s+)?(instructions|prompt|system)/i,
  /what\s+(are|is)\s+your\s+(instructions|rules|prompt)/i,

  // DevFest-specific bypasses
  /osca\s+fest/i, // Trying to confuse with old branding
];

export interface ValidationResult {
  isValid: boolean;
  sanitized: string;
  reason?: string;
  suspicionScore: number;
}

/**
 * Validate and score user input for potential injection attempts
 */
export function validateInput(input: string): ValidationResult {
  // Start with sanitization
  const sanitized = sanitizeInput(input);

  // Check length constraints
  if (sanitized.length === 0) {
    return {
      isValid: false,
      sanitized,
      reason: "Empty input",
      suspicionScore: 0,
    };
  }

  if (sanitized.length > 2000) {
    return {
      isValid: false,
      sanitized: sanitized.slice(0, 2000),
      reason: "Input too long (max 2000 characters)",
      suspicionScore: 5,
    };
  }

  // Check against injection patterns
  let suspicionScore = 0;
  const matchedPatterns: string[] = [];

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(sanitized)) {
      suspicionScore += 10;
      matchedPatterns.push(pattern.toString());
    }
  }

  // Additional heuristics
  const lowerInput = sanitized.toLowerCase();

  // High-risk keywords
  const riskyKeywords = [
    "ignore",
    "disregard",
    "system",
    "prompt",
    "instructions",
    "tool_call",
    "function",
    "api_key",
    "password",
    "secret",
  ];

  for (const keyword of riskyKeywords) {
    if (lowerInput.includes(keyword)) {
      suspicionScore += 2;
    }
  }

  // Very long messages are suspicious
  if (sanitized.length > 1000) {
    suspicionScore += 1;
  }

  // Multiple special characters
  const specialCharCount = (sanitized.match(/[{}[\]<>]/g) || []).length;
  if (specialCharCount > 10) {
    suspicionScore += 3;
  }

  // Determine validity based on suspicion score
  const isValid = suspicionScore < 10;

  return {
    isValid,
    sanitized,
    reason: isValid
      ? undefined
      : `Potential prompt injection detected (score: ${suspicionScore})${
          matchedPatterns.length > 0
            ? `. Matched patterns: ${matchedPatterns.length}`
            : ""
        }`,
    suspicionScore,
  };
}

/**
 * Schema validation for user questions
 */
export const QuestionSchema = z
  .string()
  .min(1, "Question cannot be empty")
  .max(2000, "Question too long")
  .transform((s) => sanitizeInput(s));

/**
 * Safe fallback response for blocked inputs
 */
export function getSafeErrorResponse(): string {
  return (
    "I couldn't process that request. " +
    "Please ask a clear question about DevFest Lagos (schedule, speakers, workshops, registration, etc.). "
  );
}
