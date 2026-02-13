import React from 'react';
import { getDisplayConfidence } from '../utils/confidenceAdjustment.js';

export const LowConfidenceWarning = ({
    show,
    onClose,
    lowConfidenceData
}) => {
    if (!show || !lowConfidenceData || !lowConfidenceData.has_low_confidence) return null;

    const {
        low_confidence_wbcs = [],
        low_confidence_rbcs = [],
        total_low_confidence_count = 0,
        warning_message = '',
        threshold = 0.70
    } = lowConfidenceData;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden" onClick={e => e.stopPropagation()}>
                {/* Modal Header - Warning Style */}
                <div className="bg-amber-700 text-white px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4v2m0 0v2m0-6v2m0-6v2M7 20h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v11a2 2 0 002 2z" />
                        </svg>
                        <h2 className="text-lg font-bold">Low Confidence Detection Warning</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-white hover:bg-amber-600 rounded-full p-1 transition-colors"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Modal Body - Scrollable */}
                <div className="p-6 overflow-y-auto max-h-[calc(85vh-160px)]">
                    {/* ISO 25010 Safety Notice */}
                    <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg mb-6">
                        <p className="text-sm text-amber-900">
                            <span className="font-semibold block mb-1">Model Confidence Alert</span>
                            {warning_message}
                        </p>
                    </div>

                    {/* Summary Stats */}
                    <div className="mb-6">
                        <h3 className="font-semibold text-slate-800 mb-3">Summary</h3>
                        <div className="grid grid-cols-3 gap-3 text-center">
                            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                                <div className="text-2xl font-bold text-amber-600">{total_low_confidence_count}</div>
                                <div className="text-xs text-slate-600 mt-1">Low Confidence Cells</div>
                            </div>
                            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                                <div className="text-2xl font-bold text-orange-600">{low_confidence_wbcs.length}</div>
                                <div className="text-xs text-slate-600 mt-1">Low Conf. WBCs</div>
                            </div>
                            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                                <div className="text-2xl font-bold text-orange-600">{low_confidence_rbcs.length}</div>
                                <div className="text-xs text-slate-600 mt-1">Low Conf. RBCs</div>
                            </div>
                        </div>
                        <div className="mt-3 text-sm text-slate-600">
                            <span className="font-semibold">Confidence Threshold:</span> {threshold * 100}%
                        </div>
                    </div>

                    {/* Low Confidence WBCs */}
                    {low_confidence_wbcs.length > 0 && (
                        <div className="mb-6">
                            <h4 className="font-semibold text-slate-800 mb-2 flex items-center gap-2">
                                <span className="bg-orange-100 text-orange-700 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                                    {low_confidence_wbcs.length}
                                </span>
                                WBCs with Low Confidence
                            </h4>
                            <div className="space-y-2">
                                {low_confidence_wbcs.map((wbc, idx) => (
                                    <div key={idx} className="bg-orange-50 border border-orange-200 p-3 rounded-lg text-sm">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="font-medium text-orange-900">WBC #{wbc.wbc_id}</p>
                                                <p className="text-orange-700">{wbc.classification}</p>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-lg font-bold text-orange-600">{getDisplayConfidence(wbc.confidence_percentage, wbc.classification)}%</div>
                                                <div className="text-xs text-orange-500">confidence</div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Low Confidence RBCs */}
                    {low_confidence_rbcs.length > 0 && (
                        <div className="mb-6">
                            <h4 className="font-semibold text-slate-800 mb-2 flex items-center gap-2">
                                <span className="bg-orange-100 text-orange-700 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                                    {low_confidence_rbcs.length}
                                </span>
                                RBCs with Low Confidence
                            </h4>
                            <div className="space-y-2">
                                {low_confidence_rbcs.map((rbc, idx) => (
                                    <div key={idx} className="bg-orange-50 border border-orange-200 p-3 rounded-lg text-sm">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="font-medium text-orange-900">RBC #{rbc.rbc_id}</p>
                                                <p className="text-orange-700">{rbc.classification}</p>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-lg font-bold text-orange-600">{getDisplayConfidence(rbc.confidence_percentage, rbc.classification)}%</div>
                                                <div className="text-xs text-orange-500">confidence</div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Safety Recommendations */}
                    <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                        <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Recommendations
                        </h4>
                        <ul className="space-y-1 text-sm text-blue-800">
                            <li>• Review these results with qualified medical personnel</li>
                            <li>• Consider additional analysis or manual verification</li>
                            <li>• Do not rely solely on this analysis for clinical diagnosis</li>
                            <li>• Low confidence may indicate image quality issues</li>
                            <li>• Ensure adequate image resolution and staining</li>
                        </ul>
                    </div>
                </div>

                {/* Modal Footer */}
                <div className="border-t border-slate-200 px-6 py-4 bg-slate-50 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors font-medium cursor-pointer"
                    >
                        Acknowledge
                    </button>
                </div>
            </div>
        </div>
    );
};
