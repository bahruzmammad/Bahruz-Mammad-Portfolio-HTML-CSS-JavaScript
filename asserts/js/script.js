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
  const $paragraphs = $(".about-body p");

  const $revealElements = $(".reveal");

  const $contactForm = $(".contact-form");
  const $contactButton = $(".contact-button");
  const $formStatus = $(".form-status");

  /* ========================================
       SETTINGS
    ======================================== */

  let ticking = false;

  const MOBILE_BREAKPOINT = 800;

  /* ========================================
       HEADER HEIGHT
    ======================================== */

  function getHeaderHeight() {
    return $(".header-nav").outerHeight() || 64;
  }

  /* ========================================
       ABOUT SCROLL HEIGHT
    ======================================== */

  function updateAboutHeight() {
    if (!$about.length || window.innerWidth <= MOBILE_BREAKPOINT) {
      $about.css({
        height: "auto",
      });

      return;
    }

    const paragraphCount = $paragraphs.length;

    if (!paragraphCount) {
      return;
    }

    const viewportHeight = $window.height();

    const step = Math.max(100, Math.min(150, viewportHeight * 0.16));

    const extraHeight = paragraphCount * step;

    const sectionHeight = viewportHeight + extraHeight;

    $about.css("height", `${sectionHeight}px`);
  }

  /* ========================================
       ABOUT PARAGRAPH ACTIVE
    ======================================== */

  function updateAboutParagraphs() {
    if (
      !$about.length ||
      !$paragraphs.length ||
      window.innerWidth <= MOBILE_BREAKPOINT
    ) {
      return;
    }

    const aboutTop = $about.offset().top;

    const scrollTop = $window.scrollTop();

    const relativeScroll = scrollTop - aboutTop;

    if (relativeScroll < 0) {
      $paragraphs.removeClass("active").first().addClass("active");

      return;
    }

    const viewportHeight = $window.height();

    const step = Math.max(100, Math.min(150, viewportHeight * 0.16));

    let activeIndex = Math.floor(relativeScroll / step);

    activeIndex = Math.max(0, Math.min(activeIndex, $paragraphs.length - 1));

    $paragraphs.each(function (index) {
      $(this).toggleClass("active", index === activeIndex);
    });
  }

  /* ========================================
       ACTIVE NAVIGATION
    ======================================== */

  function updateActiveNav() {
    const scrollTop = $window.scrollTop();

    const headerHeight = getHeaderHeight();

    const marker = scrollTop + headerHeight + $window.height() * 0.25;

    let currentId = "";

    $sections.each(function () {
      const $section = $(this);

      const top = $section.offset().top;

      const bottom = top + $section.outerHeight();

      if (marker >= top && marker < bottom) {
        currentId = $section.attr("id");
      }
    });

    if (!currentId) {
      if (scrollTop < $("#about").offset().top) {
        currentId = "home";
      } else {
        currentId = $sections.last().attr("id");
      }
    }

    $navLinks.removeClass("active");

    $navLinks.filter(`[href="#${currentId}"]`).addClass("active");
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

    const headerHeight = getHeaderHeight();

    const targetTop = $target.offset().top - headerHeight;

    $("html, body")
      .stop(true)
      .animate(
        {
          scrollTop: Math.max(0, targetTop),
        },
        700,
      );
  });

  /* ========================================
       REVEAL ON SCROLL
    ======================================== */

  function setupRevealObserver() {
    if (!("IntersectionObserver" in window)) {
      $revealElements.addClass("visible");

      return;
    }

    const observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            $(entry.target).addClass("visible");

            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.12,

        rootMargin: "0px 0px -40px 0px",
      },
    );

    $revealElements.each(function () {
      observer.observe(this);
    });
  }

  /* ========================================
       PROJECT HOVER
    ======================================== */

  $(".project-card").on("mouseenter", function () {
    $(this)
      .find(".project-tech span")
      .each(function (index) {
        $(this).css("transition-delay", `${index * 25}ms`);
      });
  });

  $(".project-card").on("mouseleave", function () {
    $(this).find(".project-tech span").css("transition-delay", "0ms");
  });

  /* ========================================
       CONTACT FORM
    ======================================== */

  $contactForm.on("submit", function (event) {
    event.preventDefault();

    const form = this;

    if (!form.checkValidity()) {
      form.reportValidity();

      return;
    }

    const originalText = $contactButton.text();

    $contactButton.prop("disabled", true).text("Sending...");

    $formStatus.text("");

    window.setTimeout(function () {
      $contactButton.prop("disabled", false).text("Message Sent ✓");

      $formStatus.text("Your message has been prepared successfully.");

      form.reset();

      window.setTimeout(function () {
        $contactButton.text(originalText);

        $formStatus.text("");
      }, 2500);
    }, 800);
  });

  /* ========================================
       SCROLL HANDLER
    ======================================== */

  function handleScroll() {
    if (ticking) {
      return;
    }

    window.requestAnimationFrame(function () {
      updateAboutParagraphs();
      updateActiveNav();

      ticking = false;
    });

    ticking = true;
  }

  $window.on("scroll", handleScroll);

  /* ========================================
       RESIZE
    ======================================== */

  let resizeTimer;

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

  setupRevealObserver();

  updateAboutHeight();
  updateAboutParagraphs();
  updateActiveNav();
});
