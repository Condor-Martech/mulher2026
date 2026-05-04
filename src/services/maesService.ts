import localContentData from "../data/maes/content.json";

const S3_JSON_URL = "https://s3.cndr.me/lp-content/maes/content.json";
const S3_ASSETS_BASE = "https://s3.cndr.me/lp-content/maes/assets/";

/**
 * Transforms relative asset paths to absolute S3 URLs.
 */
const transformData = (obj: any): any => {
  if (typeof obj === 'string') {
    if (obj.startsWith('/assets/maes/')) {
      return obj.replace('/assets/maes/', S3_ASSETS_BASE);
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
 */
export const getMaesContent = async () => {
  const isDev = import.meta.env.DEV;
  
  // In development, we might want to stick to local assets to verify our changes
  // or if we know S3 hasn't been synced yet.
  if (isDev) {
    return localContentData;
  }

  try {
    const response = await fetch(S3_JSON_URL);
    if (response.ok) {
      const remoteData = await response.json();
      return transformData(remoteData);
    }
  } catch (error) {
    console.error("Error fetching remote Maes content from S3:", error);
  }
  
  return localContentData;
};
