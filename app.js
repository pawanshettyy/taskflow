// app.js
// ------------------------------------------------------------
// TaskFlow - Smart Task Manager
// A simple Express.js server that renders an EJS view and
// manages a to-do list stored in memory (no database needed).
// ------------------------------------------------------------

const express = require("express");
const path = require("path");

// ------------------------------------------------------------
// NLP Chatbot integration (added)
// Loads env vars for the chatbot module (RATE_LIMIT_*, CORS_ORIGIN,
// CONFIDENCE_THRESHOLD, SESSION_TTL_MS). No-op if no .env file exists,
// so this has zero effect on TaskFlow's own behavior.
// See /chatbot for the original, self-contained chatbot project.
// ------------------------------------------------------------
require("dotenv").config();
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const chatRoutes = require("./chatbot/src/routes/chatRoutes");
const chatbotService = require("./chatbot/src/services/chatbotService");
const authStore = require("./src/auth/authStore");
const taskStore = require("./src/tasks/taskStore");
const { attachUser, requireAuth, setSessionCookie, clearSessionCookie } = require("./src/auth/authMiddleware");
const { notFoundHandler: chatbotNotFoundHandler, errorHandler: chatbotErrorHandler } = require("./chatbot/src/middleware/errorHandler");

const app = express();
const PORT = process.env.PORT || 3000;

// ------------------------------------------------------------
// In-memory "database"
// Users, sessions, and tasks are persisted in data/taskflow.sqlite.
// ------------------------------------------------------------
function getChatUserId(sessionId) {
  return authStore.getUserIdForChatSession(sessionId);
}

function userTasks(userId) {
  return taskStore.listTasks(userId);
}

chatbotService.configureTaskCreator((title, dueDate, chatSessionId) => {
  const userId = getChatUserId(chatSessionId);
  if (!userId) return null;
  return taskStore.createTask(userId, title, dueDate || null);
});

chatbotService.configureTaskActions({
  list: (chatSessionId) => {
    const userId = getChatUserId(chatSessionId);
    return userId ? userTasks(userId).filter((task) => !task.completed) : [];
  },
  complete: (reference, chatSessionId) => {
    const userId = getChatUserId(chatSessionId);
    return userId ? taskStore.setCompleted(userId, reference, true) : null;
  },
  delete: (reference, chatSessionId) => {
    const userId = getChatUserId(chatSessionId);
    return userId ? taskStore.deleteTask(userId, reference) : null;
  },
  reschedule: (reference, dueDate, chatSessionId) => {
    const userId = getChatUserId(chatSessionId);
    return userId ? taskStore.updateTask(userId, reference, { dueDate }) : null;
  },
});

// ------------------------------------------------------------
// Middleware
// ------------------------------------------------------------
app.set("view engine", "ejs");                 // Use EJS for templating
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: true })); // Parse form submissions (POST bodies)
app.use(express.static(path.join(__dirname, "public"))); // Serve CSS/JS from /public
app.use(attachUser);

// Link the chatbot's client session to the authenticated account before any
// chatbot task action is processed.
app.use("/api/chat", requireAuth, (req, res, next) => {
  authStore.linkChatSession(req.get("x-session-id"), req.user.id);
  next();
});

// ------------------------------------------------------------
// NLP Chatbot integration (added)
// Everything below is scoped to /api and /chatbot-widget only, so it
// cannot interfere with the "/", "/tasks" routes or the existing
// public/ assets above. Security middleware (helmet/cors/rate-limit)
// is applied only to /api, not the whole app, so it can't affect
// TaskFlow's existing pages (e.g. its Google Fonts links).
// ------------------------------------------------------------
const chatbotApiLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "TooManyRequests", message: "Too many requests. Please try again later." },
});

app.use(
  "/api",
  helmet(),
  cors({
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST", "DELETE"],
    allowedHeaders: ["Content-Type", "x-session-id"],
    exposedHeaders: ["x-session-id"],
  }),
  morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"),
  express.json({ limit: "10kb" }),
  chatbotApiLimiter,
  chatRoutes
);
app.use("/api", chatbotNotFoundHandler, chatbotErrorHandler);

// Serves the chatbot's self-contained widget UI (HTML/CSS/JS) used
// inside the floating chat iframe on the TaskFlow page. Namespaced
// under /chatbot-widget so it never collides with TaskFlow's own
// /css or /js static assets.
app.use("/chatbot-widget", express.static(path.join(__dirname, "chatbot", "public")));

// ------------------------------------------------------------
// Helper: compute stats used by the view (total/active/completed)
// ------------------------------------------------------------
function getStats(list) {
  const total = list.length;
  const completed = list.filter((t) => t.completed).length;
  const active = total - completed;
  return { total, completed, active };
}

// ------------------------------------------------------------
// ROUTES
// ------------------------------------------------------------

