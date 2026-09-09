$(function () {
  "use strict";
  /* ========================================
       ELEMENTS
    ======================================== */
  const $window = $(window);
  const $html = $("html");
  const $sections = $("main section");
  const $navLinks = $(".nav-list a");
  const $about = $("#about");
  const $aboutBody = $(".about-body");
  const $paragraphs = $aboutBody.find("p");
  const $projectsGrid = $("#github-projects");
  const $themeToggle = $("#theme-toggle");
  const $themeColor = $("#theme-color");
  const $contactForm = $(".contact-form");
  const $contactButton = $(".contact-button");
  const $formStatus = $(".form-status");
  /* ========================================
       SETTINGS
    ======================================== */
  const MOBILE_BREAKPOINT = 800;
  const ABOUT_MIN_STEP = 110;
  const ABOUT_MAX_STEP = 165;
  const SCROLL_DURATION = 750;
  const REVEAL_THRESHOLD = 0.08;
  const REVEAL_ROOT_MARGIN = "0px 0px -8% 0px";
  const GITHUB_USERNAME = "bahruzmammad";
  const GITHUB_API_URL =
    `https://api.github.com/users/${GITHUB_USERNAME}/repos` +
    "?sort=updated&direction=desc&per_page=12";
  const THEME_KEY = "theme";
  let ticking = false;
  let resizeTimer = null;
  let revealObserver = null;
  /* ========================================
       HELPERS
    ======================================== */
  function isMobile() {
    return window.innerWidth <= MOBILE_BREAKPOINT;
  }
  function getHeaderHeight() {
    return $(".header-nav").outerHeight() || 64;
  }
  function clamp(value, min, max) {
    return Math.max(min, Math.min(value, max));
  }
  function getAboutStep() {
    const viewportHeight = $window.height();
    return clamp(viewportHeight * 0.16, ABOUT_MIN_STEP, ABOUT_MAX_STEP);
  }
  function escapeHtml(value) {
    if (value === null || value === undefined) {
      return "";
    }
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
  function formatRepositoryName(name) {
    return name
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, function (letter) {
        return letter.toUpperCase();
      });
  }
  /* ========================================
       THEME
    ======================================== */
  function getSystemTheme() {
    if (
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    ) {
      return "dark";
    }
    return "light";
  }
  function getStoredTheme() {
    try {
      const savedTheme = localStorage.getItem(THEME_KEY);
      if (savedTheme === "dark" || savedTheme === "light") {
        return savedTheme;
      }
    } catch (error) {
      console.warn("Unable to access localStorage:", error);
    }
    return null;
  }
  function getCurrentTheme() {
    return getStoredTheme() || getSystemTheme();
  }
  function updateThemeMeta(theme) {
    if (!$themeColor.length) {
      return;
    }
    $themeColor.attr("content", theme === "dark" ? "#000000" : "#ffffff");
  }
  function updateThemeButton(theme) {
    if (!$themeToggle.length) {
      return;
    }
    const isDark = theme === "dark";
    const $icon = $themeToggle.find(".theme-icon");
    /*
     * Light mode  -> moon icon
     * Dark mode   -> sun icon
     */
    $icon.text(isDark ? "☀" : "☾");
    $themeToggle.attr("aria-pressed", String(isDark));
    $themeToggle.attr(
      "aria-label",
      isDark ? "Switch to light mode" : "Switch to dark mode",
    );
    $themeToggle.attr(
      "title",
      isDark ? "Switch to light mode" : "Switch to dark mode",
    );
  }
  function applyTheme(theme) {
    const safeTheme = theme === "dark" ? "dark" : "light";
    $html.attr("data-theme", safeTheme);
    updateThemeMeta(safeTheme);
    updateThemeButton(safeTheme);
  }
  function initializeTheme() {
    applyTheme(getCurrentTheme());
  }
  function saveTheme(theme) {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (error) {
      console.warn("Unable to save theme preference:", error);
    }
  }
  function toggleTheme() {
    const currentTheme = $html.attr("data-theme") === "dark" ? "dark" : "light";
    const nextTheme = currentTheme === "dark" ? "light" : "dark";
    saveTheme(nextTheme);
    applyTheme(nextTheme);
  }
  if ($themeToggle.length) {
    $themeToggle.on("click", toggleTheme);
  }
  /*
   * Follow system preference only when
   * the user has not manually selected
   * a theme.
   */
  if (window.matchMedia) {
    const colorScheme = window.matchMedia("(prefers-color-scheme: dark)");
    function handleSystemThemeChange(event) {
      if (getStoredTheme()) {
        return;
      }
      applyTheme(event.matches ? "dark" : "light");
    }
    if (typeof colorScheme.addEventListener === "function") {
      colorScheme.addEventListener("change", handleSystemThemeChange);
    } else if (typeof colorScheme.addListener === "function") {
      colorScheme.addListener(handleSystemThemeChange);
    }
  }
  /* ========================================
       GITHUB API
    ======================================== */
  function getGitHubRepos() {
    if (!$projectsGrid.length) {
      return;
    }
    $projectsGrid.attr("aria-busy", "true");
    $projectsGrid.html(`
            <article class="project-card github-loading">
                <div class="project-content">
                    <span class="project-number">
                        —
                    </span>
                    <h3>
                        Loading projects...
                    </h3>
                    <p>
                        Fetching repositories from GitHub.
                    </p>
                    <div class="project-tech">
                        <span>
                            GitHub API
                        </span>
                    </div>
                </div>
            </article>
        `);
    fetch(GITHUB_API_URL, {
      method: "GET",
      headers: {
        Accept: "application/vnd.github+json",
      },
    })
      .then(function (response) {
        if (!response.ok) {
          throw new Error(`GitHub API error: ${response.status}`);
        }
        return response.json();
      })
      .then(function (repos) {
        if (!Array.isArray(repos)) {
          throw new Error("Invalid GitHub API response.");
        }
        const projects = repos
          .filter(function (repo) {
            return !repo.fork && !repo.archived;
          })
          .slice(0, 9);
        renderGitHubProjects(projects);
      })
      .catch(function (error) {
        console.error("GitHub API:", error);
        renderGitHubError();
      });
  }
  /* ========================================
       RENDER GITHUB PROJECTS
    ======================================== */
  function renderGitHubProjects(repos) {
    if (!$projectsGrid.length) {
      return;
    }
    /*
     * No repositories.
     */
    if (!repos.length) {
      $projectsGrid.html(`
                <article class="project-card reveal visible">
                    <div class="project-content">
                        <span class="project-number">
                            —
                        </span>
                        <h3>
                            No projects found
                        </h3>
                        <p>
                            No public GitHub repositories are available.
                        </p>
                        <div class="project-tech">
                            <span>
                                GitHub
                            </span>
                        </div>
                        <a
                            class="project-link"
                            href="https://github.com/${GITHUB_USERNAME}"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            View GitHub →
                        </a>
                    </div>
                </article>
            `);
      $projectsGrid.attr("aria-busy", "false");
      return;
    }
    /*
     * Build project cards.
     */
    const html = repos
      .map(function (repo, index) {
        const number = String(index + 1).padStart(2, "0");
        const formattedName = formatRepositoryName(repo.name);
        const name = escapeHtml(formattedName);
        const description = escapeHtml(repo.description || "GitHub project.");
        const language = repo.language ? escapeHtml(repo.language) : "Code";
        const stars = Number(repo.stargazers_count) || 0;
        const githubUrl = escapeHtml(repo.html_url);
        return `
                        <article
                            class="project-card reveal"
                        >
                            <div class="project-content">
                                <span class="project-number">
                                    ${number}
                                </span>
                                <h3>
                                    ${name}
                                </h3>
                                <p>
                                    ${description}
                                </p>
                                <div class="project-tech">
                                    <span>
                                        ${language}
                                    </span>
                                    ${
                                      stars > 0 ? `<span>★ ${stars}</span>` : ""
                                    }
                                </div>
                                <a
                                    class="project-link"
                                    href="${githubUrl}"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    aria-label="View ${name} on GitHub"
                                >
                                    View Project →
                                </a>
                            </div>
                        </article>
                    `;
      })
      .join("");
    $projectsGrid.html(html);
    $projectsGrid.attr("aria-busy", "false");
    /*
     * Allow the browser to paint
     * the new cards before observing.
     */
    window.requestAnimationFrame(function () {
      setupRevealObserver();
      setupProjectHover();
    });
  }
  /* ========================================
       GITHUB ERROR
    ======================================== */
  function renderGitHubError() {
    if (!$projectsGrid.length) {
      return;
    }
    $projectsGrid.html(`
            <article class="project-card reveal visible">
                <div class="project-content">
                    <span class="project-number">
                        —
                    </span>
                    <h3>
                        Projects unavailable
                    </h3>
                    <p>
                        GitHub projects could not be loaded right now.
                    </p>
                    <div class="project-tech">
                        <span>
                            GitHub
                        </span>
                    </div>
                    <a
                        class="project-link"
                        href="https://github.com/${GITHUB_USERNAME}"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        Open GitHub →
                    </a>
                </div>
            </article>
        `);
    $projectsGrid.attr("aria-busy", "false");
  }
  /* ========================================
       ABOUT HEIGHT
    ======================================== */
  function updateAboutHeight() {
    if (!$about.length) {
      return;
    }
    /*
     * Sticky About is disabled
     * on mobile devices.
     */
    if (isMobile()) {
      $about.css("height", "auto");
      return;
    }
    if (!$paragraphs.length) {
      $about.css("height", "auto");
      return;
    }
    const viewportHeight = $window.height();
    const step = getAboutStep();
    /*
     * Add enough scroll space
     * for each paragraph.
     */
    const extraHeight = Math.max(0, $paragraphs.length - 1) * step;
    const sectionHeight = viewportHeight + extraHeight + getHeaderHeight();
    $about.css("height", `${sectionHeight}px`);
  }
  /* ========================================
       ABOUT PARAGRAPH STATE
    ======================================== */
  function updateAboutParagraphs() {
    if (!$about.length || !$paragraphs.length) {
      return;
    }
    /*
     * Mobile:
     * show the first paragraph.
     */
    if (isMobile()) {
      $paragraphs.removeClass("active").first().addClass("active");
      return;
    }
    const aboutOffset = $about.offset();
    if (!aboutOffset) {
      return;
    }
    const scrollTop = $window.scrollTop();
    const relativeScroll = scrollTop - aboutOffset.top;
    /*
     * Before About begins.
     */
    if (relativeScroll <= 0) {
      $paragraphs.removeClass("active").first().addClass("active");
      return;
    }
    const step = getAboutStep();
    let activeIndex = Math.floor(relativeScroll / step);
    activeIndex = clamp(activeIndex, 0, $paragraphs.length - 1);
    $paragraphs.each(function (index) {
      const $paragraph = $(this);
      const shouldBeActive = index === activeIndex;
      if ($paragraph.hasClass("active") !== shouldBeActive) {
        $paragraph.toggleClass("active", shouldBeActive);
      }
    });
  }
  /* ========================================
       ACTIVE NAVIGATION
    ======================================== */
  function updateActiveNav() {
    if (!$sections.length || !$navLinks.length) {
      return;
    }
    const scrollTop = $window.scrollTop();
    const viewportHeight = $window.height();
    const marker = scrollTop + getHeaderHeight() + viewportHeight * 0.3;
    let currentId = "";
    $sections.each(function () {
      const $section = $(this);
      const offset = $section.offset();
      if (!offset) {
        return;
      }
      const top = offset.top;
      const bottom = top + $section.outerHeight();
      if (marker >= top && marker < bottom) {
        currentId = $section.attr("id");
      }
    });
    /*
     * Home fallback.
     */
    if (!currentId) {
      const $home = $("#home");
      if ($home.length) {
        const homeOffset = $home.offset();
        if (homeOffset && scrollTop < homeOffset.top + $home.outerHeight()) {
          currentId = "home";
        }
      }
    }
    /*
     * Final fallback.
     */
    if (!currentId && $sections.length) {
      currentId = $sections.last().attr("id");
    }
    $navLinks.removeClass("active");
    if (currentId) {
      $navLinks.filter(`[href="#${currentId}"]`).addClass("active");
    }
  }
  /* ========================================
       SMOOTH NAVIGATION
    ======================================== */
  $navLinks.on("click", function (event) {
    const href = $(this).attr("href");
    if (!href || href === "#" || !href.startsWith("#")) {
      return;
    }
    const $target = $(href);
    if (!$target.length) {
      return;
    }
    const targetOffset = $target.offset();
    if (!targetOffset) {
      return;
    }
    event.preventDefault();
    const targetTop = Math.max(0, targetOffset.top - getHeaderHeight());
    $("html, body").stop(true, false).animate(
      {
        scrollTop: targetTop,
      },
      SCROLL_DURATION,
      "swing",
    );
  });
  /* ========================================
       REVEAL OBSERVER
    ======================================== */
  function setupRevealObserver() {
    if (revealObserver) {
      revealObserver.disconnect();
      revealObserver = null;
    }
    const $elements = $(".reveal");
    if (!$elements.length) {
      return;
    }
    /*
     * Fallback when IntersectionObserver
     * is not supported.
     */
    if (!("IntersectionObserver" in window)) {
      $elements.addClass("visible");
      return;
    }
    revealObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) {
            return;
          }
          const $element = $(entry.target);
          $element.addClass("visible");
          revealObserver.unobserve(entry.target);
        });
      },
      {
        threshold: REVEAL_THRESHOLD,
        rootMargin: REVEAL_ROOT_MARGIN,
      },
    );
    $elements.each(function () {
      const $element = $(this);
      if ($element.hasClass("visible")) {
        return;
      }
      revealObserver.observe(this);
    });
  }
  /* ========================================
       PROJECT HOVER
    ======================================== */
  function setupProjectHover() {
    const $projectCards = $(".project-card");
    if (!$projectCards.length) {
      return;
    }
    /*
     * Remove old handlers first.
     */
    $projectCards.off(".projectHover");
    $projectCards.on("mouseenter.projectHover", function () {
      const $card = $(this);
      const $techItems = $card.find(".project-tech span");
      $techItems.each(function (index) {
        $(this).css("transition-delay", `${index * 35}ms`);
      });
    });
    $projectCards.on("mouseleave.projectHover", function () {
      $(this).find(".project-tech span").css("transition-delay", "0ms");
    });
  }
  /* ========================================
       CONTACT FORM
    ======================================== */
  $contactForm.on("submit", function (event) {
    event.preventDefault();
    const form = this;
    /*
     * Browser-native validation.
     */
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    const originalText = $contactButton.text();
    $contactButton.prop("disabled", true).text("Sending...");
    $formStatus.text("");
    /*
     * Simulated request.
     */
    window.setTimeout(function () {
      $contactButton.prop("disabled", false).text("Message Sent ✓");
      $formStatus.text("Your message has been prepared successfully.");
      form.reset();
      window.setTimeout(function () {
        $contactButton.text(originalText);
        $formStatus.text("");
      }, 3000);
    }, 1000);
  });
  /* ========================================
       SCROLL
    ======================================== */
  function handleScroll() {
    if (ticking) {
      return;
    }
    ticking = true;
    window.requestAnimationFrame(function () {
      updateAboutParagraphs();
      updateActiveNav();
      ticking = false;
    });
  }
  $window.on("scroll", handleScroll);
  /* ========================================
       RESIZE
    ======================================== */
  $window.on("resize", function () {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(function () {
      updateAboutHeight();
      updateAboutParagraphs();
      updateActiveNav();
    }, 150);
  });
  /* ========================================
       INITIALIZE
    ======================================== */
  function initialize() {
    initializeTheme();
    updateAboutHeight();
    updateAboutParagraphs();
    updateActiveNav();
    window.requestAnimationFrame(function () {
      setupRevealObserver();
      setupProjectHover();
    });
    getGitHubRepos();
  }
  /* ========================================
       START
    ======================================== */
  initialize();
});
