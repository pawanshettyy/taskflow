# TaskFlow — Smart Task Manager

A clean, modern task manager built with **Node.js** and **Express.js**, created as a college practical to demonstrate full-stack web development alongside **Git version control** (branches, commits, merges).

> "Organize your day. Get things done."

## Description

TaskFlow lets you add tasks, mark them complete, delete them, and filter your list by All / Active / Completed. Data is kept in a simple in-memory array on the server, so there's no database setup required — the app is intentionally lightweight and easy to explain in a viva.

## Features

- Add new tasks through a simple input form
- Mark tasks as completed (with a strikethrough style)
- Delete tasks you no longer need
- Filter tasks: **All**, **Active**, **Completed**
- Live task counters (total / active / completed)
- Friendly empty-state message when a list is empty
- Fully responsive layout (desktop, tablet, mobile)
- Optional Gemini-powered response polishing for recognized chatbot intents, with local fallback and app-scope restrictions
- Clean, modern UI with a teal/amber color palette, custom typography, hover states and smooth transitions

## Technologies Used

| Layer      | Technology            |
|------------|------------------------|
| Runtime    | Node.js                |
| Framework  | Express.js              |
| Templating | EJS                     |
| Frontend   | HTML5, CSS3, JavaScript |
| Storage    | In-memory array (no DB) |
| Versioning | Git & GitHub            |

## Project Structure

```
taskflow/
│
├── public/
│   ├── css/
│   │   └── style.css      # All styling for the app
│   └── js/
│       └── script.js      # Small client-side enhancements
│
├── views/
│   └── index.ejs           # Main (and only) page template
│
├── app.js                  # Express server, routes, in-memory task data
├── package.json             # Project metadata and dependencies
├── .gitignore
└── README.md
```

## How to Install

```bash
git clone <YOUR_GITHUB_REPOSITORY_URL>
cd taskflow
npm install
```

## How to Run

```bash
npm start
```

Then open your browser at **http://localhost:3000**

### Optional Gemini support

Copy `.env.example` to `.env` and set `GEMINI_API_KEY` to enable Gemini responses. The chatbot sends Gemini only a recognized intent, the sanitized user message, and the local reference answer. Unknown intents never call Gemini, and network/API failures fall back to the built-in response generator.

## Routes

| Method | Route                    | Purpose                        |
|--------|---------------------------|---------------------------------|
| GET    | `/`                        | Show all tasks (supports `?filter=all\|active\|completed`) |
| POST   | `/tasks`                   | Add a new task                 |
| POST   | `/tasks/:id/complete`      | Toggle a task's completed state |
| POST   | `/tasks/:id/delete`        | Delete a task                  |

## Git Workflow Used

This project was built incrementally using feature branches merged into `main`:

1. `main` — initial project setup (Node.js + Express skeleton)
2. `feature/frontend` — initial HTML/EJS layout and styling → merged into `main`
3. `feature/task-functionality` — add/complete/delete task routes → merged into `main`
4. `feature/task-filter` — All/Active/Completed filtering → merged into `main`
5. `feature/ui-polish` — responsive design, hover states, empty state → merged into `main`
6. Final commit on `main` — documentation and cleanup

Key commands used throughout development: `git init`, `git status`, `git add`, `git commit`, `git branch`, `git switch`, `git merge`, `git log`, `git diff`. See the full command sequence in the project write-up provided alongside this README.

## Future Improvements

- Persist tasks to a real database (e.g. SQLite or MongoDB)
- Add due dates and priority levels
- Add drag-and-drop task reordering
- Add user accounts (basic authentication)
- Add unit tests for the Express routes
