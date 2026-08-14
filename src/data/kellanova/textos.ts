/**
 * Todo el texto visible que no vive ya en faq.json, ganhadores.json o
 * navegacion.json. **El contenido está en textos.json** — aquí solo van tipos,
 * comprobaciones y el interpolador.
 *
 * Los rótulos son LITERALES del origen, incluidas sus erratas: «©Condor 2025»
 * sin espacio y con el año anterior a la campaña, «consulte» en minúscula tras
 * punto, «imagens» sin punto previo. CONTENT-INVENTORY §4 los marca
 * [ORIGINAL - POSSIBLE TYPO] y MIGRATION-MAP §8 dice que se migran tal cual.
 *
 * Qué NO está aquí, y por qué: los `id` que el CSS del origen referencia y los
 * `import` de imágenes se quedan en el componente. Un id anclado al CSS no gana
 * nada mudándose a un JSON, y una ruta de imagen en JSON se le escapa al
 * optimizador de Astro —perdería el hash, el redimensionado y la conversión de
 * formato—. La frontera es: el texto y las URL son contenido; la estructura no.
 *
 * Que estas cadenas coincidan con el origen no depende de que yo lo transcriba
 * bien: `_source/verificar-texto.py` compara las 710 palabras publicadas contra
 * _source/raw/page.html y falla si una sola cambia.
 */
import crudo from './textos.json'
import { texto, textoPosibleVacio } from './validar'

/** Rellena {marcadores}. Los textos con hueco —«Ver detalhe do prêmio de
 *  {nome}»— son los únicos que se componen en tiempo de render; el resto se
 *  usan tal cual. */
export function fmt(plantilla: string, valores: Record<string, string | number>): string {
  return plantilla.replace(/\{(\w+)\}/g, (entero, clave: string) =>
    clave in valores ? String(valores[clave]) : entero
  )
}

/** Comprueba en bloque que cada hoja del árbol es una cadena con algo dentro.
 *  Las decorativas van aparte: su alt vacío es la marca correcta para que un
 *  lector de pantalla las ignore, no un olvido. */
function ramaLlena<T extends Record<string, string>>(obj: T, donde: string): T {
  for (const [k, v] of Object.entries(obj)) texto(v, `${donde}.${k}`)
  return obj
}

export const ui = {
  pagina: ramaLlena(crudo.pagina, 'textos.json.pagina'),
  topo: ramaLlena(crudo.topo, 'textos.json.topo'),
  nav: ramaLlena(crudo.nav, 'textos.json.nav'),
  vitrina: ramaLlena(crudo.vitrina, 'textos.json.vitrina'),
  ticket: ramaLlena(crudo.ticket, 'textos.json.ticket'),
  aceleradores: ramaLlena(crudo.aceleradores, 'textos.json.aceleradores'),
  faq: ramaLlena(crudo.faq, 'textos.json.faq'),
  regulamento: ramaLlena(crudo.regulamento, 'textos.json.regulamento'),
  rodape: ramaLlena(crudo.rodape, 'textos.json.rodape'),
  popup: ramaLlena(crudo.popup, 'textos.json.popup'),
} as const

/**
 * Textos alternativos. En el origen las 20 imágenes tienen alt="" (
 * CONTENT-INVENTORY §4). Eso es correcto para las decorativas e incorrecto para
 * las que llevan el mensaje comercial rasterizado: ASSET-INVENTORY §3 documenta
 * que al menos 5 contienen texto que «no es seleccionable, no lo indexa un
 * buscador y no se puede traducir».
 *
 * No inventan contenido: transcriben lo que el propio inventario registró como
 * contenido de cada arte (campo `rol` de _source/assets.json).
 */
export const alt = {
  ...ramaLlena(
    {
      selo: crudo.alt.selo,
      chamada: crudo.alt.chamada,
      sorteioBike: crudo.alt.sorteioBike,
      sorteioCartoes: crudo.alt.sorteioCartoes,
      podium: crudo.alt.podium,
      aceleradores: crudo.alt.aceleradores,
      rotuloMarcas: crudo.alt.rotuloMarcas,
      logoCondorRodape: crudo.alt.logoCondorRodape,
    },
    'textos.json.alt'
  ),
  marcas: ramaLlena(crudo.alt.marcas, 'textos.json.alt.marcas'),
  // vacías a propósito: moldura de palmeras, shape radial del hero y degradado
  // de fondo. Un alt vacío es lo que hace que un lector de pantalla las salte.
  decorativas: Object.fromEntries(
    Object.entries(crudo.alt.decorativas).map(([k, v]) => [
      k,
      textoPosibleVacio(v, `textos.json.alt.decorativas.${k}`),
    ])
  ) as typeof crudo.alt.decorativas,
} as const
