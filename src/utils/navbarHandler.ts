export function initNavbarHandler() {
  const toggle = document.getElementById("mobile-menu-toggle");
  const menu = document.getElementById("mobile-menu");
  const close = document.getElementById("close-menu");
  const links = document.querySelectorAll(".mobile-nav-link");

  const toggleMenu = () => {
    menu?.classList.toggle("opacity-0");
    menu?.classList.toggle("pointer-events-none");
    document.body.classList.toggle("overflow-hidden");
  };

  toggle?.addEventListener("click", toggleMenu);
  close?.addEventListener("click", toggleMenu);
  links.forEach((link) => link.addEventListener("click", toggleMenu));
}
