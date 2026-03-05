export function getPartnerLogos() {
  const sponsorsFiles: Record<string, any> = import.meta.glob(
    "../assets/logos/patrocinio/*.{jpeg,jpg,png,webp,svg}",
    { eager: true },
  );
  const supportFiles: Record<string, any> = import.meta.glob(
    "../assets/logos/apoidores/*.{jpeg,jpg,png,webp,svg}",
    { eager: true },
  );

  const sponsorsMap: Record<string, any> = {};
  Object.keys(sponsorsFiles).forEach((path) => {
    const filename = path.split("/").pop() || "";
    sponsorsMap[filename] = sponsorsFiles[path].default;
  });

  const supportMap: Record<string, any> = {};
  Object.keys(supportFiles).forEach((path) => {
    const filename = path.split("/").pop() || "";
    supportMap[filename] = supportFiles[path].default;
  });

  return { sponsorsMap, supportMap };
}
