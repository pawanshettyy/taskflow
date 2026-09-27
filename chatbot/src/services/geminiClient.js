/**
 * geminiClient.js
 * ---------------
 * Optional Gemini response polishing for recognized chatbot intents.
 * The model receives only the app's local reference answer, so it cannot
 * act as a general-purpose assistant for this endpoint.
 */

const DEFAULT_MODEL = 'gemini-2.5-flash';
const DEFAULT_TIMEOUT_MS = 8000;

function isEnabled() {
  return Boolean(process.env.GEMINI_API_KEY) && process.env.GEMINI_ENABLED !== 'false';
}

function buildPrompt({ intent, message, referenceReply }) {
  return [
    'You are the support assistant for TaskFlow.',
    'Answer only about the TaskFlow chatbot topics represented by the provided intent.',
    'Use the reference answer as the only source of facts. Do not add, infer, or invent facts.',
    'If the user request cannot be answered from the reference answer, return the reference answer unchanged.',
    'Keep the answer concise, friendly, and under 80 words. Return plain text only.',
    `Intent: ${intent}`,
    `User message: ${message}`,
    `Reference answer: ${referenceReply}`,
  ].join('\n');
}

async function generateReply(params) {
  if (!isEnabled() || typeof fetch !== 'function') return null;

  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const timeoutMs = parseInt(process.env.GEMINI_TIMEOUT_MS, 10) || DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: buildPrompt(params) }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 160 },
        }),
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      console.warn(`[Gemini] request failed with status ${response.status}`);
      return null;
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    return text && text.length <= 600 ? text : null;
  } catch (error) {
    console.warn(`[Gemini] request unavailable: ${error.name === 'AbortError' ? 'timeout' : error.message}`);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { generateReply, buildPrompt, isEnabled };