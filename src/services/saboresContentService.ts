import localContentData from "../data/sabores/content.json";

const S3_JSON_URL =
  "https://s3.cndr.me/lp-content/sabores-de-inverno/content.json";
export const SABORES_ASSETS_BASE =
  "https://s3.cndr.me/lp-content/sabores-de-inverno/";

const LOCAL_PREFIX = "/assets/sabores-de-inverno/";

/**
 * Swap de un path local de asset a su URL en Minio. Reutilizable para los paths
 * que NO pasan por el content.json (covers dinámicos `${event.id}.jpg`, fallback
 * del brandmark, OG image, CSS vars). Si el string no es un path local conocido,
 * se devuelve tal cual.
 *
 * A diferencia de maesService, NO agrega `?v=timestamp`: las imágenes son
 * inmutables por upload, así que dejamos que el browser/CDN las cacheen. El
 * cache-busting vive solo en el fetch del JSON (`?t=`).
 */
export const toSaboresCdn = (path: string): string =>
  typeof path === "string" && path.startsWith(LOCAL_PREFIX)
    ? path.replace(LOCAL_PREFIX, SABORES_ASSETS_BASE)
    : path;

/** Recorre el árbol y aplica `toSaboresCdn` a cada string. */
const transformData = (obj: any): any => {
  if (typeof obj === "string") return toSaboresCdn(obj);
  if (Array.isArray(obj)) return obj.map(transformData);
  if (obj !== null && typeof obj === "object") {
    const out: any = {};
    for (const k in obj) out[k] = transformData(obj[k]);
    return out;
  }
  return obj;
};

/**
 * Carga el content de Sabores desde Minio con fallback local.
 * Llamado desde el frontmatter de index.astro (y del layout en la ruta palestra).
 * Bajo SSR corre en cada request.
 */
export const getSaboresContent = async () => {
  try {
    const res = await fetch(`${S3_JSON_URL}?t=${Date.now()}`);
    if (res.ok) {
      console.log("[SaboresService] Conteúdo carregado do Minio");
      return transformData(await res.json());
    }
    console.warn(
      `[SaboresService] Minio fetch não-OK: ${res.status} ${res.statusText}`,
    );
  } catch (err) {
    console.error("[SaboresService] Erro ao conectar com Minio:", err);
  }

  console.log("[SaboresService] Usando fallback local");
  return transformData(localContentData);
};
