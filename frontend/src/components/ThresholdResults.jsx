import React from "react";

export const ThresholdResults = ({ diseaseInterpretation, clinicalThresholds }) => {
  if (!diseaseInterpretation || !clinicalThresholds) {
    return (
      <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg">
        <p className="text-gray-600 text-sm">No threshold interpretation available.</p>
      </div>
    );
  }

  const sc = diseaseInterpretation.sickle_cell_analysis;
  const la = diseaseInterpretation.leukemia_analysis;
  const wbc = diseaseInterpretation.wbc_differential || {};
  const adequacy = diseaseInterpretation.sample_adequacy;

  const percentBar = (value) => `${Math.max(0, Math.min(100, value || 0))}%`;

  return (
    <div className="space-y-6">
      {/* Sample Adequacy */}
      {adequacy && (
        <div className="bg-white p-4 rounded-lg border">
          <h4 className="font-semibold mb-2">Sample Adequacy</h4>
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium">Confidence:</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
              adequacy.confidence_level === 'high' ? 'bg-green-100 text-green-800' :
              adequacy.confidence_level === 'moderate' ? 'bg-yellow-100 text-yellow-800' :
              adequacy.confidence_level === 'low' ? 'bg-orange-100 text-orange-800' :
              'bg-red-100 text-red-800'
            }`}>
              {adequacy.confidence_level?.toUpperCase()}
            </span>
            <span className="text-gray-600">
              Fields analyzed: {adequacy.fields_analyzed} / Recommended: {adequacy.recommended_fields}
            </span>
          </div>
          {(adequacy.warnings?.length > 0 || adequacy.recommendations?.length > 0) && (
            <div className="mt-3 grid md:grid-cols-2 gap-3 text-sm">
              {adequacy.warnings?.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                  <p className="font-semibold text-yellow-800 mb-1">Warnings</p>
                  <ul className="list-disc pl-5 space-y-1 text-yellow-800">
                    {adequacy.warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              )}
              {adequacy.recommendations?.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded p-3">
                  <p className="font-semibold text-blue-800 mb-1">Recommendations</p>
                  <ul className="list-disc pl-5 space-y-1 text-blue-800">
                    {adequacy.recommendations.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Sickle Cell Analysis */}
      {sc && (
        <div className="bg-white p-4 rounded-lg border">
          <h4 className="font-semibold mb-3">Sickle Cell Analysis</h4>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <div className="flex justify-between text-sm text-gray-700 mb-1">
                <span>Percent sickled RBCs</span>
                <span className="font-mono">{sc.percentage}%</span>
              </div>
              <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-red-500" style={{ width: percentBar(sc.percentage) }} />
              </div>
              <div className="text-xs text-gray-600 mt-1">95% CI: {sc.confidence_interval}</div>
              <div className="text-xs text-gray-600">Sickle cells: {sc.sickle_cell_count} / {sc.total_rbc_analyzed} RBCs</div>
            </div>
            <div className="flex flex-col justify-center">
              <div className="text-sm text-gray-700">Interpretation</div>
              <div className="text-base font-semibold">{sc.interpretation}</div>
              {sc.note && <div className="text-xs text-gray-600 mt-1">{sc.note}</div>}
            </div>
          </div>
        </div>
      )}

      {/* WBC Differential vs Normal Ranges */}
      {Object.keys(wbc).length > 0 && (
        <div className="bg-white p-4 rounded-lg border">
          <h4 className="font-semibold mb-3">WBC Differential (Observed vs Normal)</h4>
          <div className="space-y-3">
            {Object.entries(wbc).map(([name, info]) => (
              <div key={name}>
                <div className="flex justify-between text-sm">
                  <div className="font-medium">{name}</div>
                  <div className="font-mono text-gray-700">{info.percentage}%</div>
                </div>
                <div className="relative w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                  {/* Observed percentage */}
                  <div className={`absolute left-0 top-0 h-3 ${
                    info.normal_status === 'normal' ? 'bg-green-500' : 'bg-orange-500'
                  }`} style={{ width: percentBar(info.percentage) }} />
                  {/* Normal range overlay */}
                  {info.normal_range && (() => {
                    const [minStr, maxStr] = info.normal_range.split('%')[0].split('-');
                    const min = parseFloat(minStr);
                    const max = parseFloat(maxStr);
                    return (
                      <div className="absolute top-0 h-3 bg-green-300/40" style={{ left: percentBar(min), width: percentBar(max - min) }} />
                    );
                  })()}
                </div>
                <div className="text-xs text-gray-600 flex justify-between">
                  <span>95% CI: {info.confidence_interval}</span>
                  {info.normal_range && <span>Normal: {info.normal_range}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Leukemia Analysis */}
      {la && (
        <div className="bg-white p-4 rounded-lg border">
          <h4 className="font-semibold mb-3">Leukemia Analysis</h4>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <div className="flex justify-between text-sm text-gray-700 mb-1">
                <span>Abnormal WBCs</span>
                <span className="font-mono">{la.abnormal_wbc_percentage}%</span>
              </div>
              <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-orange-500" style={{ width: percentBar(la.abnormal_wbc_percentage) }} />
              </div>
              <div className="text-xs text-gray-600 mt-1">95% CI: {la.confidence_interval}</div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-gray-700">Findings</div>
              {(la.findings || []).length === 0 && (
                <div className="text-sm text-gray-600">No acute leukemia findings based on thresholds.</div>
              )}
              {(la.findings || []).map((f, i) => (
                <div key={i} className="text-sm">
                  <span className="font-medium">{f.type}:</span> {f.interpretation}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ThresholdResults;
