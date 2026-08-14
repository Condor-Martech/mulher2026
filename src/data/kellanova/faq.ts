/**
 * Las 7 preguntas. **El contenido está en faq.json** — aquí solo van tipos y
 * comprobaciones.
 *
 * Es contenido legalmente relevante: explica quién puede participar y cómo se
 * comunica a los premiados. Va en `<details>` nativos, así que se lee sin
 * JavaScript; y por ir plegado, una regresión aquí no sale en una captura de
 * pantalla. Lo cubre `_source/verificar-texto.py`, que compara el HTML
 * publicado contra el origen palabra por palabra.
 */
import crudo from './faq.json'
import { cuantos, lista, texto, textoPosibleVacio, uno } from './validar'

export type BloqueFaq = {
  tag: 'p' | 'li'
  /** solo texto, sin marcado: útil para búsquedas y comprobaciones */
  texto: string
  /** el contenido REAL, con el marcado en línea del origen. El FAQ lleva 22
   *  elementos de énfasis (19 <b>, 3 <strong>, 1 <u>) más sus enlaces. Guardar
   *  solo `texto` los perdía todos. */
  html: string
}
export type EnlaceFaq = { texto: string; href: string; target: string | null }
export type ItemFaq = {
  titulo: string
  bloques: BloqueFaq[]
  /** target se conserva por enlace: el ítem 4 lo tiene null y el 5 "_new". Los
   *  enlaces ya vienen dentro de `html`; esta lista queda como inventario para
   *  auditar que ninguno se pierde. */
  links: EnlaceFaq[]
}

function validar(v: unknown, i: number): ItemFaq {
  const donde = `faq.json[${i}]`
  const it = v as Record<string, unknown>
  return {
    titulo: texto(it.titulo, `${donde}.titulo`),
    bloques: lista(it.bloques, `${donde}.bloques`).map((b, j) => {
      const bl = b as Record<string, unknown>
      return {
        tag: uno(bl.tag, ['p', 'li'] as const, `${donde}.bloques[${j}].tag`),
        texto: texto(bl.texto, `${donde}.bloques[${j}].texto`),
        html: texto(bl.html, `${donde}.bloques[${j}].html`),
      }
    }),
    // la mayoría de ítems no tiene enlaces: lista vacía es válida
    links: lista(it.links, `${donde}.links`, 0).map((k, j) => {
      const en = k as Record<string, unknown>
      return {
        texto: texto(en.texto, `${donde}.links[${j}].texto`),
        href: texto(en.href, `${donde}.links[${j}].href`),
        target: en.target == null ? null : textoPosibleVacio(en.target, `${donde}.links[${j}].target`),
      }
    }),
  }
}

const bruto = lista(crudo, 'faq.json')
cuantos(bruto, 7, 'faq.json')

export const faq: ItemFaq[] = bruto.map(validar)
