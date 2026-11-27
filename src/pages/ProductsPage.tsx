import React, { useState } from 'react';
import { Edit3, Package, Plus } from 'lucide-react';
import {
  Button,
  Card,
  ErrorAlert,
  Field,
  Modal,
  PageHeader,
  StatusIndicator,
  SuccessBanner,
  inputCls,
} from '../components/ui';
import { formatCents } from '../lib/format';
import { useCrm } from '../store/crmStore';
import { canManageProducts } from '../store/policy';
import type { Product } from '../types/crm';

export const ProductsPage: React.FC = () => {
  const { state, currentUser, createProduct, updateProduct } = useCrm();
  const canEditProducts = canManageProducts(currentUser);
  const currency = state.settings.currency || 'USD';

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [unit, setUnit] = useState('Annual License');
  const [priceDollars, setPriceDollars] = useState('10000');
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const openCreate = () => {
    setEditing(null);
    setSku('');
    setName('');
    setDesc('');
    setUnit('Annual License');
    setPriceDollars('10000');
    setError('');
    setModalOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setSku(p.sku);
    setName(p.name);
    setDesc(p.description);
    setUnit(p.unit);
    setPriceDollars(String(p.unit_price_cents / 100));
    setError('');
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const cents = Math.round(Number(priceDollars || 0) * 100);
    if (editing) {
      const res = updateProduct(editing.id, {
        name,
        description: desc,
        unit,
        unit_price_cents: cents,
      });
      if (!res.ok) {
        setError(res.error || 'Could not update product.');
        return;
      }
      setToast(`Updated ${editing.sku}. Existing quotes, orders, and invoices remain locked at their historical snapshot prices.`);
    } else {
      const res = createProduct({ sku, name, description: desc, unit, unit_price_cents: cents });
      if (!res.ok) {
        setError(res.error || 'Could not create product.');
        return;
      }
      setToast(`Created product ${res.data?.sku}.`);
    }
    setModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Product Catalog"
        subtitle="Price updates apply to new quotes only; historical quote, order, and invoice snapshots never change."
        actions={
          canEditProducts ? (
            <Button size="sm" onClick={openCreate}>
              <Plus className="w-3.5 h-3.5" />
              New Product
            </Button>
          ) : undefined
        }
      />

      {toast && <SuccessBanner message={toast} onClose={() => setToast('')} />}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#DBEAFE] bg-[#F4F8FF] text-xs font-semibold text-[#0F295C]">
                <th className="py-3 px-4">SKU</th>
                <th className="py-3 px-4">Product</th>
                <th className="py-3 px-4">Unit</th>
                <th className="py-3 px-4 text-right">Unit Price</th>
                <th className="py-3 px-4">Status</th>
                {canEditProducts && <th className="py-3 px-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFF6FF] text-sm">
              {state.products.map((p) => (
                <tr key={p.id} className="hover:bg-[#F4F8FF]">
                  <td className="py-3 px-4 font-mono text-xs font-semibold text-[#1D4ED8]">{p.sku}</td>
                  <td className="py-3 px-4">
                    <div className="font-semibold text-[#0A1936] flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5 text-[#1D4ED8]" />
                      {p.name}
                    </div>
                    <div className="text-xs text-[#3B5998]">{p.description}</div>
                  </td>
                  <td className="py-3 px-4 text-[#0F295C]">{p.unit}</td>
                  <td className="py-3 px-4 text-right tabular-nums font-semibold text-[#0A1936]">
                    {formatCents(p.unit_price_cents, currency)}
                  </td>
                  <td className="py-3 px-4">
                    <StatusIndicator status={p.is_active ? 'Active' : 'Inactive'} />
                  </td>
                  {canEditProducts && (
                    <td className="py-3 px-4 text-right space-x-2">
                      <Button size="sm" variant="outline" onClick={() => openEdit(p)}>
                        <Edit3 className="w-3.5 h-3.5" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => updateProduct(p.id, { is_active: !p.is_active })}
                      >
                        {p.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? `Edit ${editing.sku}` : 'New Product'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <ErrorAlert message={error} />}
          {!editing && (
            <Field label="SKU" required>
              <input type="text" value={sku} onChange={(e) => setSku(e.target.value)} className={inputCls} placeholder="DEX-..." required />
            </Field>
          )}
          <Field label="Product Name" required>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} required />
          </Field>
          <Field label="Description">
            <textarea rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} className={inputCls} />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Unit" required>
              <input type="text" value={unit} onChange={(e) => setUnit(e.target.value)} className={inputCls} required />
            </Field>
            <Field label={`Unit Price (${currency})`} required>
              <input type="number" min={0} step="0.01" value={priceDollars} onChange={(e) => setPriceDollars(e.target.value)} className={inputCls} required />
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">{editing ? 'Save Product' : 'Create Product'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
