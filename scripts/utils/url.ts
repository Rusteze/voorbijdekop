const TRACKING_PARAMS = [
  /^utm_/i,
  /^fbclid$/i,
  /^gclid$/i,
  /^igshid$/i,
  /^mc_cid$/i,
  /^mc_eid$/i,
  /^ref$/i,
  /^ref_src$/i,
  /^cmpid$/i,
  /^campaign$/i,
  /^source$/i,
  /^ns_campaign$/i,
  /^ns_mchannel$/i,
  /^ns_source$/i
];

function stripWww(hostname: string) {
  return hostname.toLowerCase().replace(/^www\./, "");
}

export function canonicalizeUrl(input: string): { url: string; domain: string } | null {
  try {
    // Veel RSS feeds HTML-encoden query strings (&amp;). Decodeer minimaal.
    const decoded = input.replace(/&amp;/g, "&");
    const u = new URL(decoded);
    u.hash = "";

    // normalize hostname
    u.hostname = stripWww(u.hostname);

    // strip tracking params
    const newParams = new URLSearchParams();
    for (const [k, v] of u.searchParams.entries()) {
      if (TRACKING_PARAMS.some((rx) => rx.test(k))) continue;
      if (v === "") continue;
      newParams.append(k, v);
    }
    u.search = newParams.toString();

    // normalize trailing slash (keep for root only)
    if (u.pathname !== "/" && u.pathname.endsWith("/")) {
      u.pathname = u.pathname.replace(/\/+$/, "");
    }

    return { url: u.toString(), domain: u.hostname };
  } catch {
    return null;
  }
}

