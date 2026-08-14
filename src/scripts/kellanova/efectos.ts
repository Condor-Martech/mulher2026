/**
 * Los 5 comportamientos observados del origen — MIGRATION-MAP §15.
 *
 * No se porta ni una línea del JS del constructor de origen. Se reimplementa solo
 * lo que la página realmente hace: toggle del menú móvil, acordeón, carrusel,
 * animaciones de entrada y el modal de tickets.
 *
 * Los ganchos son clases propias (.faq-acordeon, .marcas-carrusel). Antes eran
 * atributos data-* del editor de origen; al borrarlos, el acordeón y el carrusel
 * dejaron de inicializarse sin que fallara nada visible — los slides pasaron a
 * su ancho natural y la página creció 400px. Si renombras una de esas clases,
 * este archivo se entera.
 */
import Swiper, { Autoplay } from 'swiper'

// ---------------------------------------------------------------- 1. Menú móvil
function menuMovil() {
  const toggle = document.querySelector<HTMLElement>('[data-menu-toggle]')
  const dropdown = document.querySelector<HTMLElement>('.sv-nav-menu--dropdown')
  if (!toggle || !dropdown) return

  const fijar = (abierto: boolean) => {
    toggle.setAttribute('aria-expanded', String(abierto))
    toggle.classList.toggle('sv-active', abierto)
    dropdown.setAttribute('aria-hidden', String(!abierto))
    dropdown.querySelectorAll('a').forEach((a) => a.setAttribute('tabindex', abierto ? '0' : '-1'))
  }

  toggle.addEventListener('click', () => fijar(toggle.getAttribute('aria-expanded') !== 'true'))
  toggle.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      fijar(toggle.getAttribute('aria-expanded') !== 'true')
    }
  })
  // Al navegar a un ancla desde el menú móvil, se cierra.
  dropdown.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => fijar(false)))
}

// ------------------------------------------------------------------ 2. Acordeón
function acordeon() {
  // Se engancha por la clase del widget, no por un data-* del editor de origen.
  const raiz = document.querySelector<HTMLElement>('.faq-acordeon')
  if (!raiz) return
  const items = Array.from(raiz.querySelectorAll<HTMLDetailsElement>('details.sv-accordion-item'))

  items.forEach((d) => {
    // Se escucha 'toggle', no 'click': <details> actualiza .open DESPUÉS del
    // click, así que leerlo en el handler de click da el valor anterior.
    d.addEventListener('toggle', () => {
      d.querySelector('summary')?.setAttribute('aria-expanded', String(d.open))
      if (!d.open) return
      // El widget lleva max_items_expended:"one": abrir uno cierra los demás.
      for (const otro of items) {
        if (otro === d || !otro.open) continue
        otro.open = false
        otro.querySelector('summary')?.setAttribute('aria-expanded', 'false')
      }
    })
  })
}

// ------------------------------------------------------------------ 3. Carrusel
function carrusel() {
  const widget = document.querySelector<HTMLElement>('.marcas-carrusel')
  const el = widget?.querySelector<HTMLElement>('.sv-carousel')
  if (!widget || !el) return

  // Parámetros exactos del data-settings del origen (ASSET-INVENTORY §6).
  const cfg = JSON.parse(widget.dataset.settings || '{}')
  const n = (v: unknown, def: number) => (v === undefined ? def : Number(v))

  new Swiper(el, {
    modules: [Autoplay],
    slidesPerView: n(cfg.slides_to_show_mobile, 3),
    slidesPerGroup: 1,
    loop: cfg.infinite === 'yes',
    speed: n(cfg.speed, 500),
    spaceBetween: 0,
    autoplay:
      cfg.autoplay === 'yes'
        ? {
            delay: n(cfg.autoplay_speed, 5000),
            pauseOnMouseEnter: cfg.pause_on_hover === 'yes',
            disableOnInteraction: cfg.pause_on_interaction === 'yes',
          }
        : false,
    breakpoints: {
      768: { slidesPerView: n(cfg.slides_to_show_tablet, 2) },
      1024: { slidesPerView: n(cfg.slides_to_show, 5), slidesPerGroup: n(cfg.slides_to_scroll, 3) },
    },
  })
}

