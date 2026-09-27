/**
 * chatbot.test.js
 * ---------------
 * Covers:
 *  - Intent classification for core intents (greeting, working_hours, services)
 *  - Fallback behavior for unknown/gibberish queries
 *  - NLP preprocessing (lowercasing, punctuation removal, stopword removal)
 *  - The /api/chat and /api/health endpoints, including validation errors
 */

const request = require('supertest');
const app = require('../server');
const { classifyIntent } = require('../src/nlp/intentClassifier');
const { preprocess } = require('../src/nlp/preprocessor');
const { extractEntities } = require('../src/nlp/entityExtractor');
const chatbotService = require('../src/services/chatbotService');

describe('NLP preprocessing', () => {
  test('lowercases and strips punctuation', () => {
    const result = preprocess('Hello, World!!!');
    expect(result.cleanedText).not.toMatch(/[A-Z]/);
    expect(result.cleanedText).not.toMatch(/[,!]/);
  });

  test('removes stopwords but keeps meaningful tokens', () => {
    const result = preprocess('what is the price of your service');
    expect(result.tokens).toContain('what');
    expect(result.tokens).not.toContain('is');
    expect(result.tokens).not.toContain('the');
  });

  test('handles empty input without throwing', () => {
    expect(() => preprocess('')).not.toThrow();
    const result = preprocess('');
    expect(result.cleanedText).toBe('');
  });
});

describe('Entity extraction', () => {
  test('extracts an email address', () => {
    const entities = extractEntities('you can reach me at jane.doe@example.com');
    expect(entities.emails).toContain('jane.doe@example.com');
  });

  test('extracts an order id', () => {
    const entities = extractEntities('please check order #A1234 for me');
    expect(entities.orderIds.length).toBeGreaterThan(0);
  });

  test('extracts a monetary amount', () => {
    const entities = extractEntities('the plan costs $499.99');
    expect(entities.amounts).toContain('$499.99');
  });
});

describe('Intent classification', () => {
  test('detects greeting intent', () => {
    const result = classifyIntent('hello there');
    expect(result.intent).toBe('greeting');
  });

  test('detects working_hours intent from a phrasing variant', () => {
    const result = classifyIntent('hey, what time do you guys open?');
    expect(result.intent).toBe('working_hours');
  });

  test('detects working_hours intent from a differently worded query', () => {
    const result = classifyIntent('when are you available');
    expect(result.intent).toBe('working_hours');
  });

  test('detects services intent', () => {
    const result = classifyIntent('what services do you offer');
    expect(result.intent).toBe('services');
  });

  test('detects add-task intent instead of goodbye', () => {
    const result = classifyIntent('add a task for me');
    expect(result.intent).toBe('add_task');
  });

  test('falls back on unrecognizable input', () => {
    const result = classifyIntent('asdkjhasd qweoiqwe zxcvzxcv');
    expect(result.intent).toBe('fallback');
  });

  test('returns a confidence score between 0 and 1', () => {
    const result = classifyIntent('hi');
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });
});

