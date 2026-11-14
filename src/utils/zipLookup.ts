export interface ZipLookupResult {
  zip: string;
  city: string;
  state: string;
  county?: string;
  source: 'exact' | 'scf_prefix' | 'remote';
}

const EXACT_US_ZIPS: Record<string, { city: string; state: string; county: string }> = {
  '02127': { city: 'Boston', state: 'MA', county: 'Suffolk County' },
  '03101': { city: 'Manchester', state: 'NH', county: 'Hillsborough County' },
  '04101': { city: 'Portland', state: 'ME', county: 'Cumberland County' },
  '05401': { city: 'Burlington', state: 'VT', county: 'Chittenden County' },
  '06103': { city: 'Hartford', state: 'CT', county: 'Hartford County' },
  '07102': { city: 'Newark', state: 'NJ', county: 'Essex County' },
  '02903': { city: 'Providence', state: 'RI', county: 'Providence County' },
  '10001': { city: 'New York', state: 'NY', county: 'New York County' },
  '14216': { city: 'Buffalo', state: 'NY', county: 'Erie County' },
  '19147': { city: 'Philadelphia', state: 'PA', county: 'Philadelphia County' },
  '19801': { city: 'Wilmington', state: 'DE', county: 'New Castle County' },
  '20001': { city: 'Washington', state: 'DC', county: 'District of Columbia' },
  '21201': { city: 'Baltimore', state: 'MD', county: 'Baltimore City' },
  '23220': { city: 'Richmond', state: 'VA', county: 'Richmond City' },
  '25301': { city: 'Charleston', state: 'WV', county: 'Kanawha County' },
  '28205': { city: 'Charlotte', state: 'NC', county: 'Mecklenburg County' },
  '29401': { city: 'Charleston', state: 'SC', county: 'Charleston County' },
  '30306': { city: 'Atlanta', state: 'GA', county: 'Fulton County' },
  '32202': { city: 'Jacksonville', state: 'FL', county: 'Duval County' },
  '33133': { city: 'Miami', state: 'FL', county: 'Miami-Dade County' },
  '35203': { city: 'Birmingham', state: 'AL', county: 'Jefferson County' },
  '37206': { city: 'Nashville', state: 'TN', county: 'Davidson County' },
  '39201': { city: 'Jackson', state: 'MS', county: 'Hinds County' },
  '40202': { city: 'Louisville', state: 'KY', county: 'Jefferson County' },
  '43206': { city: 'Columbus', state: 'OH', county: 'Franklin County' },
  '43215': { city: 'Columbus', state: 'OH', county: 'Franklin County' },
  '46202': { city: 'Indianapolis', state: 'IN', county: 'Marion County' },
  '48207': { city: 'Detroit', state: 'MI', county: 'Wayne County' },
  '50309': { city: 'Des Moines', state: 'IA', county: 'Polk County' },
  '53211': { city: 'Milwaukee', state: 'WI', county: 'Milwaukee County' },
  '55408': { city: 'Minneapolis', state: 'MN', county: 'Hennepin County' },
  '57104': { city: 'Sioux Falls', state: 'SD', county: 'Minnehaha County' },
  '58102': { city: 'Fargo', state: 'ND', county: 'Cass County' },
  '59101': { city: 'Billings', state: 'MT', county: 'Yellowstone County' },
  '60618': { city: 'Chicago', state: 'IL', county: 'Cook County' },
  '64111': { city: 'Kansas City', state: 'MO', county: 'Jackson County' },
  '67202': { city: 'Wichita', state: 'KS', county: 'Sedgwick County' },
  '68102': { city: 'Omaha', state: 'NE', county: 'Douglas County' },
  '70119': { city: 'New Orleans', state: 'LA', county: 'Orleans Parish' },
  '72201': { city: 'Little Rock', state: 'AR', county: 'Pulaski County' },
  '73102': { city: 'Oklahoma City', state: 'OK', county: 'Oklahoma County' },
  '75214': { city: 'Dallas', state: 'TX', county: 'Dallas County' },
  '77002': { city: 'Houston', state: 'TX', county: 'Harris County' },
  '78701': { city: 'Austin', state: 'TX', county: 'Travis County' },
  '80206': { city: 'Denver', state: 'CO', county: 'Denver County' },
  '82001': { city: 'Cheyenne', state: 'WY', county: 'Laramie County' },
  '83702': { city: 'Boise', state: 'ID', county: 'Ada County' },
  '84105': { city: 'Salt Lake City', state: 'UT', county: 'Salt Lake County' },
  '85016': { city: 'Phoenix', state: 'AZ', county: 'Maricopa County' },
  '87102': { city: 'Albuquerque', state: 'NM', county: 'Bernalillo County' },
  '89104': { city: 'Las Vegas', state: 'NV', county: 'Clark County' },
  '90210': { city: 'Beverly Hills', state: 'CA', county: 'Los Angeles County' },
  '92104': { city: 'San Diego', state: 'CA', county: 'San Diego County' },
  '94102': { city: 'San Francisco', state: 'CA', county: 'San Francisco County' },
  '96813': { city: 'Honolulu', state: 'HI', county: 'Honolulu County' },
  '97214': { city: 'Portland', state: 'OR', county: 'Multnomah County' },
  '98103': { city: 'Seattle', state: 'WA', county: 'King County' },
  '99501': { city: 'Anchorage', state: 'AK', county: 'Anchorage Borough' },
};

