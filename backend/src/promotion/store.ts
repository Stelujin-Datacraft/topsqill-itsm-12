/**
 * Isolated DEV namespace store for promotion round-trip tests.
 * Never writes to live projects; only in-memory namespaces in this phase
 * (optional postgres persistence can be added later without changing the API).
 */
import { fingerprintDefinition } from './package';
import type {
  ComponentKind,
  IsolatedNamespace,
  NamespaceRecord,
} from './types';

export class PromotionNamespaceStore {
  private namespaces = new Map<string, IsolatedNamespace>();

  createNamespace(input: {
    name: string;
    organizationLogicalKey: string;
    id?: string;
  }): IsolatedNamespace {
    if (!input.name.startsWith('promotion-test-')) {
      throw new Error('Isolated DEV namespaces must be prefixed with promotion-test-');
    }
    const ns: IsolatedNamespace = {
      id: input.id || `ns_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: input.name,
      organizationLogicalKey: input.organizationLogicalKey,
      createdAt: new Date().toISOString(),
      records: new Map(),
    };
    this.namespaces.set(ns.id, ns);
    return ns;
  }

  get(id: string): IsolatedNamespace | undefined {
    return this.namespaces.get(id);
  }

  getByName(name: string): IsolatedNamespace | undefined {
    return [...this.namespaces.values()].find((n) => n.name === name);
  }

  list(): IsolatedNamespace[] {
    return [...this.namespaces.values()];
  }

  recordKey(kind: ComponentKind, key: string): string {
    return `${kind}:${key}`;
  }

  getRecord(ns: IsolatedNamespace, kind: ComponentKind, key: string): NamespaceRecord | undefined {
    return ns.records.get(this.recordKey(kind, key));
  }

  upsertRecord(
    ns: IsolatedNamespace,
    kind: ComponentKind,
    key: string,
    definition: Record<string, unknown>,
  ): NamespaceRecord {
    const row: NamespaceRecord = {
      kind,
      key,
      definition,
      fingerprint: fingerprintDefinition(definition),
      updatedAt: new Date().toISOString(),
    };
    ns.records.set(this.recordKey(kind, key), row);
    return row;
  }

  seed(ns: IsolatedNamespace, records: Array<{
    kind: ComponentKind;
    key: string;
    definition: Record<string, unknown>;
  }>): void {
    for (const r of records) {
      this.upsertRecord(ns, r.kind, r.key, r.definition);
    }
  }

  clear(nsId: string): void {
    this.namespaces.delete(nsId);
  }

  reset(): void {
    this.namespaces.clear();
  }
}
