import localContentData from "../data/maes/content.json";

const S3_JSON_URL = "https://s3.cndr.me/lp-content/maes/content.json";
const S3_ASSETS_BASE = "https://s3.cndr.me/lp-content/maes/";

/**
 * Transforms relative asset paths to absolute S3 URLs.
 */
const transformData = (obj: any): any => {
  if (typeof obj === 'string') {
    if (obj.startsWith('/assets/maes/')) {
      const timestamp = Date.now();
      const newUrl = obj.replace('/assets/maes/', S3_ASSETS_BASE) + `?v=${timestamp}`;
      // Log specific URLs to verify them in the terminal
      if (obj.includes('TIROL') || obj.includes('Melitta')) {
        console.log(`[MaesService] Transformando: ${obj} -> ${newUrl}`);
      }
      return newUrl;
    }
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(transformData);
  }
  if (obj !== null && typeof obj === 'object') {
    const newObj: any = {};
    for (const key in obj) {
      newObj[key] = transformData(obj[key]);
    }
    return newObj;
  }
  return obj;
};

/**
 * Fetches Maes content from S3 with a local fallback.
 * Called from .astro frontmatter — under SSR this runs on every request.
 */
export const getMaesContent = async () => {
  try {
    const response = await fetch(`${S3_JSON_URL}?t=${Date.now()}`);
    if (response.ok) {
      const remoteData = await response.json();
      const transformed = transformData(remoteData);
      console.log("[MaesService] Contenido cargado desde Minio correctamente");
      return transformed;
    }
    console.warn(`[MaesService] Error en fetch de Minio: ${response.status} ${response.statusText}`);
  } catch (error) {
    console.error("[MaesService] Error conectando con Minio:", error);
  }

  console.log("[MaesService] Usando fallback local transformado");
  return transformData(localContentData);
};
