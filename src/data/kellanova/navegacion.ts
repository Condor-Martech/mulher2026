/**
 * Menú, PDF del reglamento y redes del pie. **El contenido está en
 * navegacion.json** — aquí solo van tipos y comprobaciones.
 */
import crudo from './navegacion.json'
import { cuantos, lista, texto, uno } from './validar'

export type ItemNav = {
  texto: string
  href: string
  /** ancla-sin-destino: el origen apunta a "#", que no existe. MIGRATION-MAP §14 */
  tipo: 'ancla' | 'ancla-sin-destino' | 'documento'
}
export type RedSocial = { nombre: string; href: string }

const TIPOS = ['ancla', 'ancla-sin-destino', 'documento'] as const

const items = lista(crudo.items, 'navegacion.json.items')
cuantos(items, 4, 'navegacion.json.items')

export const navegacion: ItemNav[] = items.map((v, i) => {
  const it = v as Record<string, unknown>
  return {
    texto: texto(it.texto, `navegacion.json.items[${i}].texto`),
    href: texto(it.href, `navegacion.json.items[${i}].href`),
    tipo: uno(it.tipo, TIPOS, `navegacion.json.items[${i}].tipo`),
  }
})

/** El PDF se referencia desde 3 puntos (2 ítems de menú + botón CONFIRA AQUI).
 *  Una sola entrada, porque el fichero ya es una versión enmendada (_aditado-1)
 *  y una segunda enmienda obligaría a tocar tres sitios. MIGRATION-MAP §14.
 *
 *  Es uno de los dos activos críticos de la obligación legal, junto con los 14
 *  premiados: si esta ruta deja de resolver, el reglamento deja de ser público. */
export const URL_REGULAMENTO = texto(crudo.urlRegulamento, 'navegacion.json.urlRegulamento')

const redes = lista(crudo.redesSociales, 'navegacion.json.redesSociales')
cuantos(redes, 6, 'navegacion.json.redesSociales')

/** Los 6 del pie, en el orden del origen. Cada uno lleva su propio glifo en
 *  components/iconos.ts: no son un icono parametrizado (MIGRATION-MAP §4). */
export const redesSociales: RedSocial[] = redes.map((v, i) => {
  const r = v as Record<string, unknown>
  return {
    nombre: texto(r.nombre, `navegacion.json.redesSociales[${i}].nombre`),
    href: texto(r.href, `navegacion.json.redesSociales[${i}].href`),
  }
})
