/**
 * preprocessor.js
 * ---------------
 * Text normalization pipeline:
 *   1. Lowercasing
 *   2. Punctuation removal
 *   3. Tokenization (delegated to tokenizer.js)
 *   4. Stop-word removal
 *   5. Lightweight spell-correction against a known vocabulary
 *
 * The output of this module is what gets fed into the intent classifier.
 * Keeping preprocessing separate from classification means we can improve
 * text cleaning without touching the classification algorithm.
 */

const natural = require('natural');
const { tokenize, stem } = require('./tokenizer');

// `natural` ships an English stop-word list. We keep a small set of
// domain-relevant exceptions (words that matter for intent, even though
// they're common) so we don't accidentally strip useful signal.
const STOPWORDS = new Set(natural.stopwords);
const KEEP_WORDS = new Set(['how', 'what', 'when', 'where', 'who', 'why', 'not', 'no']);

/**
 * Remove punctuation and non-alphanumeric noise, but keep spaces,
 * @ symbols and # symbols (useful for emails / order IDs downstream).
 * @param {string} text
 * @returns {string}
 */
function removePunctuation(text) {
  return text.replace(/[^\w\s@#+.-]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Lowercase + trim a string.
 * @param {string} text
 */
function toLowerCase(text) {
  return text.toLowerCase().trim();
}

/**
 * Remove stopwords from a token list, respecting the KEEP_WORDS exceptions.
 * @param {string[]} tokens
 */
function removeStopwords(tokens) {
  return tokens.filter((t) => KEEP_WORDS.has(t) || !STOPWORDS.has(t));
}

/**
 * Build a vocabulary set (unique stemmed words) from an array of raw
 * training sentences. Used for spell-correction lookups.
 * @param {string[]} sentences
 * @returns {Set<string>}
 */
function buildVocabulary(sentences) {
  const vocab = new Set();
  sentences.forEach((sentence) => {
    const cleaned = removePunctuation(toLowerCase(sentence));
    tokenize(cleaned).forEach((word) => vocab.add(word));
  });
  return vocab;
}

/**
 * Attempt to correct a single misspelled token by finding the closest
 * match in the known vocabulary (Levenshtein distance <= 2). This is a
 * lightweight, dependency-free approach to handling typos without
 * requiring an external spell-check API.
 * @param {string} token
 * @param {Set<string>} vocabulary
 * @returns {string} corrected token, or the original if no close match found
 */
function correctToken(token, vocabulary) {
  if (vocabulary.has(token) || token.length <= 2) return token;

  let bestMatch = token;
  let bestDistance = Infinity;
  const maxAllowedDistance = token.length <= 4 ? 1 : 2;

  for (const word of vocabulary) {
    // Skip comparisons that can't possibly beat the current best
    if (Math.abs(word.length - token.length) > maxAllowedDistance) continue;
    const distance = natural.LevenshteinDistance(token, word);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestMatch = word;
    }
  }

  return bestDistance <= maxAllowedDistance ? bestMatch : token;
}

/**
 * Correct spelling for every token in a list against a vocabulary.
 * @param {string[]} tokens
 * @param {Set<string>} vocabulary
 */
function correctSpelling(tokens, vocabulary) {
  if (!vocabulary || vocabulary.size === 0) return tokens;
  return tokens.map((t) => correctToken(t, vocabulary));
}

/**
 * Full preprocessing pipeline: lowercase -> strip punctuation -> tokenize
 * -> spell-correct -> remove stopwords -> stem.
 * @param {string} text
 * @param {Set<string>} [vocabulary] optional vocabulary for spell correction
 * @returns {{ tokens: string[], stems: string[], cleanedText: string }}
 */
function preprocess(text, vocabulary) {
  const lowered = toLowerCase(text || '');
  const cleaned = removePunctuation(lowered);
  let tokens = tokenize(cleaned);

  if (vocabulary) {
    tokens = correctSpelling(tokens, vocabulary);
  }

  const meaningfulTokens = removeStopwords(tokens);
  const stems = meaningfulTokens.map(stem);

  return {
    tokens: meaningfulTokens,
    stems,
    cleanedText: meaningfulTokens.join(' '),
  };
}

module.exports = {
  toLowerCase,
  removePunctuation,
  removeStopwords,
  buildVocabulary,
  correctToken,
  correctSpelling,
  preprocess,
};
