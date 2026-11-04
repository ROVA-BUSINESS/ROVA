export interface TaxExplanation {
  title: string;
  explanation: string;
  example?: string;
  formula?: string;
}

export const TAX_EXPLANATIONS: Record<string, TaxExplanation> = {
  // ──────────────────────────────────────────────
  // 1. OPENING INVENTORY
  // ──────────────────────────────────────────────
  'opening inventory': {
    title: 'Opening Inventory',
    explanation: 'Stock of goods and materials your business had at the START of the year (January 1st).',
    example: 'Sum of all raw materials, work in progress, and finished goods on hand on Jan 1st.',
    formula: 'Raw materials + Work in progress + Finished goods',
  },
  'raw materials': {
    title: 'Raw Materials',
    explanation: 'Materials you bought to make products but have not used yet.',
    example: 'You are making soap. On Jan 1, you have 100 cartons of palm oil worth ₦500,000 in your store.',
  },
  'work in progress': {
    title: 'Work in Progress (WIP)',
    explanation: 'Products that are half-made. Not raw materials, but not finished either.',
    example: 'Soap that has been mixed and poured into moulds but has not dried and packaged yet. Value ₦200,000.',
  },
  'finished goods': {
    title: 'Finished Goods',
    explanation: 'Products fully made and ready to sell to customers, but not yet sold.',
    example: '500 bars of packaged soap in your warehouse ready for customers. Value ₦800,000.',
  },

  // ──────────────────────────────────────────────
  // 2. PURCHASES
  // ──────────────────────────────────────────────
  'purchases': {
    title: 'Purchases (Raw materials / Finished goods)',
    explanation: 'What you bought during the year to make or sell products.',
    example: 'Total purchases = (Local Purchases + Import Purchases) - Return Outwards.',
    formula: '(Local + Import) - Return Outwards',
  },
  'local purchases': {
    title: 'Local Purchases',
    explanation: 'Raw materials or finished goods bought from suppliers inside your country.',
    example: 'You bought caustic soda from a supplier in Lagos for ₦1,000,000.',
  },
  'import purchases': {
    title: 'Import Purchases',
    explanation: 'Raw materials or finished goods bought and shipped from outside the country.',
    example: 'You imported fragrance oil from China for ₦2,000,000.',
  },
  'return outwards': {
    title: 'Return Outwards',
    explanation: 'Goods you bought and returned to the supplier because they were defective, bad, or wrong. This REDUCES your total purchases.',
    example: 'You returned ₦100,000 worth of bad caustic soda to your supplier.',
  },
  'returns outwards': {
    title: 'Return Outwards',
    explanation: 'Goods you bought and returned to the supplier because they were defective, bad, or wrong. This REDUCES your total purchases.',
    example: 'You returned ₦100,000 worth of bad caustic soda to your supplier.',
  },

  // ──────────────────────────────────────────────
  // 3. OTHER DIRECT COSTS
  // ──────────────────────────────────────────────
  'other direct cost': {
    title: 'Other Direct Costs',
    explanation: 'Costs that can be directly traced to manufacturing or producing your goods/services.',
    example: 'Wages of machine operators, transport of raw materials, direct factory equipment depreciation.',
  },
  'direct wages': {
    title: 'Direct Wages',
    explanation: 'Pay for factory workers or laborers who physically make the product.',
    example: '₦300,000 paid to the 2 workers who mix and cut the soap in your factory.',
  },
  'direct expenses': {
    title: 'Direct Expenses',
    explanation: 'Other specific costs spent directly on the production process.',
    example: '₦50,000 paid to an accredited lab to test and certify your soap formula.',
  },
  'carriage inwards': {
    title: 'Carriage Inwards',
    explanation: 'Transport and freight cost incurred to bring raw materials and supplies TO your factory or warehouse.',
    example: '₦80,000 paid to a truck driver to haul palm oil drums from the market to your factory.',
  },
  'depreciation': {
    title: 'Depreciation (Direct)',
    explanation: 'Wear and tear of machines and equipment used directly in production.',
    example: 'Your soap mixing machine cost ₦1,000,000. It loses ₦100,000 value this year.',
  },
  'mining cost': {
    title: 'Mining Cost',
    explanation: 'Cost of extracting raw materials from the ground (applicable to mining and quarry companies).',
    example: 'A granite quarry company spends ₦5,000,000 to blast and excavate granite stone.',
  },
  'direct construction cost': {
    title: 'Direct Construction Cost',
    explanation: 'Materials, direct site labour, and heavy equipment used directly on an active construction contract.',
    example: 'A builder spends ₦10,000,000 on cement, iron rods, and bricklayers on a building project.',
  },
  'cost of storage': {
    title: 'Cost of Storage',
    explanation: 'Expenses paid to store raw materials before they are processed.',
    example: '₦40,000 paid to rent cold room storage to preserve palm oil before mixing.',
  },
  'amortisation of intangible assets': {
    title: 'Amortisation of Intangible Assets',
    explanation: 'Spreading the acquisition cost of a non-physical asset used directly in production over its useful life.',
    example: 'You paid ₦600,000 for a 3-year production patent. You charge ₦200,000 amortisation this year.',
  },
  'other direct costs': {
    title: 'Other Direct Costs',
    explanation: 'Any other expense directly tied to manufacturing or producing goods.',
    example: 'Electricity consumed specifically by heavy manufacturing machines.',
  },

  // ──────────────────────────────────────────────
  // 4. FACTORY OVERHEADS
  // ──────────────────────────────────────────────
  'factory overheads': {
    title: 'Factory Overheads',
    explanation: 'Indirect production costs required to keep the factory facility running.',
    example: 'Factory rent, diesel for factory generators, factory security, and roof repairs.',
  },
  'factory rent': {
    title: 'Factory Rent',
    explanation: 'Rent paid for the factory workshop, production premises, or manufacturing compound.',
    example: '₦1,200,000 yearly rent paid for your soap factory building in Ogun State.',
  },
  'factory rates': {
    title: 'Factory Rates',
    explanation: 'Local government or state property rates, tenements, and statutory levies on the factory building.',
    example: '₦60,000 paid to the local council as factory environmental and tenement levy.',
  },
  'fuel and power': {
    title: 'Fuel and Power',
    explanation: 'General fuel, diesel, gas, and electricity bills to power the factory plant.',
    example: '₦250,000 spent on diesel to power the industrial generator for factory operations.',
  },
  'indirect wages': {
    title: 'Indirect Wages',
    explanation: 'Wages for factory staff who support the facility but do not physically make the product.',
    example: '₦180,000 paid to the factory cleaner and factory security guard.',
  },
  'other factory overheads': {
    title: 'Other Factory Overheads',
    explanation: 'Miscellaneous indirect expenses incurred at the manufacturing premises.',
    example: '₦70,000 spent to repair leaking gutters and roof panels in the factory.',
  },

  // ──────────────────────────────────────────────
  // 5. CLOSING INVENTORY
  // ──────────────────────────────────────────────
  'closing inventory': {
    title: 'Closing Inventory',
    explanation: 'Stock of unsold products and unused materials you have on hand at the END of the year (Dec 31st). Deducted because it was not used or sold this year.',
    example: 'On Dec 31, you have palm oil worth ₦300,000, WIP soap worth ₦100,000, and finished soap worth ₦400,000.',
    formula: 'Cost of Goods Sold = Opening + Purchases + Direct Cost + Overheads - Closing',
  },

  // ──────────────────────────────────────────────
  // 6. PROFIT OR LOSS SCHEDULE
  // ──────────────────────────────────────────────
  'revenue': {
    title: 'Revenue',
    explanation: 'Total gross money received or billed from selling your goods and services during the year.',
    example: 'You sold soap worth ₦8,000,000 to distributors this year.',
  },
  'direct cost': {
    title: 'Direct Cost (Cost of Goods Sold)',
    explanation: 'Total cost incurred to manufacture and deliver the goods/services that were sold.',
    example: 'Opening Inventory + Purchases + Direct Costs + Overheads - Closing Inventory = ₦4,500,000.',
  },
  'gross profit': {
    title: 'Gross Profit',
    explanation: 'The profit made purely from production and sales before operating office expenses.',
    example: '₦8,000,000 Revenue - ₦4,500,000 Direct Cost = ₦3,500,000 Gross Profit.',
    formula: 'Revenue - Direct Cost',
  },
  'other income': {
    title: 'Other Income',
    explanation: 'Income earned from non-core business activities like interest, rentals, gains on sales, and royalties.',
    example: '₦100,000 received from subletting a corner of your factory, or interest earned on bank deposits.',
  },
  'operating income': {
    title: 'Operating Income',
    explanation: 'Core business earnings before deducting general office administrative and finance expenses.',
    example: 'Gross Profit + Other Income.',
    formula: 'Gross Profit + Other Income',
  },
  'administrative expenses': {
    title: 'Administrative Expenses',
    explanation: 'Expenses incurred to manage and run the business office, not the factory floor (salaries, office rent, internet, legal).',
    example: '₦800,000 spent on manager salary, accounting software, internet connection, and office stationery.',
  },
  'finance cost': {
    title: 'Finance Cost',
    explanation: 'Cost of borrowing capital, bank service fees, loan charges, and account maintenance levies.',
    example: '₦50,000 in bank charges, account maintenance, and loan processing fees.',
  },
  'operating profit before tax': {
    title: 'Operating Profit Before Tax (OPBT)',
    explanation: 'Your taxable accounting profit from operations before corporate income tax.',
    example: 'Operating Income - Administrative Expenses - Finance Cost.',
    formula: 'Operating Income - Admin Expenses - Finance Cost',
  },
  'taxation': {
    title: 'Taxation (CIT)',
    explanation: 'Company Income Tax calculated under the Nigeria Tax Act (30% CIT + 4% Dev Levy where applicable).',
    example: '30% of assessable profit = ₦600,000 company tax.',
  },
  'profit after tax': {
    title: 'Profit After Tax (PAT)',
    explanation: 'Net profit remaining after fulfilling corporate income tax obligations. Your real net profit.',
    example: '₦2,000,000 OPBT - ₦600,000 Tax = ₦1,400,000 Net Profit.',
  },
  'other comprehensive income': {
    title: 'Other Comprehensive Income (OCI)',
    explanation: 'Gains or losses that cannot be booked in the normal profit and loss statement under IFRS rules.',
    example: 'Unrealized asset revaluation gains, currency translation gains on foreign subsidiaries.',
  },
  'revaluation gain/loss': {
    title: 'Revaluation Gain / Loss',
    explanation: 'Increase or decrease in the recorded valuation of land, buildings, or equipment after a professional appraisal.',
    example: 'Factory land bought for ₦10M is reappraised at ₦12M. Revaluation gain = ₦2M.',
  },
  'unrealized foreign exchange gain': {
    title: 'Unrealized Foreign Exchange Gain',
    explanation: 'Gains resulting from currency exchange fluctuations on foreign bank accounts or assets that have not yet been converted.',
    example: 'You have $1,000 in your domiciliary account. As the exchange rate changed, its Naira equivalent increased.',
  },
  'profit for the year': {
    title: 'Profit For The Year',
    explanation: 'Total comprehensive profit generated for the reporting financial year.',
    example: 'Profit After Tax + Other Comprehensive Income.',
    formula: 'Profit After Tax + Other Comprehensive Income',
  },
  'retained earnings': {
    title: 'Retained Earnings',
    explanation: 'Cumulative profits from previous years that were kept in the business rather than paid out as dividends.',
    example: 'Last year your company had ₦1,000,000 profit retained in the bank. Total carried forward = ₦3,050,000.',
  },

  // ──────────────────────────────────────────────
  // 7. BALANCE SHEET — NON-CURRENT ASSETS
  // ──────────────────────────────────────────────
  'properties, plants and equipment': {
    title: 'Properties, Plants and Equipment (PPE)',
    explanation: 'Long-term tangible assets held for use in operations, not intended for immediate resale.',
    example: 'Factory building, soap packaging machine, delivery vans, industrial generators (₦15,000,000).',
  },
  'investments': {
    title: 'Investments',
    explanation: 'Capital allocated into securities, subsidiaries, or properties to generate long-term return and interest.',
    example: 'Treasury bonds, shares in Dangote Cement, real estate held for long-term capital appreciation.',
  },
  'investment in securities': {
    title: 'Investment in Securities',
    explanation: 'Long-term equity shares bought in publicly quoted or private companies.',
    example: '₦1,000,000 shares of Dangote Cement bought on the stock exchange to hold for 5 years.',
  },
  'investment in stock and bonds': {
    title: 'Investment in Stock & Bonds',
    explanation: 'Government treasury bonds or corporate debentures held for long-term yields.',
    example: '₦2,000,000 invested in Federal Government Savings Bonds earning 12% coupon interest.',
  },
  'investment in properties': {
    title: 'Investment in Properties',
    explanation: 'Real estate bought specifically to earn rental income or capital appreciation, not for company operations.',
    example: 'You bought a commercial shop in Yaba for ₦20,000,000 to collect monthly tenant rent.',
  },
  'investment in associate & joint ventures': {
    title: 'Investment in Associate & Joint Ventures',
    explanation: 'Equity holding between 20% and 50% in another business where you exercise significant influence.',
    example: 'You and a partner opened a perfume business; you contributed ₦3,000,000 for a 40% equity stake.',
  },
  'investment in subsidiaries': {
    title: 'Investment in Subsidiaries',
    explanation: 'Ownership of more than 50% controlling interest in another incorporated enterprise.',
    example: 'Your soap company acquired 80% shares of a paper packaging manufacturer for ₦5,000,000.',
  },
  'investment in finance lease': {
    title: 'Investment in Finance Lease',
    explanation: 'Long-term leasing of company assets to a third party where they pay structured installments.',
    example: 'You leased out your delivery van to a distribution agency on a 3-year full payout lease.',
  },
  'investment in staff loan': {
    title: 'Investment in Staff Loan',
    explanation: 'Long-term credit advances issued to employees with repayment schedules exceeding 12 months.',
    example: '₦500,000 long-term car loan advanced to the factory manager to be repaid over 24 months.',
  },
  'investment in digital assets': {
    title: 'Investment in Digital Assets',
    explanation: 'Cryptocurrencies, stablecoins, tokenized bonds, or NFTs held on company balance sheet.',
    example: '₦1,000,000 held in Bitcoin on corporate ledger as an inflation hedge.',
  },
  'investment in commodities': {
    title: 'Investment in Commodities',
    explanation: 'Physical commodities held as investment reserves (gold, cocoa, palm oil futures).',
    example: '10 bars of physical gold bullion purchased and held in a vault for ₦4,000,000.',
  },
  'intangible assets': {
    title: 'Intangible Assets',
    explanation: 'Non-physical assets with measurable commercial value and legal protection.',
    example: 'Registered trademarks, proprietary soap recipes, patents, software licenses, domain names.',
  },
  'goodwill': {
    title: 'Goodwill',
    explanation: 'Premium paid above net fair value when acquiring an existing business due to brand strength and customer base.',
    example: 'You bought a soap competitor for ₦10M whose physical assets were worth ₦8M; the ₦2M excess is Goodwill.',
  },
  'patent': {
    title: 'Patent',
    explanation: 'Exclusive government-granted legal protection for a newly invented product or production process.',
    example: '₦600,000 paid to patent your proprietary anti-bacterial soap formula.',
  },
  'trademarks': {
    title: 'Trademarks',
    explanation: 'Registered distinctive logos, product names, or slogans protected against infringement.',
    example: '₦150,000 spent registering your brand name and emblem with the Federal Ministry of Commerce.',
  },
  'terminal and service concession rights': {
    title: 'Terminal and Service Concession Rights',
    explanation: 'Government or authority-granted long-term rights to operate at ports, toll routes, or airport terminals.',
    example: 'A concession agreement permitting an enterprise to operate a retail kiosk inside an airport terminal.',
  },
  'brands': {
    title: 'Brands',
    explanation: 'Commercial valuation of acquired proprietary product brands.',
    example: 'You purchased the registered brand name "Pure White" for ₦1,000,000.',
  },
  'customer relationships': {
    title: 'Customer Relationships',
    explanation: 'Assessed monetary value of contracted or recurring client databases acquired in an M&A transaction.',
    example: 'Acquiring a distributor with 5,000 recurring merchant accounts valued at ₦800,000.',
  },
  'right of use': {
    title: 'Right of Use',
    explanation: 'Accounting value representing your right to use a leased property or facility over the lease term.',
    example: 'Under IFRS 16, a 5-year lease on a production warehouse is recognized as a ₦6,000,000 asset.',
  },
  'copyrights': {
    title: 'Copyrights',
    explanation: 'Exclusive legal rights to literary, musical, scientific, or software materials.',
    example: 'Exclusive rights purchased for an industrial soap formulation manual.',
  },
  'other non-current assets': {
    title: 'Other Non-Current Assets',
    explanation: 'Long-term assets with lifespan exceeding 12 months that do not fall under PPE, investments, or intangibles.',
    example: '20-year land leases, deferred tax assets, long-term security deposits.',
  },
  'derivative financial instruments': {
    title: 'Derivative Financial Instruments',
    explanation: 'Hedging contracts, currency swaps, and futures held to manage long-term financial risks.',
    example: 'A forward contract booked with your bank to lock in the USD/NGN exchange rate for raw material imports.',
  },
  'long-term borrowings and debts': {
    title: 'Long-Term Borrowings and Debts (Receivable)',
    explanation: 'Monies owed to your enterprise by third parties that will not fall due until after 12 months.',
    example: 'A business partner who purchased machinery from you with payment structured over 2 years.',
  },
  'defined benefits assets': {
    title: 'Defined Benefits Assets',
    explanation: 'Surplus net value when an employee defined benefit pension fund has more assets than projected pension liabilities.',
    example: 'Company pension fund holds ₦12M in assets to cover ₦10M actuarial obligations; surplus is ₦2M.',
  },

  // ──────────────────────────────────────────────
  // 8. BALANCE SHEET — CURRENT ASSETS
  // ──────────────────────────────────────────────
  'inventories': {
    title: 'Inventories',
    explanation: 'Current stock of raw materials, work in progress, and finished goods held for sale within 12 months.',
    example: 'Stock of raw oils, packaging materials, and packaged soaps in stock worth ₦2,500,000 on balance sheet date.',
  },
  'trade receivables': {
    title: 'Trade Receivables',
    explanation: 'Amounts owed to your enterprise by customers who purchased products or services on credit.',
    example: 'Shoprite took ₦700,000 worth of soap on 30-day payment terms and will settle this month.',
  },
  'other receivables': {
    title: 'Other Receivables',
    explanation: 'Short-term balances owed to your business from non-trade transactions (claims, staff advances).',
    example: '₦150,000 insurance claim approved for payout after minor warehouse water damage.',
  },
  'other interbank advances': {
    title: 'Other Interbank Advances',
    explanation: 'Short-term interbank placement advances (financial institution sector only).',
    example: 'Overnight placements between financial institutions.',
  },
  'withholding tax receivables': {
    title: 'Withholding Tax Receivables (WHT Credits)',
    explanation: 'WHT deducted at source by your clients that you can offset against your Corporate Income Tax with FIRS.',
    example: 'A client deducted 10% WHT (₦70,000) from your invoice; you have the credit note to offset your tax bill.',
  },
  'current portion of long term loan': {
    title: 'Current Portion of Long Term Loan (Receivable)',
    explanation: 'Installments of long-term credit extended to staff or partners that will mature and be collected THIS year.',
    example: 'A staff member owes ₦500,000 overall, but ₦200,000 of it will be deducted from salaries during this year.',
  },
  'short term investments': {
    title: 'Short Term Investments',
    explanation: 'Liquid financial instruments expected to be liquidated or matured within 12 months.',
    example: '₦1,000,000 invested in 90-day Central Bank Treasury Bills.',
  },
  'accrued income': {
    title: 'Accrued Income',
    explanation: 'Revenue earned from work already done or sales completed that has not yet been collected or billed.',
    example: 'A partner shop sold your products on consignment, earning you ₦100,000 commission not yet remitted.',
  },
  'assets classified as held for sale': {
    title: 'Assets Classified as Held for Sale',
    explanation: 'Equipment or real estate committed for disposal with an active sale expected within 12 months.',
    example: 'A surplus delivery van decommissioned from operations and advertised for immediate sale.',
  },
  'advance payment to vendor': {
    title: 'Advance Payment to Vendor',
    explanation: 'Cash deposits paid to suppliers for goods or services that have not yet been delivered.',
    example: '₦300,000 advance payment wired to a palm oil refinery awaiting shipment arrival.',
  },
  'prepaid expenses': {
    title: 'Prepaid Expenses',
    explanation: 'Operational bills and rents paid in advance for a future period.',
    example: 'You paid 1 year advance warehouse rent of ₦1,200,000 in October; 9 months carry over into next year.',
  },
  'small tools': {
    title: 'Small Tools',
    explanation: 'Low-value production tools, safety gear, and utensils expensed or held as quick consumables.',
    example: 'Hammers, measuring scales, cutters, and buckets in the workshop valued at ₦30,000.',
  },
  'goods in transit': {
    title: 'Goods in Transit',
    explanation: 'Purchased inventories that have been shipped by the vendor and paid for, but are still on the sea/road.',
    example: '₦400,000 worth of fragrance oil imported from China, currently clearing customs at Apapa port.',
  },
  'chemicals, materials supplies and others': {
    title: 'Chemicals, Materials Supplies and Others',
    explanation: 'Factory consumables and protective supplies used up during manufacturing.',
    example: 'Industrial detergents, safety gloves, goggles, and cleaning chemicals worth ₦20,000.',
  },
  'cash and cash equivalents': {
    title: 'Cash and Cash Equivalents',
    explanation: 'The most liquid assets available: physical cash in till, bank account balances, and 90-day cash equivalents.',
    example: 'Cash in the factory register plus bank balances in corporate checking accounts.',
  },
  'cash in hand': {
    title: 'Cash in Hand',
    explanation: 'Physical cash and petty cash stored in your business safe, register, or office cashbox.',
    example: '₦50,000 held in the office petty cash box for immediate factory incidental payments.',
  },
  'cash at bank': {
    title: 'Cash at Bank',
    explanation: 'Liquid cash balances held in commercial bank checking, savings, and domiciliary accounts.',
    example: '₦2,300,000 currently standing in your corporate Access Bank business account.',
  },
  'marketable securities': {
    title: 'Marketable Securities',
    explanation: 'Very liquid short-term investments that can be converted into known amounts of cash within 24–48 hours.',
    example: 'Mutual fund money-market units that can be cashed out immediately for operating needs.',
  },

  // ──────────────────────────────────────────────
  // 9. BALANCE SHEET — LIABILITIES
  // ──────────────────────────────────────────────
  'trade payables': {
    title: 'Trade Payables',
    explanation: 'Monies owed by your business to suppliers who supplied you raw materials or inventory on credit.',
    example: 'You collected ₦400,000 worth of palm oil on 30-day credit from your supplier Alhaja.',
  },
  'current tax liabilities': {
    title: 'Current Tax Liabilities',
    explanation: 'Outstanding corporate, VAT, or withholding taxes accrued for the current year that have not yet been remitted.',
    example: '₦200,000 Corporate Income Tax accrued for the year payable to the Federal Inland Revenue Service.',
  },
  'other payables': {
    title: 'Other Payables',
    explanation: 'Short-term debt obligations outside of normal raw material trade suppliers.',
    example: 'Unremitted staff pension deductions or cooperative dues awaiting transfer.',
  },
  'financial liabilities': {
    title: 'Financial Liabilities',
    explanation: 'Short-term contractual obligations to pay cash or another financial asset to an entity.',
    example: 'Bank overdrafts or short-term notes payable within 12 months.',
  },
  'accruals': {
    title: 'Accruals',
    explanation: 'Expenses incurred and consumed during the year for which no formal invoice has yet been settled.',
    example: '₦150,000 staff wages for December plus ₦20,000 NEPA electricity bill consumed but unpaid.',
  },
  'unearned income (advance from customers)': {
    title: 'Unearned Income (Customer Advances)',
    explanation: 'Money paid to your business by customers in advance before you deliver the goods or perform the service.',
    example: 'A customer paid ₦200,000 advance deposit for custom soap bars you will produce next month.',
  },
  'interest payable': {
    title: 'Interest Payable',
    explanation: 'Accumulated interest accrued on bank loans that has fallen due for payment.',
    example: '₦30,000 bank loan interest due on your commercial loan facility at month-end.',
  },
  'short-term debt': {
    title: 'Short-Term Debt',
    explanation: 'Borrowings, commercial papers, and bank overdrafts that must be repaid within 12 months.',
    example: 'A ₦500,000 6-month microfinance working capital loan.',
  },
  'dividend payable': {
    title: 'Dividend Payable',
    explanation: 'Dividends formally declared by directors to shareholders but not yet disbursed from the bank.',
    example: '₦300,000 declared year-end dividend approved at AGM awaiting bank transfer to owners.',
  },
  'income taxes payable': {
    title: 'Income Taxes Payable',
    explanation: 'Corporate income tax assessments assessed for current or prior periods awaiting settlement.',
    example: '₦150,000 CIT installment due for immediate settlement.',
  },
  'provisions for warranty expenses': {
    title: 'Provision for Warranty Expenses',
    explanation: 'Funds set aside based on historical defect rates to replace or repair faulty customer products.',
    example: 'Setting aside ₦100,000 because on average 2% of soap bars delivered may suffer shipping defects.',
  },
  'provisions for bonuses and employee benefits': {
    title: 'Provisions for Bonuses and Employee Benefits',
    explanation: 'Staff performance bonuses earned during the year that will be paid early next year.',
    example: '₦250,000 accrued Christmas 13th-month bonus approved for factory operators.',
  },
  'current portion of lease liability': {
    title: 'Current Portion of Lease Liability',
    explanation: 'The portion of a multi-year property or equipment lease that will fall due for payment THIS year.',
    example: 'Your factory lease is ₦1,200,000 per year; this year’s installment is booked as a current liability.',
  },
  'current portion of long term debt': {
    title: 'Current Portion of Long Term Debt',
    explanation: 'Principal loan repayments of a multi-year bank loan that must be paid back within the next 12 months.',
    example: 'On a 5-year ₦10M loan, ₦2M principal is due for repayment during this coming financial year.',
  },
  'decommissioning and other provisions': {
    title: 'Decommissioning and Other Provisions',
    explanation: 'Funds reserved to restore leased factory premises, clean up industrial sites, or meet legal obligations.',
    example: '₦200,000 provision to repaint and repair leased factory walls when handing back to landlord.',
  },
  'long term debt': {
    title: 'Long-Term Debt / Long-Term Borrowings',
    explanation: 'Loans, debentures, and commercial bank credit facilities with maturity exceeding 12 months.',
    example: '₦10,000,000 5-year facility from the Bank of Industry (BOI) at concessionary interest rates.',
  },
  'long term borrowings': {
    title: 'Long-Term Borrowings',
    explanation: 'Loans, debentures, and commercial bank credit facilities with maturity exceeding 12 months.',
    example: '₦10,000,000 5-year facility from the Bank of Industry (BOI) at concessionary interest rates.',
  },
  'pension and employee benefit obligation': {
    title: 'Pension and Employee Benefit Obligation',
    explanation: 'Long-term post-employment and gratuity liabilities owed to permanent staff upon retirement.',
    example: 'Actuarial pension provision calculated under company policy for long-serving employees.',
  },
  'deferred revenue (long term portion)': {
    title: 'Deferred Revenue (Long Term Portion)',
    explanation: 'Advance customer payments received for products or services that will not be delivered until after 12 months.',
    example: 'A multi-year maintenance or supply contract where a client prepaid 3 years in advance.',
  },
  'contingent liabilities (long term provision)': {
    title: 'Contingent Liabilities (Long Term Provision)',
    explanation: 'Prudent reserve set aside for probable future claims or pending court judgments.',
    example: 'A supplier filed an arbitration claim; your lawyer advises reserving ₦500,000 for settlement.',
  },
  'employees benefits obligation': {
    title: 'Employees Benefits Obligation',
    explanation: 'Accumulated long-service awards and gratuities to be settled in future operating years.',
    example: 'Staff long-service award schemes maturing in 3 to 5 years.',
  },
  'non-current portion of lease obligation': {
    title: 'Non-Current Portion of Lease Obligation',
    explanation: 'The remaining balance of multi-year lease commitments payable beyond the next 12 months.',
    example: 'On a 5-year warehouse lease, years 2 through 5 totaling ₦4,800,000 are non-current.',
  },
  'deferred tax liabilities': {
    title: 'Deferred Tax Liabilities',
    explanation: 'Taxes that will become payable in future years due to temporary differences between accounting book values and tax rules.',
    example: 'Capital allowance claimed faster for tax purposes than accounting depreciation creates deferred tax.',
  },
  'stock warrant obligation': {
    title: 'Stock Warrant Obligation',
    explanation: 'Commitment to issue shares upon exercise of corporate warrants issued to investors or lenders.',
    example: 'Lenders were granted warrants to buy company stock at a fixed strike price within 3 years.',
  },
  'debt securities': {
    title: 'Debt Securities',
    explanation: 'Bonds, notes, and debentures issued by your company to institutional investors.',
    example: '₦5,000,000 corporate bond note issued to raise expansion capital.',
  },
  'lease liabilities': {
    title: 'Lease Liabilities',
    explanation: 'Present value of future lease payments owed under long-term finance or operating lease contracts.',
    example: 'Total discounted liability for factory and delivery truck leases.',
  },
  'derivative liabilities held for risk management': {
    title: 'Derivative Liabilities Held for Risk Management',
    explanation: 'Negative market value of hedging derivative contracts entered to protect against currency or interest spikes.',
    example: 'A forward exchange contract currently standing at an unrealized loss before maturity.',
  },
  'deposits from customers': {
    title: 'Deposits from Customers (Long Term)',
    explanation: 'Refundable security deposits collected from commercial clients or distributors.',
    example: '₦500,000 refundable crate and pallet deposit paid by major wholesalers.',
  },
  'retirement benefits': {
    title: 'Retirement Benefits',
    explanation: 'Long-term funds and obligations for retiring staff under formal benefit schemes.',
    example: 'Gratuity schemes payable to staff who retire after 10+ years of service.',
  },
  'derivative financial instruments liabilities': {
    title: 'Derivative Financial Instrument Liabilities',
    explanation: 'Fair value of out-of-the-money financial derivative obligations.',
    example: 'Interest rate collar or currency hedge obligation.',
  },

  // ──────────────────────────────────────────────
  // 10. BALANCE SHEET — EQUITY & RESERVES
  // ──────────────────────────────────────────────
  'equity': {
    title: 'Equity (Shareholders’ Funds)',
    explanation: 'The net worth of the business belonging to the owners: Share Capital + Retained Earnings + Reserves.',
    example: 'Total Assets minus Total Liabilities = Owner’s Equity.',
    formula: 'Assets - Liabilities',
  },
  'issued share capital': {
    title: 'Issued Share Capital',
    explanation: 'The nominal face value of shares issued to and paid for by the company founders and investors.',
    example: 'You and 2 co-founders contributed ₦5,000,000 as initial registered share capital.',
  },
  'share premium': {
    title: 'Share Premium',
    explanation: 'Extra money paid by investors above the nominal par value of company shares.',
    example: 'A share has ₦1 nominal value, but an investor pays ₦1.50 per share; ₦0.50 is Share Premium.',
  },
  'revaluation reserve': {
    title: 'Revaluation Reserve',
    explanation: 'Cumulative surplus arising from the upward revaluation of fixed assets (land, buildings).',
    example: 'Factory land revalued from ₦10M to ₦12M creates a ₦2,000,000 Revaluation Reserve.',
  },
  'statutory reserve': {
    title: 'Statutory Reserve',
    explanation: 'Mandatory non-distributable reserve required by banking or company law to protect depositors and creditors.',
    example: 'Regulated institutions must transfer a percentage of annual profit to statutory reserves before dividends.',
  },
  'non-controlling interest': {
    title: 'Non-Controlling Interest (Minority Interest)',
    explanation: 'The equity share in a subsidiary company belonging to outside minority shareholders.',
    example: 'You own 80% of a packaging firm; the 20% owned by third parties is Non-Controlling Interest.',
  },
  'other reserves': {
    title: 'Other Reserves',
    explanation: 'General reserves created out of profit for future capital investments, contingencies, or expansion.',
    example: '₦200,000 allocated every year into an Expansion Reserve to open a retail branch.',
  },
  'contingency reserve': {
    title: 'Contingency Reserve',
    explanation: 'Funds set aside from profits to cushion against unforeseen disasters, litigations, or market downturns.',
    example: '₦500,000 kept in reserve to protect against unexpected raw material disruptions.',
  },
  'cumulative translation adjustment': {
    title: 'Cumulative Translation Adjustment',
    explanation: 'For companies with foreign operations: gains or losses from converting foreign branch books into Naira at year-end.',
    example: 'Your Ghana branch made 10,000 Cedis. Exchange rate moved from ₦500k to ₦700k; the ₦200k difference goes here.',
  },
  'share based payment reserve': {
    title: 'Share Based Payment Reserve',
    explanation: 'Reserve created when promising company shares or stock options to employees in lieu of cash bonuses.',
    example: 'You promise your manager 100,000 shares worth ₦300,000 after 2 years; the value is held here until issued.',
  },
  'reserve for bonus issue': {
    title: 'Reserve for Bonus Issue',
    explanation: 'Funds earmarked from retained profits to issue free bonus shares to existing shareholders.',
    example: '₦500,000 profit moved here before issuing 1 free share for every 5 shares owned by investors.',
  },
  'capital reserve': {
    title: 'Capital Reserve',
    explanation: 'Capital profits from non-trading events (selling PPE above book value, government grants) that cannot be paid as dividends.',
    example: 'You sold an old machine with book value ₦600k for ₦900k; the ₦300k profit is kept in Capital Reserve forever.',
  },
  'equity contribution to shareholders/equity holders': {
    title: 'Equity Contribution to Shareholders',
    explanation: 'Capital injected by owners directly to support the company without issuing new shares and without taking on debt.',
    example: 'You personally inject ₦1,000,000 from your savings to settle company debts without increasing share capital or creating a loan.',
  },
  'equity contribution to shareholders': {
    title: 'Equity Contribution to Shareholders',
    explanation: 'Capital injected by owners directly to support the company without issuing new shares and without taking on debt.',
    example: 'You personally inject ₦1,000,000 from your savings to settle company debts without increasing share capital or creating a loan.',
  },
};

/**
 * Case-insensitive lookup helper for tax item explanations
 */
export function getTaxExplanation(term: string): TaxExplanation | null {
  if (!term) return null;
  const key = term.trim().toLowerCase();
  if (TAX_EXPLANATIONS[key]) return TAX_EXPLANATIONS[key];

  // Try substring or normalized match
  for (const [k, v] of Object.entries(TAX_EXPLANATIONS)) {
    if (k.length > 3 && (key.includes(k) || k.includes(key))) {
      return v;
    }
  }
  return null;
}
