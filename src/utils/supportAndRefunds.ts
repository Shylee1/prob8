import type {
  LedgerTransaction,
  LemonSqueezyOrderSummary,
  LemonSqueezyStoreSummary,
  LemonSqueezySubscriptionSummary,
  SupportTicket,
  SupportTicketCategory,
  SupportTicketStatus,
} from '../types.ts';

export const SUPPORT_CATEGORY_LABELS: Record<SupportTicketCategory, string> = {
  feature_suggestion: 'Feature Suggestion',
  refund_request: 'Refund Request',
  billing_support: 'Billing Support',
  bug_report: 'Bug / Data Issue',
  general: 'General Contact',
};

export const SUPPORT_STATUS_LABELS: Record<SupportTicketStatus, string> = {
  open: 'Open',
  in_review: 'In Review',
  resolved: 'Resolved',
  refunded: 'Refunded',
};

const VALID_CATEGORIES = new Set<SupportTicketCategory>([
  'feature_suggestion',
  'refund_request',
  'billing_support',
  'bug_report',
  'general',
]);

export interface ValidateTicketInput {
  category: string;
  subject: string;
  message: string;
  relatedTransactionId?: string;
  relatedOrderId?: string;
  requestedRefundUsd?: number;
}

export function validateSupportTicketInput(input: ValidateTicketInput): {
  ok: boolean;
  error?: string;
  normalized?: {
    category: SupportTicketCategory;
    subject: string;
    message: string;
    relatedTransactionId?: string;
    relatedOrderId?: string;
    requestedRefundUsd?: number;
  };
} {
  const rawCat = String(input.category || 'general').trim() as SupportTicketCategory;
  const category: SupportTicketCategory = VALID_CATEGORIES.has(rawCat) ? rawCat : 'general';
  const subject = String(input.subject || '').trim();
  const message = String(input.message || '').trim();

  if (subject.length < 3) {
    return { ok: false, error: 'Please enter a brief subject (at least 3 characters).' };
  }
  if (subject.length > 160) {
    return { ok: false, error: 'Subject must be 160 characters or fewer.' };
  }
  if (message.length < 8) {
    return { ok: false, error: 'Please include enough detail in your message (at least 8 characters).' };
  }
  if (message.length > 4000) {
    return { ok: false, error: 'Message exceeds the 4,000-character limit.' };
  }

  const relatedTransactionId = input.relatedTransactionId?.trim() || undefined;
  const relatedOrderId = input.relatedOrderId?.trim() || undefined;
  const parsedRefund =
    input.requestedRefundUsd !== undefined && Number.isFinite(Number(input.requestedRefundUsd))
      ? Math.max(0, Number(Number(input.requestedRefundUsd).toFixed(2)))
      : undefined;

  return {
    ok: true,
    normalized: {
      category,
      subject,
      message,
      relatedTransactionId,
      relatedOrderId,
      requestedRefundUsd: category === 'refund_request' ? parsedRefund : undefined,
    },
  };
}

export function filterAndSortSupportTickets(
  tickets: SupportTicket[],
  filters?: {
    category?: 'all' | SupportTicketCategory;
    status?: 'all' | SupportTicketStatus;
    search?: string;
  }
): SupportTicket[] {
  const cat = filters?.category ?? 'all';
  const stat = filters?.status ?? 'all';
  const q = (filters?.search ?? '').trim().toLowerCase();

  const statusWeight: Record<SupportTicketStatus, number> = {
    open: 0,
    in_review: 1,
    resolved: 2,
    refunded: 3,
  };

  return tickets
    .filter((t) => {
      if (cat !== 'all' && t.category !== cat) return false;
      if (stat !== 'all' && t.status !== stat) return false;
      if (!q) return true;
      return (
        t.subject.toLowerCase().includes(q) ||
        t.message.toLowerCase().includes(q) ||
        t.userEmail.toLowerCase().includes(q) ||
        t.userName.toLowerCase().includes(q) ||
        (t.relatedOrderId || '').toLowerCase().includes(q)
      );
    })
    .slice()
    .sort((a, b) => {
      const sw = (statusWeight[a.status] ?? 9) - (statusWeight[b.status] ?? 9);
      if (sw !== 0) return sw;
      // Within open tickets, prioritize refund requests
      if (a.status === 'open' && b.status === 'open') {
        if (a.category === 'refund_request' && b.category !== 'refund_request') return -1;
        if (b.category === 'refund_request' && a.category !== 'refund_request') return 1;
      }
      return Date.parse(b.updatedAt || b.createdAt) - Date.parse(a.updatedAt || a.createdAt);
    });
}

