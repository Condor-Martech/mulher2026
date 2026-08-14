/**
 * Metadatos de la única ruta. **El contenido está en seo.json** — aquí solo van
 * tipos y comprobaciones.
 *
 * Los valores son LITERALES del origen. `jsonLd` es byte a byte el
 * <script type="application/ld+json"> de _source/raw/page.html (comprobado con
 * json.loads: idéntico), incluidos su autor y sus fechas.
 *
 * MIGRATION-MAP §12: no se redactan textos nuevos. El <title> es el slug de la
 * página y la description la generó AIOSEO recortando el texto de los tickets;
 * migrar fiel significa congelar ambas cadenas. Cambiarlas es decisión de
 * producto, no de migración.
 *
 * Ojo con `canonical` y `ogUrl`: apuntan al dominio actual. Si la LP se muda,
 * estos dos campos y los `@id` de jsonLd son lo que hay que revisar, y el
 * cambio afecta a cómo la indexan los buscadores.
 */
import crudo from './seo.json'
import { texto } from './validar'

const campo = (k: keyof typeof crudo, v: unknown = crudo[k]) => texto(v, `seo.json.${k}`)

export const seo = {
  title: campo('title'),
  metaDescription: campo('metaDescription'),
  canonical: campo('canonical'),
  robots: campo('robots'),
  ogTitle: campo('ogTitle'),
  ogDescription: campo('ogDescription'),
  ogUrl: campo('ogUrl'),
  ogLocale: campo('ogLocale'),
  ogType: campo('ogType'),
  ogSiteName: campo('ogSiteName'),
  twitterCard: campo('twitterCard'),
  twitterTitle: campo('twitterTitle'),
  ogImage: campo('ogImage'),
  twitterImage: campo('twitterImage'),
  lang: campo('lang'),
} as const

export const GTM_ID = campo('gtmId')

export const jsonLd = crudo.jsonLd
