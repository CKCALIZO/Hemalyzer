import React from 'react';

export const ClassificationsModal = ({
    show,
    onClose,
    currentResults,
    isBulkProcessing
}) => {
    if (!show || !currentResults || !currentResults.cropped_cells) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[85vh] overflow-hidden" onClick={e => e.stopPropagation()}>
                {/* Modal Header */}
                <div className="bg-rose-700 text-white px-6 py-4 flex items-center justify-between">
                    <h2 className="text-lg font-bold">Cell Classifications ({currentResults.cropped_cells.length} cells)</h2>
                    <button
                        onClick={onClose}
                        className="text-white hover:bg-rose-600 rounded-full p-1 transition-colors"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Modal Body - Scrollable Grid */}
                <div className="p-4 overflow-y-auto max-h-[calc(85vh-120px)]">
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                        {currentResults.cropped_cells.map((cell, idx) => {
                            // Get classification from stage2_classification if available
                            const wbcClassification = currentResults.stage2_classification?.find(c => c.wbc_id === cell.wbc_id);
                            // Use cell.classification (from cropped_cells) or fallback to stage2 classification
                            const displayClassification = cell.classification || wbcClassification?.classification || wbcClassification?.predicted_class || 'Unknown';

                            // Determine color based on classification
                            const isAbnormal = displayClassification && !displayClassification.toLowerCase().includes('normal');
                            const borderColor = isAbnormal ? 'border-amber-400 bg-amber-50' : 'border-slate-200 bg-slate-50';

                            return (
                                <div key={cell.wbc_id || idx} className={`rounded-lg overflow-hidden border-2 ${borderColor}`}>
                                    {cell.cropped_image && (
                                        <div className="aspect-square">
                                            <img
                                                src={`data:image/png;base64,${cell.cropped_image}`}
                                                alt={`${cell.cell_type} - ${displayClassification}`}
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                    )}
                                    <div className="p-2">
                                        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                                            {cell.cell_type || 'WBC'}
                                        </p>
                                        <p className="text-xs font-medium text-slate-800 truncate" title={displayClassification}>
                                            {displayClassification}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Modal Footer */}
                <div className="border-t border-slate-200 px-6 py-3 bg-slate-50 flex justify-between items-center">
                    <p className="text-sm text-slate-600">
                        {isBulkProcessing ? 'Processing in progress...' : 'Processing complete'}
                    </p>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors font-medium"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};