export function findRefundableTransactionForTicket(
  ticket: Pick<SupportTicket, 'relatedTransactionId' | 'relatedOrderId' | 'userEmail'>,
  transactions: LedgerTransaction[]
): LedgerTransaction | null {
  const paid = transactions.filter((t) => t.status === 'paid' && t.grossUsd > 0);
  if (ticket.relatedTransactionId) {
    const byId = paid.find((t) => t.id === ticket.relatedTransactionId);
    if (byId) return byId;
  }
  if (ticket.relatedOrderId) {
    const byOrder = paid.find((t) => t.externalOrderId === ticket.relatedOrderId);
    if (byOrder) return byOrder;
  }
  const email = ticket.userEmail.trim().toLowerCase();
  return paid.find((t) => t.userEmail.trim().toLowerCase() === email) ?? null;
}

export function applyLocalTransactionRefund(
  transactions: LedgerTransaction[],
  input: {
    transactionId?: string;
    externalOrderId?: string;
    amountUsd?: number;
    reason?: string;
    nowIso?: string;
  }
): {
  transactions: LedgerTransaction[];
  refundedTransaction: LedgerTransaction | null;
} {
  const nowIso = input.nowIso ?? new Date().toISOString();
  let matched: LedgerTransaction | null = null;

  const updated = transactions.map((txn) => {
    const isMatch =
      (input.transactionId && txn.id === input.transactionId) ||
      (input.externalOrderId && txn.externalOrderId === input.externalOrderId);

    if (!isMatch || txn.status === 'refunded') {
      return txn;
    }

    const refundedAmountUsd =
      input.amountUsd !== undefined && Number.isFinite(input.amountUsd) && input.amountUsd > 0
        ? Math.min(txn.grossUsd, Number(input.amountUsd.toFixed(2)))
        : txn.grossUsd;

    const updatedTxn: LedgerTransaction = {
      ...txn,
      status: 'refunded',
      netUsd: Math.max(0, Number((txn.netUsd - refundedAmountUsd).toFixed(2))),
      refundedAmountUsd,
      refundedAt: nowIso,
      refundReason: input.reason?.trim() || 'Refund issued from Admin Command Center',
    };
    matched = updatedTxn;
    return updatedTxn;
  });

  return { transactions: updated, refundedTransaction: matched };
}

interface JsonApiResource<TAttrs = Record<string, unknown>> {
  id?: string | number;
  type?: string;
  attributes?: TAttrs;
}

interface JsonApiListPayload {
  data?: JsonApiResource[];
}

export function normalizeLemonSqueezyStores(payload: unknown): LemonSqueezyStoreSummary[] {
  const items = ((payload as JsonApiListPayload | null)?.data ?? []) as JsonApiResource[];
  return items.map((item) => {
    const a = (item.attributes ?? {}) as Record<string, unknown>;
    return {
      id: String(item.id ?? ''),
      name: String(a.name ?? 'Prob8 Store'),
      slug: String(a.slug ?? ''),
      domain: String(a.domain ?? ''),
      url: String(a.url ?? ''),
      currency: String(a.currency ?? 'USD'),
      plan: String(a.plan ?? ''),
      countryNicename: String(a.country_nicename ?? 'United States'),
    };
  });
}

