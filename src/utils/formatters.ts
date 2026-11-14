import type { PipelineDeal } from '../types';

export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '$0';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '0';
  return new Intl.NumberFormat('en-US').format(value);
}

export function formatDateShort(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function exportPipelineToCsv(deals: PipelineDeal[]): string {
  const headers = [
    'Address',
    'City',
    'State',
    'County',
    'Zip',
    'APN',
    'Stage',
    'Case Number',
    'Filing Date',
    'Executor',
    'AVM Value',
    'Est. Equity',
    'Equity %',
    'Offer Amount',
    'ARV Estimate',
    'Rehab Estimate',
    'Next Follow-Up',
  ];
  const escape = (val: unknown) => {
    const str = String(val ?? '');
    return `"${str.replace(/"/g, '""')}"`;
  };
  const rows = deals.map((d) => [
    d.property.address,
    d.property.city,
    d.property.state,
    d.property.county,
    d.property.zip,
    d.property.apn,
    d.stage,
    d.property.probateCaseNumber,
    d.property.filingDate,
    d.property.executorName,
    d.property.avmValue,
    d.property.estimatedEquity,
    `${d.property.equityPct}%`,
    d.offerAmount ?? '',
    d.arvEstimate ?? d.property.avmValue,
    d.rehabEstimate ?? '',
    d.nextFollowUp ?? '',
  ]);
  return [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))].join('\n');
}
