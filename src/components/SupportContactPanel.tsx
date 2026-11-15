import React, { useMemo, useState } from 'react';
import {
  Bug,
  CheckCircle2,
  CreditCard,
  Inbox,
  Lightbulb,
  MessageSquare,
  RotateCcw,
  Send,
  ShieldCheck,
} from 'lucide-react';
import type {
  LedgerTransaction,
  SupportTicket,
  SupportTicketCategory,
  UserProfile,
} from '../types';
import { formatCurrency, formatDateShort } from '../utils/formatters';
import {
  SUPPORT_CATEGORY_LABELS,
  SUPPORT_STATUS_LABELS,
  validateSupportTicketInput,
} from '../utils/supportAndRefunds';

interface SupportContactPanelProps {
  userProfile: UserProfile;
  userTransactions: LedgerTransaction[];
  tickets: SupportTicket[];
  onSubmitTicket: (input: {
    category: SupportTicketCategory;
    subject: string;
    message: string;
    relatedTransactionId?: string;
    relatedOrderId?: string;
    requestedRefundUsd?: number;
  }) => Promise<{ ok: boolean; error?: string; ticket?: SupportTicket }>;
}

const CATEGORY_OPTIONS: Array<{
  id: SupportTicketCategory;
  label: string;
  hint: string;
  icon: React.ReactNode;
}> = [
  {
    id: 'feature_suggestion',
    label: 'Feature Suggestion',
    hint: 'Share product ideas, new county sources, or workflow improvements.',
    icon: <Lightbulb className="h-4 w-4" />,
  },
  {
    id: 'refund_request',
    label: 'Refund Request',
    hint: 'Request a Pro or Lifetime refund directly inside Prob8 — reviewed inside our Admin Desk.',
    icon: <RotateCcw className="h-4 w-4" />,
  },
  {
    id: 'billing_support',
    label: 'Billing Question',
    hint: 'Plan upgrades, promo codes, trials, or invoice receipts.',
    icon: <CreditCard className="h-4 w-4" />,
  },
  {
    id: 'bug_report',
    label: 'Bug / Data Issue',
    hint: 'Report missing county docket fields, map behavior, or sync issues.',
    icon: <Bug className="h-4 w-4" />,
  },
  {
    id: 'general',
    label: 'General Contact',
    hint: 'Reach our founder & support team without leaving Prob8.',
    icon: <MessageSquare className="h-4 w-4" />,
  },
];

