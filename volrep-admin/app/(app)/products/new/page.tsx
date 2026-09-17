"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useMutation } from "@/lib/hooks";
import { can } from "@/lib/rbac";
import type { ProductDetail } from "@/lib/types";
import { Button, Card, CardHeader, EmptyState, Field, InlineError, PageHeader, Select, TextInput, Textarea } from "@/components/ui";
import { t } from "@/lib/i18n";

// Owner-only (the backend enforces it; this is the matching UI gate).
export default function NewProductPage() {
  const router = useRouter();
  const { state } = useAuth();
  const role = state.status === "authenticated" ? state.admin.role : undefined;
  const allowed = can(role, "product.create");

  const [form, setForm] = useState({
    handle: "",
    title: "",
    description: "",
    productType: "",
    tags: "",
    status: "draft" as "draft" | "active" | "archived",
  });

  // The handle is derived from the title during render until the admin
  // edits it directly — no effect, no cascading render.
  const [handleTouched, setHandleTouched] = useState(false);
  const handle = handleTouched ? form.handle : slugify(form.title);

  const create = useMutation(() =>
    api.post<{ product: ProductDetail }>("/api/admin/products", {
      handle: handle.trim(),
      title: form.title.trim(),
      description: form.description,
      productType: form.productType.trim(),
      tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
      status: form.status,
    }),
  );

  if (!allowed) {
    return (
      <div>
        <PageHeader title={t.products.new.title} />
        <EmptyState title={t.products.new.ownerRequiredTitle} hint={t.products.new.ownerRequiredHint} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={t.products.new.title}
        action={
          <Link href="/products" className="text-sm text-slate-500 hover:underline">
            {t.products.new.backToList}
          </Link>
        }
      />
      <Card className="max-w-2xl">
        <CardHeader title={t.products.new.details} />
        <form
          className="space-y-4 px-4 py-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const res = await create.run();
            if (res) router.push(`/products/${res.product.id}`);
          }}
        >
          <Field label={t.products.new.titleField}>
            <TextInput required value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          </Field>
          <Field label={t.products.new.handle} hint={t.products.new.handleHint}>
            <TextInput
              required
              value={handle}
              onChange={(e) => {
                setHandleTouched(true);
                setForm((f) => ({ ...f, handle: e.target.value }));
              }}
            />
          </Field>
          <Field label={t.products.new.description}>
            <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t.products.new.productType}>
              <TextInput value={form.productType} onChange={(e) => setForm((f) => ({ ...f, productType: e.target.value }))} />
            </Field>
            <Field label={t.products.new.status}>
              <Select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as typeof form.status }))}>
                <option value="draft">{t.products.statusOptions.draft}</option>
                <option value="active">{t.products.statusOptions.active}</option>
                <option value="archived">{t.products.statusOptions.archived}</option>
              </Select>
            </Field>
          </div>
          <Field label={t.products.new.tags} hint={t.common.commaSeparated}>
            <TextInput value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} placeholder={t.products.new.tagsPlaceholder} />
          </Field>
          <InlineError message={create.error} />
          <Button type="submit" variant="primary" loading={create.pending}>
            {t.products.new.create}
          </Button>
        </form>
      </Card>
    </div>
  );
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
