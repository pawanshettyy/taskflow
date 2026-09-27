const { extractTaskTitle } = require('../src/services/taskActions');

describe('Task action parsing', () => {
  test('extracts a title from an add-task request', () => {
    expect(extractTaskTitle('add a task to buy groceries')).toBe('buy groceries');
  });

  test('extracts a title from a reminder request', () => {
    expect(extractTaskTitle('remind me to call the dentist')).toBe('call the dentist');
  });

  test('returns an empty title when the request needs clarification', () => {
    expect(extractTaskTitle('add a task for me')).toBe('');
  });
});