export const SupportContactPanel: React.FC<SupportContactPanelProps> = ({
  userProfile,
  userTransactions,
  tickets,
  onSubmitTicket,
}) => {
  const [category, setCategory] = useState<SupportTicketCategory>('feature_suggestion');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [selectedTxnId, setSelectedTxnId] = useState('');
  const [orderRef, setOrderRef] = useState('');
  const [requestedRefundUsd, setRequestedRefundUsd] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const paidTransactions = useMemo(
    () => userTransactions.filter((t) => t.status === 'paid' && t.grossUsd > 0),
    [userTransactions]
  );

  const selectedCategoryMeta =
    CATEGORY_OPTIONS.find((c) => c.id === category) ?? CATEGORY_OPTIONS[0];

  const handleSelectTransaction = (txnId: string) => {
    setSelectedTxnId(txnId);
    const matched = paidTransactions.find((t) => t.id === txnId);
    if (matched) {
      setRequestedRefundUsd(String(matched.grossUsd));
      if (matched.externalOrderId) {
        setOrderRef(matched.externalOrderId);
      }
      if (!subject.trim()) {
        setSubject(`Refund request for ${matched.plan}`);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const parsedRefund =
      category === 'refund_request' && requestedRefundUsd.trim()
        ? Number(requestedRefundUsd)
        : undefined;

    const validation = validateSupportTicketInput({
      category,
      subject,
      message,
      relatedTransactionId: selectedTxnId || undefined,
      relatedOrderId: orderRef || undefined,
      requestedRefundUsd: parsedRefund,
    });

    if (!validation.ok) {
      setFeedback({ ok: false, text: validation.error || 'Check your request fields.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await onSubmitTicket({
        category,
        subject: subject.trim(),
        message: message.trim(),
        relatedTransactionId: selectedTxnId || undefined,
        relatedOrderId: orderRef.trim() || undefined,
        requestedRefundUsd: parsedRefund,
      });

      if (!result.ok) {
        setFeedback({ ok: false, text: result.error || 'Could not send request. Try again.' });
        return;
      }

      setSubject('');
      setMessage('');
      setSelectedTxnId('');
      setOrderRef('');
      setRequestedRefundUsd('');
      setFeedback({
        ok: true,
        text: `Submitted cleanly to Prob8 Support Desk (${SUPPORT_CATEGORY_LABELS[category]}). Track updates below anytime.`,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const statusTone = (status: SupportTicket['status']) => {
    if (status === 'refunded') {
      return 'border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300';
    }
    if (status === 'resolved') {
      return 'border-emerald-500/30 bg-emerald-500/10 text-[#0F766E] dark:text-emerald-400';
    }
    if (status === 'in_review') {
      return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300';
    }
    return 'border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200';
  };

  return (
    <div className="mx-auto max-w-[1200px] px-4 md:px-6 py-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-[#0F766E] dark:text-emerald-400" />
            Contact Prob8 Support, Suggestions &amp; Refunds
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Messages go straight into the Founder &amp; Support Admin Desk. Track every reply and refund status right here in-app.
          </p>
        </div>

        <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] px-3.5 py-2 text-xs text-slate-600 dark:text-slate-300">
          <ShieldCheck className="h-4 w-4 text-[#0F766E] dark:text-emerald-400 shrink-0" />
          <span>Direct Encrypted Inbox · Zero External Email Exposure</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Embedded Form */}
        <section className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 space-y-5">
          <div>
            <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
              Send a Message or Request
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Sending from <span className="font-mono font-semibold">{userProfile.email}</span> ({userProfile.fullName})
            </p>
          </div>

          {/* Category Selector */}
          <div className="space-y-2">
            <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Topic / Request Type
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {CATEGORY_OPTIONS.map((opt) => {
                const active = category === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setCategory(opt.id)}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs font-semibold transition-colors ${
                      active
                        ? 'border-[#0F766E] bg-[#0F766E]/10 dark:bg-emerald-950/30 text-[#0F766E] dark:text-emerald-400'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-[#090D16] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70'
                    }`}
                  >
                    {opt.icon}
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">{selectedCategoryMeta.hint}</p>
          </div>

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            {category === 'refund_request' && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#090D16] p-4 space-y-3">
                <p className="text-xs font-bold text-slate-900 dark:text-white">
                  Billing &amp; Refund Details
                </p>

                {paidTransactions.length > 0 && (
                  <div>
                    <label
                      htmlFor="support-txn-select"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                    >
                      Select Recent Paid Charge
                    </label>
                    <select
                      id="support-txn-select"
                      value={selectedTxnId}
                      onChange={(e) => handleSelectTransaction(e.target.value)}
                      className="mt-1 w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111827] px-3 text-xs font-medium text-slate-900 dark:text-white"
                    >
                      <option value="">Choose a transaction or enter order ID below...</option>
                      {paidTransactions.map((t) => (
                        <option key={t.id} value={t.id}>
                          {formatDateShort(t.date)} · {t.plan} · {formatCurrency(t.grossUsd)} ({t.processor.toUpperCase()})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="support-order-ref"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                    >
                      Order / Receipt Reference (Optional)
                    </label>
                    <input
                      id="support-order-ref"
                      type="text"
                      value={orderRef}
                      onChange={(e) => setOrderRef(e.target.value)}
                      placeholder="e.g. Lemon Squeezy Order # or ID"
                      className="mt-1 w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111827] px-3 font-mono text-xs text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="support-refund-amt"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                    >
                      Refund Amount (USD)
                    </label>
                    <input
                      id="support-refund-amt"
                      type="number"
                      min={0}
                      step="0.01"
                      value={requestedRefundUsd}
                      onChange={(e) => setRequestedRefundUsd(e.target.value)}
                      placeholder="79.00"
                      className="mt-1 w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111827] px-3 font-mono text-xs text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>
            )}

            <div>
              <label
                htmlFor="support-subject"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Subject
              </label>
              <input
                id="support-subject"
                type="text"
                required
                maxLength={160}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={
                  category === 'feature_suggestion'
                    ? 'e.g. Add county tax lien filter to Buy-Boxes'
                    : category === 'refund_request'
                      ? 'e.g. Refund request for recent Pro renewal'
                      : 'Brief summary of your question or feedback'
                }
                className="mt-1 w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-3 text-xs text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label
                htmlFor="support-message"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Message Details
              </label>
              <textarea
                id="support-message"
                required
                rows={5}
                maxLength={4000}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Describe your suggestion, question, or refund reason clearly so our team can act quickly..."
                className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] p-3 text-xs text-slate-900 dark:text-white leading-relaxed"
              />
              <p className="mt-1 text-[11px] text-slate-400 text-right font-mono">
                {message.length}/4000
              </p>
            </div>

            {feedback && (
              <div
                role="status"
                className={`rounded-xl border px-3.5 py-2.5 text-xs font-semibold flex items-center gap-2 ${
                  feedback.ok
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-[#0F766E] dark:text-emerald-400'
                    : 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300'
                }`}
              >
                {feedback.ok && <CheckCircle2 className="h-4 w-4 shrink-0" />}
                <span>{feedback.text}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex h-11 w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-[#0F766E] px-6 text-xs font-semibold text-white hover:bg-[#0D625B] disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" />
              {isSubmitting ? 'Sending to Support Desk...' : 'Send Directly to Prob8 Support'}
            </button>
          </form>
        </section>

        {/* Right: User Ticket History & Replies */}
        <section className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Inbox className="h-4 w-4 text-[#0F766E] dark:text-emerald-400" />
              My Submitted Requests ({tickets.length})
            </h2>
          </div>

          {tickets.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-6 text-center space-y-1.5">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                No requests submitted yet
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Any feature ideas, contact inquiries, or refund requests you send appear here with live resolution status.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {tickets.map((tkt) => (
                <li
                  key={tkt.id}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#090D16] p-4 space-y-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {SUPPORT_CATEGORY_LABELS[tkt.category]}
                    </span>
                    <span
                      className={`rounded-md border px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${statusTone(
                        tkt.status
                      )}`}
                    >
                      {SUPPORT_STATUS_LABELS[tkt.status]}
                    </span>
                  </div>

                  <p className="text-xs font-bold text-slate-900 dark:text-white">{tkt.subject}</p>
                  <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                    {tkt.message}
                  </p>

                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                    <span>Sent {formatDateShort(tkt.createdAt)}</span>
                    {tkt.requestedRefundUsd !== undefined && tkt.requestedRefundUsd > 0 && (
                      <span>Requested: {formatCurrency(tkt.requestedRefundUsd)}</span>
                    )}
                    {tkt.relatedOrderId && <span>Order: {tkt.relatedOrderId}</span>}
                  </div>

                  {tkt.adminResponse && (
                    <div className="mt-2 rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-3 space-y-1">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-[#0F766E] dark:text-emerald-400">
                        Prob8 Support Response
                      </p>
                      <p className="text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                        {tkt.adminResponse}
                      </p>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
};
