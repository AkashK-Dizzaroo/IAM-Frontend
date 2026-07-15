import { useState, useMemo } from 'react';
import {
  Upload,
  File as FileIcon,
  Trash2,
  ChevronRight,
  ChevronDown,
  Loader2,
  Plus,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { secureRandomId } from '@/lib/random';

/**
 * @typedef {Object} ParsedNode
 * @property {string}      id            Temporary client-side UUID.
 * @property {string}      originalName  Raw name as it appeared in the file.
 * @property {number}      depth         0-based depth in the hierarchy.
 * @property {string|null} parentId      Temporary UUID of the parent (null for roots).
 * @property {string}      displayName   Human-readable display name (text before the `:`).
 * @property {string}      key           Snake-case key derived from displayName (used internally for duplicate detection).
 * @property {string[]}    allowedValues Enum allowed values parsed from the text after `:`, split on `|`.
 */

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toSnakeCase = (input) =>
  input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, '')
    .replace(/[\s-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

const generateId = () => secureRandomId();

function parseHierarchy(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  /** @type {ParsedNode[]} */
  const nodes = [];
  /** @type {{depth:number,id:string}[]} */
  const stack = [];

  for (const rawLine of lines) {
    const leading = rawLine.match(/^[\s-]*/)[0];
    const content = rawLine.slice(leading.length).trim();
    if (!content) continue;

    const colonIdx = content.indexOf(':');
    const name = colonIdx === -1 ? content : content.slice(0, colonIdx).trim();
    const allowedValues =
      colonIdx === -1
        ? []
        : content
            .slice(colonIdx + 1)
            .split('|')
            .map((v) => v.trim())
            .filter(Boolean);
    if (!name) continue;

    let depthScore = 0;
    for (const ch of leading) {
      if (ch === '\t') depthScore += 2;
      else if (ch === ' ') depthScore += 1;
      else if (ch === '-') depthScore += 2;
    }
    const depth = Math.floor(depthScore / 2);

    while (stack.length && stack[stack.length - 1].depth >= depth) {
      stack.pop();
    }
    const parentId = stack.length ? stack[stack.length - 1].id : null;
    const id = generateId();
    const displayName = name;
    const key = toSnakeCase(displayName);

    nodes.push({ id, originalName: name, depth, parentId, displayName, key, allowedValues });
    stack.push({ depth, id });
  }
  return nodes;
}

function rebuildDepths(nodes) {
  const idToNode = new Map(nodes.map((n) => [n.id, n]));
  const getDepth = (node) => {
    if (!node.parentId || !idToNode.has(node.parentId)) return 0;
    return getDepth(idToNode.get(node.parentId)) + 1;
  };
  return nodes.map((n) => ({ ...n, depth: getDepth(n) }));
}

function buildNestedTree(flatNodes) {
  const map = new Map(flatNodes.map((n) => [n.id, { ...n, children: [] }]));
  const roots = [];
  for (const n of flatNodes) {
    const node = map.get(n.id);
    if (n.parentId && map.has(n.parentId)) {
      map.get(n.parentId).children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

// ─── Tree node row ────────────────────────────────────────────────────────────

function TreeNodeRow({
  node,
  expandedIds,
  onToggle,
  duplicateKeys,
  isImporting,
  onUpdateNode,
  onAddChild,
  onDeleteNode,
}) {
  const hasChildren = node.children?.length > 0;
  const isExpanded = expandedIds.has(node.id);
  const isDup = duplicateKeys.has(node.key);

  return (
    <div>
      <div
        className="group flex items-start gap-2 border-b border-gray-100 px-3 py-2 hover:bg-gray-50 transition-colors"
        style={{ paddingLeft: `${node.depth * 28 + 12}px` }}
      >
        {/* Expand/collapse chevron */}
        <div className="mt-2 flex h-5 w-5 shrink-0 items-center justify-center">
          {hasChildren ? (
            <button
              type="button"
              onClick={() => onToggle(node.id)}
              className="rounded p-0.5 hover:bg-gray-200 transition-colors"
              aria-label={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded
                ? <ChevronDown className="h-3.5 w-3.5 text-gray-500" />
                : <ChevronRight className="h-3.5 w-3.5 text-gray-500" />}
            </button>
          ) : (
            <div className="h-3.5 w-3.5" />
          )}
        </div>

        {/* Display name input — full width, no key column */}
        <div className="flex-1 min-w-0 space-y-1">
          <Input
            value={node.displayName}
            onChange={(e) => {
              const displayName = e.target.value;
              onUpdateNode(node.id, { displayName, key: toSnakeCase(displayName) });
            }}
            className={`h-8 text-sm ${isDup ? 'border-red-400 bg-red-50' : ''}`}
            disabled={isImporting}
            placeholder="Display name"
          />
          {isDup && <p className="text-[11px] text-red-600">Duplicate name</p>}
          {node.allowedValues?.length > 0 && (
            <p className="text-[11px] text-gray-500 truncate">
              Enum: {node.allowedValues.join(', ')}
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div className="mt-1 flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-primary hover:bg-primary/10 hover:text-primary"
            title="Add child"
            disabled={isImporting}
            onClick={() => onAddChild(node.id)}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-red-600 hover:bg-red-50 hover:text-red-700"
            title="Delete"
            disabled={isImporting}
            onClick={() => onDeleteNode(node.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Children (recursive) */}
      {isExpanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <TreeNodeRow
              key={child.id}
              node={child}
              expandedIds={expandedIds}
              onToggle={onToggle}
              duplicateKeys={duplicateKeys}
              isImporting={isImporting}
              onUpdateNode={onUpdateNode}
              onAddChild={onAddChild}
              onDeleteNode={onDeleteNode}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main dialog ──────────────────────────────────────────────────────────────

/**
 * @param {{
 *   open: boolean,
 *   onOpenChange: (open: boolean) => void,
 *   onImportComplete?: (nodes: ParsedNode[]) => Promise<void>|void,
 *   isImporting?: boolean,
 *   importStatus?: string | null,
 * }} props
 */
export function BulkImportDialog({
  open,
  onOpenChange,
  onImportComplete,
  isImporting = false,
  importStatus = null,
}) {
  const [step, setStep] = useState(1);
  const [file, setFile] = useState(null);
  const [fileText, setFileText] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [nodes, setNodes] = useState([]);
  const [expandedIds, setExpandedIds] = useState(new Set());

  const reset = () => {
    setStep(1);
    setFile(null);
    setFileText('');
    setIsDragging(false);
    setNodes([]);
    setExpandedIds(new Set());
  };

  const handleOpenChange = (next) => {
    if (isImporting) return;
    if (!next) reset();
    onOpenChange(next);
  };

  // ── File handling ──────────────────────────────────────────────────────────

  const readFile = async (f) => {
    const text = await f.text();
    setFile(f);
    setFileText(text);
  };

  const handleFileInput = (e) => {
    const f = e.target.files?.[0];
    if (f) void readFile(f);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) void readFile(f);
  };

  // ── Step navigation ────────────────────────────────────────────────────────

  const handleNext = () => {
    if (!fileText) return;
    const parsed = parseHierarchy(fileText);
    setNodes(parsed);
    setExpandedIds(new Set(parsed.filter((n) => !n.parentId).map((n) => n.id)));
    setStep(2);
  };

  const handleBack = () => {
    if (isImporting) return;
    setNodes([]);
    setExpandedIds(new Set());
    setStep(1);
  };

  // ── Tree mutation helpers ──────────────────────────────────────────────────

  const updateNode = (id, patch) => {
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch } : n)));
  };

  const addChild = (parentId) => {
    setNodes((prev) => {
      const parent = prev.find((n) => n.id === parentId);
      if (!parent) return prev;

      const newId = generateId();
      const newNode = {
        id: newId,
        originalName: 'New Attribute',
        depth: parent.depth + 1,
        parentId,
        displayName: 'New Attribute',
        key: `new_attribute_${newId.slice(0, 4)}`,
        allowedValues: [],
      };

      const descendantIds = new Set([parentId]);
      let grew = true;
      while (grew) {
        grew = false;
        for (const n of prev) {
          if (!descendantIds.has(n.id) && n.parentId && descendantIds.has(n.parentId)) {
            descendantIds.add(n.id);
            grew = true;
          }
        }
      }

      let lastDescIdx = prev.findIndex((n) => n.id === parentId);
      for (let i = lastDescIdx + 1; i < prev.length; i++) {
        if (descendantIds.has(prev[i].id)) lastDescIdx = i;
      }

      const next = [...prev];
      next.splice(lastDescIdx + 1, 0, newNode);
      setExpandedIds((ids) => new Set([...ids, parentId, newId]));
      return rebuildDepths(next);
    });
  };

  const addRoot = () => {
    const newId = generateId();
    setNodes((prev) => [
      ...prev,
      {
        id: newId,
        originalName: 'New Attribute',
        depth: 0,
        parentId: null,
        displayName: 'New Attribute',
        key: `new_attribute_${newId.slice(0, 4)}`,
        allowedValues: [],
      },
    ]);
    setExpandedIds((ids) => new Set([...ids, newId]));
  };

  const deleteNode = (id) => {
    setNodes((prev) => {
      const toRemove = new Set();
      const collect = (targetId) => {
        toRemove.add(targetId);
        prev.filter((n) => n.parentId === targetId).forEach((c) => collect(c.id));
      };
      collect(id);
      return rebuildDepths(prev.filter((n) => !toRemove.has(n.id)));
    });
  };

  const toggleExpand = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── Derived values ─────────────────────────────────────────────────────────

  const nestedRoots = useMemo(() => buildNestedTree(nodes), [nodes]);

  const duplicateKeys = useMemo(() => {
    const seen = new Map();
    nodes.forEach((n) => seen.set(n.key, (seen.get(n.key) ?? 0) + 1));
    return new Set([...seen.entries()].filter(([, c]) => c > 1).map(([k]) => k));
  }, [nodes]);

  const canCreate = !isImporting && nodes.length > 0 && duplicateKeys.size === 0;

  const handleCreate = async () => {
    if (!onImportComplete) return;
    await onImportComplete(nodes);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl flex flex-col max-h-[90vh]">
        <DialogHeader className="shrink-0">
          <DialogTitle>Import Action Tabs Attribute</DialogTitle>
          <p className="text-sm text-gray-500">
            {step === 1
              ? 'Upload a Markdown or text file containing your UI hierarchy.'
              : 'Review and edit the generated attribute tree before creating.'}
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-1">
          {/* ── Step 1: File upload only ───────────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>UI Structure File</Label>
                {file ? (
                  <div className="flex items-center justify-between rounded-md border bg-gray-50 px-3 py-2.5">
                    <div className="flex items-center gap-2 text-sm">
                      <FileIcon className="h-4 w-4 text-gray-400" />
                      <span className="font-medium">{file.name}</span>
                      <span className="text-gray-400">
                        ({Math.max(1, Math.round(file.size / 1024))} KB)
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => { setFile(null); setFileText(''); }}
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                ) : (
                  <label
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    className={`flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed px-6 py-14 text-center transition-colors ${
                      isDragging
                        ? 'border-primary bg-primary/10'
                        : 'border-gray-300 hover:border-primary/60 hover:bg-gray-50'
                    }`}
                  >
                    <Upload className="mb-2 h-6 w-6 text-gray-400" />
                    <p className="text-sm font-medium">Click to upload or drag and drop</p>
                    <p className="text-xs text-gray-500 mt-1">.md or .txt files</p>
                    <input
                      type="file"
                      accept=".md,.txt,text/markdown,text/plain"
                      className="hidden"
                      onChange={handleFileInput}
                    />
                  </label>
                )}
                <p className="text-xs text-gray-400">
                  Each line becomes an attribute. Indent with spaces or tabs to create child attributes.
                  Add <span className="font-mono">:value1 | value2</span> after a name to set its enum allowed values, e.g. <span className="font-mono">Dashboard:open | read</span>.
                  All attributes are created with type <span className="font-mono">enum</span> and tagged as <span className="font-mono">action_tab</span>.
                </p>
              </div>
            </div>
          )}

          {/* ── Step 2: Interactive tree preview ──────────────────────────── */}
          {step === 2 && (
            <div className="py-2">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs text-gray-500">{nodes.length} attributes</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1 text-xs"
                  disabled={isImporting}
                  onClick={addRoot}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Root Attribute
                </Button>
              </div>

              <div className="max-h-[55vh] overflow-y-auto rounded-md border">
                {/* Table header */}
                <div className="flex items-center border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                  <div className="mr-2 w-5 shrink-0" />
                  <div className="flex-1">Display Name</div>
                  <div className="w-[68px] shrink-0 text-right">Actions</div>
                </div>

                {nodes.length === 0 ? (
                  <div className="px-3 py-8 text-center text-sm text-gray-500">
                    No attributes. Use "Add Root Attribute" to start.
                  </div>
                ) : (
                  nestedRoots.map((root) => (
                    <TreeNodeRow
                      key={root.id}
                      node={root}
                      expandedIds={expandedIds}
                      onToggle={toggleExpand}
                      duplicateKeys={duplicateKeys}
                      isImporting={isImporting}
                      onUpdateNode={updateNode}
                      onAddChild={addChild}
                      onDeleteNode={deleteNode}
                    />
                  ))
                )}
              </div>

              {importStatus && (
                <div className="mt-3 flex items-center gap-2 rounded-md border border-primary/25 bg-primary/10 px-3 py-2 text-sm text-primary">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{importStatus}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-gray-100 pt-4 mt-2 shrink-0">
          {step === 1 ? (
            <>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleNext} disabled={!file}>
                Next: Preview
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={handleBack} disabled={isImporting}>
                Back
              </Button>
              <Button onClick={handleCreate} disabled={!canCreate}>
                {isImporting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importing…
                  </>
                ) : (
                  'Create Attributes'
                )}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default BulkImportDialog;
