import React from "react";

export const ThresholdResults = ({ diseaseInterpretation, clinicalThresholds }) => {
  if (!diseaseInterpretation || !clinicalThresholds) {
    return (
      <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg">
        <p className="text-slate-600 text-sm">No threshold interpretation available.</p>
      </div>
    );
  }

  const sc = diseaseInterpretation.sickle_cell_analysis;
  const la = diseaseInterpretation.leukemia_analysis;
  const summary = diseaseInterpretation.classification_summary || {};
  const adequacy = diseaseInterpretation.sample_adequacy;

  const percentBar = (value) => `${Math.max(0, Math.min(100, value || 0))}%`;

  return (
    <div className="space-y-6">
      {/* Sample Adequacy */}
      {adequacy && (
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
          <h4 className="font-semibold mb-2 text-slate-800">Sample Adequacy</h4>
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium text-slate-700">Confidence:</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
              adequacy.confidence_level === 'high' ? 'bg-green-100 text-green-800' :
              adequacy.confidence_level === 'moderate' ? 'bg-amber-100 text-amber-800' :
              adequacy.confidence_level === 'low' ? 'bg-amber-100 text-amber-800' :
              'bg-red-100 text-red-800'
            }`}>
              {adequacy.confidence_level?.toUpperCase()}
            </span>
            <span className="text-slate-600">
              Fields analyzed: {adequacy.fields_analyzed} / Recommended: {adequacy.recommended_fields}
            </span>
          </div>
          {(adequacy.warnings?.length > 0 || adequacy.recommendations?.length > 0) && (
            <div className="mt-3 grid md:grid-cols-2 gap-3 text-sm">
              {adequacy.warnings?.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded p-3">
                  <p className="font-semibold text-amber-800 mb-1">Warnings</p>
                  <ul className="list-disc pl-5 space-y-1 text-amber-800">
                    {adequacy.warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              )}
              {adequacy.recommendations?.length > 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded p-3">
                  <p className="font-semibold text-slate-700 mb-1">Recommendations</p>
                  <ul className="list-disc pl-5 space-y-1 text-slate-600">
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
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
          <h4 className="font-semibold mb-3 text-slate-800">Sickle Cell Analysis</h4>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <div className="flex justify-between text-sm text-slate-700 mb-1">
                <span>Percent sickled RBCs</span>
                <span className="font-mono">{sc.percentage}%</span>
              </div>
              <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-red-500" style={{ width: percentBar(sc.percentage) }} />
              </div>
              <div className="text-xs text-slate-600 mt-1">Severity: {sc.severity} ({sc.condition})</div>
              <div className="text-xs text-slate-600">Sickle cells: {sc.sickle_cell_count} / {sc.total_rbc_analyzed} RBCs</div>
            </div>
            <div className="flex flex-col justify-center">
              <div className="text-sm text-slate-700">Interpretation</div>
              <div className="text-base font-semibold text-slate-800">{sc.interpretation}</div>
              {sc.calculation_method && <div className="text-xs text-slate-600 mt-1">{sc.calculation_method}</div>}
            </div>
          </div>
        </div>
      )}

      {/* Classification Summary - Normal vs Disease */}
      {summary.total_wbc_analyzed > 0 && (
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
          <h4 className="font-semibold mb-3 text-slate-800">WBC Classification Summary</h4>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-green-50 rounded-lg p-3 border border-green-200 text-center">
              <p className="text-green-700 text-xs font-medium mb-1">Normal WBC</p>
              <p className="text-green-800 text-2xl font-bold">{summary.normal_wbc?.count || 0}</p>
              <p className="text-green-600 text-sm">{summary.normal_wbc?.percentage || 0}%</p>
            </div>
            <div className={`rounded-lg p-3 border text-center ${
              summary.disease_wbc?.count > 0 ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'
            }`}>
              <p className={`text-xs font-medium mb-1 ${
                summary.disease_wbc?.count > 0 ? 'text-red-700' : 'text-slate-600'
              }`}>Disease Cells</p>
              <p className={`text-2xl font-bold ${
                summary.disease_wbc?.count > 0 ? 'text-red-800' : 'text-slate-700'
              }`}>{summary.disease_wbc?.count || 0}</p>
              <p className={`text-sm ${
                summary.disease_wbc?.count > 0 ? 'text-red-600' : 'text-slate-500'
              }`}>{summary.disease_wbc?.percentage || 0}%</p>
            </div>
          </div>
          {/* Disease breakdown bars */}
          {summary.breakdown && Object.entries(summary.breakdown).some(([, v]) => v.count > 0) && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700">Disease Breakdown</p>
              {Object.entries(summary.breakdown).map(([name, info]) => (
                info.count > 0 && (
                  <div key={name}>
                    <div className="flex justify-between text-sm">
                      <div className="font-medium text-slate-700">{name}</div>
                      <div className="font-mono text-slate-700">{info.count} ({info.percentage}%)</div>
                    </div>
                    <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full bg-red-500" style={{ width: percentBar(info.percentage) }} />
                    </div>
                  </div>
                )
              ))}
            </div>
          )}
        </div>
      )}

      {/* Leukemia Analysis */}
      {la && (
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
          <h4 className="font-semibold mb-3 text-slate-800">Leukemia Analysis</h4>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <div className="flex justify-between text-sm text-slate-700 mb-1">
                <span>Disease WBCs</span>
                <span className="font-mono">{la.disease_wbc_percentage}%</span>
              </div>
              <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-amber-500" style={{ width: percentBar(la.disease_wbc_percentage) }} />
              </div>
              <div className="text-xs text-slate-600 mt-1">
                Normal: {la.normal_wbc_percentage}% | Disease: {la.disease_wbc_percentage}% | Total analyzed: {la.total_wbc_analyzed}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-slate-700">Findings</div>
              {(la.findings || []).length === 0 && (
                <div className="text-sm text-slate-600">No leukemia findings based on thresholds.</div>
              )}
              {(la.findings || []).map((f, i) => (
                <div key={i} className="text-sm text-slate-700">
                  <span className={`inline-block w-2 h-2 rounded-full mr-2 ${
                    f.severity === 'HIGH' ? 'bg-red-500' :
                    f.severity === 'MODERATE' ? 'bg-amber-500' :
                    f.severity === 'LOW' ? 'bg-yellow-500' : 'bg-green-500'
                  }`}></span>
                  <span className="font-medium">{f.type}:</span> {f.interpretation}
                  <span className="text-xs text-slate-500 ml-1">({f.count} cells, {f.percentage}%)</span>
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
