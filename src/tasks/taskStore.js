const db = require('../db/database');

function mapTask(row) {
  return row && {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    completed: Boolean(row.completed),
    dueDate: row.due_date,
    createdAt: row.created_at,
  };
}

function listTasks(userId) {
  return db.prepare('SELECT * FROM tasks WHERE user_id = ? ORDER BY id DESC').all(userId).map(mapTask);
}

function createTask(userId, title, dueDate = null) {
  const createdAt = new Date().toISOString();
  const result = db.prepare(`
    INSERT INTO tasks (user_id, title, completed, due_date, created_at)
    VALUES (?, ?, 0, ?, ?)
  `).run(userId, title, dueDate, createdAt);
  return mapTask(db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid));
}

function findTask(userId, reference) {
  const normalized = String(reference || '').trim().toLowerCase();
  const idMatch = normalized.match(/^#?(\d+)$/);
  const row = idMatch
    ? db.prepare('SELECT * FROM tasks WHERE user_id = ? AND id = ?').get(userId, Number(idMatch[1]))
    : db.prepare(`
      SELECT * FROM tasks
      WHERE user_id = ? AND lower(title) LIKE ?
      ORDER BY CASE WHEN lower(title) = ? THEN 0 ELSE 1 END, id DESC
      LIMIT 1
    `).get(userId, `%${normalized}%`, normalized);
  return mapTask(row);
}

function setCompleted(userId, reference, completed = true) {
  const task = findTask(userId, reference);
  if (!task) return null;
  db.prepare('UPDATE tasks SET completed = ? WHERE id = ? AND user_id = ?').run(completed ? 1 : 0, task.id, userId);
  return findTask(userId, String(task.id));
}

function deleteTask(userId, reference) {
  const task = findTask(userId, reference);
  if (!task) return null;
  db.prepare('DELETE FROM tasks WHERE id = ? AND user_id = ?').run(task.id, userId);
  return task;
}

module.exports = { listTasks, createTask, findTask, setCompleted, deleteTask };