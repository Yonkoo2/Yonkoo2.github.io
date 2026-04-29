const searchToggle = document.querySelector("#searchToggle");
const searchPanel = document.querySelector("#searchPanel");
const searchInput = document.querySelector("#searchInput");
const whoami = document.querySelector("#whoami");
const whoamiModal = document.querySelector("#whoamiModal");
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

if (whoami && whoamiModal && closeWhoami) {
  whoami.addEventListener("click", () => {
    whoamiModal.hidden = false;
  });

  closeWhoami.addEventListener("click", () => {
    whoamiModal.hidden = true;
  });

  whoamiModal.addEventListener("click", (event) => {
    if (event.target === whoamiModal) whoamiModal.hidden = true;
  });
}
