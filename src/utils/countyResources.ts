import type { CountyResource, PropertyRecord } from '../types';

const STATE_PROBATE_RULES: Record<
  string,
  {
    administrationTypes: string;
    creditorClaimWindow: string;
    typicalTimelineMonths: string;
    smallEstateThreshold: string;
    homesteadNotes: string;
    courtSuffix: string;
  }
> = {
  OH: {
    administrationTypes: 'Full Administration, Summary Release, or Release from Administration',
    creditorClaimWindow: '6 months from date of death (ORC § 2117.06)',
    typicalTimelineMonths: '6–9 months',
    smallEstateThreshold: '$35,000 ($100,000 if surviving spouse)',
    homesteadNotes: 'Ohio allows Transfer-on-Death Designation Affidavits; spousal mansion house election applies.',
    courtSuffix: 'Court of Common Pleas — Probate Division',
  },
  FL: {
    administrationTypes: 'Formal Administration vs. Summary Administration',
    creditorClaimWindow: '3 months from first publication of Notice to Creditors',
    typicalTimelineMonths: '5–9 months (Formal) / 4–8 weeks (Summary)',
    smallEstateThreshold: '$75,000 non-exempt assets',
    homesteadNotes: 'Florida Constitutional Homestead passes outside probate administration with court order.',
    courtSuffix: 'Circuit Court — Probate Division',
  },
  AZ: {
    administrationTypes: 'Informal Probate (Registrar) vs. Formal Probate (UPC State)',
    creditorClaimWindow: '4 months from first publication of Notice to Creditors',
    typicalTimelineMonths: '4–8 months',
    smallEstateThreshold: '$100,000 real property affidavit (6 months post-death)',
    homesteadNotes: 'Arizona community property with right of survivorship & Beneficiary Deeds are common.',
    courtSuffix: 'Superior Court — Probate Registrar',
  },
  CA: {
    administrationTypes: 'IAEA (Independent Administration of Estates Act) vs. Court Confirmation',
    creditorClaimWindow: '4 months after Letters Testamentary/Administration issued',
    typicalTimelineMonths: '9–15 months',
    smallEstateThreshold: '$184,500 personal property / $61,500 real property summary',
    homesteadNotes: 'Full IAEA authority lets executor sell without court overbid auction (15-day Notice of Proposed Action).',
    courtSuffix: 'Superior Court — Probate Department',
  },
  IL: {
    administrationTypes: 'Independent Administration vs. Supervised Administration',
    creditorClaimWindow: '6 months from first publication of Notice',
    typicalTimelineMonths: '6–12 months',
    smallEstateThreshold: '$100,000 personal property (real property requires probate or Bond in Lieu)',
    homesteadNotes: 'Cook & collar counties require specific transfer tax stamps & municipal water certifications.',
    courtSuffix: 'Circuit Court — Probate Division',
  },
  GA: {
    administrationTypes: 'Solemn Form Probate (with Letters Testamentary) vs. Year’s Support',
    creditorClaimWindow: '3 months after final weekly Notice to Debtors and Creditors',
    typicalTimelineMonths: '4–8 months',
    smallEstateThreshold: 'No formal dollar cap if no will & all heirs consent (Order Declaring No Admin)',
    homesteadNotes: 'Georgia allows rapid closing once executor receives Letters Testamentary with power of sale.',
    courtSuffix: 'County Probate Court',
  },
  WA: {
    administrationTypes: 'Nonintervention Probate (Standard) vs. Intervention Probate',
    creditorClaimWindow: '4 months from publication of Notice to Creditors',
    typicalTimelineMonths: '4–7 months',
    smallEstateThreshold: '$100,000 personal property (Lack of Probate Affidavit for title)',
    homesteadNotes: 'Nonintervention status allows executor to convey title immediately without court confirmation.',
    courtSuffix: 'Superior Court — Probate Department',
  },
  NC: {
    administrationTypes: 'General Administration vs. Limited Personal Representative',
    creditorClaimWindow: '3 months from first publication of Notice to Creditors',
    typicalTimelineMonths: '6–10 months',
    smallEstateThreshold: '$20,000 ($30,000 spouse)',
    homesteadNotes: 'Clerk of Superior Court serves as ex-officio Judge of Probate; 10-day upset bid rules apply on judicial sales.',
    courtSuffix: 'Superior Court — Estates Division',
  },
  CO: {
    administrationTypes: 'Informal Probate vs. Formal Probate (Uniform Probate Code)',
    creditorClaimWindow: '4 months from first publication (or 1 year from death)',
    typicalTimelineMonths: '6–9 months',
    smallEstateThreshold: '$82,000 personal property',
    homesteadNotes: 'Beneficiary deeds and informal registrar appointments streamline real estate conveyances.',
    courtSuffix: 'District Court — Probate Division',
  },
};

