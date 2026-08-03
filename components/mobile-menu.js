const mobileMenus = document.querySelectorAll("details.mobile-menu");

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;

  for (const menu of mobileMenus) {
    if (!menu.open) continue;

    menu.open = false;
    menu.querySelector("summary")?.focus();
  }
});
