const request = require('supertest');
const app = require('../app');

async function registerUser(name) {
  const response = await request(app)
    .post('/auth/register')
    .type('form')
    .send({ name, email: `${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}@example.com`, password: 'password123' });
  expect(response.statusCode).toBe(302);
  const cookies = response.headers['set-cookie'].map((cookie) => cookie.split(';')[0]);
  return { cookie: cookies.join('; '), csrf: cookies.find((cookie) => cookie.startsWith('taskflow_csrf='))?.slice('taskflow_csrf='.length) };
}

describe('authentication and personal workspace', () => {
  test('redirects unauthenticated users to login', async () => {
    const response = await request(app).get('/');
    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe('/auth/login');
  });

  test('rejects a task mutation without a CSRF token', async () => {
    const account = await registerUser('Csrf User');
    const response = await request(app)
      .post('/tasks')
      .set('Cookie', account.cookie)
      .type('form')
      .send({ title: 'Blocked task' });
    expect(response.statusCode).toBe(403);
  });

  test('allows an authenticated user to change their password', async () => {
    const account = await registerUser('Password User');
    const response = await request(app)
      .post('/profile/password')
      .set('Cookie', account.cookie)
      .type('form')
      .send({ currentPassword: 'password123', newPassword: 'newpassword123', _csrf: account.csrf });
    expect(response.statusCode).toBe(200);
    expect(response.text).toContain('Password updated successfully.');
  });

  test('keeps tasks private and renders calendar/profile data', async () => {
    const firstCookie = await registerUser('First User');
    const secondCookie = await registerUser('Second User');

    const created = await request(app)
      .post('/tasks')
      .set('Cookie', firstCookie.cookie)
      .type('form')
      .send({ title: 'Private planning task', dueDate: '2099-12-25', _csrf: firstCookie.csrf });
    expect(created.statusCode).toBe(302);

    const firstHome = await request(app).get('/').set('Cookie', firstCookie.cookie);
    expect(firstHome.text).toContain('Private planning task');
    expect(firstHome.text).toContain('First User');

    const secondHome = await request(app).get('/').set('Cookie', secondCookie.cookie);
    expect(secondHome.text).not.toContain('Private planning task');

    const calendar = await request(app).get('/calendar?month=2099-12').set('Cookie', firstCookie.cookie);
    expect(calendar.statusCode).toBe(200);
    expect(calendar.text).toContain('Private planning task');

    const profile = await request(app).get('/profile').set('Cookie', firstCookie.cookie);
    expect(profile.statusCode).toBe(200);
    expect(profile.text).toContain('First User');
    expect(profile.text).toContain('Total tasks');
  });

  test('adds a dated personal task through the authenticated chatbot', async () => {
    const cookie = await registerUser('Chat Calendar User');
    const chatSessionId = `chat-calendar-${Date.now()}`;
    const response = await request(app)
      .post('/api/chat')
      .set('Cookie', cookie.cookie)
      .set('x-csrf-token', cookie.csrf)
      .set('x-session-id', chatSessionId)
      .send({ message: 'add a task to review calendar plans due 2099-12-25' });

    expect(response.statusCode).toBe(200);
    expect(response.body.intent).toBe('add_task');
    expect(response.body.task.title).toBe('review calendar plans');
    expect(response.body.task.dueDate).toBe('2099-12-25');

    const calendar = await request(app).get('/calendar?month=2099-12').set('Cookie', cookie.cookie);
    expect(calendar.text).toContain('review calendar plans');

    const rescheduled = await request(app)
      .post('/api/chat')
      .set('Cookie', cookie.cookie)
      .set('x-csrf-token', cookie.csrf)
      .set('x-session-id', chatSessionId)
      .send({ message: 'reschedule task review calendar plans to 2099-12-30' });
    expect(rescheduled.body.intent).toBe('reschedule_task');
    expect(rescheduled.body.changedTask.dueDate).toBe('2099-12-30');

    const edited = await request(app)
      .post(`/tasks/${rescheduled.body.changedTask.id}/edit`)
      .set('Cookie', cookie.cookie)
      .type('form')
      .send({ title: 'Updated calendar plans', dueDate: '2099-12-31', _csrf: cookie.csrf });
    expect(edited.statusCode).toBe(302);
    const updatedCalendar = await request(app).get('/calendar?month=2099-12').set('Cookie', cookie.cookie);
    expect(updatedCalendar.text).toContain('Updated calendar plans');
  });
});