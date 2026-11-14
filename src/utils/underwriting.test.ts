import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateUnderwriting, sumRehabItems } from './underwriting.ts';

test('sumRehabItems totals itemized rehab budget', () => {
  const total = sumRehabItems({
    roofAndExterior: 8000,
    kitchenAndBaths: 15000,
    flooringAndPaint: 6000,
    hvacPlumbingElectrical: 7000,
    foundationAndPermits: 2000,
    contingency: 2000,
  });
  assert.equal(total, 40000);
});

test('calculateUnderwriting computes Flip MAO, BRRRR cash-out, Wholesale MAO, and Trailer Park NOI', () => {
  const baseItems = {
    roofAndExterior: 8000,
    kitchenAndBaths: 15000,
    flooringAndPaint: 6000,
    hvacPlumbingElectrical: 7000,
    foundationAndPermits: 2000,
    contingency: 2000,
  };

  const flip = calculateUnderwriting({
    strategy: 'flip',
    assetClass: 'Single-Family',
    arv: 400000,
    rehabItems: baseItems,
    wholesaleOrClosingBuffer: 10000,
    assignmentFeeTarget: 15000,
    holdingMonths: 4,
    monthlyHoldingCost: 1800,
    sellingCostPct: 7,
    monthlyRent: 2800,
    annualTaxes: 4200,
    annualInsurance: 1500,
    downPaymentPct: 20,
    interestRatePct: 6.5,
    loanTermYears: 30,
    refiLtvPct: 75,
    vacancyPct: 5,
    managementPct: 8,
    capexMaintenancePct: 5,
  });

  // 400,000 * 0.70 - 40,000 - 10,000 = 230,000
  assert.equal(flip.mao70Rule, 230000);
  // Wholesale MAO with 15,000 assignment fee = 225,000
  assert.equal(flip.wholesaleMao, 225000);
  // BRRRR Refi at 75% LTV on 400k ARV = 300,000
  assert.equal(flip.brrrrRefiProceeds, 300000);
  assert.equal(flip.brrrrCashLeftInDeal, 0);
  assert.ok(flip.flipNetProfit > 0);
  assert.ok(flip.dscr > 1);

  const mhp = calculateUnderwriting({
    strategy: 'rental',
    assetClass: 'Mobile Home / Trailer Park',
    arv: 1200000,
    rehabItems: {
      roofAndExterior: 0,
      kitchenAndBaths: 0,
      flooringAndPaint: 0,
      hvacPlumbingElectrical: 25000,
      foundationAndPermits: 15000,
      contingency: 10000,
    },
    wholesaleOrClosingBuffer: 15000,
    assignmentFeeTarget: 25000,
    holdingMonths: 3,
    monthlyHoldingCost: 2200,
    sellingCostPct: 5,
    monthlyRent: 0,
    annualTaxes: 9600,
    annualInsurance: 3600,
    downPaymentPct: 25,
    interestRatePct: 6.75,
    loanTermYears: 25,
    refiLtvPct: 75,
    vacancyPct: 5,
    managementPct: 6,
    capexMaintenancePct: 5,
    trailerPark: {
      padCount: 24,
      lotRentPerPad: 450,
      parkOwnedHomesCount: 4,
      parkOwnedHomeRent: 350,
      utilityExpenseRatioPct: 12,
    },
  });

  // 24 * 450 + 4 * 350 = 10,800 + 1,400 = 12,200 gross monthly income
  assert.equal(mhp.grossMonthlyIncome, 12200);
  assert.ok(mhp.annualNOI > 80000);
});
