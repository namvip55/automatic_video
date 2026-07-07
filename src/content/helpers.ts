/**
 * Shared helpers for content modules.
 */

/**
 * Extract JSON from LLM response.
 * LLM sometimes wraps JSON in markdown code blocks or adds prose around it.
 */
export function extractJson(text: string): string {
  // Try to find ```json ... ``` block
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (codeBlockMatch?.[1]) {
    return codeBlockMatch[1].trim();
  }

  // Try to find first { ... } block
  const jsonStart = text.indexOf("{");
  const jsonEnd = text.lastIndexOf("}");
  if (jsonStart >= 0 && jsonEnd > jsonStart) {
    return text.slice(jsonStart, jsonEnd + 1).trim();
  }

  return text.trim();
}
