import localContentData from "../data/pascoa/content.json";

const S3_JSON_URL = "https://s3.cndr.me/lp-content/pascoa/content.json";
const S3_ASSETS_BASE = "https://s3.cndr.me/lp-content/pascoa/pascoa/";

/**
 * Transforms relative asset paths to absolute S3 URLs.
 */
const transformData = (obj: any): any => {
  if (typeof obj === 'string') {
    if (obj.startsWith('/assets/pascoa/')) {
      return obj.replace('/assets/pascoa/', S3_ASSETS_BASE);
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
 * Fetches Pascoa content from S3 with a local fallback.
 */
export const getPascoaContent = async () => {
  try {
    const response = await fetch(S3_JSON_URL);
    if (response.ok) {
      const remoteData = await response.json();
      return transformData(remoteData);
    }
    console.warn("S3 response not OK, using local fallback");
  } catch (error) {
    console.error("Error fetching remote content from S3, using local fallback:", error);
  }
  
  // Fallback to local data (transformed so local paths also work if needed, 
  // or return as is if local paths are intended for local dev)
  return localContentData;
};
