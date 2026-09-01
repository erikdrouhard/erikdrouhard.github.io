/* The four page manifests, in the order the check runs them. Adding a page
   means adding a file next to this one and one line here. */
import mixDialog from "./mix-dialog.mjs";
import microsoft from "./microsoft.mjs";
import dragonDrive from "./dragon-drive.mjs";
import verseDesignSystem from "./verse-design-system.mjs";

export default [
  { slug: "mix-dialog", ...mixDialog },
  { slug: "microsoft", ...microsoft },
  { slug: "dragon-drive", ...dragonDrive },
  { slug: "verse-design-system", ...verseDesignSystem },
];
