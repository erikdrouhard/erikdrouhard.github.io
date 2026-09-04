/* See mix-dialog.mjs for the shape. Ticket 04 owns the `square` list here. */
export default {
  path: "/work/dragon-drive/",
  buttons: { primary: 1, secondary: 1 },
  square: [
    ".drive-badges li",
    ".drive-video-frame",
    ".drive-video-frame video",
    ".drive-live-label",
    ".drive-highlight video",
    ".drive-interaction-map",
    ".drive-map-step",
    ".drive-role-note",
  ],
  /* The ring behind the outcome panel. `50%` is geometry, not styling, so
     DESIGN-SYSTEM.md keeps it; it is listed rather than exempted so a fourth
     round corner cannot appear without someone adding a line here. */
  circles: [".drive-outcome::before"],
};
