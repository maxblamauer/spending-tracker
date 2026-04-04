import { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, getDocs, deleteDoc, doc, orderBy, query, addDoc, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import { useDropzone } from 'react-dropzone';
import { parseStatement, extractText } from '../lib/parser';
import { extractMerchantPattern } from '../lib/categorize';
import { FilterSelect } from './ui/FilterSelect';
import { Modal, ModalBodyPanel } from './ui/Modal';
import type { CardProfile } from '../types';
import { CATEGORIES } from '../types';

interface Mapping {
  id: string;
  merchantPattern: string;
  category: string;
}

interface Props {
  householdId: string;
}

interface GenerateResult {
  profile: {
    bankName: string;
    cardholders: string[];
    cardholderPatterns: string[];
    hasSections: boolean;
    useTwoDateFormat: boolean;
    creditIndicator: string;
  };
  mappings: Array<{ merchantPattern: string; category: string }>;
}

type AddCardStep = 'idle' | 'label' | 'upload' | 'processing' | 'done';

export function MappingsManager({ householdId }: Props) {
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [cardProfiles, setCardProfiles] = useState<(CardProfile & { id: string })[]>([]);
  const [addCardStep, setAddCardStep] = useState<AddCardStep>('idle');
  const [newCardLabel, setNewCardLabel] = useState('');
  const [addCardError, setAddCardError] = useState('');
  const [addCardResult, setAddCardResult] = useState('');

  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [editCardLabel, setEditCardLabel] = useState('');
  const [editBankName, setEditBankName] = useState('');
  const [editCardholders, setEditCardholders] = useState('');
  const [editCardError, setEditCardError] = useState('');

  const [editingMappingId, setEditingMappingId] = useState<string | null>(null);
  const [editMappingPattern, setEditMappingPattern] = useState('');
  const [editMappingCategory, setEditMappingCategory] = useState('');
  const [editMappingError, setEditMappingError] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<
    { kind: 'card'; id: string } | { kind: 'mapping'; id: string } | null
  >(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const categorySelectOptions = useMemo((): { value: string; label: string }[] => {
    const seen = new Set<string>([...CATEGORIES]);
    const out: { value: string; label: string }[] = CATEGORIES.map((c) => ({ value: c, label: c }));
    for (const m of mappings) {
      if (!seen.has(m.category)) {
        seen.add(m.category);
        out.push({ value: m.category, label: m.category });
      }
    }
    return out.sort((a, b) => a.label.localeCompare(b.label));
  }, [mappings]);

  const normalizeMappingPattern = (raw: string) => raw.trim().toLowerCase();

  const fetchMappings = useCallback(async () => {
    const q = query(collection(db, 'households', householdId, 'categoryMappings'), orderBy('merchantPattern'));
    const snap = await getDocs(q);
    setMappings(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Mapping)));
  }, [householdId]);

  const fetchCardProfiles = useCallback(async () => {
    const snap = await getDocs(collection(db, 'households', householdId, 'cardProfiles'));
    setCardProfiles(snap.docs.map((d) => ({ id: d.id, ...d.data() } as CardProfile & { id: string })));
  }, [householdId]);

  useEffect(() => {
    fetchMappings();
    fetchCardProfiles();
  }, [fetchMappings, fetchCardProfiles]);

  const deleteMappingDoc = async (id: string) => {
    await deleteDoc(doc(db, 'households', householdId, 'categoryMappings', id));
    fetchMappings();
  };

  const mappingPatternTaken = (normalized: string, exceptId?: string) =>
    mappings.some(
      (m) => normalizeMappingPattern(m.merchantPattern) === normalized && m.id !== exceptId
    );

  const startEditMapping = (m: Mapping) => {
    setEditingMappingId(m.id);
    setEditMappingPattern(m.merchantPattern);
    setEditMappingCategory(m.category);
    setEditMappingError('');
  };

  const cancelEditMapping = () => {
    setEditingMappingId(null);
    setEditMappingError('');
  };

  const saveEditMapping = async () => {
    if (!editingMappingId) return;
    const normalized = normalizeMappingPattern(editMappingPattern);
    if (!normalized) {
      setEditMappingError('Pattern cannot be empty.');
      return;
    }
    if (mappingPatternTaken(normalized, editingMappingId)) {
      setEditMappingError('Another mapping already uses this pattern.');
      return;
    }
    if (!categorySelectOptions.some((o) => o.value === editMappingCategory)) {
      setEditMappingError('Pick a valid category.');
      return;
    }
    setEditMappingError('');
    try {
      await updateDoc(doc(db, 'households', householdId, 'categoryMappings', editingMappingId), {
        merchantPattern: normalized,
        category: editMappingCategory,
      });
      setEditingMappingId(null);
      fetchMappings();
    } catch (err) {
      console.error('Save mapping error:', err);
      setEditMappingError(err instanceof Error ? err.message : 'Could not save.');
    }
  };

  const deleteCardDoc = async (id: string) => {
    await deleteDoc(doc(db, 'households', householdId, 'cardProfiles', id));
    fetchCardProfiles();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    try {
      if (deleteTarget.kind === 'card') {
        await deleteCardDoc(deleteTarget.id);
      } else {
        await deleteMappingDoc(deleteTarget.id);
      }
      setDeleteTarget(null);
    } catch (err) {
      console.error('Delete error:', err);
    } finally {
      setDeleteBusy(false);
    }
  };

  const deleteDetailLine = useMemo(() => {
    if (!deleteTarget) return '';
    if (deleteTarget.kind === 'card') {
      const p = cardProfiles.find((c) => c.id === deleteTarget.id);
      return p
        ? `The card “${p.cardLabel}” (${p.bankName}) will be removed.`
        : 'This card will be removed.';
    }
    const m = mappings.find((x) => x.id === deleteTarget.id);
    return m
      ? `The mapping “${m.merchantPattern}” → ${m.category} will be removed.`
      : 'This mapping will be removed.';
  }, [deleteTarget, cardProfiles, mappings]);

  const onDrop = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    setAddCardError('');
    setAddCardStep('processing');

    try {
      const buffer = await files[0].arrayBuffer();
      const pdfText = await extractText(new Uint8Array(buffer.slice(0)));
      const parsed = await parseStatement(new Uint8Array(buffer.slice(0)), []);

      const merchantMap = new Map<string, string>();
      for (const txn of parsed.transactions) {
        if (txn.isCredit) continue;
        const pattern = extractMerchantPattern(txn.description);
        if (pattern && !merchantMap.has(pattern)) {
          merchantMap.set(pattern, txn.description);
        }
      }

      if (merchantMap.size === 0) {
        setAddCardError('No merchant transactions found. Try a different file.');
        setAddCardStep('upload');
        return;
      }

      const descriptions = Array.from(merchantMap.values());
      const generateMappings = httpsCallable<
        { descriptions: string[]; pdfText: string },
        GenerateResult
      >(functions, 'generateMappings');

      const result = await generateMappings({ descriptions, pdfText });

      // Save card profile
      const profile: Omit<CardProfile, 'id'> = {
        cardLabel: newCardLabel.trim(),
        bankName: result.data.profile.bankName || 'Unknown',
        cardholders: result.data.profile.cardholders || [],
        cardholderPatterns: result.data.profile.cardholderPatterns || [],
        hasSections: result.data.profile.hasSections ?? false,
        useTwoDateFormat: result.data.profile.useTwoDateFormat ?? true,
        creditIndicator: result.data.profile.creditIndicator || 'CR',
      };
      await addDoc(collection(db, 'households', householdId, 'cardProfiles'), profile);

      // Build Claude category lookup
      const claudeCategories = new Map<string, string>();
      for (const m of result.data.mappings) {
        const key = m.merchantPattern?.toLowerCase().trim();
        if (key && m.category) claudeCategories.set(key, m.category);
      }

      // Save new mappings using our extractMerchantPattern (skip duplicates)
      const existingPatterns = new Set(mappings.map((m) => m.merchantPattern));
      const mappingsCol = collection(db, 'households', householdId, 'categoryMappings');
      let count = 0;

      for (const [pattern, desc] of merchantMap) {
        if (existingPatterns.has(pattern)) continue;
        existingPatterns.add(pattern);

        let category = 'Other';
        const descLower = desc.toLowerCase();
        const patternWords = pattern.split(/\s+/);

        for (const [claudePattern, claudeCategory] of claudeCategories) {
          if (
            descLower.includes(claudePattern) ||
            claudePattern.includes(pattern) ||
            patternWords.some((w) => w.length > 2 && claudePattern.includes(w)) ||
            claudePattern.split(/\s+/).some((w: string) => w.length > 2 && descLower.includes(w))
          ) {
            category = claudeCategory;
            break;
          }
        }

        // Don't save "Other" mappings — let the built-in keyword engine handle those
        if (category === 'Other') continue;

        await addDoc(mappingsCol, { merchantPattern: pattern, category });
        count++;
      }

      setAddCardResult(`${profile.bankName} card added with ${count} new mappings.`);
      setAddCardStep('done');
      fetchCardProfiles();
      fetchMappings();
    } catch (err) {
      console.error('Add card error:', err);
      setAddCardError(err instanceof Error ? err.message : 'Something went wrong.');
      setAddCardStep('upload');
    }
  }, [householdId, newCardLabel, mappings, fetchCardProfiles, fetchMappings]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    disabled: addCardStep !== 'upload',
  });

  const startAddCard = () => {
    setEditingCardId(null);
    setEditCardError('');
    setNewCardLabel('');
    setAddCardError('');
    setAddCardResult('');
    setAddCardStep('label');
  };

  const startEditCard = (p: CardProfile & { id: string }) => {
    setAddCardStep('idle');
    setAddCardError('');
    setAddCardResult('');
    setEditingCardId(p.id);
    setEditCardLabel(p.cardLabel);
    setEditBankName(p.bankName);
    setEditCardholders(p.cardholders.join(', '));
    setEditCardError('');
  };

  const cancelEditCard = () => {
    setEditingCardId(null);
    setEditCardError('');
  };

  const cancelAddCard = () => {
    setAddCardStep('idle');
    setNewCardLabel('');
    setAddCardError('');
    setAddCardResult('');
  };

  const closeAddCardModal = () => {
    if (addCardStep === 'processing') return;
    cancelAddCard();
  };

  const saveEditCard = async () => {
    if (!editingCardId) return;
    const label = editCardLabel.trim();
    if (!label) {
      setEditCardError('Give your card a name');
      return;
    }
    setEditCardError('');
    const holders = editCardholders
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    try {
      await updateDoc(doc(db, 'households', householdId, 'cardProfiles', editingCardId), {
        cardLabel: label,
        bankName: editBankName.trim() || 'Unknown',
        cardholders: holders,
      });
      setEditingCardId(null);
      fetchCardProfiles();
    } catch (err) {
      console.error('Save card error:', err);
      setEditCardError(err instanceof Error ? err.message : 'Could not save.');
    }
  };

  return (
    <div className="mappings-page">
      {/* Card Profiles Section */}
      <h2>Cards</h2>
      <p className="hint">
        Card profiles tell the parser how to read each credit card's statement format.
      </p>

      {cardProfiles.length > 0 ? (
        <div className="table-wrapper">
          <table className="transactions-table mappings-cards-table">
            <thead>
              <tr>
                <th>Card</th>
                <th>Bank</th>
                <th>Cardholders</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {cardProfiles.map((p) => (
                <tr key={p.id}>
                  <td className="mapping-cell-primary">
                    <strong>{p.cardLabel}</strong>
                  </td>
                  <td className="mapping-cell-meta">{p.bankName}</td>
                  <td className="mapping-cell-meta2">{p.cardholders.join(', ') || '—'}</td>
                  <td className="mapping-cell-actions">
                    <button type="button" className="btn btn-xs" onClick={() => startEditCard(p)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn btn-xs btn-destructive"
                      onClick={() => setDeleteTarget({ kind: 'card', id: p.id })}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : addCardStep === 'idle' ? (
        <p className="empty-state">
          No cards set up yet. Add a card to enable smart statement parsing.
        </p>
      ) : null}

      {addCardStep === 'idle' && (
        <button type="button" className="btn btn-save add-card-btn" onClick={startAddCard}>
          + Add Card
        </button>
      )}

      <Modal
        open={addCardStep !== 'idle'}
        onClose={closeAddCardModal}
        title={
          addCardStep === 'label'
            ? 'Add card'
            : addCardStep === 'upload'
              ? 'Upload statement'
              : addCardStep === 'processing'
                ? 'Adding card…'
                : 'Card added'
        }
        description={
          addCardStep === 'label'
            ? 'Name this card, then upload a sample statement so we can learn its format.'
            : addCardStep === 'upload'
              ? `PDF for “${newCardLabel}”.`
              : addCardStep === 'processing'
                ? 'Analyzing statement format and merchants…'
                : undefined
        }
        panelClassName="modal-panel--add-card"
        closeOnBackdropClick={addCardStep !== 'processing'}
        showCloseButton={addCardStep !== 'processing'}
      >
        {addCardStep === 'label' && (
          <>
            <ModalBodyPanel>
              <div className="edit-card-panel-fields">
                <label className="edit-card-field">
                  <span className="edit-card-field-label">Card name</span>
                  <input
                    type="text"
                    className="household-input"
                    placeholder="e.g. TD Visa"
                    value={newCardLabel}
                    onChange={(e) => setNewCardLabel(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newCardLabel.trim()) {
                        setAddCardError('');
                        setAddCardStep('upload');
                      }
                    }}
                  />
                </label>
              </div>
            </ModalBodyPanel>
            <div className="edit-card-panel-actions">
              <button type="button" className="btn" onClick={cancelAddCard}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-save"
                onClick={() => {
                  if (!newCardLabel.trim()) {
                    setAddCardError('Give your card a name');
                    return;
                  }
                  setAddCardError('');
                  setAddCardStep('upload');
                }}
              >
                Next
              </button>
            </div>
            {addCardError && <p className="login-error household-inline-error edit-card-panel-error">{addCardError}</p>}
          </>
        )}
        {addCardStep === 'upload' && (
          <>
            <ModalBodyPanel>
              <div
                {...getRootProps()}
                className={`dropzone add-card-dropzone ${isDragActive ? 'active' : ''}`}
              >
                <input {...getInputProps()} />
                <div className="dropzone-content">
                  <p>{isDragActive ? 'Drop here...' : 'Drag & drop a statement PDF'}</p>
                </div>
              </div>
            </ModalBodyPanel>
            <div className="edit-card-panel-actions">
              <button type="button" className="btn" onClick={cancelAddCard}>
                Cancel
              </button>
            </div>
            {addCardError && <p className="login-error household-inline-error edit-card-panel-error">{addCardError}</p>}
          </>
        )}
        {addCardStep === 'processing' && (
          <ModalBodyPanel>
            <div className="onboarding-processing">
              <div className="upload-spinner" />
              <p>This may take a moment.</p>
            </div>
          </ModalBodyPanel>
        )}
        {addCardStep === 'done' && (
          <>
            <ModalBodyPanel>
              <p className="add-card-success modal-add-card-done-msg">{addCardResult}</p>
            </ModalBodyPanel>
            <div className="edit-card-panel-actions">
              <button type="button" className="btn btn-save" onClick={cancelAddCard}>
                Done
              </button>
            </div>
          </>
        )}
      </Modal>

      {/* Mappings Section */}
      <h2 className="mappings-page-section-title">Category Mappings</h2>
      <p className="hint">
        These are merchant-to-category rules. When you confirm or edit
        a transaction's category, the merchant pattern is saved here. Future uploads will
        auto-match these patterns. Matching is case-insensitive and uses substring search on descriptions.
      </p>

      {mappings.length === 0 ? (
        <p className="empty-state">
          No custom mappings yet. Confirm or edit transaction categories from the Transactions tab to build rules here.
        </p>
      ) : (
        <div className="table-wrapper">
          <table className="transactions-table mappings-rules-table">
            <thead>
              <tr>
                <th>Merchant Pattern</th>
                <th>Category</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {mappings.map((m) => (
                <tr key={m.id}>
                  <td className="mapping-pattern-cell">
                    <code className="mapping-pattern-badge">{m.merchantPattern}</code>
                  </td>
                  <td className="mapping-category-cell">
                    <span
                      className={`category-badge cat-${m.category.toLowerCase().replace(/[^a-z]/g, '-')}`}
                    >
                      {m.category}
                    </span>
                  </td>
                  <td className="mapping-cell-actions">
                    <button type="button" className="btn btn-xs" onClick={() => startEditMapping(m)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn btn-xs btn-destructive"
                      onClick={() => setDeleteTarget({ kind: 'mapping', id: m.id })}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={editingCardId !== null}
        onClose={cancelEditCard}
        title="Editing this card"
        description="Display names only — statement parser rules stay as when you added the card."
      >
        <ModalBodyPanel>
          <div className="edit-card-panel-fields">
            <label className="edit-card-field">
              <span className="edit-card-field-label">Card</span>
              <input
                type="text"
                className="household-input"
                value={editCardLabel}
                onChange={(e) => setEditCardLabel(e.target.value)}
              />
            </label>
            <label className="edit-card-field">
              <span className="edit-card-field-label">Bank</span>
              <input
                type="text"
                className="household-input"
                value={editBankName}
                onChange={(e) => setEditBankName(e.target.value)}
              />
            </label>
            <label className="edit-card-field">
              <span className="edit-card-field-label">Cardholders</span>
              <input
                type="text"
                className="household-input"
                placeholder="Comma-separated names"
                value={editCardholders}
                onChange={(e) => setEditCardholders(e.target.value)}
              />
            </label>
          </div>
        </ModalBodyPanel>
        <div className="edit-card-panel-actions">
          <button type="button" className="btn" onClick={cancelEditCard}>
            Cancel
          </button>
          <button type="button" className="btn btn-save" onClick={() => void saveEditCard()}>
            Save changes
          </button>
        </div>
        {editCardError && (
          <p className="login-error household-inline-error edit-card-panel-error">{editCardError}</p>
        )}
      </Modal>

      <Modal
        open={deleteTarget !== null}
        onClose={() => !deleteBusy && setDeleteTarget(null)}
        title="Are you sure?"
        description="This action cannot be undone."
        closeOnBackdropClick={!deleteBusy}
        showCloseButton={!deleteBusy}
      >
        <ModalBodyPanel>
          <p className="modal-confirm-detail">{deleteDetailLine}</p>
        </ModalBodyPanel>
        <div className="edit-card-panel-actions">
          <button type="button" className="btn" disabled={deleteBusy} onClick={() => setDeleteTarget(null)}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-destructive"
            disabled={deleteBusy}
            onClick={() => void confirmDelete()}
          >
            {deleteBusy ? 'Removing…' : 'Remove'}
          </button>
        </div>
      </Modal>

      <Modal
        open={editingMappingId !== null}
        onClose={cancelEditMapping}
        title="Edit mapping"
        description="Pattern is saved lowercase; descriptions match if they include this text."
      >
        <ModalBodyPanel>
          <div className="edit-card-panel-fields">
            <label className="edit-card-field">
              <span className="edit-card-field-label">Merchant pattern</span>
              <input
                type="text"
                className="household-input"
                value={editMappingPattern}
                onChange={(e) => setEditMappingPattern(e.target.value)}
              />
            </label>
            <label className="edit-card-field">
              <span className="edit-card-field-label">Category</span>
              <FilterSelect
                className="filter-pill mapping-category-select"
                value={editMappingCategory}
                onChange={setEditMappingCategory}
                options={categorySelectOptions}
              />
            </label>
          </div>
        </ModalBodyPanel>
        <div className="edit-card-panel-actions">
          <button type="button" className="btn" onClick={cancelEditMapping}>
            Cancel
          </button>
          <button type="button" className="btn btn-save" onClick={() => void saveEditMapping()}>
            Save changes
          </button>
        </div>
        {editMappingError && (
          <p className="login-error household-inline-error edit-card-panel-error">{editMappingError}</p>
        )}
      </Modal>
    </div>
  );
}
