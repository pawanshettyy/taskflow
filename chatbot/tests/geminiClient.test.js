const { buildPrompt } = require('../src/services/geminiClient');

describe('Gemini scope guard', () => {
  test('builds a prompt that limits answers to the local reference facts', () => {
    const prompt = buildPrompt({
      intent: 'services',
      message: 'what services do you offer?',
      referenceReply: 'We provide web development and software consulting services.',
    });

    expect(prompt).toContain('only source of facts');
    expect(prompt).toContain('what services do you offer?');
    expect(prompt).toContain('We provide web development and software consulting services.');
    expect(prompt).toContain('return the reference answer unchanged');
  });
});