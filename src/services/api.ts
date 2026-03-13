const S3_PATH = "https://s3.cndr.me/lp-content";

/**
 * Fetches store links from the remote radar.json endpoint.
 * Implements status validation and best practices.
 */
export async function getStoreLinks(name: string): Promise<any> {
  try {
    const basePath = `${S3_PATH}/${name}/${name}.json`;
    const response = await fetch(basePath);

    if (!response.ok) {
      throw new Error(`Failed to fetch store links: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    // Validate that we received an array
    if (!Array.isArray(data)) {
      console.error("Invalid data format received from API:", data);
      return [];
    }

    return data;
  } catch (error) {
    console.error("Error fetching store links:", error);
    // Returning empty array to prevent UI crashes while logging the error
    return [];
  }
}