const ZIP_STATE_RANGES: Array<{ min: number; max: number; state: string; defaultCity: string }> = [
  { min: 1000, max: 2799, state: 'MA', defaultCity: 'Boston' },
  { min: 2800, max: 2999, state: 'RI', defaultCity: 'Providence' },
  { min: 3000, max: 3899, state: 'NH', defaultCity: 'Manchester' },
  { min: 3900, max: 4999, state: 'ME', defaultCity: 'Portland' },
  { min: 5000, max: 5999, state: 'VT', defaultCity: 'Burlington' },
  { min: 6000, max: 6999, state: 'CT', defaultCity: 'Hartford' },
  { min: 7000, max: 8999, state: 'NJ', defaultCity: 'Newark' },
  { min: 10000, max: 14999, state: 'NY', defaultCity: 'New York' },
  { min: 15000, max: 19699, state: 'PA', defaultCity: 'Philadelphia' },
  { min: 19700, max: 19999, state: 'DE', defaultCity: 'Wilmington' },
  { min: 20000, max: 20599, state: 'DC', defaultCity: 'Washington' },
  { min: 20600, max: 21999, state: 'MD', defaultCity: 'Baltimore' },
  { min: 22000, max: 24699, state: 'VA', defaultCity: 'Richmond' },
  { min: 24700, max: 26899, state: 'WV', defaultCity: 'Charleston' },
  { min: 27000, max: 28999, state: 'NC', defaultCity: 'Charlotte' },
  { min: 29000, max: 29999, state: 'SC', defaultCity: 'Columbia' },
  { min: 30000, max: 31999, state: 'GA', defaultCity: 'Atlanta' },
  { min: 32000, max: 34999, state: 'FL', defaultCity: 'Miami' },
  { min: 35000, max: 36999, state: 'AL', defaultCity: 'Birmingham' },
  { min: 37000, max: 38599, state: 'TN', defaultCity: 'Nashville' },
  { min: 38600, max: 39799, state: 'MS', defaultCity: 'Jackson' },
  { min: 40000, max: 42799, state: 'KY', defaultCity: 'Louisville' },
  { min: 43000, max: 45999, state: 'OH', defaultCity: 'Columbus' },
  { min: 46000, max: 47999, state: 'IN', defaultCity: 'Indianapolis' },
  { min: 48000, max: 49999, state: 'MI', defaultCity: 'Detroit' },
  { min: 50000, max: 52899, state: 'IA', defaultCity: 'Des Moines' },
  { min: 53000, max: 54999, state: 'WI', defaultCity: 'Milwaukee' },
  { min: 55000, max: 56799, state: 'MN', defaultCity: 'Minneapolis' },
  { min: 57000, max: 57799, state: 'SD', defaultCity: 'Sioux Falls' },
  { min: 58000, max: 58899, state: 'ND', defaultCity: 'Fargo' },
  { min: 59000, max: 59999, state: 'MT', defaultCity: 'Billings' },
  { min: 60000, max: 62999, state: 'IL', defaultCity: 'Chicago' },
  { min: 63000, max: 65899, state: 'MO', defaultCity: 'Kansas City' },
  { min: 66000, max: 67999, state: 'KS', defaultCity: 'Wichita' },
  { min: 68000, max: 69399, state: 'NE', defaultCity: 'Omaha' },
  { min: 70000, max: 71499, state: 'LA', defaultCity: 'New Orleans' },
  { min: 71600, max: 72999, state: 'AR', defaultCity: 'Little Rock' },
  { min: 73000, max: 74999, state: 'OK', defaultCity: 'Oklahoma City' },
  { min: 75000, max: 79999, state: 'TX', defaultCity: 'Dallas' },
  { min: 80000, max: 81699, state: 'CO', defaultCity: 'Denver' },
  { min: 82000, max: 83199, state: 'WY', defaultCity: 'Cheyenne' },
  { min: 83200, max: 83899, state: 'ID', defaultCity: 'Boise' },
  { min: 84000, max: 84799, state: 'UT', defaultCity: 'Salt Lake City' },
  { min: 85000, max: 86599, state: 'AZ', defaultCity: 'Phoenix' },
  { min: 87000, max: 88499, state: 'NM', defaultCity: 'Albuquerque' },
  { min: 88900, max: 89899, state: 'NV', defaultCity: 'Las Vegas' },
  { min: 90000, max: 96199, state: 'CA', defaultCity: 'Los Angeles' },
  { min: 96700, max: 96899, state: 'HI', defaultCity: 'Honolulu' },
  { min: 97000, max: 97999, state: 'OR', defaultCity: 'Portland' },
  { min: 98000, max: 99499, state: 'WA', defaultCity: 'Seattle' },
  { min: 99500, max: 99999, state: 'AK', defaultCity: 'Anchorage' },
];

export function normalizeZip5(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 5);
}

export function resolveZipSync(rawZip: string): ZipLookupResult | null {
  const zip = normalizeZip5(rawZip);
  if (zip.length !== 5) return null;

  const exact = EXACT_US_ZIPS[zip];
  if (exact) {
    return { zip, city: exact.city, state: exact.state, county: exact.county, source: 'exact' };
  }

  const num = Number(zip);
  const range = ZIP_STATE_RANGES.find((r) => num >= r.min && num <= r.max);
  if (range) {
    return { zip, city: range.defaultCity, state: range.state, source: 'scf_prefix' };
  }

  return null;
}

export async function lookupUsZipCode(rawZip: string): Promise<ZipLookupResult | null> {
  const zip = normalizeZip5(rawZip);
  if (zip.length !== 5) return null;

  try {
    const resp = await fetch(`/api/geo/zip/${zip}`);
    if (resp.ok) {
      const data = (await resp.json()) as { zip?: string; city?: string; state?: string; county?: string };
      if (data.city && data.state) {
        return {
          zip,
          city: data.city,
          state: data.state,
          county: data.county,
          source: 'remote',
        };
      }
    }
  } catch {
    // Fallback cleanly to deterministic local lookup
  }

  return resolveZipSync(zip);
}
