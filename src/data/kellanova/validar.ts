/**
 * Comprobaciones de contenido que corren AL CONSTRUIR, no en el navegador.
 *
 * Astro evalúa el frontmatter de cada componente durante `astro build`, así que
 * un `throw` aquí rompe el build y nunca llega a publicarse. Esa es justo la
 * garantía que hace falta: un registro de ganador mal formado tiene que parar la
 * publicación, no salir a producción con un campo vacío. La promoción obliga a
 * mantener los 14 premiados visibles; una tarjeta sin número de sorte es un
 * incumplimiento silencioso.
 *
 * Sin dependencias a propósito. Un validador de esquemas haría esto mismo con
 * más sintaxis y una dependencia más que mantener durante los años que esta
 * página tiene que seguir en pie sin que nadie la toque.
 */

class ContenidoInvalido extends Error {
  constructor(donde: string, detalle: string) {
    super(`contenido inválido en ${donde}: ${detalle}`)
    this.name = 'ContenidoInvalido'
  }
}

/** Cadena presente y con algo dentro. El caso que importa: un campo que el
 *  origen tenía y la extracción perdió aparece aquí como '' y para el build. */
export function texto(v: unknown, donde: string): string {
  if (typeof v !== 'string') throw new ContenidoInvalido(donde, `se esperaba texto, llegó ${typeof v}`)
  if (v.trim() === '') throw new ContenidoInvalido(donde, 'está vacío')
  return v
}

/** Cadena que puede estar vacía legítimamente —`tipoVisible` lo está en los 4
 *  tickets de bicicleta— pero que sigue teniendo que ser una cadena. */
export function textoPosibleVacio(v: unknown, donde: string): string {
  if (typeof v !== 'string') throw new ContenidoInvalido(donde, `se esperaba texto, llegó ${typeof v}`)
  return v
}

export function booleano(v: unknown, donde: string): boolean {
  if (typeof v !== 'boolean') throw new ContenidoInvalido(donde, `se esperaba booleano, llegó ${typeof v}`)
  return v
}

/** Lista no vacía. Una lista vacía suele significar que el selector de
 *  extracción dejó de encajar, y es un fallo mudo: la sección desaparece. */
export function lista(v: unknown, donde: string, minimo = 1): unknown[] {
  if (!Array.isArray(v)) throw new ContenidoInvalido(donde, `se esperaba una lista, llegó ${typeof v}`)
  if (v.length < minimo) throw new ContenidoInvalido(donde, `tiene ${v.length} elementos y hacen falta ${minimo}`)
  return v
}

/** Cuenta exacta, para lo que tiene un número conocido y no debe cambiar solo. */
export function cuantos(v: unknown[], n: number, donde: string): void {
  if (v.length !== n) throw new ContenidoInvalido(donde, `hay ${v.length} y deberían ser ${n}`)
}

export function uno<T extends string>(v: unknown, opciones: readonly T[], donde: string): T {
  if (typeof v !== 'string' || !opciones.includes(v as T)) {
    throw new ContenidoInvalido(donde, `${JSON.stringify(v)} no es uno de ${opciones.join(' | ')}`)
  }
  return v as T
}

export function contra(v: string, patron: RegExp, donde: string): string {
  if (!patron.test(v)) throw new ContenidoInvalido(donde, `${JSON.stringify(v)} no encaja con ${patron}`)
  return v
}