// -------------------------------------------------- 4. Animaciones de entrada
function animacionesDeEntrada() {
  // El origen marca con .sv-invisible y dispara la animación al entrar en
  // viewport, una sola vez. No va ligada al progreso de scroll.
  const nodos = document.querySelectorAll<HTMLElement>('.sv-invisible[data-settings]')
  if (!nodos.length) return

  const observador = new IntersectionObserver(
    (entradas) => {
      for (const e of entradas) {
        // Se revela al entrar en viewport Y también si ya se pasó de largo. El
        // observador entrega las entradas de forma asíncrona: en un scroll
        // rápido —o programático— el elemento puede haber salido por arriba
        // cuando llega el aviso, y con la condición sola de `isIntersecting` se
        // quedaba oculto para siempre. Le pasó al pódium de las bicicletas.
        // Solo se salta lo que sigue POR DEBAJO, que aún no toca.
        const yaPasado = e.boundingClientRect.bottom <= 0
        if (!e.isIntersecting && !yaPasado) continue
        const el = e.target as HTMLElement
        let anim: string | undefined
        try {
          anim = JSON.parse(el.dataset.settings || '{}')._animation
        } catch {
          /* data-settings sin JSON válido: se deja visible sin animar */
        }
        if (anim) el.classList.add('animated', anim)
        el.classList.remove('sv-invisible')
        observador.unobserve(el)
      }
    },
    { threshold: 0.15 }
  )
  nodos.forEach((n) => observador.observe(n))

  // Los nodos dentro de un contenedor display:none (la variante de oferta que
  // no toca a este breakpoint) nunca intersecan, así que quedan invisibles. Al
  // cambiar de breakpoint pasan a mostrarse: hay que volver a observarlos.
  let temporizador: number | undefined
  window.addEventListener('resize', () => {
    clearTimeout(temporizador)
    temporizador = window.setTimeout(() => {
      document
        .querySelectorAll<HTMLElement>('.sv-invisible[data-settings]')
        .forEach((n) => observador.observe(n))
    }, 200)
  })
}

// -------------------------------------------------------- 5. Modal de tickets
function modalTickets() {
  const modal = document.querySelector<HTMLElement>('#ticketModal')
  if (!modal) return

  const campo = (id: string) => modal.querySelector<HTMLElement>(`#${id}`)

  const abrir = (t: HTMLElement) => {
    const d = t.dataset
    const premio = d.premio ?? ''
    campo('modal-name')!.innerText = d.nome ?? ''
    campo('modal-serie')!.innerText = d.serie ?? ''
    campo('modal-lucky')!.innerText = d.numero ?? ''
    campo('modal-date')!.innerText = d.data ?? ''
    const elPremio = campo('modal-prize')!
    elPremio.innerText = premio
    // Regla del origen: el premio largo recibe una clase propia.
    elPremio.classList.toggle('v-prize-long', premio.length > 20)
    modal.style.display = 'flex'
    document.body.classList.add('v-modal-open')
    // La clase se añade en el frame siguiente, no en el mismo: si se pusiera a la
    // vez que display:flex, el navegador nunca vería el estado inicial y no
    // habría nada desde donde animar. Los estilos están en mejoras.css.
    requestAnimationFrame(() => modal.classList.add('v-abierto'))
  }

  const cerrar = () => {
    modal.classList.remove('v-abierto')
    document.body.classList.remove('v-modal-open')
    // display:none se retrasa hasta que acabe el fundido; si no, el modal
    // desaparecería de golpe y la transición de salida no se vería nunca.
    const ocultar = () => {
      modal.style.display = 'none'
      modal.removeEventListener('transitionend', ocultar)
    }
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) ocultar()
    else modal.addEventListener('transitionend', ocultar)
  }

  // Listener delegado: los 5 valores viven en data-*, no en una cadena JS dentro
  // de onclick. Un apóstrofo en un nombre rompería ese ticket — MIGRATION-MAP §10.
  document.addEventListener('click', (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('[data-ticket]')
    if (t) return abrir(t)
    if ((e.target as HTMLElement).closest('[data-cerrar-ticket]')) return cerrar()
    if (e.target === modal) cerrar()
  })
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.style.display === 'flex') cerrar()
    const t = document.activeElement as HTMLElement | null
    if ((e.key === 'Enter' || e.key === ' ') && t?.hasAttribute('data-ticket')) {
      e.preventDefault()
      abrir(t)
    }
  })
}

for (const f of [menuMovil, acordeon, carrusel, animacionesDeEntrada, modalTickets]) {
  try {
    f()
  } catch (err) {
    console.error(`[efectos] fallo en ${f.name}:`, err)
  }
}
