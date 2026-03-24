export type SourceType = "news" | "investigative" | "analysis" | "tech";
export type SourceBias =
  | "neutral"
  | "slightly-left"
  | "left"
  | "center"
  | "mixed"
  | "independent"
  | "varied";
export type SourceDepth = "medium" | "high" | "very-high";
export type SourceRegion = "nl" | "intl";

export type Source = {
  domain: string;
  type: SourceType;
  bias: SourceBias;
  depth: SourceDepth;
  region?: SourceRegion;
};

export const SOURCES: Source[] = [
  // 🇳🇱 Netherlands (core)
  { domain: "nos.nl", type: "news", bias: "neutral", depth: "medium", region: "nl" },
  // Rijksoverheid (publieke RSS)
  { domain: "feeds.rijksoverheid.nl", type: "news", bias: "neutral", depth: "medium", region: "nl" },
  { domain: "rijksoverheid.nl", type: "news", bias: "neutral", depth: "medium", region: "nl" },
  // NRC publiceert RSS via subdomeinen (zelfde redactie/bron, enkel distributie)
  { domain: "ipad.nrc.nl", type: "news", bias: "slightly-left", depth: "high", region: "nl" },
  { domain: "vorige.nrc.nl", type: "news", bias: "slightly-left", depth: "high", region: "nl" },
  { domain: "nrc.nl", type: "news", bias: "slightly-left", depth: "high", region: "nl" },
  { domain: "volkskrant.nl", type: "news", bias: "slightly-left", depth: "high", region: "nl" },
  { domain: "trouw.nl", type: "news", bias: "center", depth: "high", region: "nl" },
  { domain: "ftm.nl", type: "investigative", bias: "independent", depth: "high", region: "nl" },

  // 🌍 International news
  { domain: "bbc.com", type: "news", bias: "neutral", depth: "high", region: "intl" },
  // Sommige BBC items linken naar bbc.co.uk (zelfde bron, ander domein)
  { domain: "bbc.co.uk", type: "news", bias: "neutral", depth: "high", region: "intl" },
  { domain: "reuters.com", type: "news", bias: "neutral", depth: "high", region: "intl" },
  // Publieke RSS-alternatief (reuters.com RSS endpoints geven vaak 401/DNS-issues)
  { domain: "reutersbest.com", type: "news", bias: "neutral", depth: "high", region: "intl" },
  { domain: "apnews.com", type: "news", bias: "neutral", depth: "high", region: "intl" },
  { domain: "aljazeera.com", type: "news", bias: "mixed", depth: "high", region: "intl" },
  { domain: "theguardian.com", type: "news", bias: "left", depth: "high", region: "intl" },
  { domain: "ft.com", type: "news", bias: "center", depth: "high", region: "intl" },
  { domain: "politico.com", type: "news", bias: "center", depth: "high", region: "intl" },
  { domain: "dw.com", type: "news", bias: "neutral", depth: "high", region: "intl" },
  { domain: "france24.com", type: "news", bias: "mixed", depth: "high", region: "intl" },

  // 🔎 Investigative journalism
  { domain: "bellingcat.com", type: "investigative", bias: "independent", depth: "very-high", region: "intl" },
  { domain: "propublica.org", type: "investigative", bias: "independent", depth: "very-high", region: "intl" },
  { domain: "icij.org", type: "investigative", bias: "independent", depth: "very-high", region: "intl" },
  { domain: "occrp.org", type: "investigative", bias: "independent", depth: "very-high", region: "intl" },

  // 🧠 Analysis / think tanks
  { domain: "warontherocks.com", type: "analysis", bias: "varied", depth: "high", region: "intl" },
  { domain: "thecipherbrief.com", type: "analysis", bias: "varied", depth: "high", region: "intl" },
  { domain: "lawfaremedia.org", type: "analysis", bias: "center", depth: "high", region: "intl" },
  { domain: "carnegieendowment.org", type: "analysis", bias: "center", depth: "high", region: "intl" },
  { domain: "brookings.edu", type: "analysis", bias: "center", depth: "high", region: "intl" },
  { domain: "globalissues.org", type: "analysis", bias: "varied", depth: "medium", region: "intl" },

  // 🛰 Defence / security niche
  { domain: "defence-blog.com", type: "news", bias: "varied", depth: "medium", region: "intl" },

  // 💻 Tech / cyber
  { domain: "wired.com", type: "tech", bias: "center", depth: "medium", region: "intl" },
  { domain: "arstechnica.com", type: "tech", bias: "center", depth: "high", region: "intl" },
  { domain: "therecord.media", type: "tech", bias: "center", depth: "high", region: "intl" }
];

export const SOURCE_BY_DOMAIN = new Map(SOURCES.map((s) => [s.domain, s] as const));

