import { SOURCES } from "./sources.js";

export type Feed = {
  domain: string;
  url: string;
};

// MVP: een subset met publiek toegankelijke RSS feeds.
// Je kunt dit uitbreiden; ingest blijft whitelist-enforced op domein.
export const FEEDS: Feed[] = [
  { domain: "nos.nl", url: "https://feeds.nos.nl/nosnieuwsalgemeen" },
  // NRC RSS endpoints (subdomein-distributie)
  { domain: "nrc.nl", url: "https://ipad.nrc.nl/rss/" },
  { domain: "nrc.nl", url: "http://vorige.nrc.nl/rss/" },

  // DPG Media
  { domain: "volkskrant.nl", url: "https://www.volkskrant.nl/voorpagina/rss.xml" },
  { domain: "trouw.nl", url: "https://www.trouw.nl/voorpagina/rss.xml" },

  // International
  { domain: "bbc.com", url: "https://feeds.bbci.co.uk/news/rss.xml" },
  { domain: "bbc.com", url: "https://feeds.bbci.co.uk/news/world/rss.xml" },
  { domain: "theguardian.com", url: "https://www.theguardian.com/world/rss" },
  { domain: "aljazeera.com", url: "https://www.aljazeera.com/xml/rss/all.xml" },
  { domain: "ft.com", url: "https://www.ft.com/news-feed?format=rss" },
  { domain: "politico.com", url: "https://rss.politico.com/economy.xml" },
  { domain: "politico.com", url: "https://rss.politico.com/energy.xml" },
  { domain: "politico.com", url: "https://rss.politico.com/politics-news.xml" },     

  // Tech
  { domain: "arstechnica.com", url: "https://feeds.arstechnica.com/arstechnica/index" },

  // --- uitbreiding: international / geopolitics overlap ---
  { domain: "bbc.co.uk", url: "http://feeds.bbci.co.uk/news/world/rss.xml" },
  { domain: "ft.com", url: "https://www.ft.com/world?format=rss" },
  { domain: "dw.com", url: "https://rss.dw.com/xml/rss-en-world" },
  { domain: "france24.com", url: "https://www.france24.com/en/rss" },

  // --- niche: intelligence / geopolitics ---
  { domain: "thecipherbrief.com", url: "https://www.thecipherbrief.com/feed" },
  { domain: "warontherocks.com", url: "https://warontherocks.com/feed/" },
  { domain: "defence-blog.com", url: "https://defence-blog.com/feed/" },
  { domain: "globalissues.org", url: "https://www.globalissues.org/news/feed" },
  { domain: "politico.com", url: "https://rss.politico.com/defense.xml" },
  // --- Reuters alternatief (publiek RSS) ---
  { domain: "reutersbest.com", url: "https://reutersbest.com/feed/" },
  // --- Rijksoverheid (publiek RSS) ---
  { domain: "feeds.rijksoverheid.nl", url: "https://feeds.rijksoverheid.nl/nieuws.rss" },
  { domain: "feeds.rijksoverheid.nl", url: "https://feeds.rijksoverheid.nl/regering/nieuws.rss" },
  { domain: "feeds.rijksoverheid.nl", url: "https://feeds.rijksoverheid.nl/besluiten.rss" }
];

// Sanity: alleen feeds van whitelisted domeinen.
const allowed = new Set(SOURCES.map((s) => s.domain));
for (const f of FEEDS) {
  if (!allowed.has(f.domain)) {
    throw new Error(`Feed domein niet whitelisted: ${f.domain}`);
  }
}

