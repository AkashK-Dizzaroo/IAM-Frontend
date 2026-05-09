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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/**
 * @typedef {Object} ParsedNode
 * @property {string}      id           Temporary client-side UUID.
 * @property {string}      originalName Raw name as it appeared in the file.
 * @property {number}      depth        0-based depth in the hierarchy.
 * @property {string|null} parentId     Temporary UUID of the parent (null for roots).
 * @property {string}      displayName  Human-readable display name.
 * @property {string}      key          Snake-case attribute key.
 */

// ─── Constants ────────────────────────────────────────────────────────────────

const VERB_OPTIONS = ['Open', 'View', 'Read', 'Update', 'Create', 'Delete'];

const DEFAULT_SETTINGS = {
  verb:               'View',
  dataType:           'boolean',
  defaultValue:       '',
  isRequired:         false,
  isMultiValued:      false,
  isUserRequestable:  false,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toSnakeCase = (input) =>
  input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, '')
    .replace(/[\s-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

const generateId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

function parseHierarchy(text, verb) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  /** @type {ParsedNode[]} */
  const nodes = [];
  /** @type {{depth:number,id:string}[]} */
  const stack = [];

  for (const rawLine of lines) {
    const match = rawLine.match(/^([\s\-]*)(.*)$/);
    if (!match) continue;
    const leading = match[1] ?? '';
    const name = (match[2] ?? '').trim();
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
    const displayName = `${verb} ${name}`;
    const key = toSnakeCase(displayName);

    nodes.push({ id, originalName: name, depth, parentId, displayName, key });
    stack.push({ depth, id });
  }
  return nodes;
}

/**
 * Rebuild the `depth` values of every node from the parentId tree structure.
 * This is needed after add/delete operations change the topology.
 */
function rebuildDepths(nodes) {
  const idToNode = new Map(nodes.map((n) => [n.id, n]));
  const getDepth = (node) => {
    if (!node.parentId || !idToNode.has(node.parentId)) return 0;
    return getDepth(idToNode.get(node.parentId)) + 1;
  };
  return nodes.map((n) => ({ ...n, depth: getDepth(n) }));
}

/**
 * Build nested tree from flat list for render. Returns root nodes each with a
 * `children` array (recursively). Preserves insertion order within each level.
 */
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
      {/* Row */}
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

        {/* Display name input */}
        <div className="flex-1 min-w-0 space-y-1">
          <Input
            value={node.displayName}
            onChange={(e) => onUpdateNode(node.id, { displayName: e.target.value })}
            className="h-8 text-sm"
            disabled={isImporting}
          />
          <p className="truncate text-[11px] text-gray-400">from: {node.originalName}</p>
        </div>

        {/* Key input */}
        <div className="w-[220px] shrink-0 space-y-1">
          <Input
            value={node.key}
            onChange={(e) => onUpdateNode(node.id, { key: e.target.value })}
            className={`h-8 font-mono text-sm ${isDup ? 'border-red-400 bg-red-50' : ''}`}
            disabled={isImporting}
          />
          {isDup && <p className="text-[11px] text-red-600">Duplicate key</p>}
        </div>

        {/* Action buttons — always visible, not hidden */}
        <div className="mt-1 flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700"
            title="Add child attribute"
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
            title="Delete this attribute"
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
 *   onImportComplete?: (nodes: ParsedNode[], settings: typeof DEFAULT_SETTINGS) => Promise<void>|void,
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

  // Step-1 settings (apply to all generated nodes as defaults)
  const [settings, setSettings] = useState({ ...DEFAULT_SETTINGS });

  const reset = () => {
    setStep(1);
    setFile(null);
    setFileText('');
    setIsDragging(false);
    setNodes([]);
    setExpandedIds(new Set());
    setSettings({ ...DEFAULT_SETTINGS });
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
    if (!fileText || !settings.verb) return;
    const parsed = parseHierarchy(fileText, settings.verb);
    setNodes(parsed);
    // Start all root nodes expanded
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

  /**
   * Add a new blank child under `parentId`. The child is inserted immediately
   * after the last existing descendant of the parent in the flat list, so the
   * visual ordering matches insertion order.
   */
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
      };

      // Collect all descendant IDs of parentId using repeated passes so that
      // non-contiguous or out-of-order flat lists are handled correctly.
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

      // Expand the parent so the new child is visible.
      setExpandedIds((ids) => new Set([...ids, parentId, newId]));
      // Recompute depth for every node from parentId relations so the
      // indentation level is always correct regardless of insertion order.
      return rebuildDepths(next);
    });
  };

  /**
   * Add a new root-level node at the end of the flat list.
   */
  const addRoot = () => {
    const newId = generateId();
    const newNode = {
      id: newId,
      originalName: 'New Attribute',
      depth: 0,
      parentId: null,
      displayName: 'New Attribute',
      key: `new_attribute_${newId.slice(0, 4)}`,
    };
    setNodes((prev) => [...prev, newNode]);
    setExpandedIds((ids) => new Set([...ids, newId]));
  };

  /**
   * Delete a node and all of its descendants from the flat list.
   */
  const deleteNode = (id) => {
    setNodes((prev) => {
      const toRemove = new Set();
      const collect = (targetId) => {
        toRemove.add(targetId);
        prev.filter((n) => n.parentId === targetId).forEach((c) => collect(c.id));
      };
      collect(id);
      const next = prev.filter((n) => !toRemove.has(n.id));
      return rebuildDepths(next);
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

  const canProceed = !!file && !!settings.verb;
  const canCreate = !isImporting && nodes.length > 0 && duplicateKeys.size === 0;

  const handleCreate = async () => {
    if (!onImportComplete) return;
    await onImportComplete(nodes, settings);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl flex flex-col max-h-[90vh]">
        <DialogHeader className="shrink-0">
          <DialogTitle>Bulk Import Action Attributes</DialogTitle>
          <p className="text-sm text-gray-500">
            {step === 1
              ? 'Upload a Markdown hierarchy file and configure default attribute settings.'
              : 'Review and edit the generated tree before creating.'}
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-1">
          {/* ── Step 1: Upload + defaults ─────────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-5 py-2">
              {/* File upload */}
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
                    className={`flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed px-6 py-10 text-center transition-colors ${
                      isDragging
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-300 hover:border-indigo-400 hover:bg-gray-50'
                    }`}
                  >
                    <Upload className="mb-2 h-6 w-6 text-gray-400" />
                    <p className="text-sm font-medium">Click to upload or drag and drop</p>
                    <p className="text-xs text-gray-500">.md or .txt files</p>
                    <input
                      type="file"
                      accept=".md,.txt,text/markdown,text/plain"
                      className="hidden"
                      onChange={handleFileInput}
                    />
                  </label>
                )}
              </div>

              <div className="border-t border-gray-100 pt-4">
                <p className="mb-4 text-sm font-medium text-gray-700">
                  Default Attribute Settings
                </p>
                <div className="grid grid-cols-2 gap-4">
                  {/* Verb */}
                  <div className="space-y-1.5">
                    <Label htmlFor="verb">Base Action Verb <span className="text-red-500">*</span></Label>
                    <Select
                      value={settings.verb}
                      onValueChange={(v) => setSettings((s) => ({ ...s, verb: v }))}
                    >
                      <SelectTrigger id="verb">
                        <SelectValue placeholder="Select a verb" />
                      </SelectTrigger>
                      <SelectContent>
                        {VERB_OPTIONS.map((v) => (
                          <SelectItem key={v} value={v}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-400">
                      Prepended to every name — e.g. "View Dashboard".
                    </p>
                  </div>

                  {/* Attribute type — locked to boolean */}
                  <div className="space-y-1.5">
                    <Label>Attribute Type</Label>
                    <div className="flex h-9 w-full items-center rounded-md border bg-gray-50 px-3 text-sm text-gray-500 cursor-not-allowed select-none">
                      Boolean
                    </div>
                    <p className="text-xs text-gray-400">
                      Bulk import always creates boolean attributes. Use New Attribute for other types.
                    </p>
                  </div>
                </div>

                {/* Default Value */}
                <div className="mt-4 space-y-1.5">
                  <Label htmlFor="bulk-default">Default Value</Label>
                  <Input
                    id="bulk-default"
                    placeholder="true or false"
                    value={settings.defaultValue}
                    onChange={(e) => setSettings((s) => ({ ...s, defaultValue: e.target.value }))}
                  />
                  <p className="text-xs text-gray-400">Applied to all imported attributes as constraints.defaultValue.</p>
                </div>

                {/* Is Required + Is Multi-Valued */}
                <div className="mt-4 flex flex-col gap-4">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="bulk-required"
                      checked={settings.isRequired}
                      onCheckedChange={(c) => setSettings((s) => ({ ...s, isRequired: Boolean(c) }))}
                    />
                    <Label htmlFor="bulk-required" className="cursor-pointer">Is Required</Label>
                  </div>

                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="bulk-multi"
                      checked={settings.isMultiValued}
                      onCheckedChange={(c) => setSettings((s) => ({ ...s, isMultiValued: Boolean(c) }))}
                    />
                    <Label htmlFor="bulk-multi" className="cursor-pointer">Is Multi-Valued</Label>
                  </div>

                  {/* User Requestable — radio buttons matching AttributeForm */}
                  <div className="space-y-1.5">
                    <Label>Filled by User during Access Request?</Label>
                    <div className="flex items-center gap-6 pt-0.5">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="bulk-user-requestable"
                          value="true"
                          checked={settings.isUserRequestable === true}
                          onChange={() => setSettings((s) => ({ ...s, isUserRequestable: true }))}
                          className="accent-indigo-600"
                        />
                        <span className="text-sm">Yes</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="bulk-user-requestable"
                          value="false"
                          checked={settings.isUserRequestable === false}
                          onChange={() => setSettings((s) => ({ ...s, isUserRequestable: false }))}
                          className="accent-indigo-600"
                        />
                        <span className="text-sm">No</span>
                      </label>
                    </div>
                    <p className="text-xs text-gray-400">
                      When set to Yes, end-users will be prompted to fill this attribute when requesting access.
                    </p>
                  </div>
                </div>
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

              <div className="max-h-[52vh] overflow-y-auto rounded-md border">
                {/* Table header */}
                <div className="flex items-center border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                  {/* chevron placeholder */}
                  <div className="mr-2 w-5 shrink-0" />
                  <div className="flex-1">Display Name</div>
                  <div className="w-[220px] shrink-0">Attribute Key</div>
                  {/* action buttons placeholder */}
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
                <div className="mt-3 flex items-center gap-2 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-800">
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
              <Button onClick={handleNext} disabled={!canProceed}>
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
