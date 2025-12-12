const globResult = import.meta.glob("../../categoryImages/**/*.{png,jpg,jpeg,webp,avif}", {
  eager: true,
  import: "default",
});

type CategoryMap = Record<string, string[]>;

const map: CategoryMap = {};
const FALLBACK_CATEGORIES = [
  "Technology",
  "HBCU Mascots",
  "Black Movies",
  "Black Athletes",
  "Musical Instruments",
  "Black History",
  "Famous Divine 9",
  "African Geography",
  "Thanksgiving",
  "Black Music Artists",
];

Object.entries(globResult).forEach(([path, mod]) => {
  const parts = path.split("/");
  const folderIndex = parts.findIndex((p) => p === "categoryImages");
  const category = parts[folderIndex + 1];
  const url = mod as string;
  if (!category) return;
  if (!map[category]) {
    map[category] = [];
  }
  map[category].push(url);
});

const categoryNames = Object.keys(map);
const CATEGORY_IMAGES: CategoryMap =
  categoryNames.length > 0 ? map : Object.fromEntries(FALLBACK_CATEGORIES.map((c) => [c, []]));

export { CATEGORY_IMAGES };
export const CATEGORY_NAMES: string[] = categoryNames.length > 0 ? categoryNames : FALLBACK_CATEGORIES;
