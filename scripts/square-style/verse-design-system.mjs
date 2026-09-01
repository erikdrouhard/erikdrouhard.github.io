/* See mix-dialog.mjs for the shape. Ticket 05 owns the `square` list here.
   Two primaries: the storybook callout's <span> and the closing pair's link. */
export default {
  path: "/work/verse-design-system/",
  buttons: { primary: 2, secondary: 1 },
  square: [
    ".mix-page--verse .mix-four-column--media > figure",
    ".mix-page--verse .mix-four-column--media > figure > a > img",
    ".mix-page--verse .mix-hero-visual--wide",
    ".mix-page--verse .mix-hero-visual--wide img",
    ".mix-page--verse .mix-content figure > a",
    ".mix-page--verse .mix-hero-visual--spec > a > span",
  ],
};