describe('GET /api/health', () => {
  test('returns 200 and status ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('POST /api/chat', () => {
  test('returns a reply, intent, and confidence for a valid message', async () => {
    const res = await request(app)
      .post('/api/chat')
      .send({ message: 'hello' })
      .set('Content-Type', 'application/json');

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('reply');
    expect(res.body).toHaveProperty('intent');
    expect(res.body).toHaveProperty('confidence');
    expect(res.body.intent).toBe('greeting');
  });

  test('adds a task when the title is provided in the follow-up message', async () => {
    const createdTasks = [];
    chatbotService.configureTaskCreator((title) => {
      const task = { title };
      createdTasks.push(task);
      return task;
    });

    const sessionId = 'test-session-add-task-follow-up';
    const prompt = await request(app)
      .post('/api/chat')
      .set('x-session-id', sessionId)
      .send({ message: 'add a task for me' });
    expect(prompt.body.intent).toBe('add_task');
    expect(prompt.body.reply).toContain('What task');

    const result = await request(app)
      .post('/api/chat')
      .set('x-session-id', sessionId)
      .send({ message: 'buy groceries' });

    expect(result.body.intent).toBe('add_task');
    expect(result.body.reply).toContain('buy groceries');
    expect(result.body.task).toEqual({ title: 'buy groceries' });
    expect(createdTasks).toEqual([{ title: 'buy groceries' }]);
    chatbotService.configureTaskCreator(null);
  });

  test('supports listing, completing, and deleting tasks through chat', async () => {
    const tasks = [
      { id: 1, title: 'Buy milk', completed: false },
      { id: 2, title: 'Read notes', completed: false },
    ];
    chatbotService.configureTaskActions({
      list: () => tasks.filter((task) => !task.completed),
      complete: (reference) => {
        const task = tasks.find((candidate) => candidate.title.toLowerCase().includes(reference.toLowerCase()));
        if (task) task.completed = true;
        return task || null;
      },
      delete: (reference) => {
        const index = tasks.findIndex((candidate) => candidate.title.toLowerCase().includes(reference.toLowerCase()));
        return index === -1 ? null : tasks.splice(index, 1)[0];
      },
    });

    const list = await request(app).post('/api/chat').send({ message: 'show my tasks' });
    expect(list.body.intent).toBe('list_tasks');
    expect(list.body.reply).toContain('Buy milk');

    const completePrompt = await request(app)
      .post('/api/chat')
      .set('x-session-id', 'test-session-complete-task')
      .send({ message: 'complete a task' });
    expect(completePrompt.body.reply).toContain('Which task');

    const complete = await request(app)
      .post('/api/chat')
      .set('x-session-id', 'test-session-complete-task')
      .send({ message: 'Buy milk' });
    expect(complete.body.intent).toBe('complete_task');
    expect(complete.body.changedTask.title).toBe('Buy milk');

    const deleted = await request(app).post('/api/chat').send({ message: 'delete task Read notes' });
    expect(deleted.body.intent).toBe('delete_task');
    expect(deleted.body.changedTask.title).toBe('Read notes');
    expect(tasks).toEqual([{ id: 1, title: 'Buy milk', completed: true }]);
    chatbotService.configureTaskActions(null);
  });

  test('rejects an empty message with 400', async () => {
    const res = await request(app).post('/api/chat').send({ message: '' });
    expect(res.statusCode).toBe(400);
  });

  test('rejects a missing message field with 400', async () => {
    const res = await request(app).post('/api/chat').send({});
    expect(res.statusCode).toBe(400);
  });

  test('rejects an excessively long message with 400', async () => {
    const longMessage = 'a'.repeat(600);
    const res = await request(app).post('/api/chat').send({ message: longMessage });
    expect(res.statusCode).toBe(400);
  });

  test('rejects a non-string message with 400', async () => {
    const res = await request(app).post('/api/chat').send({ message: 12345 });
    expect(res.statusCode).toBe(400);
  });

  test('maintains context across two related messages in one session', async () => {
    const sessionId = 'test-session-context-1';

    const first = await request(app)
      .post('/api/chat')
      .set('x-session-id', sessionId)
      .send({ message: 'what are your services' });
    expect(first.body.intent).toBe('services');

    const second = await request(app)
      .post('/api/chat')
      .set('x-session-id', sessionId)
      .send({ message: 'how much does it cost' });
    expect(second.body.intent).toBe('pricing');
    expect(second.body.reply.toLowerCase()).toContain('service');
  });

  test('strips basic HTML from the message (sanitization)', async () => {
    const res = await request(app)
      .post('/api/chat')
      .send({ message: '<script>alert(1)</script> hello' });
    expect(res.statusCode).toBe(200);
    expect(res.body.reply).not.toContain('<script>');
  });
});

describe('DELETE /api/chat/session', () => {
  test('clears session context successfully', async () => {
    const res = await request(app)
      .delete('/api/chat/session')
      .set('x-session-id', 'test-session-clear-1');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('message');
  });
});

describe('404 handling', () => {
  test('returns 404 for an unknown route', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.statusCode).toBe(404);
  });
});
