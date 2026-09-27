const { extractTaskTitle, extractDueDate, extractTaskDetails, extractRescheduleDetails } = require('../src/services/taskActions');

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

  test('extracts an explicit due date and removes it from the title', () => {
    const details = extractTaskDetails('add a task to submit report due 2099-12-25');
    expect(details).toEqual({ title: 'submit report', dueDate: '2099-12-25' });
  });

  test('understands tomorrow for calendar scheduling', () => {
    expect(extractDueDate('add a task to call the dentist tomorrow', new Date(2099, 11, 24))).toBe('2099-12-25');
  });

  test('extracts a task reference and date from a reschedule command', () => {
    expect(extractRescheduleDetails('reschedule task submit report to 2099-12-30')).toEqual({
      reference: 'submit report',
      dueDate: '2099-12-30',
    });
  });
});