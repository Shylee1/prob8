import React, { useMemo, useState } from 'react';
import { Building2, Lock, Mail, MapPin, Phone, Plus, Search, Sparkles, UserPlus, Users, X } from 'lucide-react';
import {
  PERSON_ROLES,
  type EngagementRecord,
  type PersonRecord,
  type PersonRole,
  type PropertyPersonLink,
  type PropertyRecord,
  type SubscriptionTier,
} from '../types';
import { formatCurrency, formatDateShort } from '../utils/formatters';

interface PeopleCRMViewProps {
  people: PersonRecord[];
  propertyPeople: PropertyPersonLink[];
  knownProperties: PropertyRecord[];
  engagements: EngagementRecord[];
  subscriptionTier: SubscriptionTier;
  onAddPerson: (input: {
    fullName: string;
    role: PersonRole;
    phone: string;
    email: string;
    mailingAddress: string;
    notes: string;
    linkedPropertyId?: string;
  }) => void;
  onLinkProperty: (propertyId: string, personId: string, relationshipType: string) => void;
  onSkipTracePerson: (person: PersonRecord) => Promise<void>;
  onOpenPropertyDossier: (property: PropertyRecord) => void;
  onOpenUpgradeModal: () => void;
  initialSelectedPersonId?: string | null;
}

