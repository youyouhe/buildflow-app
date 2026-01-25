/**
 * JavaScript syntax validator
 * Validates JavaScript code without executing it
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
  line?: number;
  column?: number;
}

/**
 * Validate JavaScript syntax
 * Uses Function constructor to check syntax without execution
 * Also performs additional checks for iframe/srcdoc context
 */
export function validateJavaScript(code: string): ValidationResult {
  // Handle empty code
  if (!code || !code.trim()) {
    return { valid: true };
  }

  // Handle comments-only code
  const codeWithoutComments = removeComments(code);
  if (!codeWithoutComments.trim()) {
    return { valid: true };
  }

  try {
    // First check for issues that might be valid in modern JS
    // but cause problems in iframe srcdoc context
    
    // Check for incomplete code blocks during streaming
    if (isIncompleteCode(code)) {
      return {
        valid: false,
        error: "Incomplete code block (streaming in progress)",
      };
    }

    // Use Function constructor to validate syntax
    // This checks syntax without executing the code
    // Wrap in try-catch and also test in strict mode
    // eslint-disable-next-line no-new-func
    new Function(code);
    
    // Also test in strict mode
    // eslint-disable-next-line no-new-func
    new Function('"use strict";' + code);
    
    return { valid: true };
  } catch (error) {
    // Parse the error to extract useful information
    const errorMessage = (error as Error).message;
    const errorInfo = parseJavaScriptError(errorMessage);

    return {
      valid: false,
      error: errorInfo.message,
      line: errorInfo.line,
      column: errorInfo.column,
    };
  }
}

/**
 * Remove JavaScript comments from code
 * Useful for checking if code is only comments
 */
function removeComments(code: string): string {
  // Remove single-line comments
  let cleaned = code.replace(/\/\/.*$/gm, "");

  // Remove multi-line comments
  cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, "");

  return cleaned;
}

/**
 * Check if code appears to be incomplete (streaming in progress)
 */
function isIncompleteCode(code: string): boolean {
  const trimmed = code.trim();
  
  // Check if code ends with incomplete patterns
  const incompletePatterns = [
    /,\s*$/,              // Ends with comma
    /\{\s*$/,             // Ends with opening brace
    /\[\s*$/,             // Ends with opening bracket
    /\(\s*$/,             // Ends with opening paren
    /=\s*$/,              // Ends with assignment
    /=>\s*$/,             // Ends with arrow function
    /\.\s*$/,             // Ends with dot (property access)
    /\?\s*$/,             // Ends with question mark
    /:\s*$/,              // Ends with colon
  ];
  
  return incompletePatterns.some(pattern => pattern.test(trimmed));
}

/**
 * Parse JavaScript error message to extract line and column info
 */
function parseJavaScriptError(errorMessage: string): {
  message: string;
  line?: number;
  column?: number;
} {
  // Try to extract line number from error message
  // Common patterns:
  // - "Unexpected token ',' at line 6 column 47"
  // - "SyntaxError: Unexpected token ','"
  // - "Unexpected identifier at 6:47"

  const lineMatch = errorMessage.match(/line (\d+)/i);
  const columnMatch = errorMessage.match(/column (\d+)/i);
  const positionMatch = errorMessage.match(/at (\d+):(\d+)/);

  let line: number | undefined;
  let column: number | undefined;

  if (lineMatch) {
    line = parseInt(lineMatch[1]);
  }

  if (columnMatch) {
    column = parseInt(columnMatch[1]);
  }

  if (positionMatch) {
    line = parseInt(positionMatch[1]);
    column = parseInt(positionMatch[2]);
  }

  // Clean up error message
  let message = errorMessage
    .replace(/^SyntaxError:\s*/i, "")
    .replace(/\s*at\s+line\s+\d+\s+column\s+\d+/i, "")
    .replace(/\s*at\s+\d+:\d+/i, "")
    .trim();

  // Make message more user-friendly
  if (message.includes("Unexpected token")) {
    message = message.replace("Unexpected token", "Syntax error: Unexpected");
  }

  return { message, line, column };
}

/**
 * Check if code has common syntax issues
 * Returns specific error messages for common problems
 */
export function checkCommonIssues(code: string): ValidationResult | null {
  const trimmed = code.trim();

  // Check for trailing comma in object/array
  if (trimmed.match(/,\s*[}\]]/)) {
    return {
      valid: false,
      error: "Trailing comma in object or array (not supported in some contexts)",
    };
  }

  // Check for incomplete object/array
  const openBraces = (trimmed.match(/\{/g) || []).length;
  const closeBraces = (trimmed.match(/\}/g) || []).length;
  const openBrackets = (trimmed.match(/\[/g) || []).length;
  const closeBrackets = (trimmed.match(/\]/g) || []).length;
  const openParens = (trimmed.match(/\(/g) || []).length;
  const closeParens = (trimmed.match(/\)/g) || []).length;

  if (openBraces !== closeBraces) {
    return {
      valid: false,
      error: `Unmatched braces: ${openBraces} opening, ${closeBraces} closing`,
    };
  }

  if (openBrackets !== closeBrackets) {
    return {
      valid: false,
      error: `Unmatched brackets: ${openBrackets} opening, ${closeBrackets} closing`,
    };
  }

  if (openParens !== closeParens) {
    return {
      valid: false,
      error: `Unmatched parentheses: ${openParens} opening, ${closeParens} closing`,
    };
  }

  // Check for incomplete string literals
  const singleQuotes = (trimmed.match(/'/g) || []).length;
  const doubleQuotes = (trimmed.match(/"/g) || []).length;
  const backticks = (trimmed.match(/`/g) || []).length;

  if (singleQuotes % 2 !== 0) {
    return {
      valid: false,
      error: "Unclosed single quote string literal",
    };
  }

  if (doubleQuotes % 2 !== 0) {
    return {
      valid: false,
      error: "Unclosed double quote string literal",
    };
  }

  if (backticks % 2 !== 0) {
    return {
      valid: false,
      error: "Unclosed template literal",
    };
  }

  return null;
}

/**
 * Validate and return detailed error information
 */
export function validateJavaScriptDetailed(code: string): ValidationResult {
  // First check common issues
  const commonIssue = checkCommonIssues(code);
  if (commonIssue) {
    return commonIssue;
  }

  // Then do full syntax validation
  return validateJavaScript(code);
}
