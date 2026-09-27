(function () {
  "use strict";

  var root = document.getElementById("chatWidgetRoot");
  if (!root) return;

  var launcher = root.querySelector(".cw-launcher");
  var iframe = root.querySelector("iframe");
  var loaded = false;

  launcher.addEventListener("click", function () {
    var isOpen = root.classList.toggle("cw-open");

    // Lazy-load the chatbot iframe only on first open, so it never
    // costs anything on pages where the user never opens the widget.
    if (isOpen && !loaded) {
      iframe.src = iframe.getAttribute("data-src");
      loaded = true;
    }

    launcher.setAttribute("aria-expanded", isOpen ? "true" : "false");
  });
})();
