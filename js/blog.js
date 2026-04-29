const searchToggle = document.querySelector("#searchToggle");
const searchPanel = document.querySelector("#searchPanel");
const searchInput = document.querySelector("#searchInput");

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
