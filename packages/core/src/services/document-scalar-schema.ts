import { D1Database } from '@cloudflare/workers-types'
import type { QueryableField } from '../schemas/document'

// Identifiers and JSON paths are interpolated into DDL (they cannot be bound), so
// they are format-guarded here. Source is trusted code config, not user input —
// this is defense-in-depth, mirroring document-repository.ts.
const SAFE_IDENTIFIER = /^[a-z_][a-z0-9_]*$/

/** Map a queryable field's logical type to a SQLite column affinity. */
function affinity(type?: QueryableField['type']): 'TEXT' | 'INTEGER' | 'REAL' {
  if (type === 'number') return 'REAL'
  if (type === 'integer' || type === 'boolean' || type === 'date') return 'INTEGER'
  return 'TEXT'
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')

/**
 * Authoritative generated-column name for a scalar field. An explicit `column`
 * always wins (back-compat with every existing type definition); otherwise it is
 * derived deterministically from the type id + field name. The repository reads
 * the same `column`/derivation when building filter SQL, so the two never drift.
 */
export function resolveColumn(typeId: string, f: QueryableField): string {
  if (f.column) return f.column
  const name = `q_${slug(typeId)}_${slug(f.name)}`
  return name.length <= 60 ? name : `q_${slug(typeId).slice(0, 20)}_${slug(f.name).slice(0, 20)}`
}

/**
 * Idempotently ensure the `documents` table has a VIRTUAL generated column and a
 * filter/sort index for each of a type's scalar queryable fields. Safe to call on
 * every registration and every bootstrap: existing columns/indexes are skipped,
 * and a concurrent add surfaces as a swallowed "duplicate column name".
 *
 * Facet and reference fields need no DDL (generic document_facets /
 * document_references tables), so they are ignored here.
 *
 * Returns the columns it actually created (empty when all already existed).
 */
export async function ensureScalarSchema(
  db: D1Database,
  typeId: string,
  fields: QueryableField[],
): Promise<string[]> {
  const scalars = fields.filter((f) => f.kind === 'scalar')
  if (scalars.length === 0) return []

  // pragma_table_info does NOT list VIRTUAL generated columns — use table_xinfo, which does.
  let existing = new Set<string>()
  try {
    const info = await db.prepare("SELECT name FROM pragma_table_xinfo('documents')").all()
    existing = new Set((info?.results ?? []).map((r: any) => r.name))
  } catch {
    // table_xinfo unavailable — fall back to attempting every ALTER (duplicate errors swallowed).
  }

  const added: string[] = []
  for (const f of scalars) {
    const col = resolveColumn(typeId, f)
    if (!SAFE_IDENTIFIER.test(col)) {
      console.error(`[scalar-schema] unsafe column name '${col}' for ${typeId}.${f.name} — skipped`)
      continue
    }
    const path = f.path ?? `$.${f.name}`
    if (path.includes("'")) {
      console.error(`[scalar-schema] unsafe json path for ${col} (${typeId}.${f.name}) — skipped`)
      continue
    }

    if (!existing.has(col)) {
      try {
        await db
          .prepare(`ALTER TABLE documents ADD COLUMN ${col} ${affinity(f.type)} AS (json_extract(data, '${path}')) VIRTUAL`)
          .run()
        added.push(col)
        console.log(`[scalar-schema] added documents.${col} for type '${typeId}'`)
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        if (!msg.includes('duplicate column name')) {
          console.error(`[scalar-schema] failed to add documents.${col}:`, msg)
          continue
        }
      }
    }

    // One general index per column: the leading (tenant_id, type_id, col) prefix
    // serves every equality filter the repository builds; the trailing
    // (updated_at DESC, id DESC) matches the default keyset sort/cursor. Non-partial
    // so a single index covers both draft and published lists.
    try {
      await db
        .prepare(`CREATE INDEX IF NOT EXISTS idx_${col} ON documents(tenant_id, type_id, ${col}, updated_at DESC, id DESC)`)
        .run()
    } catch (error) {
      console.error(`[scalar-schema] failed to create idx_${col}:`, error instanceof Error ? error.message : String(error))
    }
  }
  return added
}
