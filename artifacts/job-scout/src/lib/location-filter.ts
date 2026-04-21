const NON_US_INDICATORS = [
  "amsterdam", "london", "singapore", "berlin", "paris", "toronto", "tokyo",
  "sydney", "dubai", "bangalore", "bengaluru", "chennai", "hyderabad",
  "mexico", "colombia", "brazil", "argentina", "ireland", "india", "china",
  "hong kong", "emea", "apac", "latam", "uk", "u.k.", "europe",
  "canada", "australia", "luxembourg", "warsaw", "bucharest", "barcelona",
  "madrid", "stockholm", "munich", "zurich", "switzerland", "spain",
  "dublin", "ie-",
];

const SF_LAT = 37.7749;
const SF_LNG = -122.4194;
const SF_AREA_LABELS = ["bay area", "sf bay", "silicon valley", "south bay", "east bay"];

export const CITY_COORDS: Record<string, [number, number]> = {
  // Bay Area / Northern California
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
  "hayward": [37.6688, -122.0808],
  "oakland": [37.8044, -122.2712],
  "berkeley": [37.8716, -122.2727],
  "san leandro": [37.7249, -122.1561],
  "san rafael": [37.9735, -122.5311],
  "walnut creek": [37.9101, -122.0652],
  "concord": [37.9780, -122.0311],
  "pleasanton": [37.6624, -121.8747],
  "livermore": [37.6819, -121.7681],
  "san ramon": [37.7799, -121.9780],
  "sacramento": [38.5816, -121.4944],
  // Southern California
  "los angeles": [34.0522, -118.2437],
  "la": [34.0522, -118.2437],
  "santa monica": [34.0195, -118.4912],
  "west hollywood": [34.0900, -118.3617],
  "culver city": [34.0211, -118.3965],
  "burbank": [34.1808, -118.3090],
  "glendale": [34.1425, -118.2551],
  "pasadena": [34.1478, -118.1445],
  "long beach": [33.7701, -118.1937],
  "torrance": [33.8358, -118.3406],
  "el segundo": [33.9192, -118.4165],
  "manhattan beach": [33.8847, -118.4109],
  "irvine": [33.6846, -117.8265],
  "anaheim": [33.8353, -117.9145],
  "santa ana": [33.7455, -117.8677],
  "san diego": [32.7157, -117.1611],
  // Pacific Northwest
  "seattle": [47.6062, -122.3321],
  "bellevue": [47.6101, -122.2015],
  "redmond": [47.6740, -122.1215],
  "kirkland": [47.6769, -122.2060],
  "tacoma": [47.2529, -122.4443],
  "portland": [45.5051, -122.6750],
  "beaverton": [45.4871, -122.8037],
  // Southwest
  "phoenix": [33.4484, -112.0740],
  "scottsdale": [33.4942, -111.9261],
  "tempe": [33.4255, -111.9400],
  "chandler": [33.3062, -111.8413],
  "mesa": [33.4152, -111.8315],
  "tucson": [32.2226, -110.9747],
  "las vegas": [36.1699, -115.1398],
  "henderson": [36.0395, -114.9817],
  // Mountain / Denver
  "denver": [39.7392, -104.9903],
  "boulder": [40.0150, -105.2705],
  "aurora": [39.7294, -104.8319],
  "colorado springs": [38.8339, -104.8214],
  "salt lake city": [40.7608, -111.8910],
  "albuquerque": [35.0853, -106.6056],
  // Texas
  "austin": [30.2672, -97.7431],
  "dallas": [32.7767, -96.7970],
  "houston": [29.7604, -95.3698],
  "san antonio": [29.4241, -98.4936],
  "fort worth": [32.7555, -97.3308],
  "plano": [33.0198, -96.6989],
  "irving": [32.8140, -96.9490],
  "frisco": [33.1507, -96.8236],
  // Midwest
  "chicago": [41.8781, -87.6298],
  "evanston": [42.0450, -87.6877],
  "naperville": [41.7508, -88.1535],
  "minneapolis": [44.9778, -93.2650],
  "saint paul": [44.9537, -93.0900],
  "kansas city": [39.0997, -94.5786],
  "omaha": [41.2565, -95.9345],
  "detroit": [42.3314, -83.0458],
  "ann arbor": [42.2808, -83.7430],
  "columbus": [39.9612, -82.9988],
  "cleveland": [41.4993, -81.6944],
  "cincinnati": [39.1031, -84.5120],
  "indianapolis": [39.7684, -86.1581],
  "milwaukee": [43.0389, -87.9065],
  "st. louis": [38.6270, -90.1994],
  "saint louis": [38.6270, -90.1994],
  // Southeast
  "atlanta": [33.7490, -84.3880],
  "miami": [25.7617, -80.1918],
  "fort lauderdale": [26.1224, -80.1373],
  "orlando": [28.5383, -81.3792],
  "tampa": [27.9506, -82.4572],
  "charlotte": [35.2271, -80.8431],
  "raleigh": [35.7796, -78.6382],
  "durham": [35.9940, -78.8986],
  "nashville": [36.1627, -86.7816],
  "memphis": [35.1495, -90.0490],
  "louisville": [38.2527, -85.7585],
  "birmingham": [33.5186, -86.8104],
  "new orleans": [29.9511, -90.0715],
  "jacksonville": [30.3322, -81.6557],
  // Northeast
  "new york": [40.7128, -74.0060],
  "nyc": [40.7128, -74.0060],
  "manhattan": [40.7831, -73.9712],
  "brooklyn": [40.6782, -73.9442],
  "queens": [40.7282, -73.7949],
  "bronx": [40.8448, -73.8648],
  "hoboken": [40.7440, -74.0324],
  "jersey city": [40.7178, -74.0431],
  "newark": [40.7357, -74.1724],
  "stamford": [41.0534, -73.5387],
  "boston": [42.3601, -71.0589],
  "cambridge": [42.3736, -71.1097],
  "somerville": [42.3876, -71.0995],
  "waltham": [42.3765, -71.2356],
  "philadelphia": [39.9526, -75.1652],
  "washington": [38.9072, -77.0369],
  "washington dc": [38.9072, -77.0369],
  "dc": [38.9072, -77.0369],
  "arlington": [38.8816, -77.0910],
  "bethesda": [38.9807, -77.1003],
  "baltimore": [39.2904, -76.6122],
  "pittsburgh": [40.4406, -79.9959],
  "richmond": [37.5407, -77.4360],
  "norfolk": [36.8508, -76.2859],
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

export function isBroadlyUs(location: string | null | undefined): boolean {
  if (!location) return true;
  const loc = location.toLowerCase().trim();
  // Reject "City, State, United States" or "City, State, USA" (Greenhouse/Lever format):
  // a country suffix after a comma without "remote" means it's a city-level job, not US-remote.
  if (/,\s*united states/.test(loc) && !/\bremote\b/.test(loc)) return false;
  if (/,\s*usa\.?$/i.test(loc) && !/\bremote\b/.test(loc)) return false;
  // "Remote" + "United States" together → US-remote (priority over non-US indicators,
  // handles "Remote within Canada or United States" combined segments).
  if (/\bremote\b.*(united states|usa|u\.s\.a?\.?)/.test(loc)) return true;
  if (/(united states|usa|u\.s\.a?\.?).*\bremote\b/.test(loc)) return true;
  // Reject non-US country/region indicators
  if (NON_US_INDICATORS.some((kw) => loc.includes(kw))) return false;
  // Simple patterns: bare "Remote", "US", "United States" as the entire segment
  if (/^(remote|us|u\.s\.|united states|united states of america)$/.test(loc)) return true;
  if (/\b(usa|u\.s\.a?\.)/.test(loc)) return true;
  if (/^remote[\s\-\(,]*(us|u\.s\.|usa|united states)/i.test(loc)) return true;
  if (/^(us|u\.s\.|usa|united states)[\s\-\(,]*remote/i.test(loc)) return true;
  return false;
}

/**
 * Split a Greenhouse-style multi-location string into individual segments.
 * "San Francisco, CA, New York, NY, or Remote within United States"
 * → ["San Francisco, CA", "New York, NY", "Remote within United States"]
 *
 * Only splits strings that contain " or " (the Greenhouse multi-location marker).
 * Single-location strings like "New York, New York, United States" (Lever format)
 * are returned as-is to avoid falsely extracting "United States" as a standalone segment.
 */
function splitMultiLocation(locStr: string): string[] {
  if (!/ or /i.test(locStr)) return [locStr.trim()];
  const parts = locStr
    .split(/, (?=[A-Z][a-z]|or )/)
    .map((s) => s.replace(/^or\s+/i, "").trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : [locStr.trim()];
}

function resolveCityCoords(cityQuery: string): [number, number] | null {
  const q = cityQuery.toLowerCase().trim();
  if (CITY_COORDS[q]) return CITY_COORDS[q];
  const entry = Object.entries(CITY_COORDS).find(([city]) => city.includes(q) || q.includes(city));
  return entry ? entry[1] : null;
}

export function isWithinCityRadius(location: string | null | undefined, cityQuery: string, radiusMiles: number): boolean {
  if (!location || !cityQuery.trim()) return false;
  const loc = location.toLowerCase().trim();
  if (NON_US_INDICATORS.some((kw) => loc.includes(kw))) return false;
  const queryCoords = resolveCityCoords(cityQuery);
  if (!queryCoords) return loc.includes(cityQuery.toLowerCase().trim());
  const [queryLat, queryLng] = queryCoords;
  if (SF_AREA_LABELS.some((label) => loc.includes(label))) {
    return haversineDistance(queryLat, queryLng, SF_LAT, SF_LNG) <= radiusMiles;
  }
  for (const [city, [lat, lng]] of Object.entries(CITY_COORDS)) {
    if (loc.includes(city)) {
      if (haversineDistance(queryLat, queryLng, lat, lng) <= radiusMiles) return true;
    }
  }
  return loc.includes(cityQuery.toLowerCase().trim());
}

export type LocationState = {
  usRemote: boolean;
  usLocal: boolean;
  city: string;
  radiusMiles: number;
};

// When the ATS reports "Remote" but the job title contains a non-US place name
// (e.g. "Senior Fraud Ops | Singapore"), treat it as non-US.
function titleHasNonUsHint(title: string | null | undefined): boolean {
  if (!title) return false;
  const t = title.toLowerCase();
  return NON_US_INDICATORS.some((kw) => t.includes(kw));
}

export function matchesLocation(
  location: string | null | undefined,
  loc: LocationState,
  title?: string | null,
  requireCityMatch = false,
): boolean {
  const anyChecked = loc.usRemote || loc.usLocal;
  if (!anyChecked) return true;
  const segments = location ? splitMultiLocation(location) : [""];
  for (const seg of segments) {
    // When requireCityMatch is set, skip remote matching entirely — only allow city radius hits
    if (!requireCityMatch && loc.usRemote && isBroadlyUs(seg)) {
      if (seg.toLowerCase() === "remote" && title && titleHasNonUsHint(title)) continue;
      return true;
    }
    if (loc.usLocal && loc.city.trim().length > 0 && isWithinCityRadius(seg, loc.city, loc.radiusMiles)) {
      return true;
    }
  }
  return false;
}

export function loadLocationState(): LocationState {
  const defaults: LocationState = { usRemote: true, usLocal: false, city: "", radiusMiles: 50 };
  try {
    const saved = localStorage.getItem("jobscout:location");
    if (saved) return { ...defaults, ...JSON.parse(saved) };
  } catch {}
  return defaults;
}

export function locationLabel(loc: LocationState): string {
  const parts: string[] = [];
  if (loc.usRemote) parts.push("US Remote");
  if (loc.usLocal && loc.city.trim()) parts.push(loc.city.trim());
  if (parts.length === 0) return "All Locations";
  if (parts.length === 1) return parts[0];
  return `${parts.length} locations`;
}

export function saveLocationState(loc: LocationState): void {
  try {
    localStorage.setItem("jobscout:location", JSON.stringify(loc));
    window.dispatchEvent(new CustomEvent("jobscout:location-changed", { detail: loc }));
  } catch {}
}

/**
 * Given a raw job location string and the user's active location filter,
 * return only the part(s) of the location that match the filter.
 * If no filter is active, returns the full location string.
 * Falls back to the full string if nothing matches (shouldn't happen for filtered jobs).
 */
export function filterLocationForDisplay(
  location: string | null | undefined,
  state: LocationState,
  title?: string | null,
): string | null {
  if (!location) return null;
  const anyChecked = state.usRemote || state.usLocal;
  if (!anyChecked) return location;

  const segments = splitMultiLocation(location);
  const matching: string[] = [];

  for (const seg of segments) {
    if (state.usRemote && isBroadlyUs(seg)) {
      if (seg.toLowerCase() === "remote" && title && titleHasNonUsHint(title)) continue;
      matching.push("Remote");
      continue;
    }
    if (state.usLocal && state.city.trim() && isWithinCityRadius(seg, state.city, state.radiusMiles)) {
      const cleaned = seg
        .replace(/,\s*(united states|usa|u\.s\.a?\.?|u\.s\.)\s*$/i, "")
        .trim();
      matching.push(cleaned || seg);
    }
  }

  if (matching.length === 0) return location;
  return [...new Set(matching)].join(" · ");
}
