import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyLocalTransactionRefund,
  detectLemonSqueezyMode,
  filterAndSortSupportTickets,
  findRefundableTransactionForTicket,
  normalizeLemonSqueezyOrders,
  normalizeLemonSqueezyStores,
  normalizeLemonSqueezySubscriptions,
  validateSupportTicketInput,
} from './supportAndRefunds.ts';
import type { LedgerTransaction, SupportTicket } from '../types.ts';

test('validateSupportTicketInput accepts valid suggestion & refund requests and rejects short messages', () => {
  const bad = validateSupportTicketInput({
    category: 'feature_suggestion',
    subject: 'Hi',
    message: 'Too short',
  });
  assert.equal(bad.ok, false);

  const okRefund = validateSupportTicketInput({
    category: 'refund_request',
    subject: 'Refund duplicate Pro charge',
    message: 'Accidentally upgraded twice while switching browser profiles. Please refund $79.',
    relatedTransactionId: 'txn-101',
    requestedRefundUsd: 79,
  });
  assert.equal(okRefund.ok, true);
  assert.equal(okRefund.normalized?.category, 'refund_request');
  assert.equal(okRefund.normalized?.requestedRefundUsd, 79);
  assert.equal(okRefund.normalized?.relatedTransactionId, 'txn-101');
});

test('filterAndSortSupportTickets prioritizes open refund requests before older general tickets', () => {
  const tickets: SupportTicket[] = [
    {
      id: 't1',
      userId: 'u1',
      userEmail: 'a@example.com',
      userName: 'Alice',
      subscriptionTier: 'free',
      category: 'feature_suggestion',
      subject: 'Add dark map heat layer',
      message: 'Would love equity shading.',
      status: 'open',
      createdAt: '2026-11-12T10:00:00.000Z',
      updatedAt: '2026-11-12T10:00:00.000Z',
    },
    {
      id: 't2',
      userId: 'u2',
      userEmail: 'b@example.com',
      userName: 'Bob',
      subscriptionTier: 'pro',
      category: 'refund_request',
      subject: 'Please refund monthly renewal',
      message: 'Closing down acquisitions this quarter.',
      status: 'open',
      createdAt: '2026-11-10T10:00:00.000Z',
      updatedAt: '2026-11-10T10:00:00.000Z',
    },
    {
      id: 't3',
      userId: 'u3',
      userEmail: 'c@example.com',
      userName: 'Carol',
      subscriptionTier: 'pro',
      category: 'general',
      subject: 'Question resolved',
      message: 'Thanks for the quick help.',
      status: 'resolved',
      createdAt: '2026-11-14T10:00:00.000Z',
      updatedAt: '2026-11-14T10:00:00.000Z',
    },
  ];

  const sorted = filterAndSortSupportTickets(tickets, { status: 'all', category: 'all' });
  assert.deepEqual(
    sorted.map((t) => t.id),
    ['t2', 't1', 't3']
  );

  const refundOnly = filterAndSortSupportTickets(tickets, { category: 'refund_request' });
  assert.equal(refundOnly.length, 1);
  assert.equal(refundOnly[0].id, 't2');
});

test('findRefundableTransactionForTicket & applyLocalTransactionRefund mark ledger transaction refunded cleanly', () => {
  const txns: LedgerTransaction[] = [
    {
      id: 'txn-pro-1',
      date: '2026-11-10T00:00:00.000Z',
      userId: 'u2',
      userEmail: 'investor@example.com',
      plan: 'Prob8 Pro ($79/mo)',
      processor: 'lemonsqueezy',
      grossUsd: 79,
      feeUsd: 4.45,
      netUsd: 74.55,
      status: 'paid',
      externalOrderId: 'ls-ord-998',
    },
  ];

  const match = findRefundableTransactionForTicket(
    { userEmail: 'investor@example.com', relatedOrderId: 'ls-ord-998' },
    txns
  );
  assert.ok(match);
  assert.equal(match?.id, 'txn-pro-1');

  const res = applyLocalTransactionRefund(txns, {
    transactionId: match!.id,
    reason: 'Customer requested cancellation within 24h',
    nowIso: '2026-11-14T14:00:00.000Z',
  });
  assert.ok(res.refundedTransaction);
  assert.equal(res.refundedTransaction?.status, 'refunded');
  assert.equal(res.refundedTransaction?.refundedAmountUsd, 79);
  assert.equal(res.transactions[0].status, 'refunded');

  // Re-applying should be idempotent (no double refund)
  const second = applyLocalTransactionRefund(res.transactions, { transactionId: match!.id });
  assert.equal(second.refundedTransaction, null);
});

test('Lemon Squeezy JSON:API normalizers parse stores, orders, subscriptions and mode cleanly', () => {
  const stores = normalizeLemonSqueezyStores({
    data: [
      {
        id: '9001',
        attributes: {
          name: 'Prob8 Store',
          slug: 'prob8',
          domain: 'prob8.lemonsqueezy.com',
          url: 'https://prob8.lemonsqueezy.com',
          currency: 'USD',
          plan: 'fresh',
          country_nicename: 'United States',
        },
      },
    ],
  });
  assert.equal(stores[0].slug, 'prob8');

  const orders = normalizeLemonSqueezyOrders({
    data: [
      {
        id: '42001',
        attributes: {
          order_number: 1001,
          user_name: 'Jane Investor',
          user_email: 'jane@example.com',
          total: 7900,
          total_formatted: '$79.00',
          refunded: false,
          refunded_amount: 0,
          status: 'paid',
          status_formatted: 'Paid',
          test_mode: true,
          first_order_item: { product_name: 'Prob8 Pro', variant_name: 'Monthly' },
          urls: { receipt: 'https://app.lemonsqueezy.com/my-orders/1001' },
          created_at: '2026-11-14T12:00:00Z',
        },
      },
    ],
  });
  assert.equal(orders[0].totalUsd, 79);
  assert.equal(orders[0].testMode, true);
  assert.equal(orders[0].productName, 'Prob8 Pro');

  const subs = normalizeLemonSqueezySubscriptions({
    data: [
      {
        id: '88001',
        attributes: {
          store_id: 9001,
          order_id: 42001,
          user_name: 'Jane Investor',
          user_email: 'jane@example.com',
          product_name: 'Prob8 Pro',
          variant_name: 'Monthly',
          status: 'active',
          status_formatted: 'Active',
          test_mode: true,
          cancelled: false,
          renews_at: '2026-12-14T12:00:00Z',
          created_at: '2026-11-14T12:00:00Z',
        },
      },
    ],
  });
  assert.equal(subs[0].status, 'active');
  assert.equal(detectLemonSqueezyMode({ orders, subscriptions: subs }), 'test');
});
