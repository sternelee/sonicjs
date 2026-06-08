import crypto from 'crypto';

// ../../node_modules/nanoid/index.js

// ../../node_modules/nanoid/url-alphabet/index.js
var urlAlphabet = "useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict";

// ../../node_modules/nanoid/index.js
var POOL_SIZE_MULTIPLIER = 128;
var pool;
var poolOffset;
var fillPool = (bytes) => {
  if (!pool || pool.length < bytes) {
    pool = Buffer.allocUnsafe(bytes * POOL_SIZE_MULTIPLIER);
    crypto.randomFillSync(pool);
    poolOffset = 0;
  } else if (poolOffset + bytes > pool.length) {
    crypto.randomFillSync(pool);
    poolOffset = 0;
  }
  poolOffset += bytes;
};
var nanoid = (size = 21) => {
  fillPool(size |= 0);
  let id = "";
  for (let i = poolOffset - size; i < poolOffset; i++) {
    id += urlAlphabet[pool[i] & 63];
  }
  return id;
};

// src/services/document-projection.ts
var MAX_PARAMS = 90;
function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}
var DocumentProjection = class {
  constructor(db) {
    this.db = db;
  }
  // Build D1 PreparedStatement arrays for inserting facets/references for a document.
  // Returns raw D1 PreparedStatement objects suitable for inclusion in db.batch([...]).
  buildDerivedInsertStatements(doc, queryableFields, now) {
    const statements = [];
    const facets = [];
    const refs = [];
    for (const field of queryableFields) {
      const rawValue = this.extractPath(doc.data, field.path ?? `$.${field.name}`);
      if (field.kind === "facet") {
        const values = Array.isArray(rawValue) ? rawValue : rawValue != null ? [rawValue] : [];
        values.forEach((v, ordinal) => {
          const isNum = typeof v === "number";
          facets.push({
            id: nanoid(),
            tenant_id: doc.tenantId,
            document_id: doc.id,
            root_id: doc.rootId,
            type_id: doc.typeId,
            field_name: field.name,
            ordinal,
            value_text: isNum ? null : String(v),
            value_number: isNum ? v : null,
            now
          });
        });
      } else if (field.kind === "reference") {
        const roots = Array.isArray(rawValue) ? rawValue : rawValue != null ? [rawValue] : [];
        roots.forEach((rootId, ordinal) => {
          refs.push({
            id: nanoid(),
            tenant_id: doc.tenantId,
            from_root_id: doc.rootId,
            from_document_id: doc.id,
            field_name: field.name,
            ordinal,
            to_root_id: String(rootId),
            ref_strength: field.refStrength ?? "weak",
            now
          });
        });
      }
    }
    const FACET_COLS = 10;
    for (const chunk of chunkArray(facets, Math.floor(MAX_PARAMS / FACET_COLS))) {
      const placeholders = chunk.map(() => "(?,?,?,?,?,?,?,?,?,?)").join(",");
      const params = [];
      for (const f of chunk) {
        params.push(f.id, f.tenant_id, f.document_id, f.root_id, f.type_id, f.field_name, f.ordinal, f.value_text, f.value_number, f.now);
      }
      statements.push(
        this.db.prepare(
          `INSERT INTO document_facets (id, tenant_id, document_id, root_id, type_id, field_name, ordinal, value_text, value_number, created_at) VALUES ${placeholders}`
        ).bind(...params)
      );
    }
    const REF_COLS = 9;
    for (const chunk of chunkArray(refs, Math.floor(MAX_PARAMS / REF_COLS))) {
      const placeholders = chunk.map(() => "(?,?,?,?,?,?,?,?,?)").join(",");
      const params = [];
      for (const r of chunk) {
        params.push(r.id, r.tenant_id, r.from_root_id, r.from_document_id, r.field_name, r.ordinal, r.to_root_id, r.ref_strength, r.now);
      }
      statements.push(
        this.db.prepare(
          `INSERT INTO document_references (id, tenant_id, from_root_id, from_document_id, field_name, ordinal, to_root_id, ref_strength, created_at) VALUES ${placeholders}`
        ).bind(...params)
      );
    }
    return statements;
  }
  buildDerivedDeleteStatements(documentId) {
    return [
      this.db.prepare("DELETE FROM document_facets WHERE document_id = ?").bind(documentId),
      this.db.prepare("DELETE FROM document_references WHERE from_document_id = ?").bind(documentId)
    ];
  }
  // Rebuild derived rows for all current-draft and published rows of a type.
  // One bounded admin action; not chunked cron orchestration.
  async reindexType(typeId, tenantId, queryableFields) {
    const result = await this.db.prepare(
      `SELECT * FROM documents
         WHERE type_id = ? AND tenant_id = ? AND (is_current_draft = 1 OR is_published = 1) AND deleted_at IS NULL`
    ).bind(typeId, tenantId).all();
    const rows = result.results ?? [];
    if (rows.length === 0) return 0;
    const now = Math.floor(Date.now() / 1e3);
    let rebuilt = 0;
    for (const chunk of chunkArray(rows, 20)) {
      const statements = [];
      for (const row of chunk) {
        const doc = rowToDocument(row);
        statements.push(...this.buildDerivedDeleteStatements(doc.id));
        statements.push(...this.buildDerivedInsertStatements(doc, queryableFields, now));
      }
      if (statements.length > 0) {
        await this.db.batch(statements);
        rebuilt += chunk.length;
      }
    }
    return rebuilt;
  }
  extractPath(data, path) {
    if (path.startsWith("$.")) {
      const key = path.slice(2);
      return data[key] ?? null;
    }
    return null;
  }
};
function rowToDocument(row) {
  return {
    id: row.id,
    rootId: row.root_id,
    typeId: row.type_id,
    typeVersion: row.type_version,
    versionOfId: row.version_of_id,
    versionNumber: row.version_number,
    isCurrentDraft: row.is_current_draft === 1,
    isPublished: row.is_published === 1,
    status: row.status,
    parentRootId: row.parent_root_id,
    slug: row.slug,
    path: row.path,
    title: row.title,
    zone: row.zone,
    sortOrder: row.sort_order,
    visible: row.visible === 1,
    publishedAt: row.published_at,
    scheduledAt: row.scheduled_at,
    expiresAt: row.expires_at,
    deletedAt: row.deleted_at,
    tenantId: row.tenant_id,
    locale: row.locale,
    translationGroupId: row.translation_group_id,
    data: JSON.parse(row.data),
    metadata: JSON.parse(row.metadata),
    ownerId: row.owner_id,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export { DocumentProjection, nanoid };
//# sourceMappingURL=chunk-VAECCHDA.js.map
//# sourceMappingURL=chunk-VAECCHDA.js.map