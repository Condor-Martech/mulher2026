import localContentData from "../data/encontro-de-sabores/content.json";

const S3_JSON_URL =
  "https://s3.cndr.me/lp-content/encontro-de-sabores/content.json";
export const ENCONTRO_ASSETS_BASE =
  "https://s3.cndr.me/lp-content/encontro-de-sabores/";

const LOCAL_PREFIX = "/assets/encontro-de-sabores/";

/**
 * Forma do conteúdo, tirada do JSON local. É o contrato que os componentes
 * recebem por props — assim nenhum deles precisa tipar com `any`. O JSON do
 * Minio pode trazer chaves a mais; o que vale como contrato é o fallback, que
 * é o que sempre existe.
 */
export type ConteudoEncontro = typeof localContentData;

/**
 * Troca um caminho local de asset pela sua URL no Minio. Serve também para os
 * caminhos que NÃO passam pelo content.json (og:image do layout, por exemplo).
 * Se a string não for um caminho local conhecido, volta como veio.
 *
 * Igual ao saboresContentService e ao contrário do maesService: NÃO acrescenta
 * `?v=timestamp`. As imagens são imutáveis por upload, então deixamos o browser
 * e o CDN guardarem em cache. O cache-busting fica só no fetch do JSON (`?t=`),
 * que é o que muda quando alguém edita o conteúdo.
 */
export const toEncontroCdn = (path: string): string =>
  typeof path === "string" && path.startsWith(LOCAL_PREFIX)
    ? path.replace(LOCAL_PREFIX, ENCONTRO_ASSETS_BASE)
    : path;

/**
 * Mistura o que vem do Minio POR CIMA do conteúdo local, chave a chave.
 *
 * Antes o JSON do Minio SUBSTITUÍA o local inteiro, e isso custava duas coisas:
 * quem editava um texto tinha de subir os 5 KB completos, e um bloco em falta
 * derrubava a página — medido, sem `formulario` dá «Cannot read properties of
 * undefined (reading 'fechar')» e a rota devolve a página de erro.
 *
 * Agora o Minio carrega só o que muda (datas, patrocinadores, textos) e o resto
 * vem do repo. O que não se subir não desaparece: preenche-se sozinho.
 *
 * Objetos fundem-se em profundidade. ARRAYS substituem-se inteiros, de
 * propósito: é o que permite TIRAR um patrocinador subindo a lista sem ele.
 * Fundir arrays elemento a elemento tornaria impossível encurtar uma lista.
 */
const mesclar = (base: any, novo: any): any => {
  if (novo === undefined) return base;
  if (novo === null || Array.isArray(novo)) return novo;
  if (
    typeof novo !== "object" ||
    typeof base !== "object" ||
    base === null ||
    Array.isArray(base)
  ) {
    return novo;
  }
  const saida: any = { ...base };
  for (const chave in novo) saida[chave] = mesclar(base[chave], novo[chave]);
  return saida;
};

/** Percorre a árvore e aplica `toEncontroCdn` em cada string. */
const transformData = (obj: any): any => {
  if (typeof obj === "string") return toEncontroCdn(obj);
  if (Array.isArray(obj)) return obj.map(transformData);
  if (obj !== null && typeof obj === "object") {
    const out: any = {};
    for (const k in obj) out[k] = transformData(obj[k]);
    return out;
  }
  return obj;
};

/**
 * Carrega o conteúdo do Encontro de Sabores do Minio, com fallback local.
 *
 * Chamado UMA vez no frontmatter de cada rota e passado por props aos
 * componentes (padrão do sabores-de-inverno). O maes chama o serviço dentro de
 * cada componente, o que dispara um fetch por bloco na mesma requisição; aqui
 * seguimos o outro.
 *
 * Sob SSR isto roda a cada requisição. O `?t=` evita que o Minio devolva uma
 * versão em cache logo depois de alguém subir o arquivo — que é justamente o
 * fluxo de edição: sobe o content.json e a mudança está no ar, sem deploy.
 *
 * Nunca lança: se o Minio estiver fora, a página sobe com o conteúdo local que
 * foi junto no build. O que o build carrega é o fallback, não a verdade.
 *
 * O TIMEOUT é o que faz esse fallback existir de verdade. 404 e conexão
 * recusada falham rápido e caem sozinhos no catch. Um Minio meio morto —
 * conecta e não responde — não: sem prazo, o fetch espera para sempre, e como
 * o SSR roda sem cache isso acontece a CADA requisição. A LP cairia junto com
 * um Minio que nem chegou a cair. Vencido o prazo, o AbortSignal lança e o
 * catch abaixo serve o conteúdo local, que é o comportamento desejado.
 */
const TIMEOUT_MS = 2500;
export const getEncontroContent = async () => {
  try {
    const res = await fetch(`${S3_JSON_URL}?t=${Date.now()}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.ok) {
      const remoto = await res.json();
      console.log("[EncontroService] Conteúdo carregado do Minio");
      // Sobre o local, não em vez dele: ver mesclar().
      return transformData(mesclar(localContentData, remoto));
    }
    console.warn(
      `[EncontroService] Minio fetch não-OK: ${res.status} ${res.statusText}`,
    );
  } catch (err) {
    const nome = (err as Error)?.name;
    if (nome === "TimeoutError" || nome === "AbortError") {
      console.warn(`[EncontroService] Minio não respondeu em ${TIMEOUT_MS}ms`);
    } else {
      console.error("[EncontroService] Erro ao conectar com Minio:", err);
    }
  }

  console.log("[EncontroService] Usando fallback local");
  return transformData(localContentData);
};
