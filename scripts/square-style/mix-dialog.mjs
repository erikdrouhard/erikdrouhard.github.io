/* One manifest per page so the wave-2 agents never share a file.
   `buttons` are the exact counts of `.btn.primary` and `.btn:not(.primary)`
   the page renders. `square` lists the selectors whose four corner radii must
   compute to 0px; each entry must match at least one element, so a selector
   that stops matching fails loudly instead of passing vacuously. */
export default {
  path: "/work/mix-dialog/",
  buttons: { primary: 1, secondary: 1 },
  square: [],
};
