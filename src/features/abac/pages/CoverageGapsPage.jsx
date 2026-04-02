import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAbacScope } from '../contexts/AbacScopeContext';
import { abacService } from '../api/abacService';

/**
 * Backend GET /api/v1/apps/:key/coverage-gaps returns:
 * { success, data: { applicationId, totalLogsScanned, uniqueGaps, gaps: [{ message, occurrences }] } }
 * Messages are strings like: Policy "X" references missing attr: subject.foo
 */
export function CoverageGapsPage() {
  const { selectedAppKey, selectedAppName } = useAbacScope();

  const { data: gapsRes, isLoading, isError, error } = useQuery({
    queryKey: ['abac', 'coverageGaps', selectedAppKey],
    queryFn: () => abacService.getCoverageGaps(selectedAppKey),
    enabled: !!selectedAppKey,
  });

  const body = gapsRes?.data;
  const payload = body?.data ?? body;
  const gaps = Array.isArray(payload?.gaps) ? payload.gaps : [];
  const totalLogsScanned = payload?.totalLogsScanned ?? 0;
  const uniqueGaps = payload?.uniqueGaps ?? gaps.length;

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
              <th className="px-4 py-3 font-medium w-32">Occurrences</th>
              <th className="px-4 py-3 font-medium">Resolution</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-gray-500">
                  Scanning for gaps...
                </td>
              </tr>
            ) : gaps.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-12 text-center">
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
              gaps.map((gap, i) => (
                <tr key={`${gap.message}-${i}`} className="hover:bg-gray-50">
                  <td className="px-4 py-4 text-gray-900 align-top">
                    <span className="font-mono text-[11px] leading-snug text-gray-800">{gap.message}</span>
                  </td>
                  <td className="px-4 py-4 align-top text-gray-700 tabular-nums">{gap.occurrences}</td>
                  <td className="px-4 py-4 text-xs text-gray-500 align-top">
                    Define the missing attribute in <strong>App Attributes</strong> or ensure it exists in{' '}
                    <strong>Hub Attributes</strong>.
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
