/**
 * tokenizer.js
 * ------------
 * Thin wrapper around the `natural` library's WordTokenizer and PorterStemmer.
 * Keeping this in its own module means the rest of the app never talks to
 * `natural` directly -- if we swap tokenization strategy later, only this
 * file needs to change.
 */

const natural = require('natural');

const wordTokenizer = new natural.WordTokenizer();

/**
 * Split a string into word tokens.
 * @param {string} text
 * @returns {string[]}
 */
function tokenize(text) {
  if (!text || typeof text !== 'string') return [];
  return wordTokenizer.tokenize(text) || [];
}

/**
 * Reduce a word to its stem (e.g. "running" -> "run").
 * Stemming helps the classifier generalize across word forms.
 * @param {string} word
 * @returns {string}
 */
function stem(word) {
  return natural.PorterStemmer.stem(word);
}

/**
 * Tokenize and stem in one step.
 * @param {string} text
 * @returns {string[]}
 */
function tokenizeAndStem(text) {
  return tokenize(text).map(stem);
}

module.exports = {
  tokenize,
  stem,
  tokenizeAndStem,
};
