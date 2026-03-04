export function initNavbarHandler() {
  const toggle = document.getElementById("mobile-menu-toggle");
  const menu = document.getElementById("mobile-menu");
  const close = document.getElementById("close-menu");
  const links = document.querySelectorAll(".mobile-nav-link");

  const openMenu = () => {
    menu?.classList.remove("opacity-0", "pointer-events-none");
    menu?.classList.add("pointer-events-auto");
    document.body.classList.add("overflow-hidden");
  };

  const closeMenu = () => {
    menu?.classList.add("opacity-0", "pointer-events-none");
    menu?.classList.remove("pointer-events-auto");
    document.body.classList.remove("overflow-hidden");
  };

  toggle?.addEventListener("click", openMenu);
  close?.addEventListener("click", closeMenu);
  links.forEach((link) => {
    link.addEventListener("click", closeMenu);
  });
}
