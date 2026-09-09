$(function () {
  "use strict";
  /* ========================================
       ELEMENTS
    ======================================== */
  const $window = $(window);
  const $sections = $("main section");
  const $navLinks = $(".nav-list a");
  const $about = $("#about");
  const $aboutBody = $(".about-body");
  const $paragraphs = $aboutBody.find("p");
  const $revealElements = $(".reveal");
  const $projectCards = $(".project-card");
  const $contactForm = $(".contact-form");
  const $contactButton = $(".contact-button");
  const $formStatus = $(".form-status");
  /* ========================================
       SETTINGS
    ======================================== */
  const MOBILE_BREAKPOINT = 800;
  const ABOUT_MIN_STEP = 110;
  const ABOUT_MAX_STEP = 165;
  const SCROLL_DURATION = 900;
  const REVEAL_THRESHOLD = 0.03;
  const REVEAL_ROOT_MARGIN = "0px 0px -20px 0px";
  let ticking = false;
  let resizeTimer = null;
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
  /* ========================================
       ABOUT HEIGHT
    ======================================== */
  function updateAboutHeight() {
    if (!$about.length) {
      return;
    }
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
     * Extra scroll distance allows every
     * About paragraph to have enough time
     * to become active.
     */
    const extraHeight = $paragraphs.length * step;
    const sectionHeight = viewportHeight + extraHeight;
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
     * Mobile does not use sticky scrolling.
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
     * Before About.
     */
    if (relativeScroll <= 0) {
      $paragraphs.removeClass("active").first().addClass("active");
      return;
    }
    const step = getAboutStep();
    let activeIndex = Math.floor(relativeScroll / step);
    activeIndex = clamp(activeIndex, 0, $paragraphs.length - 1);
    $paragraphs.each(function (index) {
      $(this).toggleClass("active", index === activeIndex);
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
    const marker = scrollTop + getHeaderHeight() + $window.height() * 0.3;
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
      if (
        $home.length &&
        scrollTop < $home.offset().top + $home.outerHeight()
      ) {
        currentId = "home";
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
    event.preventDefault();
    const targetOffset = $target.offset();
    if (!targetOffset) {
      return;
    }
    const targetTop = Math.max(0, targetOffset.top - getHeaderHeight());
    $("html, body").stop(true).animate(
      {
        scrollTop: targetTop,
      },
      SCROLL_DURATION,
      "swing",
    );
  });
  /* ========================================
       REVEAL ON SCROLL
    ======================================== */
  function setupRevealObserver() {
    if (!$revealElements.length) {
      return;
    }
    /*
     * Fallback.
     */
    if (!("IntersectionObserver" in window)) {
      $revealElements.addClass("visible");
      return;
    }
    let revealIndex = 0;
    $revealElements.each(function () {
      const $element = $(this);
      /*
       * Small stagger between nearby
       * reveal elements.
       */
      $element.css("transition-delay", `${Math.min(revealIndex * 70, 280)}ms`);
      revealIndex++;
    });
    const observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) {
            return;
          }
          const $element = $(entry.target);
          /*
           * Make visible immediately
           * once the element enters the
           * viewport.
           */
          $element.addClass("visible");
          /*
           * Stop observing after the
           * first reveal.
           */
          observer.unobserve(entry.target);
        });
      },
      {
        threshold: REVEAL_THRESHOLD,
        rootMargin: REVEAL_ROOT_MARGIN,
      },
    );
    $revealElements.each(function () {
      observer.observe(this);
    });
  }
  /* ========================================
       PROJECT HOVER
    ======================================== */
  $projectCards.each(function () {
    const $card = $(this);
    const $techItems = $card.find(".project-tech span");
    $card.on("mouseenter", function () {
      $techItems.each(function (index) {
        $(this).css("transition-delay", `${index * 35}ms`);
      });
    });
    $card.on("mouseleave", function () {
      $techItems.css("transition-delay", "0ms");
    });
  });
  /* ========================================
       CONTACT FORM
    ======================================== */
  $contactForm.on("submit", function (event) {
    event.preventDefault();
    const form = this;
    /*
     * Native validation.
     */
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    const originalText = $contactButton.text();
    /*
     * Prevent duplicate submission.
     */
    $contactButton.prop("disabled", true).text("Sending...");
    $formStatus.text("");
    /*
     * Simulated sending state.
     */
    window.setTimeout(function () {
      $contactButton.prop("disabled", false).text("Message Sent ✓");
      $formStatus.text("Your message has been prepared successfully.");
      form.reset();
      /*
       * Keep success state visible
       * slightly longer.
       */
      window.setTimeout(function () {
        $contactButton.text(originalText);
        $formStatus.text("");
      }, 3000);
    }, 1000);
  });
  /* ========================================
       SCROLL HANDLER
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
    }, 200);
  });
  /* ========================================
       PAGE LOAD
    ======================================== */
  function initialize() {
    updateAboutHeight();
    updateAboutParagraphs();
    updateActiveNav();
    /*
     * Give layout a moment to settle before
     * starting viewport animations.
     */
    window.setTimeout(function () {
      setupRevealObserver();
    }, 80);
  }
  /* ========================================
       INITIALIZE
    ======================================== */
  initialize();
});
