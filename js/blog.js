const posts = [
    {
        title: "Attacking SQL Databases",
        url: "/posts/attacking-sql-databases/",
        date: "2026-04-29",
        category: "Attacking Common Services",
        type: "CPTS",
        tags: ["SQL", "MySQL", "MSSQL", "Databases", "Pentesting"],
        excerpt: "A CPTS playbook for enumerating, attacking, and abusing SQL database services.",
    },
];

const postsMount = document.querySelector("#postsMount");
const recentMount = document.querySelector("#recentMount");
const tagMount = document.querySelector("#tagMount");
const searchToggle = document.querySelector("#searchToggle");
const searchPanel = document.querySelector("#searchPanel");
const searchInput = document.querySelector("#searchInput");
const whoami = document.querySelector("#whoami");
const whoamiView = document.querySelector("#whoamiView");
const closeWhoami = document.querySelector("#closeWhoami");

function unique(values) {
    return [...new Set(values)];
}

function allTags() {
    return unique(posts.flatMap((post) => post.tags)).sort();
}

function allCategories() {
    return unique(posts.map((post) => post.category)).sort();
}

function postMeta(post) {
    const tags = post.tags
        .map((tag) => `<a href="/tags/#${encodeURIComponent(tag)}"><i class="fa-solid fa-tag"></i> ${tag}</a>`)
        .join(" <span>›</span> ");
    return `
        <span><i class="fa-solid fa-calendar-days"></i> Created ${post.date}</span>
        <a href="/categories/#${encodeURIComponent(post.category)}"><i class="fa-solid fa-folder"></i> ${post.category}</a>
        <span><i class="fa-solid fa-bookmark"></i> ${post.type}</span>
        ${tags}
    `;
}

function renderPosts(list) {
    if (!list.length) {
        postsMount.innerHTML = `<div class="empty">No posts found.</div>`;
        return;
    }

    postsMount.innerHTML = list
        .map(
            (post) => `
            <article class="post-card">
                <a class="post-thumb" href="${post.url}">
                    <img src="/images/yonkoo-logo.png" alt="YonKoo logo" />
                </a>
                <div class="post-body">
                    <h2><a href="${post.url}">${post.title}</a></h2>
                    <div class="meta">${postMeta(post)}</div>
                    <p class="excerpt">${post.excerpt}</p>
                </div>
            </article>
        `,
        )
        .join("");
}

function renderSidebar() {
    document.querySelector("#articleCount").textContent = posts.length;
    document.querySelector("#tagCount").textContent = allTags().length;
    document.querySelector("#categoryCount").textContent = allCategories().length;

    recentMount.innerHTML = posts
        .slice(0, 5)
        .map(
            (post) => `
            <a class="recent-item" href="${post.url}">
                <img src="/images/yonkoo-logo.png" alt="" />
                <span><strong>${post.title}</strong><span>${post.date}</span></span>
            </a>
        `,
        )
        .join("");

    tagMount.innerHTML = allTags()
        .map((tag) => `<a class="chip" href="/tags/#${encodeURIComponent(tag)}">${tag}</a>`)
        .join("");
}

function filterPosts(query) {
    const q = query.trim().toLowerCase();
    if (!q) return posts;
    return posts.filter((post) => {
        const haystack = [post.title, post.category, post.type, post.excerpt, ...post.tags]
            .join(" ")
            .toLowerCase();
        return haystack.includes(q);
    });
}

searchToggle.addEventListener("click", () => {
    searchPanel.hidden = !searchPanel.hidden;
    if (!searchPanel.hidden) searchInput.focus();
});

searchInput.addEventListener("input", () => {
    renderPosts(filterPosts(searchInput.value));
});

whoami.addEventListener("click", () => {
    whoamiView.hidden = false;
    whoamiView.querySelector(".whoami-logo").classList.remove("spin-again");
    void whoamiView.querySelector(".whoami-logo").offsetWidth;
    whoamiView.querySelector(".whoami-logo").classList.add("spin-again");
});

closeWhoami.addEventListener("click", () => {
    whoamiView.hidden = true;
});

whoamiView.addEventListener("click", (event) => {
    if (event.target === whoamiView) whoamiView.hidden = true;
});

renderPosts(posts);
renderSidebar();
