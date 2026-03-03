export function getPartnerLogos() {
  const sponsorsFiles = import.meta.glob(
    "../assets/logos/patrocinio/*.{jpeg,jpg,png,webp,svg}",
    { eager: true },
  );
  const sponsorsData = Object.values(sponsorsFiles).map(
    (file: any) => file.default,
  );

  const supportFiles = import.meta.glob(
    "../assets/logos/apoidores/*.{jpeg,jpg,png,webp,svg}",
    { eager: true },
  );
  const supportData = Object.values(supportFiles).map(
    (file: any) => file.default,
  );

  return { sponsorsData, supportData };
}
