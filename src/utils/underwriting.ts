import type { PropertyType } from '../types';

export type InvestmentStrategy = 'flip' | 'brrrr' | 'rental' | 'wholesale';

export interface RehabLineItems {
  roofAndExterior: number;
  kitchenAndBaths: number;
  flooringAndPaint: number;
  hvacPlumbingElectrical: number;
  foundationAndPermits: number;
  contingency: number;
}

export interface TrailerParkInputs {
  padCount: number;
  lotRentPerPad: number;
  parkOwnedHomesCount: number;
  parkOwnedHomeRent: number;
  utilityExpenseRatioPct: number;
}

export interface UnderwritingInputs {
  strategy: InvestmentStrategy;
  assetClass: PropertyType;
  purchasePriceOverride?: number;
  arv: number;
  rehabItems: RehabLineItems;
  wholesaleOrClosingBuffer: number;
  assignmentFeeTarget: number;
  holdingMonths: number;
  monthlyHoldingCost: number;
  sellingCostPct: number;
  monthlyRent: number;
  annualTaxes: number;
  annualInsurance: number;
  downPaymentPct: number;
  interestRatePct: number;
  loanTermYears: number;
  refiLtvPct: number;
  vacancyPct: number;
  managementPct: number;
  capexMaintenancePct: number;
  trailerPark?: TrailerParkInputs;
}

export interface UnderwritingResult {
  strategy: InvestmentStrategy;
  assetClass: PropertyType;
  totalRehab: number;
  mao70Rule: number;
  wholesaleMao: number;
  wholesaleAssignmentProfit: number;
  effectivePurchasePrice: number;
  spreadToArv: number;
  estimatedOfferPctOfArv: number;
  holdingAndSellingCosts: number;
  flipNetProfit: number;
  flipRoiPct: number;
  brrrrRefiProceeds: number;
  brrrrCashLeftInDeal: number;
  brrrrPostRefiMonthlyPayment: number;
  brrrrPostRefiMonthlyCashFlow: number;
  grossMonthlyIncome: number;
  monthlyMortgagePI: number;
  monthlyOperatingExpenses: number;
  totalMonthlyDebtAndExpenses: number;
  monthlyCashFlow: number;
  annualNOI: number;
  dscr: number;
  capRatePct: number;
  cashOnCashRoiPct: number;
  totalCashInvested: number;
  fiveYearEquityAndCashflow: number;
}

export function sumRehabItems(items: RehabLineItems): number {
  return Math.max(
    0,
    Math.round(
      items.roofAndExterior +
        items.kitchenAndBaths +
        items.flooringAndPaint +
        items.hvacPlumbingElectrical +
        items.foundationAndPermits +
        items.contingency
    )
  );
}

function calcMonthlyPI(loanAmount: number, annualRatePct: number, years: number): number {
  if (loanAmount <= 0) return 0;
  const monthlyRate = Math.max(0, annualRatePct) / 100 / 12;
  const totalPayments = Math.max(1, years * 12);
  if (monthlyRate === 0) return loanAmount / totalPayments;
  const factor = Math.pow(1 + monthlyRate, totalPayments);
  return (loanAmount * (monthlyRate * factor)) / (factor - 1);
}

