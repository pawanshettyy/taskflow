const request = require('supertest');
const app = require('../app');

async function registerUser(name) {
  const response = await request(app)
    .post('/auth/register')
    .type('form')
    .send({ name, email: `${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}@example.com`, password: 'password123' });
  expect(response.statusCode).toBe(302);
  return response.headers['set-cookie'][0].split(';')[0];
}

describe('authentication and personal workspace', () => {
  test('redirects unauthenticated users to login', async () => {
    const response = await request(app).get('/');
    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe('/auth/login');
  });

  test('keeps tasks private and renders calendar/profile data', async () => {
    const firstCookie = await registerUser('First User');
    const secondCookie = await registerUser('Second User');

    const created = await request(app)
      .post('/tasks')
      .set('Cookie', firstCookie)
      .type('form')
      .send({ title: 'Private planning task', dueDate: '2099-12-25' });
    expect(created.statusCode).toBe(302);

    const firstHome = await request(app).get('/').set('Cookie', firstCookie);
    expect(firstHome.text).toContain('Private planning task');
    expect(firstHome.text).toContain('First User');

    const secondHome = await request(app).get('/').set('Cookie', secondCookie);
    expect(secondHome.text).not.toContain('Private planning task');

    const calendar = await request(app).get('/calendar?month=2099-12').set('Cookie', firstCookie);
    expect(calendar.statusCode).toBe(200);
    expect(calendar.text).toContain('Private planning task');

    const profile = await request(app).get('/profile').set('Cookie', firstCookie);
    expect(profile.statusCode).toBe(200);
    expect(profile.text).toContain('First User');
    expect(profile.text).toContain('Total tasks');
  });

  test('adds a dated personal task through the authenticated chatbot', async () => {
    const cookie = await registerUser('Chat Calendar User');
    const chatSessionId = `chat-calendar-${Date.now()}`;
    const response = await request(app)
      .post('/api/chat')
      .set('Cookie', cookie)
      .set('x-session-id', chatSessionId)
      .send({ message: 'add a task to review calendar plans due 2099-12-25' });

    expect(response.statusCode).toBe(200);
    expect(response.body.intent).toBe('add_task');
    expect(response.body.task.title).toBe('review calendar plans');
    expect(response.body.task.dueDate).toBe('2099-12-25');

    const calendar = await request(app).get('/calendar?month=2099-12').set('Cookie', cookie);
    expect(calendar.text).toContain('review calendar plans');
  });
});