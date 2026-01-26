import React from "react";

export const ThresholdResults = ({ diseaseInterpretation, clinicalThresholds }) => {
  if (!diseaseInterpretation || !clinicalThresholds) {
    return (
      <div className="bg-stone-50 border border-stone-200 p-8 rounded-[32px] text-center">
        <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">No threshold interpretation available</p>
      </div>
    );
  }

  const sc = diseaseInterpretation.sickle_cell_analysis;
  const la = diseaseInterpretation.leukemia_analysis;
  const wbc = diseaseInterpretation.wbc_differential || {};
  const adequacy = diseaseInterpretation.sample_adequacy;

  const percentBar = (value) => `${Math.max(0, Math.min(100, value || 0))}%`;

  return (
    <div className="space-y-8">
      {/* Sample Adequacy */}
      {adequacy && (
        <div className="bg-white p-8 rounded-[32px] border border-stone-200 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Sample Adequacy</h4>
            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
              adequacy.confidence_level === 'high' ? 'bg-green-50 text-green-600' :
              adequacy.confidence_level === 'moderate' ? 'bg-amber-50 text-amber-600' :
              'bg-rose-50 text-rose-600'
            }`}>
              {adequacy.confidence_level} Confidence
            </span>
          </div>
          
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 h-2 bg-stone-100 rounded-full overflow-hidden">
                <div 
                    className="h-full bg-zinc-950 transition-all duration-500" 
                    style={{ width: `${(adequacy.fields_analyzed / adequacy.recommended_fields) * 100}%` }}
                />
            </div>
            <span className="text-[10px] font-black text-zinc-950 uppercase">{adequacy.fields_analyzed}/{adequacy.recommended_fields} Fields</span>
          </div>

          {(adequacy.warnings?.length > 0 || adequacy.recommendations?.length > 0) && (
            <div className="grid md:grid-cols-2 gap-6 pt-6 border-t border-stone-100">
              {adequacy.warnings?.length > 0 && (
                <div>
                  <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-3">Pathology Warnings</p>
                  <ul className="space-y-2">
                    {adequacy.warnings.map((w, i) => (
                        <li key={i} className="text-xs text-slate-500 flex items-start gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1 shrink-0"></span>
                            {w}
                        </li>
                    ))}
                  </ul>
                </div>
              )}
              {adequacy.recommendations?.length > 0 && (
                <div>
                  <p className="text-[10px] font-black text-zinc-950 uppercase tracking-widest mb-3">Clinical Recommendations</p>
                  <ul className="space-y-2">
                    {adequacy.recommendations.map((r, i) => (
                        <li key={i} className="text-xs text-slate-500 flex items-start gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 mt-1 shrink-0"></span>
                            {r}
                        </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Sickle Cell Analysis */}
      {sc && (
        <div className="bg-white p-8 rounded-[32px] border border-stone-200 shadow-sm">
          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-6">Morphological Distortion (Sickle Cell)</h4>
          <div className="grid md:grid-cols-12 gap-10">
            <div className="md:col-span-7">
              <div className="flex justify-between items-end mb-3">
                <span className="text-4xl font-black text-zinc-950 tracking-tighter">{sc.percentage}%</span>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sickled Indices</span>
              </div>
              <div className="w-full h-4 bg-stone-100 rounded-full overflow-hidden mb-4">
                <div className="h-full bg-rose-600 transition-all duration-700" style={{ width: percentBar(sc.percentage) }} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-stone-50 rounded-2xl">
                    <p className="text-[9px] font-black text-slate-400 uppercase">Count</p>
                    <p className="text-sm font-black text-zinc-950">{sc.sickle_cell_count} cells</p>
                </div>
                <div className="p-3 bg-stone-50 rounded-2xl">
                    <p className="text-[9px] font-black text-slate-400 uppercase">95% CI</p>
                    <p className="text-sm font-black text-zinc-950">{sc.confidence_interval}</p>
                </div>
              </div>
            </div>
            <div className="md:col-span-5 flex flex-col justify-center border-l border-stone-100 pl-10">
              <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-2">Interpretation</p>
              <div className="text-xl font-black text-zinc-950 tracking-tight leading-tight">{sc.interpretation}</div>
              {sc.note && <div className="text-xs text-slate-400 mt-3 font-medium">{sc.note}</div>}
            </div>
          </div>
        </div>
      )}

      {/* WBC Differential vs Normal Ranges */}
      {Object.keys(wbc).length > 0 && (
        <div className="bg-white p-8 rounded-[32px] border border-stone-200 shadow-sm">
          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-8">Clinical Differential (WBC)</h4>
          <div className="space-y-8">
            {Object.entries(wbc).map(([name, info]) => (
              <div key={name} className="relative">
                <div className="flex justify-between items-end mb-3">
                  <div className="flex items-center gap-3">
                    <span className="w-3 h-3 rounded-full bg-zinc-950"></span>
                    <span className="text-sm font-black text-zinc-950 uppercase tracking-tighter">{name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs font-bold text-slate-400 uppercase">Range: {info.normal_range}</span>
                    <span className={`text-sm font-black ${info.status === 'normal' ? 'text-zinc-400' : 'text-rose-600'}`}>{info.percentage}%</span>
                  </div>
                </div>
                <div className="relative w-full h-2.5 bg-stone-100 rounded-full overflow-hidden">
                  <div className={`absolute left-0 top-0 h-full transition-all duration-700 ${info.status === 'normal' ? 'bg-zinc-950' : 'bg-rose-600'}`} style={{ width: percentBar(info.percentage) }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
