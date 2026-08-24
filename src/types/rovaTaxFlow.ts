export type AssetCategory =
  | 'Building Industrial'
  | 'Building Non-Industrial'
  | 'Plants (excluding Furniture & Fittings)'
  | 'Agricultural Plants Expenditure'
  | 'Furniture & Fittings Expenditure'
  | 'Public Transport Motor Vehicles'
  | 'Motor Vehicles Expenditure'
  | 'Plantation Equipment'
  | 'Construction Plants Expenditure'
  | 'Research & Development Expenditure'
  | 'Housing Estate Expenditure'
  | 'Land'
  | 'Ranching & Plantation'
  | 'Software'
  | 'Others';

export interface FixedAsset {
  id: string;
  dateFirstUsed: string;
  cost: number;
  description: string;
  category: AssetCategory | '';
}

export type Sector =
  | 'MANUFACTURING'
  | 'AGRICULTURE FORESTRY & FISHING'
  | 'MINING & QUARRY'
  | 'ELECTRICITY'
  | 'WATER SUPPLY SEWERAGE & WASTE MANAGEMENT'
  | 'CONSTRUCTION'
  | 'WHOLESALE AND RETAIL TRADE'
  | 'TRANSPORTATION AND HAULAGE'
  | 'ACCOMMODATION AND FOOD SERVICE ACTIVITIES'
  | 'COMMUNICATION & INFORMATION'
  | 'BANKS & OTHER FINANCIAL ACTIVITIES'
  | 'INSURANCE ACTIVITIES'
  | 'REAL ESTATE ACTIVITIES'
  | 'PROFESSIONAL SCIENTIFIC AND TECHNICAL ACTIVITIES'
  | 'ADMINISTRATIVE AND SUPPORT ACTIVITIES'
  | 'EDUCATION'
  | 'OIL AND GAS'
  | 'NGOs NFPOs RELIGIOUS INSTITUTIONS'
  | 'ART ENTERTAINMENT AND RECREATION'
  | 'DIGITAL AND VIRTUAL ASSETS'
  | 'Others';

export interface RovaTaxState {
  assets: FixedAsset[];
  hasFixedAssets: boolean | null;
  mneCfc: {
    isMNE: boolean | null;
    isCFC: boolean | null;
  };
  yearOfAssessment: string;
  sector: Sector | '';
  revenue: number | null;
  costOfSales: {
    openingInventory: Record<string, number>;
    purchases: Record<string, number>;
    otherDirectCost: Record<string, number>;
    factoryOverheads: Record<string, number>;
    closingInventory: Record<string, number>;
  };
  sfp: {
    propertiesPlantsEquipment: number | null;
    investments: Record<string, number>;
    intangibleAssets: Record<string, number>;
    otherNonCurrentAssets: Record<string, number>;
    otherCurrentAssets: Record<string, number>;
    cashAndEquivalents: Record<string, number>;
    otherCurrentLiabilities: Record<string, number>;
    nonCurrentLiabilities: Record<string, number>;
    otherReserves: Record<string, number>;
    tradePayablesAndCurrentTax: Record<string, number>;
    equity: Record<string, number>;
  };
  profitAdjustment: {
    hasAddbacks: boolean | null;
    addbacks: Record<string, number>;
    hasDeductions: boolean | null;
    deductions: Record<string, number>;
  };
  adminExpense: Record<string, number>;
}