export const PeopleCRMView: React.FC<PeopleCRMViewProps> = ({
  people,
  propertyPeople,
  knownProperties,
  engagements,
  subscriptionTier,
  onAddPerson,
  onLinkProperty,
  onSkipTracePerson,
  onOpenPropertyDossier,
  onOpenUpgradeModal,
  initialSelectedPersonId,
}) => {
  const hasProAccess = subscriptionTier === 'pro' || subscriptionTier === 'vip_lifetime';
  const [roleFilter, setRoleFilter] = useState<'All' | PersonRole>('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(initialSelectedPersonId ?? null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [linkPropertyId, setLinkPropertyId] = useState('');
  const [isTracing, setIsTracing] = useState(false);

  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<PersonRole>('Executor');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [mailingAddress, setMailingAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const filteredPeople = useMemo(() => {
    return people.filter((p) => {
      if (roleFilter !== 'All' && p.role !== roleFilter) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const hit =
          p.fullName.toLowerCase().includes(q) ||
          p.role.toLowerCase().includes(q) ||
          p.mailingAddress.toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [people, roleFilter, searchTerm]);

  const selectedPerson = people.find((p) => p.id === selectedPersonId) ?? filteredPeople[0] ?? null;

  const linkedPropertiesForSelected = useMemo(() => {
    if (!selectedPerson) return [];
    const links = propertyPeople.filter((l) => l.personId === selectedPerson.id);
    return links
      .map((l) => ({
        link: l,
        property: knownProperties.find((p) => p.id === l.propertyId),
      }))
      .filter((item): item is { link: PropertyPersonLink; property: PropertyRecord } => Boolean(item.property));
  }, [selectedPerson, propertyPeople, knownProperties]);

  const engagementsForSelected = useMemo(() => {
    if (!selectedPerson) return [];
    const propIds = new Set(linkedPropertiesForSelected.map((lp) => lp.property.id));
    return engagements.filter(
      (e) => e.personId === selectedPerson.id || (e.propertyId && propIds.has(e.propertyId))
    );
  }, [selectedPerson, engagements, linkedPropertiesForSelected]);

  const handleSubmitNewPerson = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setFormError('Full name is required.');
      return;
    }
    setFormError(null);
    onAddPerson({
      fullName: fullName.trim(),
      role,
      phone: phone.trim(),
      email: email.trim(),
      mailingAddress: mailingAddress.trim(),
      notes: notes.trim(),
      linkedPropertyId: linkPropertyId || undefined,
    });
    setFullName('');
    setPhone('');
    setEmail('');
    setMailingAddress('');
    setNotes('');
    setLinkPropertyId('');
    setShowAddForm(false);
  };

  if (people.length === 0 && !showAddForm) {
    return (
      <div className="mx-auto max-w-2xl py-16 px-4 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0F766E]/10 dark:bg-emerald-500/15 text-[#0F766E] dark:text-emerald-400">
          <Users className="h-7 w-7" />
        </div>
        <h2 className="mt-5 font-display text-2xl font-bold text-slate-900 dark:text-white">
          Your People CRM is Empty
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          Add Executors, Heirs, Probate Attorneys, Cash Buyers, or Contractors—or run One-Click Skip Trace inside any Property Dossier or directly here. Every person automatically cross-links to all associated properties.
        </p>
        <button
          type="button"
          onClick={() => setShowAddForm(true)}
          className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-[#0F766E] px-5 text-sm font-semibold text-white hover:bg-[#0D625B] transition-colors"
        >
          <UserPlus className="h-4 w-4" />
          Add First Contact
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1440px] px-4 md:px-6 py-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white">
            Relational People CRM ({people.length})
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Bidirectionally cross-connected to every associated probate property, skip trace log, and outreach timeline.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAddForm(true)}
          className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#0F766E] px-4 text-xs font-semibold text-white hover:bg-[#0D625B] whitespace-nowrap"
        >
          <Plus className="h-4 w-4" />
          Add Contact
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            aria-label="Search contacts"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, role, or address..."
            className="w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111827] pl-9 pr-3 text-sm text-slate-900 dark:text-white"
          />
        </div>

        <div className="flex items-center gap-1 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111827] p-1">
          {(['All', ...PERSON_ROLES] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRoleFilter(r)}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap ${
                roleFilter === r
                  ? 'bg-slate-900 dark:bg-emerald-600 text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 space-y-2.5">
          {filteredPeople.map((person) => {
            const count = propertyPeople.filter((l) => l.personId === person.id).length;
            const active = selectedPerson?.id === person.id;
            return (
              <button
                key={person.id}
                type="button"
                onClick={() => setSelectedPersonId(person.id)}
                className={`w-full text-left rounded-2xl border bg-white dark:bg-[#111827] p-4 transition-all ${
                  active
                    ? 'border-[#0F766E] ring-2 ring-[#0F766E]/15'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-display text-sm font-bold text-slate-900 dark:text-white">{person.fullName}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {person.role} · {count} Linked {count === 1 ? 'Property' : 'Properties'}
                    </p>
                  </div>
                  {person.skipTraced && (
                    <span className="text-xs font-semibold text-[#0F766E] dark:text-emerald-400">Skip Traced</span>
                  )}
                </div>
                {(person.phones[0] || person.emails[0]) && (
                  <p className="mt-2 font-mono text-xs text-slate-600 dark:text-slate-300 truncate">
                    {person.phones[0]?.number}
                    {person.phones[0] && person.emails[0] && ' · '}
                    {person.emails[0]?.address}
                  </p>
                )}
              </button>
            );
          })}
        </div>

        <div className="lg:col-span-7">
          {selectedPerson ? (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                    {selectedPerson.fullName}
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {selectedPerson.role} · Added {formatDateShort(selectedPerson.createdAt)}
                  </p>
                </div>

                <button
                  type="button"
                  disabled={isTracing}
                  onClick={async () => {
                    if (!hasProAccess) {
                      onOpenUpgradeModal();
                      return;
                    }
                    setIsTracing(true);
                    try {
                      await onSkipTracePerson(selectedPerson);
                    } finally {
                      setIsTracing(false);
                    }
                  }}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-slate-900 dark:bg-emerald-600 px-3.5 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  {!hasProAccess ? (
                    <Lock className="h-3.5 w-3.5 text-amber-300" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5 text-[#5EEAD4] dark:text-white" />
                  )}
                  {isTracing
                    ? 'Tracing...'
                    : !hasProAccess
                      ? 'Skip Trace Contact (Pro)'
                      : selectedPerson.skipTraced
                        ? 'Re-Run Skip Trace'
                        : 'Skip Trace Contact'}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5" /> Phone Numbers
                  </p>
                  {selectedPerson.phones.length === 0 ? (
                    <p className="text-xs text-slate-400">None recorded</p>
                  ) : (
                    selectedPerson.phones.map((ph, idx) => (
                      <p key={idx} className="font-mono text-xs text-slate-800 dark:text-slate-200">
                        {ph.number} ({ph.type})
                      </p>
                    ))
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" /> Email Addresses
                  </p>
                  {selectedPerson.emails.length === 0 ? (
                    <p className="text-xs text-slate-400">None recorded</p>
                  ) : (
                    selectedPerson.emails.map((em, idx) => (
                      <p key={idx} className="font-mono text-xs text-slate-800 dark:text-slate-200">
                        {em.address}
                      </p>
                    ))
                  )}
                </div>
                {selectedPerson.mailingAddress && (
                  <div className="sm:col-span-2 space-y-1">
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" /> Mailing Address
                    </p>
                    <p className="text-xs text-slate-800 dark:text-slate-200">{selectedPerson.mailingAddress}</p>
                  </div>
                )}
              </div>

              <div className="border-t border-slate-100 dark:border-slate-800 pt-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                    Associated Properties ({linkedPropertiesForSelected.length})
                  </h3>
                  {knownProperties.length > 0 && (
                    <div className="flex items-center gap-2">
                      <select
                        aria-label="Associate property with contact"
                        value={linkPropertyId}
                        onChange={(e) => setLinkPropertyId(e.target.value)}
                        className="h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-2 text-xs text-slate-900 dark:text-white"
                      >
                        <option value="">Link another property...</option>
                        {knownProperties.map((kp) => (
                          <option key={kp.id} value={kp.id}>
                            {kp.address}, {kp.state}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={!linkPropertyId}
                        onClick={() => {
                          if (linkPropertyId) {
                            onLinkProperty(linkPropertyId, selectedPerson.id, selectedPerson.role);
                            setLinkPropertyId('');
                          }
                        }}
                        className="h-8 rounded-lg bg-slate-900 dark:bg-emerald-600 px-3 text-xs font-semibold text-white disabled:opacity-40"
                      >
                        Link
                      </button>
                    </div>
                  )}
                </div>

                {linkedPropertiesForSelected.length === 0 ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    No properties connected yet. Link any searched or pipeline parcel above.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {linkedPropertiesForSelected.map(({ link, property }) => (
                      <button
                        key={link.id}
                        type="button"
                        onClick={() => onOpenPropertyDossier(property)}
                        className="w-full flex items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 p-3 text-left hover:border-[#0F766E] transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                            <Building2 className="h-4 w-4 text-[#0F766E] dark:text-emerald-400 shrink-0" />
                            {property.address}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {property.city}, {property.state} · Role: {link.relationshipType} · Case{' '}
                            {property.probateCaseNumber}
                          </p>
                        </div>
                        <span className="font-mono text-xs font-bold text-[#0F766E] dark:text-emerald-400 tabular-nums shrink-0">
                          {formatCurrency(property.avmValue)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-slate-100 dark:border-slate-800 pt-5 space-y-2">
                <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                  Unified Communication &amp; Skip Trace History ({engagementsForSelected.length})
                </h3>
                {engagementsForSelected.length === 0 ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">No logged calls, SMS, skip traces, or direct mail yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {engagementsForSelected.map((eng) => (
                      <li key={eng.id} className="rounded-lg bg-slate-50 dark:bg-[#090D16] px-3 py-2 text-xs">
                        <span className="font-semibold uppercase text-slate-700 dark:text-slate-200">{eng.channel}</span> ·{' '}
                        <span className="text-slate-500 dark:text-slate-400">{formatDateShort(eng.createdAt)}</span>
                        <p className="mt-0.5 text-slate-800 dark:text-slate-300">{eng.summary}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">Add Contact to CRM</h2>
              <button
                type="button"
                aria-label="Close Add Contact form"
                onClick={() => setShowAddForm(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitNewPerson} className="space-y-3.5">
              {formError && (
                <p className="rounded-lg bg-rose-50 dark:bg-rose-950/40 px-3 py-2 text-xs font-medium text-rose-700 dark:text-rose-300">
                  {formError}
                </p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="person-name" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Full Name *
                  </label>
                  <input
                    id="person-name"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="mt-1 w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-3 text-sm text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label htmlFor="person-role" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Role
                  </label>
                  <select
                    id="person-role"
                    value={role}
                    onChange={(e) => setRole(e.target.value as PersonRole)}
                    className="mt-1 w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-3 text-sm text-slate-900 dark:text-white"
                  >
                    {PERSON_ROLES.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="person-phone" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Phone
                  </label>
                  <input
                    id="person-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(555) 234-5678"
                    className="mt-1 w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-3 text-sm text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label htmlFor="person-email" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Email
                  </label>
                  <input
                    id="person-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1 w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-3 text-sm text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="person-mailing" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Mailing Address
                </label>
                <input
                  id="person-mailing"
                  type="text"
                  value={mailingAddress}
                  onChange={(e) => setMailingAddress(e.target.value)}
                  className="mt-1 w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-3 text-sm text-slate-900 dark:text-white"
                />
              </div>

              {knownProperties.length > 0 && (
                <div>
                  <label htmlFor="person-prop" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Cross-Link to Property (Optional)
                  </label>
                  <select
                    id="person-prop"
                    value={linkPropertyId}
                    onChange={(e) => setLinkPropertyId(e.target.value)}
                    className="mt-1 w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-3 text-sm text-slate-900 dark:text-white"
                  >
                    <option value="">None</option>
                    {knownProperties.map((kp) => (
                      <option key={kp.id} value={kp.id}>
                        {kp.address}, {kp.city}, {kp.state}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label htmlFor="person-notes" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Notes
                </label>
                <textarea
                  id="person-notes"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] p-2.5 text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="h-10 rounded-xl border border-slate-200 dark:border-slate-700 px-4 text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-10 rounded-xl bg-[#0F766E] px-5 text-xs font-semibold text-white hover:bg-[#0D625B]"
                >
                  Save Contact
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
