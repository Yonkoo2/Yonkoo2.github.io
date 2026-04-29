const searchToggle = document.querySelector("#searchToggle");
const searchPanel = document.querySelector("#searchPanel");
const searchInput = document.querySelector("#searchInput");
const whoami = document.querySelector("#whoami");
const whoamiView = document.querySelector("#whoamiView");
const closeWhoami = document.querySelector("#closeWhoami");

if (searchToggle && searchPanel && searchInput) {
  searchToggle.addEventListener("click", () => {
    searchPanel.hidden = !searchPanel.hidden;
    if (!searchPanel.hidden) searchInput.focus();
  });

  searchInput.addEventListener("input", () => {
    const query = searchInput.value.trim().toLowerCase();
    document.querySelectorAll(".post-card").forEach((card) => {
      const haystack = [
        card.dataset.title || "",
        card.dataset.tags || "",
        card.dataset.category || "",
        card.textContent || "",
      ].join(" ").toLowerCase();
      card.hidden = Boolean(query) && !haystack.includes(query);
    });
  });
}

if (whoami && whoamiView && closeWhoami) {
  whoami.addEventListener("click", () => {
    whoamiView.hidden = false;
    const logo = whoamiView.querySelector(".whoami-logo");
    logo.classList.remove("spin-again");
    void logo.offsetWidth;
    logo.classList.add("spin-again");
  });

  closeWhoami.addEventListener("click", () => {
    whoamiView.hidden = true;
  });

  whoamiView.addEventListener("click", (event) => {
    if (event.target === whoamiView) whoamiView.hidden = true;
  });
}
