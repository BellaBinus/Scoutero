const NON_US_INDICATORS = [
  "amsterdam", "london", "singapore", "berlin", "paris", "toronto", "tokyo",
  "sydney", "dubai", "bangalore", "bengaluru", "chennai", "hyderabad",
  "mexico", "colombia", "brazil", "argentina", "ireland", "india", "china",
  "hong kong", "emea", "apac", "latam", "uk", "u.k.", "europe",
  "canada", "australia", "luxembourg", "warsaw", "bucharest", "barcelona",
  "madrid", "stockholm", "munich", "zurich", "switzerland", "spain",
  "dublin", "ie-",
];

const CITY_COORDS: Record<string, [number, number]> = {
  "san francisco": [37.7749, -122.4194],
  "sf": [37.7749, -122.4194],
  "daly city": [37.6879, -122.4702],
  "south san francisco": [37.6547, -122.4077],
  "san bruno": [37.6305, -122.4111],
  "burlingame": [37.5841, -122.3660],
  "san mateo": [37.5630, -122.3255],
  "foster city": [37.5585, -122.2711],
  "redwood city": [37.4852, -122.2364],
  "menlo park": [37.4529, -122.1817],
  "palo alto": [37.4419, -122.1430],
  "mountain view": [37.3861, -122.0839],
  "sunnyvale": [37.3688, -122.0363],
  "santa clara": [37.3541, -121.9552],
  "cupertino": [37.3229, -122.0322],
  "san jose": [37.3382, -121.8863],
  "milpitas": [37.4323, -121.8996],
  "fremont": [37.5485, -121.9886],
  "newark": [37.5296, -122.0402],
  "union city": [37.5934, -122.0438],
  "hayward": [37.6688, -122.0808],
  "castro valley": [37.6946, -122.0858],
  "san leandro": [37.7249, -122.1561],
  "alameda": [37.7652, -122.2416],
  "oakland": [37.8044, -122.2712],
  "berkeley": [37.8716, -122.2727],
  "emeryville": [37.8310, -122.2855],
  "richmond": [37.9358, -122.3478],
  "el cerrito": [37.9238, -122.3177],
  "san pablo": [37.9616, -122.3449],
  "san rafael": [37.9735, -122.5311],
  "novato": [38.1074, -122.5697],
  "mill valley": [37.9060, -122.5449],
  "sausalito": [37.8590, -122.4852],
  "tiburon": [37.8915, -122.4569],
  "corte madera": [37.9254, -122.5244],
  "san anselmo": [37.9754, -122.5616],
  "fairfax": [37.9871, -122.5888],
  "walnut creek": [37.9101, -122.0652],
  "concord": [37.9780, -122.0311],
  "pleasant hill": [37.9479, -122.0608],
  "martinez": [37.9955, -122.1341],
  "pittsburg": [38.0280, -121.8947],
  "antioch": [37.9966, -121.8058],
  "brentwood": [37.9316, -121.6958],
  "san ramon": [37.7799, -121.9780],
  "danville": [37.8216, -121.9996],
  "pleasanton": [37.6624, -121.8747],
  "livermore": [37.6819, -121.7681],
  "dublin": [37.7021, -121.9358],
};

export type LocationFilter = {
  usRemote: boolean;
  usLocal: boolean;
  city: string;
  radiusMiles: number;
};

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

function resolveCityCoords(cityQuery: string): [number, number] | null {
  const q = cityQuery.toLowerCase().trim();
  if (CITY_COORDS[q]) return CITY_COORDS[q];
  for (const [key, coords] of Object.entries(CITY_COORDS)) {
    if (q.includes(key) || key.includes(q)) return coords;
  }
  return null;
}

function isWithinCityRadius(location: string, centerCity: string, radiusMiles: number): boolean {
  if (!location) return false;
  const loc = location.toLowerCase();
  if (NON_US_INDICATORS.some((kw) => loc.includes(kw))) return false;
  const centerCoords = resolveCityCoords(centerCity);
  if (!centerCoords) return false;
  const [cLat, cLng] = centerCoords;
  const SF_AREA_LABELS = ["bay area", "sf bay", "silicon valley", "south bay", "east bay"];
  if (SF_AREA_LABELS.some((label) => loc.includes(label))) return true;
  for (const [cityKey, [lat, lng]] of Object.entries(CITY_COORDS)) {
    if (loc.includes(cityKey)) {
      const dist = haversineDistance(cLat, cLng, lat, lng);
      if (dist <= radiusMiles) return true;
    }
  }
  return false;
}

function isBroadlyUs(location: string | null | undefined): boolean {
  if (!location) return true;
  const loc = location.toLowerCase().trim();
  if (/,\s*united states/.test(loc) && !/\bremote\b/.test(loc)) return false;
  if (/,\s*usa\.?$/i.test(loc) && !/\bremote\b/.test(loc)) return false;
  if (/\bremote\b.*(united states|usa|u\.s\.a?\.?)/.test(loc)) return true;
  if (/(united states|usa|u\.s\.a?\.?).*\bremote\b/.test(loc)) return true;
  if (NON_US_INDICATORS.some((kw) => loc.includes(kw))) return false;
  if (/^(remote|us|u\.s\.|united states|united states of america)$/.test(loc)) return true;
  if (/\b(usa|u\.s\.a?\.)/.test(loc)) return true;
  if (/^remote[\s\-\(,]*(us|u\.s\.|usa|united states)/i.test(loc)) return true;
  if (/^(us|u\.s\.|usa|united states)[\s\-\(,]*remote/i.test(loc)) return true;
  return false;
}

function splitMultiLocation(locStr: string): string[] {
  // Split on semicolons (multi-location ATS format like "New York; San Francisco")
  // then further split each part on " or " (natural language format)
  return locStr
    .split(/;\s*/)
    .flatMap((seg) => {
      if (!/ or /i.test(seg)) return [seg.trim()];
      const parts = seg
        .split(/, (?=[A-Z][a-z]|or )/)
        .map((s) => s.replace(/^or\s+/i, "").trim())
        .filter(Boolean);
      return parts.length > 0 ? parts : [seg.trim()];
    })
    .filter(Boolean);
}

function titleHasNonUsHint(title: string | null | undefined): boolean {
  if (!title) return false;
  const t = title.toLowerCase();
  return NON_US_INDICATORS.some((kw) => t.includes(kw));
}

export function matchesLocationFilter(
  location: string | null | undefined,
  title: string | null | undefined,
  filter: LocationFilter,
  requireCityMatch = false,
): boolean {
  const anyChecked = filter.usRemote || filter.usLocal;
  if (!anyChecked) return true;
  const segments = location ? splitMultiLocation(location) : [""];
  for (const seg of segments) {
    // When requireCityMatch is set, skip remote matching entirely — only allow city radius hits
    if (!requireCityMatch && filter.usRemote && isBroadlyUs(seg)) {
      if (seg.toLowerCase() === "remote" && title && titleHasNonUsHint(title)) continue;
      return true;
    }
    if (filter.usLocal && filter.city.trim().length > 0 && isWithinCityRadius(seg, filter.city, filter.radiusMiles)) {
      return true;
    }
  }
  return false;
}