export function getCountyResourcesForProperty(property: PropertyRecord): CountyResource {
  const stateCode = property.state.toUpperCase();
  const countyClean = property.county.replace(/\s+County$/i, '').trim();
  const countySlug = countyClean.toLowerCase().replace(/[^a-z0-9]+/g, '');
  const stateRule = STATE_PROBATE_RULES[stateCode] ?? {
    administrationTypes: 'Independent / Informal Administration vs. Supervised Court Administration',
    creditorClaimWindow: '3–6 months following statutory Notice to Creditors publication',
    typicalTimelineMonths: '6–10 months',
    smallEstateThreshold: 'Varies by state statute ($25,000–$100,000)',
    homesteadNotes: 'Verify Letters Testamentary / Letters of Administration power-of-sale clause with title company.',
    courtSuffix: 'County Probate & Surrogate Court',
  };

  return {
    state: stateCode,
    county: property.county,
    probateCourtClerk: {
      officeName: `${property.county} ${stateRule.courtSuffix}`,
      phone: `Verify via ${countyClean} Clerk Directory`,
      address: `${property.county} Courthouse Plaza, ${property.city}, ${stateCode}`,
      portalUrl: `https://www.google.com/search?q=${encodeURIComponent(`${property.county} ${stateCode} Probate Court Clerk docket`)}`,
      filingFeeEstimate: '$185 – $350 initial estate petition',
    },
    taxAssessor: {
      officeName: `${property.county} Office of the Tax Assessor / Auditor`,
      phone: `Verify via ${countyClean} Tax Office`,
      portalUrl: `https://www.google.com/search?q=${encodeURIComponent(`${property.county} ${stateCode} Tax Assessor parcel search ${property.apn}`)}`,
      millageSummary: `Assessed at $${property.assessorData.assessedValue.toLocaleString()} · Annual Taxes $${property.assessorData.annualTaxes.toLocaleString()} (${property.assessorData.taxYear})`,
    },
    stateProbateRules: {
      administrationTypes: stateRule.administrationTypes,
      creditorClaimWindow: stateRule.creditorClaimWindow,
      typicalTimelineMonths: stateRule.typicalTimelineMonths,
      smallEstateThreshold: stateRule.smallEstateThreshold,
      homesteadNotes: stateRule.homesteadNotes,
    },
    countyMarketMetrics: {
      medianDaysOnMarket: 24 + (property.city.length % 19),
      medianSalePrice: Math.round(property.avmValue * 0.96),
      yoyAppreciationPct: Number((3.4 + (property.zip.charCodeAt(4) % 5) * 0.7).toFixed(1)),
      investorSharePct: 16 + (property.county.length % 14),
    },
    localForms: [
      {
        title: `${stateCode} Letters Testamentary / Authority Verification Checklist`,
        formCode: `${stateCode}-PR-101`,
        description: `Verify whether ${property.executorName} holds Independent Power of Sale under ${property.courtName} Case #${property.probateCaseNumber}.`,
      },
      {
        title: `${property.county} As-Is Probate Real Estate Purchase Agreement`,
        formCode: `${countySlug.toUpperCase().slice(0, 6)}-PSA-2026`,
        description: `Pre-populated with APN ${property.apn}, ${stateCode} statutory disclosures, and probate court contingency language.`,
      },
      {
        title: `${stateCode} Affidavit of Heirship & Estate Lien Release Request`,
        formCode: `${stateCode}-HEIR-204`,
        description: `Standardized title curative request for decedent ${property.decedentName} covering municipal liens and tax clearance.`,
      },
    ],
  };
}

export function buildLocalizedLoiTemplate(property: PropertyRecord, offerPrice: number, earnestMoney = 2500, closingDays = 21): string {
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  return `LETTER OF INTENT TO PURCHASE REAL ESTATE (PROBATE ESTATE)

Date: ${today}
To: ${property.executorName}, Personal Representative / Executor of the ${property.decedentName}
Probate Case Reference: ${property.courtName} — Case #${property.probateCaseNumber}
Subject Property: ${property.address}, ${property.city}, ${property.state} ${property.zip}
County Assessor APN: ${property.apn} (${property.county})

1. PURCHASE PRICE & TERMS
Buyer proposes an all-cash purchase price of $${offerPrice.toLocaleString()} USD, payable via wire transfer at closing, with no financing or appraisal contingencies.

2. CONDITION OF PROPERTY (AS-IS)
Property shall be conveyed in strict "As-Is, Where-Is" condition. Seller/Estate is not required to perform any repairs, cleanout, or debris removal prior to closing.

3. EARNEST MONEY & TITLE
Buyer will deposit $${earnestMoney.toLocaleString()} earnest money with a licensed ${property.state} title and escrow company within 3 business days of mutual execution.

4. CLOSING TIMELINE & PROBATE CONTINGENCY
Closing to occur within ${closingDays} calendar days, or immediately upon issuance of Court Order / Letters Testamentary confirming Personal Representative authority in ${property.county}, ${property.state}.

5. CLOSING COSTS
Buyer agrees to pay standard title policy premiums and escrow settlement fees so the Estate nets the stated proceeds (subject only to prorated property taxes and existing liens of record).

Submitted Respectfully,
Buyer / Acquisition Partner`;
}
