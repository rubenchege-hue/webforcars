document.addEventListener("DOMContentLoaded", () => {

  // ─── Config ───
  const FRAME_COUNT = 100;
  const FRAME_SPEED = 1.2;
  const IMAGE_SCALE = 1.0;

  // ─── DOM refs ───
  const loader = document.getElementById("loader");
  const loaderBar = document.getElementById("loader-bar");
  const loaderPercent = document.getElementById("loader-percent");
  const hero = document.getElementById("hero");
  const canvasWrap = document.getElementById("canvas-wrap");
  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");
  const scrollContainer = document.getElementById("scroll-container");
  const overlay = document.getElementById("dark-overlay");
  const marqueeWrap = document.querySelector(".marquee-wrap");

  // ─── Responsive scroll height ───
  const isMobile = window.innerWidth < 768;
  if (isMobile) {
    scrollContainer.style.height = "450vh";
  } else {
    scrollContainer.style.height = "300vh";
  }

  // ─── Canvas sizing ───
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  let cw, ch;

  function resizeCanvas() {
    cw = window.innerWidth;
    ch = window.innerHeight;
    canvas.width = cw * dpr;
    canvas.height = ch * dpr;
    canvas.style.width = cw + "px";
    canvas.style.height = ch + "px";
    drawFrame(currentFrame);
  }

  // ─── Frame preloader ───
  let frames = [];
  let loadedCount = 0;
  let currentFrame = 0;
  let ready = false;

  function pad(n) {
    return String(n).padStart(4, "0");
  }

  function loadFrame(i) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        frames[i] = img;
        loadedCount++;
        const pct = Math.round((loadedCount / FRAME_COUNT) * 100);
        loaderBar.style.width = pct + "%";
        loaderPercent.textContent = pct + "%";
        resolve(img);
      };
      img.onerror = () => {
        frames[i] = null;
        loadedCount++;
        resolve(null);
      };
      img.src = `frames/frame_${pad(i + 1)}.webp`;
    });
  }

  async function preload() {
    // Phase 1: load first 10 frames immediately
    const firstBatch = [];
    for (let i = 0; i < Math.min(10, FRAME_COUNT); i++) {
      firstBatch.push(loadFrame(i));
    }
    await Promise.all(firstBatch);

    // Phase 2: load remaining in background
    const remaining = [];
    for (let i = 10; i < FRAME_COUNT; i++) {
      remaining.push(loadFrame(i));
    }
    await Promise.all(remaining);

    ready = true;
    loader.classList.add("hidden");
    drawFrame(0);
  }

  // ─── Background color sampling ───
  let bgColor = "#0a0a0a";

  function sampleBgColor(index) {
    const img = frames[index];
    if (!img) return;
    const tempCanvas = document.createElement("canvas");
    const tempCtx = tempCanvas.getContext("2d");
    tempCanvas.width = img.naturalWidth;
    tempCanvas.height = img.naturalHeight;
    tempCtx.drawImage(img, 0, 0);
    try {
      const data = tempCtx.getImageData(0, 0, 10, 10).data;
      let r = 0, g = 0, b = 0, count = 0;
      for (let i = 0; i < data.length; i += 16) {
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
        count++;
      }
      r = Math.round(r / count);
      g = Math.round(g / count);
      b = Math.round(b / count);
      bgColor = `rgb(${r},${g},${b})`;
    } catch (e) {
      // CORS issue, keep default
    }
  }

  // ─── Canvas renderer ───
  function drawFrame(index) {
    const img = frames[index];
    if (!img) return;

    ctx.save();
    ctx.scale(dpr, dpr);

    // Fill background
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, cw, ch);

    // Padded cover mode
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    const scale = Math.max(cw / iw, ch / ih) * IMAGE_SCALE;
    const dw = iw * scale;
    const dh = ih * scale;
    const dx = (cw - dw) / 2;
    const dy = (ch - dh) / 2;

    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.restore();
  }

  // ─── Dark Overlay ───
  function initDarkOverlay() {
    ScrollTrigger.create({
      trigger: scrollContainer,
      start: "top top",
      end: "bottom bottom",
      scrub: true,
      onUpdate: (self) => {
        const p = self.progress;
        let opacity = 0;
        if (p < 0.04) {
          opacity = 0;
        } else if (p < 0.08) {
          opacity = (p - 0.04) / 0.04 * 0.55;
        } else if (p < 0.40) {
          opacity = 0.55;
        } else if (p < 0.44) {
          opacity = 0.55 + (p - 0.40) / 0.04 * 0.35;
        } else if (p < 0.60) {
          opacity = 0.9;
        } else if (p < 0.64) {
          opacity = 0.9 - (p - 0.60) / 0.04 * 0.35;
        } else {
          opacity = 0.55;
        }
        overlay.style.opacity = opacity;
      }
    });
  }

  // ─── Hero Transition ───
  function initHeroTransition() {
    ScrollTrigger.create({
      trigger: scrollContainer,
      start: "top top",
      end: "bottom bottom",
      scrub: true,
      onUpdate: (self) => {
        const p = self.progress;
        hero.style.opacity = Math.max(0, 1 - p * 10);
      }
    });
  }

  // ─── Frame-to-Scroll Binding ───
  let frameScrollTrigger;

  function initFrameScrub() {
    frameScrollTrigger = ScrollTrigger.create({
      trigger: scrollContainer,
      start: "top top",
      end: "bottom bottom",
      scrub: 1.5,
      onUpdate: (self) => {
        if (!ready) return;
        const accelerated = Math.min(self.progress * FRAME_SPEED, 1);
        const index = Math.min(
          Math.floor(accelerated * FRAME_COUNT),
          FRAME_COUNT - 1
        );
        if (index !== currentFrame) {
          currentFrame = index;
          requestAnimationFrame(() => drawFrame(currentFrame));
        }
        // Sample background color periodically
        if (currentFrame > 0 && currentFrame % 20 === 0) {
          sampleBgColor(currentFrame);
        }
      }
    });
  }

  // ─── Section Animation System ───
  function setupSectionAnimation(section) {
    const type = section.dataset.animation;
    const persist = section.dataset.persist === "true";
    const enterPct = parseFloat(section.dataset.enter) / 100;
    const leavePct = parseFloat(section.dataset.leave) / 100;

    // Position section — from-bottom sections start at bottom of viewport
    const fromBottom = section.dataset.fromBottom === "true";
    if (fromBottom) {
      const pos = 0.28;
      section.style.top = (pos * 100) + "%";
      section.style.transform = "none";
    } else {
      const midpoint = (enterPct + leavePct) / 2;
      section.style.top = (midpoint * 100) + "%";
      section.style.transform = "translateY(-50%)";
    }

    const children = section.querySelectorAll(
      ".section-label, .section-heading, .section-body, .section-note, .cta-button, .stat"
    );

    const tl = gsap.timeline({ paused: true });

    switch (type) {
      case "fade-up":
        tl.from(children, {
          y: 40,
          opacity: 0,
          stagger: 0.1,
          duration: 0.7,
          ease: "power2.out"
        });
        break;
      case "slide-left":
        tl.from(children, {
          x: -60,
          opacity: 0,
          stagger: 0.1,
          duration: 0.7,
          ease: "power2.out"
        });
        break;
      case "slide-right":
        tl.from(children, {
          x: 60,
          opacity: 0,
          stagger: 0.1,
          duration: 0.7,
          ease: "power2.out"
        });
        break;
      case "scale-up":
        tl.from(children, {
          scale: 0.9,
          opacity: 0,
          stagger: 0.1,
          duration: 0.7,
          ease: "power2.out"
        });
        break;
      case "rotate-in":
        tl.from(children, {
          y: 30,
          rotation: 2,
          opacity: 0,
          stagger: 0.08,
          duration: 0.7,
          ease: "power2.out"
        });
        break;
      case "stagger-up":
        tl.from(children, {
          y: 40,
          opacity: 0,
          stagger: 0.1,
          duration: 0.6,
          ease: "power2.out"
        });
        break;
      case "clip-reveal":
        tl.from(children, {
          clipPath: "inset(100% 0 0 0)",
          opacity: 0,
          stagger: 0.1,
          duration: 0.9,
          ease: "power3.inOut"
        });
        break;
    }

    const range = leavePct - enterPct;

    ScrollTrigger.create({
      trigger: scrollContainer,
      start: "top top",
      end: "bottom bottom",
      scrub: true,
      onUpdate: (self) => {
        const p = self.progress;

        if (p >= enterPct && p <= leavePct) {
          const sectionProgress = (p - enterPct) / range;
          section.style.opacity = 1;
          tl.progress(sectionProgress);
        } else if (p < enterPct) {
          section.style.opacity = 0;
          tl.progress(0);
        } else if (p > leavePct) {
          if (persist) {
            section.style.opacity = 1;
            tl.progress(1);
          } else {
            section.style.opacity = 0;
            tl.progress(1);
          }
        }
      }
    });
  }

  // ─── Counter Animations ───
  function initCounters() {
    document.querySelectorAll(".stat-number").forEach((el) => {
      const target = parseFloat(el.dataset.value);
      const decimals = parseInt(el.dataset.decimals || "0");
      const snap = decimals === 0 ? 1 : 0.01;
      gsap.from(el, {
        textContent: 0,
        duration: 2,
        ease: "power1.out",
        snap: { textContent: snap },
        scrollTrigger: {
          trigger: el.closest(".scroll-section"),
          start: "top 70%",
          toggleActions: "play none none reverse"
        }
      });
    });
  }

  // ─── Horizontal Marquee ───
  function initMarquee() {
    const speed = parseFloat(marqueeWrap.dataset.scrollSpeed) || -25;
    gsap.to(marqueeWrap.querySelector(".marquee-text"), {
      xPercent: speed,
      ease: "none",
      scrollTrigger: {
        trigger: scrollContainer,
        start: "top top",
        end: "bottom bottom",
        scrub: true
      }
    });

    // Fade marquee in/out
    ScrollTrigger.create({
      trigger: scrollContainer,
      start: "top top",
      end: "bottom bottom",
      scrub: true,
      onUpdate: (self) => {
        const p = self.progress;
        if (p > 0.06 && p < 0.80) {
          let fadePct = 1;
          if (p < 0.12) {
            fadePct = (p - 0.06) / 0.06;
          } else if (p > 0.74) {
            fadePct = (0.80 - p) / 0.06;
          }
          marqueeWrap.style.opacity = Math.min(1, Math.max(0, fadePct));
        } else {
          marqueeWrap.style.opacity = 0;
        }
      }
    });
  }

  // ─── Register GSAP Plugins ───
  gsap.registerPlugin(TextPlugin);

  // ─── Lenis Smooth Scroll ───
  let lenis = new Lenis({
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
  });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  lenis.stop();

  // ─── Window resize ───
  window.addEventListener("resize", () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    resizeCanvas();
    ScrollTrigger.refresh();
  });

  // ─── Initialize all ───
  resizeCanvas();
  preload().then(() => {
    sampleBgColor(0);
    lenis.start();

    initHeroTransition();
    initFrameScrub();
    initDarkOverlay();
    initMarquee();
    initCounters();

    document.querySelectorAll(".scroll-section").forEach((section) => {
      setupSectionAnimation(section);
    });

    ScrollTrigger.refresh();
  });
});
