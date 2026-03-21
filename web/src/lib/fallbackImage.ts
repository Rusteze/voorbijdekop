export function getFallbackImage(topic?: string) {
  const t = (topic ?? "").toLowerCase().trim();

  // JPG-only fallbacks (geen SVGs) zodat de UI altijd naar bestaande jpg-paden verwijst.
  const map: Record<string, string> = {
    // Categories (hoog-niveau) -> foto-gevoel consistent met topics
    geopolitiek: "/fallbacks/geopolitiek.jpg",
    economie: "/fallbacks/energiepolitiek.jpg",
    technologie: "/fallbacks/technologische-macht.jpg",
    samenleving: "/fallbacks/diplomatie.jpg",
    sport: "/fallbacks/default.jpg",
    overig: "/fallbacks/default.jpg",

    conflict: "/fallbacks/conflict.jpg",
    oorlog: "/fallbacks/oorlog.jpg",
    spionage: "/fallbacks/spionage.jpg",
    inlichtingen: "/fallbacks/inlichtingen.jpg",
    diplomatie: "/fallbacks/diplomatie.jpg",
    sancties: "/fallbacks/sancties.jpg",
    handelsconflict: "/fallbacks/handelsconflict.jpg",
    energiepolitiek: "/fallbacks/energiepolitiek.jpg",
    defensie: "/fallbacks/defensie.jpg",
    "militaire strategie": "/fallbacks/militaire-strategie.jpg",

    cyberoorlog: "/fallbacks/cyberoorlog.jpg",
    "desinformatie": "/fallbacks/cyberoorlog.jpg",
    "beïnvloeding": "/fallbacks/cyberoorlog.jpg",
    "technologische macht": "/fallbacks/technologische-macht.jpg",

    "hybride oorlog": "/fallbacks/conflict.jpg",
    propaganda: "/fallbacks/conflict.jpg",
    "politieke instabiliteit": "/fallbacks/politieke-instabiliteit.jpg",

    machtsverschuiving: "/fallbacks/geopolitiek.jpg",
  };

  return map[t] || "/fallbacks/default.jpg";
}