// GET / -> show all tasks (with optional ?filter=all|active|completed)
app.get("/auth/login", (req, res) => {
  if (req.user) return res.redirect("/");
  res.render("login", { error: null });
});

app.post("/auth/login", (req, res) => {
  const { email, password } = req.body;
  const user = authStore.verifyCredentials(email, password);
  if (!user) return res.status(401).render("login", { error: "Email or password is incorrect." });
  setSessionCookie(res, authStore.createSession(user.id));
  return res.redirect("/");
});

app.get("/auth/register", (req, res) => {
  if (req.user) return res.redirect("/");
  res.render("register", { error: null, values: {} });
});

app.post("/auth/register", (req, res) => {
  const values = { name: String(req.body.name || "").trim(), email: String(req.body.email || "").trim() };
  const password = String(req.body.password || "");
  if (values.name.length < 2 || !/^\S+@\S+\.\S+$/.test(values.email) || password.length < 8) {
    return res.status(400).render("register", {
      error: "Use a name, a valid email, and a password of at least 8 characters.",
      values,
    });
  }
  try {
    const user = authStore.createUser({ ...values, password });
    setSessionCookie(res, authStore.createSession(user.id));
    return res.redirect("/");
  } catch (error) {
    return res.status(409).render("register", { error: error.message, values });
  }
});

app.post("/auth/logout", (req, res) => {
  const token = req.headers.cookie?.split(";").map((value) => value.trim()).find((value) => value.startsWith("taskflow_session="));
  if (token) authStore.destroySession(decodeURIComponent(token.slice("taskflow_session=".length)));
  clearSessionCookie(res);
  res.redirect("/auth/login");
});

app.get("/", requireAuth, (req, res) => {
  const filter = req.query.filter || "all";

  const ownedTasks = userTasks(req.user.id);
  let visibleTasks = ownedTasks;
  if (filter === "active") {
    visibleTasks = ownedTasks.filter((t) => !t.completed);
  } else if (filter === "completed") {
    visibleTasks = ownedTasks.filter((t) => t.completed);
  }

  // Show the newest tasks first
  visibleTasks = [...visibleTasks].sort((a, b) => b.id - a.id);

  res.render("index", {
    tasks: visibleTasks,
    filter,
    stats: getStats(ownedTasks),
    user: req.user,
  });
});

app.get("/profile", requireAuth, (req, res) => {
  const ownedTasks = userTasks(req.user.id);
  res.render("profile", { user: req.user, stats: getStats(ownedTasks) });
});

app.get("/calendar", requireAuth, (req, res) => {
  const monthValue = /^\d{4}-\d{2}$/.test(req.query.month || "") ? req.query.month : new Date().toISOString().slice(0, 7);
  const [year, month] = monthValue.split("-").map(Number);
  const firstDay = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells = [];
  for (let index = 0; index < firstDay.getDay(); index += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = `${monthValue}-${String(day).padStart(2, "0")}`;
    cells.push({ day, date, tasks: userTasks(req.user.id).filter((task) => task.dueDate === date) });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  const previous = new Date(year, month - 2, 1).toISOString().slice(0, 7);
  const next = new Date(year, month, 1).toISOString().slice(0, 7);
  res.render("calendar", { user: req.user, monthValue, monthLabel: firstDay.toLocaleString("en-US", { month: "long", year: "numeric" }), cells, previous, next });
});

// POST /tasks -> add a new task
app.post("/tasks", requireAuth, (req, res) => {
  const title = (req.body.title || "").trim();

  if (title.length > 0) {
    taskStore.createTask(req.user.id, title, /^\d{4}-\d{2}-\d{2}$/.test(req.body.dueDate || "") ? req.body.dueDate : null);
  }

  res.redirect("/");
});

// POST /tasks/:id/complete -> toggle a task's completed state
app.post("/tasks/:id/complete", requireAuth, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const task = taskStore.findTask(req.user.id, String(id));

  if (task) {
    taskStore.setCompleted(req.user.id, String(id), !task.completed);
  }

  res.redirect(req.get("Referrer") || "/");
});

app.post("/tasks/:id/edit", requireAuth, (req, res) => {
  const title = String(req.body.title || "").trim();
  const dueDate = req.body.dueDate || null;
  if (title.length > 0) {
    taskStore.updateTask(req.user.id, String(req.params.id), { title, dueDate });
  }
  res.redirect(req.get("Referrer") || "/");
});

// POST /tasks/:id/delete -> remove a task
app.post("/tasks/:id/delete", requireAuth, (req, res) => {
  const id = parseInt(req.params.id, 10);
  taskStore.deleteTask(req.user.id, String(id));

  res.redirect(req.get("Referrer") || "/");
});

// ------------------------------------------------------------
// Start the server
// ------------------------------------------------------------
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`TaskFlow is running at http://localhost:${PORT}`);
  });
}

module.exports = app;
