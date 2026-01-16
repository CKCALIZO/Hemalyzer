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

    // Helper to get severity color classes
    const getSeverityColor = (severity) => {
        switch (severity?.toUpperCase()) {
            case 'HIGH':
                return 'bg-red-100 border-red-500 text-red-800';
            case 'MODERATE':
                return 'bg-orange-100 border-orange-500 text-orange-800';
            case 'LOW':
                return 'bg-yellow-100 border-yellow-500 text-yellow-800';
            case 'INFO':
                return 'bg-blue-100 border-blue-500 text-blue-800';
            case 'NORMAL':
            default:
                return 'bg-green-100 border-green-500 text-green-800';
        }
    };

    const getSeverityIcon = (severity) => {
        switch (severity?.toUpperCase()) {
            case 'HIGH':
                return '🔴';
            case 'MODERATE':
                return '🟠';
            case 'LOW':
                return '🟡';
            case 'INFO':
                return '🔵';
            case 'NORMAL':
            default:
                return '🟢';
        }
    };

    // Percentage bar component
    const PercentageBar = ({ percentage, thresholds, label }) => {
        const getBarColor = (pct) => {
            if (pct >= 80) return 'bg-red-500';
            if (pct >= 60) return 'bg-orange-500';
            if (pct >= 40) return 'bg-yellow-500';
            if (pct >= 20) return 'bg-blue-500';
            return 'bg-green-500';
        };

        return (
            <div className="mt-2">
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                    <span>{label}</span>
                    <span className="font-mono font-semibold">{percentage}%</span>
                </div>
                <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                        className={`h-full ${getBarColor(percentage)} transition-all duration-300`}
                        style={{ width: `${Math.min(100, percentage)}%` }}
                    />
                </div>
            </div>
        );
    };

    return (
        <div className="mt-6 space-y-4">
            <h3 className="text-xl font-bold text-[#a02038] flex items-center gap-2">
                🩺 Disease Interpretation
            </h3>

            {/* Overall Assessment Summary */}
            {overallAssessment.length > 0 && (
                <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-4 border-l-4 border-[#cb2a49]">
                    <h4 className="font-semibold text-gray-800 mb-3">Overall Assessment</h4>
                    <div className="space-y-2">
                        {overallAssessment.map((item, idx) => (
                            <div 
                                key={idx} 
                                className={`p-2 rounded border-l-4 ${
                                    item.type === 'warning' 
                                        ? 'bg-yellow-50 border-yellow-400 text-yellow-800'
                                        : item.type === 'finding'
                                        ? getSeverityColor(item.severity)
                                        : 'bg-blue-50 border-blue-400 text-blue-800'
                                }`}
                            >
                                <span className="text-sm">{item.message}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Leukemia Analysis Section */}
            {leukemia && leukemia.findings && leukemia.findings.length > 0 && (
                <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-[#cb2a49] to-[#a02038] text-white px-4 py-2">
                        <h4 className="font-semibold">Leukemia Analysis</h4>
                    </div>
                    <div className="p-4 space-y-4">
                        {leukemia.findings.map((finding, idx) => (
                            <div 
                                key={idx} 
                                className={`rounded-lg p-4 border-l-4 ${getSeverityColor(finding.severity)}`}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-lg">{getSeverityIcon(finding.severity)}</span>
                                            <span className="font-bold text-lg">{finding.type}</span>
                                        </div>
                                        <p className="text-sm mb-2">{finding.interpretation}</p>
                                        <div className="text-xs opacity-80">
                                            <span className="font-mono">Condition: {finding.condition}</span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-2xl font-bold">{finding.percentage}%</span>
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
                            <div className="bg-gray-50 rounded-lg p-3">
                                <p className="text-sm font-semibold text-gray-700 mb-2">Cell Type Distribution</p>
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
                        <span className="text-2xl">🟢</span>
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
                <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-red-600 to-red-800 text-white px-4 py-2">
                        <h4 className="font-semibold">Sickle Cell Anemia (SCA) Analysis</h4>
                    </div>
                    <div className="p-4">
                        <div className={`rounded-lg p-4 border-l-4 ${getSeverityColor(sickleCell.severity)}`}>
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-lg">{getSeverityIcon(sickleCell.severity)}</span>
                                        <span className="font-bold">{sickleCell.interpretation}</span>
                                    </div>
                                    <div className="text-sm mt-2 space-y-1">
                                        <p>
                                            <span className="text-gray-600">Sickle Cells:</span>{' '}
                                            <span className="font-mono font-semibold">
                                                {sickleCell.sickle_cell_count} / {sickleCell.total_rbc_analyzed} RBCs
                                            </span>
                                        </p>
                                        <p>
                                            <span className="text-gray-600">Threshold Range:</span>{' '}
                                            <span className="font-mono">{sickleCell.condition}</span>
                                        </p>
                                        <p>
                                            <span className="text-gray-600">95% CI:</span>{' '}
                                            <span className="font-mono">{sickleCell.confidence_interval}</span>
                                        </p>
                                    </div>
                                    {sickleCell.note && (
                                        <p className="text-xs text-gray-500 mt-2 italic">{sickleCell.note}</p>
                                    )}
                                </div>
                                <div className="text-right">
                                    <span className="text-3xl font-bold">{sickleCell.percentage}%</span>
                                    <p className="text-xs text-gray-500">Sickled RBCs</p>
                                </div>
                            </div>

                            {/* Percentage Bar */}
                            <div className="mt-4">
                                <div className="w-full h-4 bg-gray-200 rounded-full overflow-hidden">
                                    <div 
                                        className={`h-full transition-all duration-300 ${
                                            sickleCell.severity === 'HIGH' ? 'bg-red-500' :
                                            sickleCell.severity === 'MODERATE' ? 'bg-orange-500' :
                                            sickleCell.severity === 'LOW' ? 'bg-yellow-500' :
                                            sickleCell.severity === 'INFO' ? 'bg-blue-500' :
                                            'bg-green-500'
                                        }`}
                                        style={{ width: `${Math.min(100, sickleCell.percentage * 50)}%` }}
                                    />
                                </div>
                                <div className="flex justify-between text-xs text-gray-500 mt-1">
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
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm">
                <p className="font-semibold text-yellow-800">⚠️ Clinical Disclaimer</p>
                <p className="text-yellow-700 text-xs mt-1">
                    This analysis is based on automated cell classification and threshold comparisons.
                    Results should be verified by a qualified hematologist. Additional diagnostic tests
                    (bone marrow biopsy, genetic testing, flow cytometry) may be required for confirmation.
                </p>
            </div>
        </div>
    );
};

export default DiseaseInterpretation;
