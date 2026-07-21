export type VehicleReference = {
  url: string;
  sourceUrl: string;
  title: string;
};

type CommonsImageInfo = {
  mime?: string;
  thumburl?: string;
  url?: string;
  descriptionurl?: string;
};

type CommonsPage = {
  index?: number;
  title?: string;
  imageinfo?: CommonsImageInfo[];
};

const COMMONS_API = "https://commons.wikimedia.org/w/api.php";

const requestCommons = async (
  parameters: Record<string, string>,
  signal: AbortSignal,
) => {
  const query = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    origin: "*",
    ...parameters,
  });
  const response = await fetch(`${COMMONS_API}?${query}`, { signal });
  if (!response.ok) throw new Error(`Wikimedia 오류 (${response.status})`);
  return (await response.json()) as {
    query?: {
      pages?: CommonsPage[];
      search?: Array<{ title?: string }>;
    };
  };
};

const firstImage = (pages: CommonsPage[] | undefined): VehicleReference | null => {
  const sortedPages = [...(pages ?? [])].sort(
    (left, right) => (left.index ?? 9999) - (right.index ?? 9999),
  );
  for (const page of sortedPages) {
    const info = page.imageinfo?.[0];
    const url = info?.thumburl || info?.url;
    if (!info?.mime?.startsWith("image/") || !url || !info.descriptionurl) continue;
    return {
      url,
      sourceUrl: info.descriptionurl,
      title: (page.title ?? "Top-1 차량 참고 사진").replace(/^File:/, ""),
    };
  }
  return null;
};

const searchFiles = async (query: string, signal: AbortSignal) => {
  const payload = await requestCommons(
    {
      generator: "search",
      gsrsearch: query,
      gsrnamespace: "6",
      gsrlimit: "8",
      prop: "imageinfo",
      iiprop: "url|mime",
      iiurlwidth: "900",
    },
    signal,
  );
  return firstImage(payload.query?.pages);
};

const searchCategory = async (query: string, signal: AbortSignal) => {
  const categorySearch = await requestCommons(
    { list: "search", srsearch: query, srnamespace: "14", srlimit: "3" },
    signal,
  );
  for (const category of categorySearch.query?.search ?? []) {
    if (!category.title?.startsWith("Category:")) continue;
    const payload = await requestCommons(
      {
        generator: "categorymembers",
        gcmtitle: category.title,
        gcmtype: "file",
        gcmlimit: "8",
        prop: "imageinfo",
        iiprop: "url|mime",
        iiurlwidth: "900",
      },
      signal,
    );
    const result = firstImage(payload.query?.pages);
    if (result) return result;
  }
  return null;
};

const searchQueries = (productName: string) => {
  const aliases: Record<string, string> = {
    "Maybach Landaulet": "Maybach 62 S Landaulet",
  };
  const withoutYear = productName
    .replace(/\s*\((?:19|20)\d{2}\)\s*$/, "")
    .replace(/\s+(?:19|20)\d{2}\s*$/, "")
    .trim();
  const modelOnly = withoutYear
    .replace(
      /\s+(Sedan|Hatchback|Convertible|Coupe|Wagon|Minivan|세단|해치백|컨버터블|쿠페|왜건|미니밴)$/i,
      "",
    )
    .trim();
  const alias = Object.entries(aliases).find(([name]) =>
    productName.startsWith(name),
  )?.[1];
  return [...new Set([alias, productName, withoutYear, modelOnly].filter(Boolean))] as string[];
};

export const lookupVehicleReference = async (
  productName: string,
  signal: AbortSignal,
): Promise<VehicleReference | null> => {
  const queries = searchQueries(productName);
  for (const query of queries) {
    const result = await searchFiles(query, signal);
    if (result) return result;
  }
  for (const query of [...queries].reverse()) {
    const result = await searchCategory(query, signal);
    if (result) return result;
  }
  return null;
};
