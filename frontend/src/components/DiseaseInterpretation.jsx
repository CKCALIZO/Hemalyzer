import React from "react";

/**
 * DiseaseInterpretation Component
 * Displays disease analysis results based on clinical thresholds
 * - AML/ALL (Acute Leukemia): Based on blast cell percentage
 * - CML: Based on granulocyte percentage (Basophil, Eosinophil, Neutrophil)
 * - CLL: Based on lymphocyte percentage
 * - Sickle Cell Anemia: Based on sickled RBC percentage
 */
export const DiseaseInterpretation = ({ diseaseInterpretation, clinicalThresholds }) => {
    if (!diseaseInterpretation) {
        return null;
    }

    const sickleCell = diseaseInterpretation.sickle_cell_analysis;
    const leukemia = diseaseInterpretation.leukemia_analysis;
    const overallAssessment = diseaseInterpretation.overall_assessment || [];

    // Helper to get severity color classes - professional medical design
    const getSeverityColor = (severity) => {
        switch (severity?.toUpperCase()) {
            case 'HIGH':
                return 'bg-rose-50 border-rose-500 text-rose-800';
            case 'MODERATE':
                return 'bg-amber-50 border-amber-500 text-amber-800';
            case 'LOW':
                return 'bg-stone-50 border-stone-300 text-stone-600';
            case 'INFO':
                return 'bg-zinc-50 border-zinc-300 text-zinc-700';
            case 'NORMAL':
            default:
                return 'bg-stone-50 border-stone-200 text-stone-700';
        }
    };

    const getSeverityIcon = (severity) => {
        switch (severity?.toUpperCase()) {
            case 'HIGH':
                return '⚠';
            case 'MODERATE':
                return '!!';
            case 'LOW':
                return '•';
            case 'INFO':
                return 'i';
            case 'NORMAL':
            default:
                return '✓';
        }
    };

    // Percentage bar component
    const PercentageBar = ({ percentage, thresholds, label }) => {
        const getBarColor = (pct) => {
            if (pct >= 50) return 'bg-rose-600';
            if (pct >= 20) return 'bg-zinc-950';
            return 'bg-zinc-300';
        };

        return (
            <div className="mt-4">
                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">
                    <span>{label}</span>
                    <span className="tabular-nums">{percentage}%</span>
                </div>
                <div className="w-full h-1.5 bg-stone-100 rounded-full overflow-hidden">
                    <div 
                        className={`h-full ${getBarColor(percentage)} transition-all duration-1000 ease-out`}
                        style={{ width: `${Math.min(100, percentage)}%` }}
                    />
                </div>
            </div>
        );
    };

    return (
        <div className="mt-12 space-y-6 animate-in fade-in duration-700">
            <h3 className="text-xl font-black text-zinc-950 uppercase tracking-tighter flex items-center gap-4 italic mb-8">
                Clinical Interpretation
                <div className="h-px flex-grow bg-stone-200"></div>
            </h3>

            {/* Overall Assessment Summary */}
            {overallAssessment.length > 0 && (
                <div className="bg-zinc-950 rounded-[35px] p-8 text-white shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-10">
                        <svg className="w-24 h-24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                    </div>
                    <h4 className="font-black text-[10px] uppercase tracking-[0.3em] text-rose-500 mb-6 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                        Executive Summary
                    </h4>
                    <div className="space-y-4">
                        {overallAssessment.map((item, idx) => (
                            <div 
                                key={idx} 
                                className={`p-6 rounded-[25px] border text-sm font-bold leading-relaxed transition-all hover:scale-[1.01] ${
                                    item.type === 'warning' 
                                        ? 'bg-rose-600/10 border-rose-500/30 text-rose-400'
                                        : item.type === 'finding'
                                        ? 'bg-white/5 border-white/10 text-white'
                                        : 'bg-white/5 border-white/10 text-zinc-400'
                                }`}
                            >
                                <span className="flex items-start gap-4">
                                    <span className="text-rose-500 mt-1">→</span>
                                    {item.message}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Leukemia Analysis Section */}
            {leukemia && leukemia.findings && leukemia.findings.length > 0 && (
                <div className="bg-stone-50 rounded-[40px] border border-stone-200 overflow-hidden shadow-sm">
                    <div className="bg-white px-8 py-6 border-b border-stone-200 flex items-center justify-between">
                        <h4 className="font-black text-xs uppercase tracking-[0.2em] text-zinc-950 italic">Hematological Morphology Review</h4>
                        <span className="px-3 py-1 bg-stone-100 text-stone-400 rounded-full text-[8px] font-black uppercase tracking-widest">WBC Focused</span>
                    </div>
                    <div className="p-8 space-y-6">
                        {leukemia.findings.map((finding, idx) => (
                            <div 
                                key={idx} 
                                className={`rounded-[30px] p-8 border-2 transition-all hover:shadow-lg ${getSeverityColor(finding.severity)}`}
                            >
                                <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-4">
                                            <span className="px-4 py-1.5 bg-zinc-950 text-white rounded-full text-[9px] font-black uppercase tracking-widest">
                                                {finding.type}
                                            </span>
                                            {finding.severity === 'HIGH' && (
                                                <span className="animate-pulse px-3 py-1 bg-rose-600 text-white rounded-full text-[8px] font-black uppercase tracking-widest leading-none">
                                                    CRITICAL FINDING
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xl font-black text-zinc-900 tracking-tight leading-7 mb-2 uppercase italic">{finding.condition}</p>
                                        <p className="text-sm font-bold opacity-70 leading-relaxed max-w-xl">{finding.interpretation}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-black opacity-30 uppercase tracking-[0.2em] mb-1 text-current">Detected Load</p>
                                        <span className="text-5xl font-black tabular-nums tracking-tighter italic">{finding.percentage}<span className="text-xl not-italic ml-1">%</span></span>
                                    </div>
                                </div>

                                {/* Breakdown for CML */}
                                {finding.type === 'CML Analysis' && finding.breakdown && (
                                    <div className="mt-3 pt-3 border-t border-current/20">
                                        <p className="text-xs font-semibold mb-1">Granulocyte Breakdown:</p>
                                        <div className="grid grid-cols-4 gap-2 text-xs">
                                            {Object.entries(finding.breakdown).map(([cell, count]) => (
                                                <div key={cell} className="text-center">
                                                    <div className="font-mono font-semibold">{count}</div>
                                                    <div className="opacity-70">{cell.replace('_', ' ')}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Breakdown for AML/ALL */}
                                {(finding.all_count !== undefined || finding.aml_count !== undefined) && (
                                    <div className="mt-3 pt-3 border-t border-current/20">
                                        <p className="text-xs font-semibold mb-1">Blast Cell Breakdown:</p>
                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                            <div className="text-center">
                                                <div className="font-mono font-semibold">{finding.all_count || 0}</div>
                                                <div className="opacity-70">ALL Blasts</div>
                                            </div>
                                            <div className="text-center">
                                                <div className="font-mono font-semibold">{finding.aml_count || 0}</div>
                                                <div className="opacity-70">AML Blasts</div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}

                        {/* Disease Percentages Summary */}
                        {leukemia.disease_percentages && (
                            <div className="bg-slate-50 rounded-lg p-3">
                                <p className="text-sm font-semibold text-slate-700 mb-2">Cell Type Distribution</p>
                                <div className="space-y-2">
                                    <PercentageBar 
                                        percentage={leukemia.disease_percentages.blast_cells?.percentage || 0}
                                        label={`Blast Cells (AML/ALL): ${leukemia.disease_percentages.blast_cells?.count || 0} cells`}
                                    />
                                    <PercentageBar 
                                        percentage={leukemia.disease_percentages.granulocytes?.percentage || 0}
                                        label={`Granulocytes (CML): ${leukemia.disease_percentages.granulocytes?.count || 0} cells`}
                                    />
                                    <PercentageBar 
                                        percentage={leukemia.disease_percentages.lymphocytes?.percentage || 0}
                                        label={`Lymphocytes (CLL): ${leukemia.disease_percentages.lymphocytes?.count || 0} cells`}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* No Leukemia Findings - Show Normal */}
            {leukemia && (!leukemia.findings || leukemia.findings.length === 0) && leukemia.total_wbc_analyzed > 0 && (
                <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                    <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center text-sm">✓</span>
                        <div>
                            <p className="font-semibold text-green-800">No Leukemia Patterns Detected</p>
                            <p className="text-sm text-green-600">
                                Based on analysis of {leukemia.total_wbc_analyzed} WBCs, no significant abnormalities found.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Sickle Cell Analysis Section */}
            {sickleCell && (
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                    <div className="bg-slate-700 text-white px-4 py-2">
                        <h4 className="font-semibold text-sm">Sickle Cell Anemia (SCA) Analysis</h4>
                    </div>
                    <div className="p-4">
                        <div className={`rounded-lg p-4 border-l-4 ${getSeverityColor(sickleCell.severity)}`}>
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="w-5 h-5 rounded-full bg-current/10 flex items-center justify-center text-xs font-bold">
                                            {getSeverityIcon(sickleCell.severity)}
                                        </span>
                                        <span className="font-bold">{sickleCell.interpretation}</span>
                                    </div>
                                    <div className="text-sm mt-2 space-y-1">
                                        <p>
                                            <span className="text-slate-600">Sickle Cells:</span>{' '}
                                            <span className="font-mono font-semibold">
                                                {sickleCell.sickle_cell_count} / {sickleCell.total_rbc_analyzed} RBCs
                                            </span>
                                        </p>
                                        <p>
                                            <span className="text-slate-600">Threshold Range:</span>{' '}
                                            <span className="font-mono">{sickleCell.condition}</span>
                                        </p>
                                        <p>
                                            <span className="text-slate-600">95% CI:</span>{' '}
                                            <span className="font-mono">{sickleCell.confidence_interval}</span>
                                        </p>
                                    </div>
                                    {sickleCell.note && (
                                        <p className="text-xs text-slate-500 mt-2 italic">{sickleCell.note}</p>
                                    )}
                                </div>
                                <div className="text-right">
                                    <span className="text-2xl font-bold">{sickleCell.percentage}%</span>
                                    <p className="text-xs text-slate-500">Sickled RBCs</p>
                                </div>
                            </div>

                            {/* Percentage Bar */}
                            <div className="mt-4">
                                <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                                    <div 
                                        className={`h-full transition-all duration-300 ${
                                            sickleCell.severity === 'HIGH' ? 'bg-red-500' :
                                            sickleCell.severity === 'MODERATE' ? 'bg-amber-500' :
                                            sickleCell.severity === 'LOW' ? 'bg-yellow-500' :
                                            sickleCell.severity === 'INFO' ? 'bg-slate-500' :
                                            'bg-green-500'
                                        }`}
                                        style={{ width: `${Math.min(100, sickleCell.percentage * 50)}%` }}
                                    />
                                </div>
                                <div className="flex justify-between text-xs text-slate-500 mt-1">
                                    <span>0%</span>
                                    <span>0.3% (Normal)</span>
                                    <span>1.0% (Trait)</span>
                                    <span>1.6%+ (Severe)</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Reference Note */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm">
                <p className="font-semibold text-slate-700">Clinical Disclaimer</p>
                <p className="text-slate-600 text-xs mt-1">
                    This analysis is based on automated cell classification and threshold comparisons.
                    Results should be verified by a qualified hematologist. Additional diagnostic tests
                    (bone marrow biopsy, genetic testing, flow cytometry) may be required for confirmation.
                </p>
            </div>
        </div>
    );
};

export default DiseaseInterpretation;
