'use strict';

var chunkUYJ6TJHX_cjs = require('./chunk-UYJ6TJHX.cjs');
var chunkMNWKYY5E_cjs = require('./chunk-MNWKYY5E.cjs');

// src/templates/pages/admin-documents-form.template.ts
chunkUYJ6TJHX_cjs.init_admin_layout_catalyst_template();

// src/templates/components/alert.template.ts
function renderAlert(data) {
  const typeClasses = {
    success: "bg-green-50 dark:bg-green-500/10 border border-green-600/20 dark:border-green-500/20",
    error: "bg-error/10 border border-red-600/20 dark:border-red-500/20",
    warning: "bg-amber-50 dark:bg-amber-500/10 border border-amber-600/20 dark:border-amber-500/20",
    info: "bg-blue-50 dark:bg-blue-500/10 border border-blue-600/20 dark:border-blue-500/20"
  };
  const iconClasses = {
    success: "text-green-600 dark:text-green-400",
    error: "text-red-600 dark:text-red-400",
    warning: "text-amber-600 dark:text-amber-400",
    info: "text-blue-600 dark:text-blue-400"
  };
  const textClasses = {
    success: "text-green-900 dark:text-green-300",
    error: "text-red-900 dark:text-red-300",
    warning: "text-amber-900 dark:text-amber-300",
    info: "text-blue-900 dark:text-blue-300"
  };
  const messageTextClasses = {
    success: "text-green-700 dark:text-green-400",
    error: "text-red-700 dark:text-red-400",
    warning: "text-amber-700 dark:text-amber-400",
    info: "text-blue-700 dark:text-blue-400"
  };
  const icons = {
    success: `<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />`,
    error: `<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />`,
    warning: `<path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />`,
    info: `<path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />`
  };
  return `
    <div class="rounded-lg p-4 ${typeClasses[data.type]} ${data.className || ""}" ${data.dismissible ? 'id="dismissible-alert"' : ""}>
      <div class="flex">
        ${data.icon !== false ? `
          <div class="flex-shrink-0">
            <svg class="h-5 w-5 ${iconClasses[data.type]}" viewBox="0 0 20 20" fill="currentColor">
              ${icons[data.type]}
            </svg>
          </div>
        ` : ""}
        <div class="${data.icon !== false ? "ml-3" : ""}">
          ${data.title ? `
            <h3 class="text-sm font-semibold ${textClasses[data.type]}">
              ${chunkMNWKYY5E_cjs.escapeHtml(data.title)}
            </h3>
          ` : ""}
          <div class="${data.title ? "mt-1 text-sm" : "text-sm"} ${messageTextClasses[data.type]}">
            <p>${chunkMNWKYY5E_cjs.escapeHtml(data.message)}</p>
          </div>
        </div>
        ${data.dismissible ? `
          <div class="ml-auto pl-3">
            <div class="-mx-1.5 -my-1.5">
              <button
                type="button"
                class="inline-flex rounded-md p-1.5 ${iconClasses[data.type]} hover:bg-opacity-20 focus:outline-none focus:ring-2 focus:ring-offset-2"
                onclick="document.getElementById('dismissible-alert').remove()"
              >
                <span class="sr-only">Dismiss</span>
                <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        ` : ""}
      </div>
    </div>
  `;
}

