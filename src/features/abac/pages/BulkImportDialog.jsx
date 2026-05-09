import { useState } from 'react';
import {
  Upload,
  File as FileIcon,
  Trash,
  ChevronRight,
  Loader2,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/**
 * @typedef {Object} ParsedNode
 * @property {string} id              Temporary client-side UUID.
 * @property {string} originalName    Raw name as it appeared in the file.
 * @property {number} depth           0-based depth in the hierarchy.
 * @property {string|null} parentId   Temporary UUID of the parent (null for roots).
 * @property {string} displayName     Human-readable name (verb + originalName).
 * @property {string} key             Snake-case attribute key.
 */

const VERB_OPTIONS = ['Open', 'View', 'Read', 'Update', 'Create', 'Delete'];

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
 * @param {{
 *   open: boolean,
 *   onOpenChange: (open: boolean) => void,
 *   onImportComplete?: (nodes: ParsedNode[]) => Promise<void> | void,
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
  const [verb, setVerb] = useState('');
  const [nodes, setNodes] = useState([]);
  const [isDragging, setIsDragging] = useState(false);

  const reset = () => {
    setStep(1);
    setFile(null);
    setFileText('');
    setVerb('');
    setNodes([]);
    setIsDragging(false);
  };

  const handleOpenChange = (next) => {
    if (isImporting) return; // never close mid-import
    if (!next) reset();
    onOpenChange(next);
  };

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

  const handleNext = () => {
    if (!fileText || !verb) return;
    setNodes(parseHierarchy(fileText, verb));
    setStep(2);
  };

  const handleBack = () => {
    if (isImporting) return;
    setNodes([]);
    setStep(1);
  };

  const updateNode = (id, patch) => {
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch } : n)));
  };

  const handleCreate = async () => {
    if (!onImportComplete) return;
    await onImportComplete(nodes);
  };

  const canProceed = !!file && !!verb;

  // Detect duplicate keys among the parsed nodes (caller is responsible for
  // checking against existing backend keys, but this catches in-file dupes).
  const duplicateKeys = (() => {
    const seen = new Map();
    nodes.forEach((n) => seen.set(n.key, (seen.get(n.key) ?? 0) + 1));
    return new Set([...seen.entries()].filter(([, c]) => c > 1).map(([k]) => k));
  })();

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl flex flex-col max-h-[90vh]">
        <DialogHeader className="shrink-0">
          <DialogTitle>Bulk Import Action Attributes</DialogTitle>
          <p className="text-sm text-gray-500">
            {step === 1
              ? 'Upload a Markdown file describing your UI hierarchy and choose a base action verb.'
              : 'Review and edit the generated attributes before creating them.'}
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-1">
          {step === 1 ? (
            <div className="space-y-5 py-2">
              <div className="space-y-2">
                <Label>UI Structure File</Label>
                {file ? (
                  <div className="flex items-center justify-between rounded-md border bg-gray-50 px-3 py-2.5">
                    <div className="flex items-center gap-2 text-sm">
                      <FileIcon className="h-4 w-4 text-gray-500" />
                      <span className="font-medium">{file.name}</span>
                      <span className="text-gray-500">
                        ({Math.max(1, Math.round(file.size / 1024))} KB)
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setFile(null);
                        setFileText('');
                      }}
                    >
                      <Trash className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                ) : (
                  <label
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    className={`flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed px-6 py-10 text-center transition-colors ${
                      isDragging
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-300 hover:border-indigo-400 hover:bg-gray-50'
                    }`}
                  >
                    <Upload className="mb-2 h-6 w-6 text-gray-500" />
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

              <div className="space-y-2">
                <Label htmlFor="verb">Base Action Verb</Label>
                <Select value={verb} onValueChange={setVerb}>
                  <SelectTrigger id="verb">
                    <SelectValue placeholder="Select a verb" />
                  </SelectTrigger>
                  <SelectContent>
                    {VERB_OPTIONS.map((v) => (
                      <SelectItem key={v} value={v}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">
                  This verb will be prepended to every extracted name (e.g. "View Dashboard").
                </p>
              </div>
            </div>
          ) : (
            <div className="py-2">
              <div className="mb-2 flex items-center justify-between text-xs text-gray-500">
                <span>{nodes.length} attributes generated</span>
                <span>Edit any field before creating</span>
              </div>
              <div className="max-h-[50vh] overflow-y-auto rounded-md border">
                <div className="divide-y">
                  <div className="grid grid-cols-[1fr_1fr] gap-3 bg-gray-50 px-3 py-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                    <div>Display Name</div>
                    <div>Attribute Key</div>
                  </div>
                  {nodes.map((node) => {
                    const isDup = duplicateKeys.has(node.key);
                    return (
                      <div
                        key={node.id}
                        className="group grid grid-cols-[1fr_1fr] gap-3 px-3 py-2 transition-colors hover:bg-gray-50"
                      >
                        <div
                          className="flex items-center gap-2 min-w-0"
                          style={{ paddingLeft: `${node.depth * 24}px` }}
                        >
                          {node.depth > 0 && (
                            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                          )}
                          <div className="flex-1 min-w-0 space-y-1">
                            <Input
                              value={node.displayName}
                              onChange={(e) =>
                                updateNode(node.id, { displayName: e.target.value })
                              }
                              className="h-8 text-sm"
                              disabled={isImporting}
                            />
                            <p className="truncate text-[11px] text-gray-500">
                              from: {node.originalName}
                            </p>
                          </div>
                        </div>
                        <div>
                          <Input
                            value={node.key}
                            onChange={(e) => updateNode(node.id, { key: e.target.value })}
                            className={`h-8 font-mono text-sm ${
                              isDup ? 'border-red-400 bg-red-50' : ''
                            }`}
                            disabled={isImporting}
                          />
                          {isDup && (
                            <p className="mt-0.5 text-[11px] text-red-600">
                              Duplicate key in file
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {nodes.length === 0 && (
                    <div className="px-3 py-8 text-center text-sm text-gray-500">
                      No items found in file.
                    </div>
                  )}
                </div>
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

        <div className="flex justify-end gap-2 pt-4 border-t border-gray-100 mt-2 shrink-0">
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
              <Button
                onClick={handleCreate}
                disabled={
                  isImporting ||
                  nodes.length === 0 ||
                  duplicateKeys.size > 0
                }
              >
                {isImporting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importing…
                  </>
                ) : (
                  <>Create Attributes</>
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
