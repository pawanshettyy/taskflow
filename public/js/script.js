// script.js
// Small client-side touches for TaskFlow.
// The app works fully without JavaScript (forms post normally),
// this file just adds a couple of nice-to-have UX details.

document.addEventListener("DOMContentLoaded", () => {
  // Auto-focus the "add task" input so users can start typing immediately
  const input = document.querySelector(".add-task-form input");
  if (input) {
    input.focus();
  }

  // Gentle confirmation before deleting a task
  document.querySelectorAll(".delete-form").forEach((form) => {
    form.addEventListener("submit", (e) => {
      const confirmed = confirm("Delete this task?");
      if (!confirmed) {
        e.preventDefault();
      }
    });
  });
});
