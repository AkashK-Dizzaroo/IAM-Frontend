import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { useAbacScope } from '../contexts/AbacScopeContext';
import { abacService } from '../api/abacService';

/**
 * Backend GET /api/v1/apps/:key/coverage-gaps returns:
 * { success, data: { applicationId, totalLogsScanned, uniqueGaps, gaps: [{ message, occurrences }] } }
 * Messages are strings like: Policy "X" references missing attr: subject.foo
 *
 * Two root causes exist:
 *   1. Attribute is not defined in App/Hub Attributes at all → go define it
 *   2. Attribute is defined but has no value set for the user → go assign it
 */

/** Parse "namespace.key" from a gap message */
function parseAttrRef(message) {
  // Matches patterns like: subject.foo  resource.bar  action.baz  environment.qux
  const match = message.match(/\b(subject|resource|action|environment)\.([a-zA-Z0-9_.-]+)/);
  if (!match) return null;
  return { namespace: match[1], key: match[2] };
}

const NAMESPACE_COLORS = {
  subject: 'bg-blue-50 text-blue-700 border-blue-200',
  resource: 'bg-purple-50 text-purple-700 border-purple-200',
  action: 'bg-teal-50 text-teal-700 border-teal-200',
  environment: 'bg-gray-100 text-gray-600 border-gray-200',
};

export function CoverageGapsPage() {
  const { selectedAppKey, selectedAppName } = useAbacScope();
  const navigate = useNavigate();

  const { data: gapsRes, isLoading, isError, error } = useQuery({
    queryKey: ['abac', 'coverageGaps', selectedAppKey],
    queryFn: () => abacService.getCoverageGaps(selectedAppKey),
    enabled: !!selectedAppKey,
  });

  const { data: attrDefsRes } = useQuery({
    queryKey: ['abac', 'appAttrDefs', selectedAppKey],
    queryFn: () => abacService.listAppAttrDefs(selectedAppKey),
    enabled: !!selectedAppKey,
    staleTime: 60_000,
  });

  const body = gapsRes?.data;
  const payload = body?.data ?? body;
  const gaps = Array.isArray(payload?.gaps) ? payload.gaps : [];
  const totalLogsScanned = payload?.totalLogsScanned ?? 0;
  const uniqueGaps = payload?.uniqueGaps ?? gaps.length;

  // Build a lookup: "namespace.key" → defined (true/false)
  const definedAttrKeys = useMemo(() => {
    const raw = attrDefsRes?.data?.data ?? attrDefsRes?.data ?? attrDefsRes ?? [];
    const defs = Array.isArray(raw) ? raw : [];
    const set = new Set();
    defs.forEach((d) => {
      if (d.namespace && d.key) set.add(`${d.namespace}.${d.key}`);
    });
    return set;
  }, [attrDefsRes]);

  // Categorize each gap
  const categorizedGaps = useMemo(() => {
    return gaps.map((gap) => {
      const ref = parseAttrRef(gap.message);
      if (!ref) return { ...gap, ref: null, category: 'unknown' };
      const fullKey = `${ref.namespace}.${ref.key}`;
      const isDefined = definedAttrKeys.has(fullKey);
      return {
        ...gap,
        ref,
        fullKey,
        category: isDefined ? 'no-value' : 'not-defined',
      };
    });
  }, [gaps, definedAttrKeys]);

  if (!selectedAppKey) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center h-full">
        <p className="font-medium text-gray-900 mb-1">No Application Selected</p>
        <p className="text-sm text-gray-500">Select an application to view its coverage gaps.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">{selectedAppName} Coverage Gaps</h1>
        <p className="text-sm text-gray-500 mt-1">
          Aggregated from recent evaluations: attributes referenced by global or app policies that were
          missing from the attribute bundle. Missing attributes default to falsy during evaluation.
        </p>
        {!isLoading && !isError && (
          <p className="text-xs text-gray-400 mt-2">
            Scanned {totalLogsScanned} evaluation{totalLogsScanned === 1 ? '' : 's'} · {uniqueGaps}{' '}
            unique gap{uniqueGaps === 1 ? '' : 's'}
          </p>
        )}
      </div>

      {isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error?.response?.data?.error ?? error?.message ?? 'Failed to load coverage gaps.'}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
            <tr>
              <th className="px-4 py-3 font-medium">Coverage gap</th>
              <th className="px-4 py-3 font-medium w-28">Occurrences</th>
              <th className="px-4 py-3 font-medium">Root cause</th>
              <th className="px-4 py-3 font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                  Scanning for gaps...
                </td>
              </tr>
            ) : gaps.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center">
                  <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-green-100 text-green-600 mb-3">
                    ✓
                  </div>
                  <p className="font-medium text-gray-900">No Coverage Gaps</p>
                  <p className="text-sm text-gray-500 mt-1">
                    No missing-attribute warnings were recorded in recent evaluations for this
                    application.
                  </p>
                </td>
              </tr>
            ) : (
              categorizedGaps.map((gap, i) => (
                <tr key={`${gap.message}-${i}`} className="hover:bg-gray-50">
                  <td className="px-4 py-4 align-top">
                    <div className="space-y-1">
                      <span className="font-mono text-[11px] leading-snug text-gray-800 block">
                        {gap.message}
                      </span>
                      {gap.ref && (
                        <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded border ${NAMESPACE_COLORS[gap.ref.namespace] ?? NAMESPACE_COLORS.environment}`}>
                          {gap.ref.namespace}
                          <span className="opacity-50">.</span>
                          {gap.ref.key}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4 align-top text-gray-700 tabular-nums">{gap.occurrences}</td>
                  <td className="px-4 py-4 align-top">
                    {gap.category === 'not-defined' ? (
                      <div className="flex items-start gap-1.5">
                        <span className="mt-0.5 text-orange-500 text-xs">⬡</span>
                        <div>
                          <p className="text-xs font-medium text-orange-700">Attribute not defined</p>
                          <p className="text-[11px] text-gray-500 mt-0.5">
                            No attribute definition exists for{' '}
                            <span className="font-mono">{gap.fullKey}</span> in this app.
                          </p>
                        </div>
                      </div>
                    ) : gap.category === 'no-value' ? (
                      <div className="flex items-start gap-1.5">
                        <span className="mt-0.5 text-amber-500 text-xs">◎</span>
                        <div>
                          <p className="text-xs font-medium text-amber-700">No value assigned</p>
                          <p className="text-[11px] text-gray-500 mt-0.5">
                            Attribute is defined but at least one user has no value set for{' '}
                            <span className="font-mono">{gap.fullKey}</span>.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">Unknown</span>
                    )}
                  </td>
                  <td className="px-4 py-4 align-top">
                    {gap.category === 'not-defined' ? (
                      <button
                        type="button"
                        onClick={() => navigate('/app-attributes')}
                        className="text-xs text-blue-600 hover:text-blue-800 hover:underline font-medium"
                      >
                        Define in App Attributes →
                      </button>
                    ) : gap.category === 'no-value' ? (
                      <button
                        type="button"
                        onClick={() => navigate('/app-user-attributes')}
                        className="text-xs text-blue-600 hover:text-blue-800 hover:underline font-medium"
                      >
                        Assign value in User Attributes →
                      </button>
                    ) : (
                      <span className="text-xs text-gray-400">
                        Check App Attributes or Hub Attributes.
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