export function normalizeLemonSqueezyOrders(payload: unknown): LemonSqueezyOrderSummary[] {
  const items = ((payload as JsonApiListPayload | null)?.data ?? []) as JsonApiResource[];
  return items.map((item) => {
    const a = (item.attributes ?? {}) as Record<string, unknown>;
    const firstItem = (a.first_order_item ?? {}) as Record<string, unknown>;
    const urls = (a.urls ?? {}) as Record<string, unknown>;
    const totalCents = Number(a.total ?? 0);
    const refundedCents = Number(a.refunded_amount ?? 0);
    return {
      id: String(item.id ?? ''),
      orderNumber: Number(a.order_number ?? item.id ?? 0),
      userName: String(a.user_name ?? 'Customer'),
      userEmail: String(a.user_email ?? ''),
      productName: String(firstItem.product_name ?? 'Prob8 Subscription'),
      variantName: String(firstItem.variant_name ?? ''),
      totalUsd: Number((totalCents / 100).toFixed(2)),
      totalFormatted: String(a.total_formatted ?? `$${(totalCents / 100).toFixed(2)}`),
      refunded: Boolean(a.refunded),
      refundedAmountUsd: Number((refundedCents / 100).toFixed(2)),
      refundedAt: a.refunded_at ? String(a.refunded_at) : undefined,
      status: String(a.status ?? 'paid'),
      statusFormatted: String(a.status_formatted ?? 'Paid'),
      testMode: Boolean(a.test_mode),
      receiptUrl: urls.receipt ? String(urls.receipt) : undefined,
      createdAt: String(a.created_at ?? new Date().toISOString()),
    };
  });
}

export function normalizeLemonSqueezySubscriptions(
  payload: unknown
): LemonSqueezySubscriptionSummary[] {
  const items = ((payload as JsonApiListPayload | null)?.data ?? []) as JsonApiResource[];
  return items.map((item) => {
    const a = (item.attributes ?? {}) as Record<string, unknown>;
    const urls = (a.urls ?? {}) as Record<string, unknown>;
    return {
      id: String(item.id ?? ''),
      storeId: String(a.store_id ?? ''),
      orderId: String(a.order_id ?? ''),
      userName: String(a.user_name ?? 'Subscriber'),
      userEmail: String(a.user_email ?? ''),
      productName: String(a.product_name ?? 'Prob8 Pro'),
      variantName: String(a.variant_name ?? ''),
      status: String(a.status ?? 'active'),
      statusFormatted: String(a.status_formatted ?? 'Active'),
      renewsAt: a.renews_at ? String(a.renews_at) : undefined,
      endsAt: a.ends_at ? String(a.ends_at) : undefined,
      trialEndsAt: a.trial_ends_at ? String(a.trial_ends_at) : undefined,
      testMode: Boolean(a.test_mode),
      cancelled: Boolean(a.cancelled),
      updatePaymentMethodUrl: urls.update_payment_method
        ? String(urls.update_payment_method)
        : undefined,
      customerPortalUrl: urls.customer_portal ? String(urls.customer_portal) : undefined,
      createdAt: String(a.created_at ?? new Date().toISOString()),
    };
  });
}

export function detectLemonSqueezyMode(input: {
  orders: LemonSqueezyOrderSummary[];
  subscriptions: LemonSqueezySubscriptionSummary[];
}): 'test' | 'live' {
  const hasAnyLive =
    input.orders.some((o) => !o.testMode) || input.subscriptions.some((s) => !s.testMode);
  const hasAnyTest =
    input.orders.some((o) => o.testMode) || input.subscriptions.some((s) => s.testMode);
  if (hasAnyLive && !hasAnyTest) return 'live';
  if (hasAnyTest) return 'test';
  // New accounts with zero orders yet are typically in Test Mode until store activation
  return 'test';
}
