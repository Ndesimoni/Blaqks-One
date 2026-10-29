export type Choice = readonly [string, string];
export type Query = Record<string, string | string[] | undefined>;
export type Site = {
  id: string;
  kind: 'platform' | 'company';
  name: string;
  company: string | null;
  theme: '1' | '2' | '3' | '4';
  sample: boolean;
  content?: Record<string, string>;
};
export type Company = {
  id: string;
  name: string;
  mark: string;
  area: string;
  note: string;
  publicListingCount?: number;
  publicAgentCount?: number;
};
export type Agent = {
  id: string;
  name: string;
  company: string;
  specialty: string;
  publicWhatsApp?: string;
  publicEmail?: string;
  publicListingCount?: number;
};
export type Area = {
  id: string;
  name: string;
  city: string;
  emirate: string;
  image: string;
  note: string;
  publicListingCount?: number;
};
export type Developer = {
  id: string;
  name: string;
  emirate: string;
  website?: string;
  publicListingCount?: number;
};
export type Listing = {
  advertisingPermit?: string;
  id: string;
  agent: string;
  company: string;
  developer: string;
  developerIllustrative?: boolean;
  area: string;
  title: string;
  type: string;
  purpose: string;
  emirate: string;
  category: string;
  bedrooms: number | null;
  bathrooms: number;
  size: number;
  price: number;
  image: string;
  photos: string[];
  floorPlans: string[];
  description: string;
  ready: string;
  furnishing: string;
  market: string;
  parking: number;
  amenities: string[];
  guests: number;
  minimumStay: number;
  publishedAt: string;
  reference: string;
};
export type Catalogue = {
  listings: Listing[];
  companies: Company[];
  agents: Agent[];
  areas: Area[];
  developers: Developer[];
};
export type Results = {
  items: Listing[];
  total: number;
  page: number;
  pageSize: number;
  errors: string[];
};
export type PageData = {
  site: Site;
  catalogue: Catalogue;
  query: Query;
  page: string;
  entity?: Listing | Company | Agent | Area | Developer;
  results?: Results;
  directory?: { total: number; page: number; pageSize: number };
};