export function calculateUnderwriting(inputs: UnderwritingInputs): UnderwritingResult {
  const arv = Math.max(0, inputs.arv);
  const totalRehab = sumRehabItems(inputs.rehabItems);
  const closingBuffer = Math.max(0, inputs.wholesaleOrClosingBuffer);
  const mao70Rule = Math.max(0, Math.round(arv * 0.7 - totalRehab - closingBuffer));
  const assignmentFee = Math.max(0, inputs.assignmentFeeTarget);
  const wholesaleMao = Math.max(0, Math.round(arv * 0.7 - totalRehab - assignmentFee));

  const effectivePurchasePrice =
    inputs.purchasePriceOverride !== undefined && inputs.purchasePriceOverride > 0
      ? Math.round(inputs.purchasePriceOverride)
      : inputs.strategy === 'wholesale'
        ? wholesaleMao
        : mao70Rule;

  const spreadToArv = Math.max(0, Math.round(arv - effectivePurchasePrice - totalRehab));
  const estimatedOfferPctOfArv = arv > 0 ? Number(((effectivePurchasePrice / arv) * 100).toFixed(1)) : 0;

  // Fix & Flip Metrics
  const holdingTotal = Math.max(0, inputs.holdingMonths) * Math.max(0, inputs.monthlyHoldingCost);
  const sellingTotal = arv * (Math.max(0, inputs.sellingCostPct) / 100);
  const holdingAndSellingCosts = Math.round(holdingTotal + sellingTotal + closingBuffer);
  const flipNetProfit = Math.round(arv - effectivePurchasePrice - totalRehab - holdingAndSellingCosts);
  const flipCashBasis = effectivePurchasePrice + totalRehab + holdingTotal;
  const flipRoiPct = flipCashBasis > 0 ? Number(((flipNetProfit / flipCashBasis) * 100).toFixed(1)) : 0;

  // Gross Monthly Income (supports Mobile Home / Trailer Park pad + POH rent or standard rent)
  let grossMonthlyIncome = Math.max(0, inputs.monthlyRent);
  let parkUtilityRatioExpense = 0;
  if (inputs.assetClass === 'Mobile Home / Trailer Park' && inputs.trailerPark) {
    const padIncome = Math.max(0, inputs.trailerPark.padCount) * Math.max(0, inputs.trailerPark.lotRentPerPad);
    const pohIncome =
      Math.max(0, inputs.trailerPark.parkOwnedHomesCount) * Math.max(0, inputs.trailerPark.parkOwnedHomeRent);
    grossMonthlyIncome = padIncome + pohIncome;
    parkUtilityRatioExpense =
      grossMonthlyIncome * (Math.min(85, Math.max(0, inputs.trailerPark.utilityExpenseRatioPct)) / 100);
  }

  // Acquisition Debt Service
  const downPayment = effectivePurchasePrice * (Math.min(100, Math.max(0, inputs.downPaymentPct)) / 100);
  const loanAmount = Math.max(0, effectivePurchasePrice - downPayment);
  const monthlyMortgagePI = calcMonthlyPI(loanAmount, inputs.interestRatePct, inputs.loanTermYears);

  const monthlyTaxes = Math.max(0, inputs.annualTaxes) / 12;
  const monthlyInsurance = Math.max(0, inputs.annualInsurance) / 12;
  const variableOpEx =
    grossMonthlyIncome *
    ((Math.max(0, inputs.vacancyPct) +
      Math.max(0, inputs.managementPct) +
      Math.max(0, inputs.capexMaintenancePct)) /
      100);

  const monthlyOperatingExpenses = monthlyTaxes + monthlyInsurance + variableOpEx + parkUtilityRatioExpense;
  const totalMonthlyDebtAndExpenses = monthlyMortgagePI + monthlyOperatingExpenses;
  const monthlyCashFlow = grossMonthlyIncome - totalMonthlyDebtAndExpenses;

  const annualNOI = (grossMonthlyIncome - monthlyOperatingExpenses) * 12;
  const annualDebtService = monthlyMortgagePI * 12;
  const dscr = annualDebtService > 0 ? Number((annualNOI / annualDebtService).toFixed(2)) : 0;

  const allInBasis = effectivePurchasePrice + totalRehab;
  const capRatePct = allInBasis > 0 ? Number(((annualNOI / allInBasis) * 100).toFixed(2)) : 0;

  const totalCashInvested = downPayment + totalRehab + effectivePurchasePrice * 0.03;
  const cashOnCashRoiPct =
    totalCashInvested > 0 ? Number((((monthlyCashFlow * 12) / totalCashInvested) * 100).toFixed(2)) : 0;

  // BRRRR Refinance Metrics
  const refiLtv = Math.min(85, Math.max(40, inputs.refiLtvPct)) / 100;
  const brrrrRefiProceeds = Math.round(arv * refiLtv);
  const brrrrTotalCostBasis = effectivePurchasePrice + totalRehab + closingBuffer;
  const brrrrCashLeftInDeal = Math.max(0, Math.round(brrrrTotalCostBasis - brrrrRefiProceeds));
  const brrrrPostRefiMonthlyPayment = calcMonthlyPI(brrrrRefiProceeds, inputs.interestRatePct, inputs.loanTermYears);
  const brrrrPostRefiMonthlyCashFlow = Math.round(
    grossMonthlyIncome - monthlyOperatingExpenses - brrrrPostRefiMonthlyPayment
  );

  // 5-Year Projected Combined Return (3% appreciation + cumulative cash flow + equity spread)
  const fiveYrAppreciatedValue = arv * Math.pow(1.03, 5);
  const fiveYearEquityAndCashflow = Math.round(
    fiveYrAppreciatedValue - loanAmount + monthlyCashFlow * 60
  );

  return {
    strategy: inputs.strategy,
    assetClass: inputs.assetClass,
    totalRehab,
    mao70Rule,
    wholesaleMao,
    wholesaleAssignmentProfit: assignmentFee,
    effectivePurchasePrice,
    spreadToArv,
    estimatedOfferPctOfArv,
    holdingAndSellingCosts,
    flipNetProfit,
    flipRoiPct,
    brrrrRefiProceeds,
    brrrrCashLeftInDeal,
    brrrrPostRefiMonthlyPayment: Math.round(brrrrPostRefiMonthlyPayment),
    brrrrPostRefiMonthlyCashFlow,
    grossMonthlyIncome: Math.round(grossMonthlyIncome),
    monthlyMortgagePI: Math.round(monthlyMortgagePI),
    monthlyOperatingExpenses: Math.round(monthlyOperatingExpenses),
    totalMonthlyDebtAndExpenses: Math.round(totalMonthlyDebtAndExpenses),
    monthlyCashFlow: Math.round(monthlyCashFlow),
    annualNOI: Math.round(annualNOI),
    dscr,
    capRatePct,
    cashOnCashRoiPct,
    totalCashInvested: Math.round(totalCashInvested),
    fiveYearEquityAndCashflow,
  };
}