// src/templates/pages/admin-documents-form.template.ts
function inputClass(error) {
  const base = "block w-full rounded-lg border bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-950 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors";
  return error ? `${base} border-red-400 dark:border-red-500` : `${base} border-zinc-300 dark:border-zinc-700`;
}
function renderFieldInput(field, value, error) {
  const id = `data_${field.name}`;
  const name = `data[${field.name}]`;
  const label = field.name.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
  const strVal = value != null ? String(value) : "";
  let input;
  if (field.type === "integer" || field.type === "number") {
    input = `<input type="number" id="${id}" name="${name}" value="${chunkMNWKYY5E_cjs.escapeHtml(strVal)}"
              step="${field.type === "integer" ? "1" : "any"}"
              class="${inputClass(error)}">`;
  } else if (field.type === "boolean") {
    input = `<div class="flex items-center gap-2">
               <input type="hidden" name="${name}" value="false">
               <input type="checkbox" id="${id}" name="${name}" value="true" ${strVal === "true" ? "checked" : ""}
                 class="h-4 w-4 rounded border-zinc-300 dark:border-zinc-600 text-blue-600 focus:ring-blue-500">
               <span class="text-sm text-zinc-700 dark:text-zinc-300">${label}</span>
             </div>`;
    return `
      <div>
        ${input}
        ${error ? `<p class="mt-1 text-xs text-red-500">${chunkMNWKYY5E_cjs.escapeHtml(error)}</p>` : ""}
      </div>`;
  } else if (field.kind === "facet") {
    const arrVal = Array.isArray(value) ? value.join(", ") : strVal;
    input = `<input type="text" id="${id}" name="${name}" value="${chunkMNWKYY5E_cjs.escapeHtml(arrVal)}"
              placeholder="Comma-separated values"
              class="${inputClass(error)}">`;
  } else {
    input = `<input type="text" id="${id}" name="${name}" value="${chunkMNWKYY5E_cjs.escapeHtml(strVal)}"
              class="${inputClass(error)}">`;
  }
  return `
    <div>
      <label for="${id}" class="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
        ${label}
      </label>
      ${input}
      ${error ? `<p class="mt-1 text-xs text-red-500">${chunkMNWKYY5E_cjs.escapeHtml(error)}</p>` : ""}
    </div>`;
}
function renderRemainingFields(allData, queryableFields, errors) {
  const knownNames = new Set(queryableFields.map((f) => f.name));
  const remainingKeys = Object.keys(allData).filter((k) => !knownNames.has(k));
  if (remainingKeys.length === 0) return "";
  const inputs = remainingKeys.map((key) => {
    const val = allData[key];
    const id = `data_${key}`;
    const name = `data[${key}]`;
    const label = key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
    const strVal = typeof val === "object" ? JSON.stringify(val, null, 2) : String(val ?? "");
    const isMultiline = strVal.includes("\n") || strVal.length > 100;
    return `
      <div>
        <label for="${id}" class="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">${chunkMNWKYY5E_cjs.escapeHtml(label)}</label>
        ${isMultiline ? `<textarea id="${id}" name="${name}" rows="4" class="${inputClass(errors[key])}">${chunkMNWKYY5E_cjs.escapeHtml(strVal)}</textarea>` : `<input type="text" id="${id}" name="${name}" value="${chunkMNWKYY5E_cjs.escapeHtml(strVal)}" class="${inputClass(errors[key])}">`}
        ${errors[key] ? `<p class="mt-1 text-xs text-red-500">${chunkMNWKYY5E_cjs.escapeHtml(errors[key])}</p>` : ""}
      </div>`;
  }).join("");
  return `
    <div class="border-t border-zinc-200 dark:border-zinc-700 pt-6">
      <h3 class="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-4">Additional Fields</h3>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">${inputs}</div>
    </div>`;
}
function renderDocumentFormPage(data) {
  const { docType, doc, publishedDoc, isEdit, errors = {} } = data;
  const queryableFields = docType.queryableFields ?? [];
  const docData = doc?.data ?? {};
  const isAdmin = data.user?.role === "admin";
  const isEditor = isAdmin || data.user?.role === "editor";
  const hasNewerDraft = isEdit && doc && !doc.isPublished && publishedDoc;
  const isPublishedAndDraft = isEdit && doc?.isPublished && doc?.isCurrentDraft;
  const formAction = isEdit ? `/admin/content/documents/${chunkMNWKYY5E_cjs.escapeHtml(docType.id)}/${chunkMNWKYY5E_cjs.escapeHtml(doc.rootId)}` : `/admin/content/documents/${chunkMNWKYY5E_cjs.escapeHtml(docType.id)}/new`;
  const publishBannerHtml = (() => {
    if (!isEdit || !doc) return "";
    if (isPublishedAndDraft) {
      return renderAlert({
        type: "success",
        message: 'This document is live. Saving creates a new draft. Use "Publish" to push changes live.'
      });
    }
    if (hasNewerDraft) {
      return renderAlert({
        type: "info",
        message: `A published version (v${publishedDoc.versionNumber}) is still live. This is an unpublished draft (v${doc.versionNumber}).`
      });
    }
    return "";
  })();
  const queryableInputs = queryableFields.filter((f) => f.kind !== "reference").map((f) => renderFieldInput(f, docData[f.name], errors[`data.${f.name}`])).join("");
  const remainingHtml = renderRemainingFields(docData, queryableFields, errors);
  const content = `
    <div class="w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div class="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400 mb-1">
            <a href="/admin/content" class="hover:text-zinc-950 dark:hover:text-white">Content</a>
            <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd"/></svg>
            <a href="/admin/content?model=doc:${chunkMNWKYY5E_cjs.escapeHtml(docType.id)}" class="hover:text-zinc-950 dark:hover:text-white">${chunkMNWKYY5E_cjs.escapeHtml(docType.displayName)}</a>
            <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd"/></svg>
            <span class="text-zinc-950 dark:text-white font-medium">${isEdit ? "Edit" : "New"}</span>
          </div>
          <h1 class="text-2xl/8 font-semibold text-zinc-950 dark:text-white sm:text-xl/8">
            ${isEdit ? `Edit ${chunkMNWKYY5E_cjs.escapeHtml(docType.displayName)}` : `New ${chunkMNWKYY5E_cjs.escapeHtml(docType.displayName)}`}
          </h1>
          ${isEdit && doc ? `<p class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">v${doc.versionNumber} \xB7 root: <code class="font-mono">${chunkMNWKYY5E_cjs.escapeHtml(doc.rootId)}</code></p>` : ""}
        </div>

        <!-- Publish controls (edit mode only) -->
        ${isEdit && doc && isEditor ? `
        <div class="mt-4 sm:mt-0 flex gap-2">
          ${!doc.isPublished ? `
          <form method="POST" action="/admin/content/documents/${chunkMNWKYY5E_cjs.escapeHtml(docType.id)}/${chunkMNWKYY5E_cjs.escapeHtml(doc.id)}/publish">
            <button type="submit"
              class="inline-flex items-center rounded-lg bg-green-600 px-3.5 py-2.5 text-sm font-semibold text-white hover:bg-green-500 transition-colors shadow-sm">
              Publish
            </button>
          </form>` : `
          <form method="POST" action="/admin/content/documents/${chunkMNWKYY5E_cjs.escapeHtml(docType.id)}/${chunkMNWKYY5E_cjs.escapeHtml(doc.id)}/unpublish">
            <button type="submit"
              class="inline-flex items-center rounded-lg bg-amber-500 px-3.5 py-2.5 text-sm font-semibold text-white hover:bg-amber-400 transition-colors shadow-sm">
              Unpublish
            </button>
          </form>`}
        </div>` : ""}
      </div>

      ${publishBannerHtml}
      ${data.message ? renderAlert({ type: data.messageType ?? "info", message: data.message, dismissible: true }) : ""}

      <!-- Form -->
      <form method="POST" action="${formAction}">
        ${isEdit ? `<input type="hidden" name="_method" value="PUT">` : ""}

        <div class="relative rounded-xl">
          <div class="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 dark:from-blue-400/10 dark:to-purple-400/10 rounded-xl"></div>
          <div class="relative bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl shadow-sm ring-1 ring-zinc-950/5 dark:ring-white/10 rounded-xl p-6 space-y-6">

            <!-- Standard fields -->
            <div>
              <h3 class="text-sm font-semibold text-zinc-700 dark:text-zinc-200 mb-4">Document</h3>
              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label for="title" class="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Title</label>
                  <input type="text" id="title" name="title" value="${chunkMNWKYY5E_cjs.escapeHtml(doc?.title ?? "")}"
                    class="${inputClass(errors.title)}">
                  ${errors.title ? `<p class="mt-1 text-xs text-red-500">${chunkMNWKYY5E_cjs.escapeHtml(errors.title)}</p>` : ""}
                </div>
                <div>
                  <label for="slug" class="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Slug</label>
                  <input type="text" id="slug" name="slug" value="${chunkMNWKYY5E_cjs.escapeHtml(doc?.slug ?? "")}"
                    placeholder="auto-generated-if-empty"
                    class="${inputClass(errors.slug)}">
                  ${errors.slug ? `<p class="mt-1 text-xs text-red-500">${chunkMNWKYY5E_cjs.escapeHtml(errors.slug)}</p>` : ""}
                </div>
              </div>
            </div>

            <!-- Queryable data fields -->
            ${queryableFields.length > 0 ? `
            <div class="border-t border-zinc-200 dark:border-zinc-700 pt-6">
              <h3 class="text-sm font-semibold text-zinc-700 dark:text-zinc-200 mb-4">Content</h3>
              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                ${queryableInputs}
              </div>
            </div>` : ""}

            <!-- Remaining data fields not in queryable fields -->
            ${remainingHtml}

            <!-- Actions -->
            <div class="border-t border-zinc-200 dark:border-zinc-700 pt-6 flex items-center justify-between">
              <a href="/admin/content?model=doc:${chunkMNWKYY5E_cjs.escapeHtml(docType.id)}"
                class="inline-flex items-center rounded-lg bg-white dark:bg-zinc-800 px-3.5 py-2.5 text-sm font-semibold text-zinc-700 dark:text-zinc-200 ring-1 ring-inset ring-zinc-300 dark:ring-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors">
                Cancel
              </a>
              <div class="flex gap-3">
                <button type="submit"
                  class="inline-flex items-center rounded-lg bg-zinc-950 dark:bg-white px-3.5 py-2.5 text-sm font-semibold text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors shadow-sm">
                  ${isEdit ? "Save Draft" : "Create"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>

      <!-- Version history (edit mode) -->
      ${isEdit && doc ? `
      <details class="group">
        <summary class="cursor-pointer text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white flex items-center gap-2 py-2">
          <svg class="h-4 w-4 transition-transform group-open:rotate-90" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd"/>
          </svg>
          Version history
        </summary>
        <div class="mt-3 rounded-xl bg-white dark:bg-zinc-900 ring-1 ring-zinc-950/5 dark:ring-white/10 overflow-hidden">
          <div id="version-history-placeholder" class="px-6 py-4 text-sm text-zinc-500 dark:text-zinc-400"
               hx-get="/admin/content/documents/${chunkMNWKYY5E_cjs.escapeHtml(docType.id)}/${chunkMNWKYY5E_cjs.escapeHtml(doc.rootId)}/versions"
               hx-trigger="revealed"
               hx-swap="outerHTML">
            Loading version history\u2026
          </div>
        </div>
      </details>` : ""}
    </div>
  `;
  return chunkUYJ6TJHX_cjs.renderAdminLayoutCatalyst({
    title: `${isEdit ? "Edit" : "New"} ${docType.displayName} \u2014 Documents`,
    currentPath: "/admin/content",
    user: data.user,
    version: data.version,
    content
  });
}
function renderVersionHistoryFragment(data) {
  if (data.versions.length === 0) {
    return `<div class="px-6 py-4 text-sm text-zinc-500 dark:text-zinc-400">No versions found.</div>`;
  }
  const rows = data.versions.map((v) => `
    <div class="flex items-center justify-between px-6 py-3 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
      <div class="flex items-center gap-3">
        <span class="text-sm font-medium text-zinc-950 dark:text-white">v${v.versionNumber}</span>
        ${v.isPublished ? `<span class="inline-flex items-center rounded-md bg-green-50 dark:bg-green-500/10 px-1.5 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">live</span>` : ""}
        ${v.isCurrentDraft ? `<span class="inline-flex items-center rounded-md bg-blue-50 dark:bg-blue-500/10 px-1.5 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-400">draft</span>` : ""}
      </div>
      <div class="flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
        <span>${v.createdBy ?? "\u2014"}</span>
        <span>${new Date(v.updatedAt * 1e3).toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" })}</span>
      </div>
    </div>
  `).join("");
  return `<div>${rows}</div>`;
}

exports.renderAlert = renderAlert;
exports.renderDocumentFormPage = renderDocumentFormPage;
exports.renderVersionHistoryFragment = renderVersionHistoryFragment;
//# sourceMappingURL=chunk-5X5RGY2T.cjs.map
//# sourceMappingURL=chunk-5X5RGY2T.cjs.map