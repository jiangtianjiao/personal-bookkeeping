/**
 * Simple star height check - reject patterns with nested quantifiers
 * that can cause catastrophic backtracking (ReDoS).
 */
export function isSafeRegex(pattern: string): boolean {
  // Reject nested quantifiers like (a+)+, (a*)+, (a+)*, etc.
  if (/(\([^)]*[+*]\)[+*?{])/.test(pattern)) return false;
  // Reject excessive backtracking patterns like a**  a++
  if (/([+*])\1/.test(pattern)) return false;
  // Check it actually compiles
  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
}
