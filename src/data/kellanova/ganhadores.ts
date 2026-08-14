/**
 * Los 14 premiados. **El contenido está en ganhadores.json** — este archivo solo
 * lo tipa y lo comprueba.
 *
 * Trata una edición de ese JSON como tocarías un registro legal: es el motivo
 * por el que la página tiene que seguir publicada. El reglamento de la promoción
 * obliga a mantener los premiados visibles, así que cada campo que falte es un
 * incumplimiento, no un hueco cosmético. Por eso la comprobación de abajo corre
 * al construir y rompe el build en vez de publicar una tarjeta a medias.
 *
 * DOS campos de premio, no uno (MIGRATION-MAP §9). La tarjeta y el modal dicen
 * cosas distintas en 12 de los 14: la tarjeta pone «CARTÃO PRESENTE R$ 500» y el
 * modal «CARTÃO PRESENTE R$ 500,00». Colapsarlos rompe uno de los dos textos.
 */
import crudo from './ganhadores.json'
import { booleano, contra, cuantos, lista, texto, textoPosibleVacio } from './validar'

export type Ganhador = {
  nome: string
  serie: string
  numero: string
  data: string
  /** el del modal */
  premio: string
  /** los de la tarjeta de la vitrina */
  tipoVisible: string
  montanteVisible: string
  /** 4 de los 14 lo llevan: la regla .v-prize-long baja la fuente de 16px a
   *  10px !important. Sin ella la tarjeta mide 168px en vez de 90px. */
  premioLargo: boolean
}

const FECHA = /^\d{2}\/\d{2}\/\d{2}$/

function validar(v: unknown, i: number): Ganhador {
  const donde = `ganhadores.json[${i}]`
  const g = v as Record<string, unknown>
  return {
    nome: texto(g.nome, `${donde}.nome`),
    // serie llega a ser '0' en un ticket: cadena no vacía, no un número
    serie: texto(g.serie, `${donde}.serie`),
    numero: texto(g.numero, `${donde}.numero`),
    data: contra(texto(g.data, `${donde}.data`), FECHA, `${donde}.data`),
    premio: texto(g.premio, `${donde}.premio`),
    // vacío a propósito en los 4 tickets de bicicleta: el importe lo dice todo
    tipoVisible: textoPosibleVacio(g.tipoVisible, `${donde}.tipoVisible`),
    montanteVisible: texto(g.montanteVisible, `${donde}.montanteVisible`),
    premioLargo: booleano(g.premioLargo, `${donde}.premioLargo`),
  }
}

const bruto = lista(crudo, 'ganhadores.json')
// Fueron 14 sorteos y son 14 registros. Si el número cambia sin que nadie lo
// haya decidido, es que la extracción falló, no que hubo un sorteo nuevo.
cuantos(bruto, 14, 'ganhadores.json')

export const ganhadores: Ganhador[] = bruto.map(validar)
