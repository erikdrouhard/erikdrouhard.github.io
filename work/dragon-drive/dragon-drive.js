const autoplayVideos = [...document.querySelectorAll("[data-autoplay-video]")];
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

function playWhenAllowed(video) {
  if (reduceMotion.matches || document.hidden || video.dataset.visible === "false") {
    video.pause();
    return;
  }

  video.play().catch(() => {
    video.controls = true;
  });
}

function syncMotionPreference() {
  autoplayVideos.forEach((video) => {
    video.controls = reduceMotion.matches;
    playWhenAllowed(video);
  });
}

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      const video = entry.target;
      video.dataset.visible = String(entry.isIntersecting);
      playWhenAllowed(video);
    });
  },
  { threshold: 0.2 },
);

autoplayVideos.forEach((video) => observer.observe(video));
reduceMotion.addEventListener("change", syncMotionPreference);
document.addEventListener("visibilitychange", syncMotionPreference);
syncMotionPreference();
