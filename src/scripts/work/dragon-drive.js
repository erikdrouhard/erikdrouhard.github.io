// The hero loop plays only while it is on screen, the tab is visible, and the
// visitor has not asked for reduced motion. Under <ClientRouter /> the module
// top level runs once but the DOM is replaced on every navigation, so all of
// this state lives in module scope and is torn down in stopDragonDrive().

let observer = null;
let reduceMotion = null;
let videos = [];

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
  videos.forEach((video) => {
    video.controls = reduceMotion.matches;
    playWhenAllowed(video);
  });
}

export function initDragonDrive() {
  // A second init on the same DOM would attach a second observer and a second
  // pair of listeners; the teardown only knows about one of each.
  if (observer) return;

  videos = [...document.querySelectorAll("[data-autoplay-video]")];
  if (!videos.length) return;

  reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const video = entry.target;
        video.dataset.visible = String(entry.isIntersecting);
        playWhenAllowed(video);
      });
    },
    { threshold: 0.2 },
  );

  videos.forEach((video) => observer.observe(video));
  reduceMotion.addEventListener("change", syncMotionPreference);
  document.addEventListener("visibilitychange", syncMotionPreference);
  syncMotionPreference();
}

export function stopDragonDrive() {
  if (!observer) return;

  observer.disconnect();
  observer = null;
  reduceMotion.removeEventListener("change", syncMotionPreference);
  document.removeEventListener("visibilitychange", syncMotionPreference);
  reduceMotion = null;
  // The outgoing nodes are about to be discarded, but pausing first stops the
  // decoder rather than leaving it running on a detached element.
  videos.forEach((video) => video.pause());
  videos = [];
}
