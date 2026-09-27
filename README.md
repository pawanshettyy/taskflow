# TaskFlow — Smart Task Manager

A clean, modern task manager built with **Node.js** and **Express.js**, created as a college practical to demonstrate full-stack web development alongside **Git version control** (branches, commits, merges).

> "Organize your day. Get things done."

## Description

TaskFlow lets you add tasks, mark them complete, delete them, and filter your list by All / Active / Completed. User accounts and tasks are persisted in a local SQLite database, keeping each user's workspace separate across server restarts.

## Features

- Add new tasks through a simple input form
- Mark tasks as completed (with a strikethrough style)
- Delete tasks you no longer need
- Filter tasks: **All**, **Active**, **Completed**
- Live task counters (total / active / completed)
- Friendly empty-state message when a list is empty
- Fully responsive layout (desktop, tablet, mobile)
- Account registration and login with separate personal workspaces
- Profile view with task statistics
- Calendar view for tasks with due dates
- Optional Gemini-powered response polishing for recognized chatbot intents, with local fallback and app-scope restrictions
- Embedded support chatbot can add, list, complete, and delete tasks through natural-language commands
- Clean, modern UI with a teal/amber color palette, custom typography, hover states and smooth transitions

## Technologies Used

| Layer      | Technology                        |
| ---------- | --------------------------------- |
| Runtime    | Node.js                           |
| Framework  | Express.js                        |
| Templating | EJS                               |
| Frontend   | HTML5, CSS3, JavaScript           |
| Storage    | SQLite database                   |
| Database   | SQLite (`data/taskflow.sqlite`) |
| Versioning | Git & GitHub                      |

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
│   ├── index.ejs           # Authenticated task list view
│   ├── calendar.ejs        # Monthly due-date calendar
│   ├── profile.ejs         # User profile and task statistics
│   ├── login.ejs           # Sign-in form
│   └── register.ejs        # Account creation form
│
├── app.js                  # Express server, routes, in-memory task data
├── chatbot/                # Integrated NLP chatbot and widget
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

Create an account from the sign-in page. Each account gets its own task list, calendar, and profile. SQLite stores accounts, sessions, chatbot ownership, and tasks in `data/taskflow.sqlite`.

### Optional Gemini support

Copy `.env.example` to `.env` and set `GEMINI_API_KEY` to enable Gemini response polishing. Gemini receives only recognized intents, the sanitized message, and the local reference answer. It cannot create or modify tasks, unknown intents never call it, and network/API failures fall back to local responses. Keep the key server-side and never commit it.

### Chatbot task commands

The support widget is connected to the same in-memory task list as the main app. Examples:

```text
add a task to buy groceries
add a task to review the report due 2026-10-05
show my tasks
complete a task       -> then provide the task name
delete task Read notes
reschedule task review calendar plans to 2026-10-12
```

After a task is added, completed, or deleted, the main page refreshes so the list and counters stay synchronized.

## Routes

| Method | Route                   | Purpose                                                    |
| ------ | ----------------------- | ---------------------------------------------------------- |
| GET    | `/`                   | Show all tasks (supports`?filter=all\|active\|completed`)  |
| POST   | `/tasks`              | Add a personal task, optionally with`dueDate=YYYY-MM-DD` |
| POST   | `/tasks/:id/complete` | Toggle a task's completed state                            |
| POST   | `/tasks/:id/delete`   | Delete a task                                              |
| GET    | `/calendar`           | Show the signed-in user's monthly calendar                 |
| GET    | `/profile`            | Show the signed-in user's profile and statistics           |
| GET    | `/auth/login`         | Sign-in page                                               |
| POST   | `/auth/login`         | Create an authenticated session                            |
| GET    | `/auth/register`      | Registration page                                          |
| POST   | `/auth/register`      | Create a user account                                      |
| POST   | `/auth/logout`        | End the current session                                    |

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
- Move SQLite to a managed production database and add automated backups
- Add unit tests for the Express routes
