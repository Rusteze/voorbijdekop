export type EditorialKind = "book" | "film" | "podcast" | "series" | "link";

export type EditorialPickFile =
  | { enabled: false }
  | {
      enabled: true;
      title: string;
      dek: string;
      kind: EditorialKind;
      label: string;
      href: string;
      imageUrl?: string;
      updatedAt?: string;
      external: boolean;
    };

export const EDITORIAL_KIND_LABEL_NL: Record<EditorialKind, string> = {
  book: "Boek",
  film: "Film",
  podcast: "Podcast",
  series: "Serie",
  link: "Link"
};
