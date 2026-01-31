import React from 'react';

export const AnalysisResults = ({
    currentResults,
    loading,
    showCurrentResults,
    toggleResults,
    onViewClassifications,
    previewUrl
}) => {
    return (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between flex-shrink-0">
                <div>
                    <h2 className="text-lg font-semibold text-slate-800">
                        Current Image Results
                    </h2>
                    <p className="text-sm text-slate-600 mt-1">
                        Analysis of the most recently uploaded image
                    </p>
                </div>
                {currentResults && (
                    <button
                        onClick={toggleResults}
                        className="text-sm text-rose-600 hover:text-rose-800"
                    >
                        {showCurrentResults ? 'Hide' : 'Show'}
                    </button>
                )}
            </div>

            <div className="p-6 overflow-y-auto flex-1">
                {!currentResults && !loading && (
                    <div className="text-center py-8">
                        <svg className="w-16 h-16 mx-auto text-rose-200 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <p className="text-rose-400">
                            Upload an image and click "Analyze" to see results
                        </p>
                    </div>
                )}

                {currentResults && showCurrentResults && (
                    <div className="space-y-4">
                        {/* View Cell Classifications Button */}
                        {currentResults.cropped_cells && currentResults.cropped_cells.length > 0 && (
                            <button
                                onClick={onViewClassifications}
                                className="w-full px-4 py-3 bg-rose-50 text-rose-600 rounded-lg 
                                        hover:bg-rose-100 font-medium flex items-center justify-center gap-2 
                                        border border-rose-200 transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                                View Cell Classifications ({currentResults.cropped_cells.length} cells)
                            </button>
                        )}

                        {/* Annotated Image */}
                        {currentResults.annotated_image && (
                            <div className="rounded-lg overflow-hidden border border-slate-200">
                                <img
                                    src={`data:image/jpeg;base64,${currentResults.annotated_image}`}
                                    alt="Annotated"
                                    className="w-full"
                                />
                            </div>
                        )}

                        {/* Detection Summary */}
                        <div className="bg-slate-50 p-4 rounded-lg">
                            <h3 className="font-semibold text-slate-700 mb-3">Detection Summary</h3>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-slate-600">Total Cells:</span>
                                    <span className="font-semibold">{currentResults.stage1_detection?.total || 0}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-600">RBC:</span>
                                    <span className="font-semibold text-red-600">{currentResults.stage1_detection?.counts?.RBC || 0}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-600">WBC:</span>
                                    <span className="font-semibold">{currentResults.stage1_detection?.counts?.WBC || 0}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-600">Platelets:</span>
                                    <span className="font-semibold text-amber-600">{currentResults.stage1_detection?.counts?.Platelets || 0}</span>
                                </div>
                            </div>
                        </div>

                        {/* Abnormal Cells Alert */}
                        {currentResults.summary && (currentResults.summary.abnormal_wbc_count > 0 || currentResults.summary.sickle_cell_count > 0) && (
                            <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg">
                                <p className="font-semibold text-amber-800 flex items-center gap-2">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                    Abnormal Cells Detected
                                </p>
                                <div className="mt-2 text-sm text-amber-700 space-y-1">
                                    {currentResults.summary.abnormal_wbc_count > 0 && (
                                        <p>• {currentResults.summary.abnormal_wbc_count} abnormal WBC(s) found</p>
                                    )}
                                    {currentResults.summary.sickle_cell_count > 0 && (
                                        <p>• {currentResults.summary.sickle_cell_count} Sickle Cell(s) detected</p>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Clinical Note */}
                        <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg text-sm">
                            <p className="font-semibold text-slate-700">Note:</p>
                            <p className="text-xs mt-1 text-slate-600">
                                Continue uploading images until 10 images are analyzed for
                                a reliable differential count and disease assessment.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
