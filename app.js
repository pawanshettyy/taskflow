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
const { notFoundHandler: chatbotNotFoundHandler, errorHandler: chatbotErrorHandler } = require("./chatbot/src/middleware/errorHandler");

const app = express();
const PORT = process.env.PORT || 3000;

// ------------------------------------------------------------
// In-memory "database"
// Each task looks like: { id, title, completed, createdAt }
// Using an array keeps the project beginner-friendly - data
// resets whenever the server restarts, which is fine for a
// college demo.
// ------------------------------------------------------------
let tasks = [
  { id: 1, title: "Prepare project viva slides", completed: false, createdAt: new Date() },
  { id: 2, title: "Push code to GitHub", completed: false, createdAt: new Date() },
  { id: 3, title: "Install Node.js and Express", completed: true, createdAt: new Date() },
];

// Keeps track of the next id to assign to a new task
let nextId = 4;

chatbotService.configureTaskCreator((title) => {
  const task = {
    id: nextId++,
    title,
    completed: false,
    createdAt: new Date(),
  };
  tasks.push(task);
  return task;
});

// ------------------------------------------------------------
// Middleware
// ------------------------------------------------------------
app.set("view engine", "ejs");                 // Use EJS for templating
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: true })); // Parse form submissions (POST bodies)
app.use(express.static(path.join(__dirname, "public"))); // Serve CSS/JS from /public

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
app.get("/", (req, res) => {
  const filter = req.query.filter || "all";

  let visibleTasks = tasks;
  if (filter === "active") {
    visibleTasks = tasks.filter((t) => !t.completed);
  } else if (filter === "completed") {
    visibleTasks = tasks.filter((t) => t.completed);
  }

  // Show the newest tasks first
  visibleTasks = [...visibleTasks].sort((a, b) => b.id - a.id);

  res.render("index", {
    tasks: visibleTasks,
    filter,
    stats: getStats(tasks),
  });
});

// POST /tasks -> add a new task
app.post("/tasks", (req, res) => {
  const title = (req.body.title || "").trim();

  if (title.length > 0) {
    tasks.push({
      id: nextId++,
      title,
      completed: false,
      createdAt: new Date(),
    });
  }

  res.redirect("/");
});

// POST /tasks/:id/complete -> toggle a task's completed state
app.post("/tasks/:id/complete", (req, res) => {
  const id = parseInt(req.params.id, 10);
  const task = tasks.find((t) => t.id === id);

  if (task) {
    task.completed = !task.completed;
  }

  res.redirect(req.get("Referrer") || "/");
});

// POST /tasks/:id/delete -> remove a task
app.post("/tasks/:id/delete", (req, res) => {
  const id = parseInt(req.params.id, 10);
  tasks = tasks.filter((t) => t.id !== id);

  res.redirect(req.get("Referrer") || "/");
});

// ------------------------------------------------------------
// Start the server
// ------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`TaskFlow is running at http://localhost:${PORT}`);
});
