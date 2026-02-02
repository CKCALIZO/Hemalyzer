import React from 'react';

export const UploadSection = ({
    processedImages,
    targetImageCount,
    previewUrl,
    selectedFile,
    loading,
    thresholdMet,
    handleFileChange,
    handleBulkFileChange,
    bulkFiles,
    setBulkFiles,
    setError,
    handleBulkUpload,
    isBulkProcessing,
    bulkProgress,
    analysisProgress,
    handleAnalyze,
    error,
    aggregatedCounts,
    handleReset
}) => {
    const remainingImages = Math.max(0, targetImageCount - processedImages.length);
    const progress = Math.min(100, (processedImages.length / targetImageCount) * 100);

    return (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm h-fit">
            <div className="px-6 py-4 border-b border-rose-200 bg-rose-50">
                <h2 className="text-lg font-semibold text-rose-800">
                    Upload Blood Smear Image
                </h2>
                <p className="text-sm text-rose-600 mt-1">
                    {processedImages.length} / {targetImageCount} images analyzed
                </p>
            </div>

            <div className="p-6">
                {/* Progress Indicator */}
                <div className="mb-6 bg-rose-50 rounded-lg p-4 border border-rose-100">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-rose-700">Analysis Progress</span>
                        <span className="text-sm text-rose-600">
                            {processedImages.length} / {targetImageCount} Images
                        </span>
                    </div>
                    <div className="w-full h-3 bg-rose-200 rounded-full overflow-hidden">
                        <div
                            className={`h-full transition-all duration-700 ease-[cubic-bezier(0.4,0,0.2,1)] ${thresholdMet ? 'bg-gradient-to-r from-emerald-400 to-emerald-600' : 'bg-gradient-to-r from-rose-400 to-rose-600'}`}
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    {remainingImages > 0 ? (
                        <p className="text-xs text-rose-600 mt-2">
                            Need {remainingImages} more image{remainingImages > 1 ? 's' : ''} for reliable differential
                        </p>
                    ) : (
                        <p className="text-xs text-emerald-600 mt-2 font-medium">
                            ✓ Analysis complete! View final results above.
                        </p>
                    )}
                </div>

                {/* Threshold Met Banner */}
                {thresholdMet && (
                    <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                        <div className="flex items-center gap-2 text-emerald-700">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="font-semibold">10 Images Analyzed Successfully!</span>
                        </div>
                        <p className="text-sm text-emerald-600 mt-1">
                            Final results are now available. Click "Reset Analysis Session" to start a new analysis.
                        </p>
                    </div>
                )}

                {/* Image Preview - Only show when not threshold met and no error */}
                {previewUrl && !thresholdMet && !error && (
                    <div className="mb-4 rounded-lg overflow-hidden border border-slate-200">
                        <img
                            src={previewUrl}
                            alt="Preview"
                            className="w-full h-64 object-contain bg-slate-50"
                        />
                    </div>
                )}

                {/* Early Error Display - Show immediately after file selection fails */}
                {error && !loading && (
                    <div className="mb-4 p-4 bg-red-50 border border-red-300 rounded-lg">
                        <div className="flex items-start gap-2">
                            <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div>
                                <p className="font-semibold text-red-700 text-sm">Image Validation Failed</p>
                                <p className="text-sm text-red-600 whitespace-pre-wrap mt-1">{error}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Upload Controls - Fade when threshold met */}
                <div className={`transition-opacity duration-300 ${thresholdMet ? 'opacity-40 pointer-events-none' : ''}`}>
                    {/* Supported File Types Notice */}
                    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2">
                        <svg className="w-5 h-5 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-sm text-blue-800">
                            <strong>Supported file types:</strong> JPG and PNG only
                        </p>
                    </div>
                    
                    {/* Single File Input */}
                    <input
                        type="file"
                        accept=".jpg,.jpeg,.png"
                        onChange={handleFileChange}
                        className="block w-full text-sm text-slate-500
                        file:mr-4 file:py-2 file:px-4
                        file:rounded-full file:border-0
                        file:text-sm file:font-semibold
                        file:bg-rose-50 file:text-rose-700
                        hover:file:bg-rose-100
                        disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={loading || thresholdMet}
                    />

                    {/* Divider */}
                    <div className="relative my-6">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-slate-200"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="bg-white px-3 text-slate-500 font-medium">OR</span>
                    </div>
                </div>

                {/* Bulk Upload Section */}
                <div className="mb-4 p-4 bg-gradient-to-r from-rose-50 to-pink-50 rounded-lg border border-rose-200">
                    <label className="block text-sm font-medium text-rose-900 mb-2">
                        Bulk Upload (up to {targetImageCount - processedImages.length} images) - JPG/PNG only
                    </label>
                    <input
                        className="block w-full text-sm text-rose-700 border border-rose-300 
                        rounded-lg cursor-pointer bg-white focus:outline-none focus:ring-2 
                        focus:ring-rose-400 p-2 mb-3"
                        id="bulk-upload"
                        type="file"
                        accept=".jpg,.jpeg,.png"
                        multiple
                        onChange={handleBulkFileChange}
                        disabled={loading || thresholdMet || isBulkProcessing}
                    />

                    {/* Selected files preview */}
                    {bulkFiles.length > 0 && (
                        <div className="mb-3 p-3 bg-white rounded-lg border border-rose-200">
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-sm font-medium text-rose-800">
                                    ✓ {bulkFiles.length} image{bulkFiles.length > 1 ? 's' : ''} selected:
                                </p>
                                <button
                                    onClick={() => {
                                        setBulkFiles([]);
                                        setError(null);
                                        const bulkInput = document.getElementById('bulk-upload');
                                        if (bulkInput) bulkInput.value = '';
                                    }}
                                    disabled={isBulkProcessing}
                                    className="text-xs px-2 py-1 bg-rose-100 text-rose-700 hover:bg-rose-200 rounded transition-colors disabled:opacity-50"
                                >
                                    Clear
                                </button>
                            </div>
                            <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                                {bulkFiles.map((file, idx) => (
                                    <span key={idx} className="text-xs bg-rose-100 text-rose-700 px-2 py-1 rounded">
                                        {file.name.length > 15 ? file.name.slice(0, 12) + '...' : file.name}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Insufficient images memo */}
                    {bulkFiles.length > 0 && bulkFiles.length < (targetImageCount - processedImages.length) && !isBulkProcessing && (
                        <div className="mb-3 p-3 bg-amber-50 rounded-lg border border-amber-300 flex items-start gap-2">
                            <span className="text-amber-600 font-bold">Note:</span>
                            <div>
                                <p className="text-sm font-medium text-amber-800">
                                    {bulkFiles.length} of {targetImageCount - processedImages.length} images selected
                                </p>
                                <p className="text-xs text-amber-700 mt-1">
                                    You can still process these, but for accurate results please upload {targetImageCount - processedImages.length} images total.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Bulk Progress Display */}
                    {isBulkProcessing && (
                        <div className="mb-3 p-3 bg-rose-100 rounded-lg border border-rose-300">
                            <p className="text-sm font-semibold text-rose-800">
                                Processed: {bulkProgress.current} / {bulkProgress.total} images
                            </p>
                            <div className="w-full h-2 bg-rose-200 rounded-full mt-2 overflow-hidden">
                                <div
                                    className="h-full bg-rose-600 transition-all duration-300"
                                    style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Process Bulk Button */}
                    <button
                        onClick={handleBulkUpload}
                        disabled={bulkFiles.length === 0 || loading || thresholdMet || isBulkProcessing}
                        className={`w-full flex items-center justify-center gap-2 text-white 
                        bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 
                        transition-all font-semibold rounded-lg text-sm px-4 py-2.5
                        ${(bulkFiles.length === 0 || loading || thresholdMet || isBulkProcessing) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer shadow-md hover:shadow-lg'}`}
                    >
                        {isBulkProcessing ? (
                            <>
                                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Processed {bulkProgress.current}/{bulkProgress.total}...
                            </>
                        ) : (
                            <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                </svg>
                                Process {bulkFiles.length > 0 ? bulkFiles.length : ''} Images at Once
                            </>
                        )}
                    </button>
                </div>


                {/* Analysis Progress Bar - Shows during image processing AND for 2s after completion */}
                {analysisProgress.stage && (
                    <div className={`mb-4 p-4 rounded-lg border ${analysisProgress.stage === 'Complete'
                        ? 'bg-emerald-50 border-emerald-300'
                        : 'bg-rose-50 border-rose-300'
                        }`}>
                        <div className="flex justify-between items-center mb-2">
                            <span className={`text-sm font-medium ${analysisProgress.stage === 'Complete'
                                ? 'text-emerald-800'
                                : 'text-rose-800'
                                }`}>
                                {analysisProgress.message}
                            </span>
                            <span className={`text-sm font-semibold ${analysisProgress.stage === 'Complete'
                                ? 'text-emerald-600'
                                : 'text-rose-600'
                                }`}>
                                {analysisProgress.percentage}%
                            </span>
                        </div>
                        <div className={`w-full h-2.5 rounded-full overflow-hidden ${analysisProgress.stage === 'Complete'
                            ? 'bg-emerald-200'
                            : 'bg-rose-200'
                            }`}>
                            <div
                                className={`h-full transition-all duration-700 ease-[cubic-bezier(0.4,0,0.2,1)] ${analysisProgress.stage === 'Complete'
                                    ? 'bg-emerald-500'
                                    : 'bg-gradient-to-r from-rose-400 to-rose-600'
                                    }`}
                                style={{ width: `${analysisProgress.percentage}%` }}
                            />
                        </div>
                        {/* Only show step indicators for single image processing, not bulk */}
                        {analysisProgress.stage !== 'bulk' && (
                            <div className={`mt-3 flex items-center justify-between text-xs ${analysisProgress.stage === 'Complete'
                                ? 'text-emerald-700'
                                : 'text-rose-700'
                                }`}>
                                <div className={`flex items-center gap-1 transition-all duration-300 ${analysisProgress.percentage >= 10 ? 'font-semibold scale-105' : 'opacity-50'
                                    }`}>
                                    <span className={`transition-colors duration-300 ${analysisProgress.percentage >= 10 ? 'text-emerald-500' : ''}`}>
                                        {analysisProgress.percentage >= 10 ? '✓' : '○'}
                                    </span>
                                    <span>Upload</span>
                                </div>
                                <div className={`flex items-center gap-1 transition-all duration-300 ${analysisProgress.percentage >= 30 ? 'font-semibold scale-105' : 'opacity-50'
                                    }`}>
                                    <span className={`transition-colors duration-300 ${analysisProgress.percentage >= 30 ? 'text-emerald-500' : ''}`}>
                                        {analysisProgress.percentage >= 30 ? '✓' : '○'}
                                    </span>
                                    <span>Detection</span>
                                </div>
                                <div className={`flex items-center gap-1 transition-all duration-300 ${analysisProgress.percentage >= 60 ? 'font-semibold scale-105' : 'opacity-50'
                                    }`}>
                                    <span className={`transition-colors duration-300 ${analysisProgress.percentage >= 60 ? 'text-emerald-500' : ''}`}>
                                        {analysisProgress.percentage >= 60 ? '✓' : '○'}
                                    </span>
                                    <span>Classification</span>
                                </div>
                                <div className={`flex items-center gap-1 transition-all duration-300 ${analysisProgress.percentage >= 85 ? 'font-semibold scale-105' : 'opacity-50'
                                    }`}>
                                    <span className={`transition-colors duration-300 ${analysisProgress.percentage >= 85 ? 'text-emerald-500' : ''}`}>
                                        {analysisProgress.percentage >= 85 ? '✓' : '○'}
                                    </span>
                                    <span>Analysis</span>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Analyze Button */}
                <button
                    onClick={handleAnalyze}
                    disabled={!selectedFile || loading || thresholdMet}
                    className={`w-full flex items-center justify-center gap-2 text-white 
                    bg-rose-600 hover:bg-rose-500 transition-colors font-semibold 
                    rounded-lg text-base px-6 py-3
                    ${(!selectedFile || loading || thresholdMet) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                    {loading ? (
                        <>
                            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Analyzing...
                        </>
                    ) : (
                        <>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            {thresholdMet ? 'Analysis Complete' : 'Analyze Image'}
                        </>
                    )}
                </button>
                </div>
                {/* End of Upload Controls wrapper */}

                {/* Aggregated Stats */}
                {processedImages.length > 0 && (
                    <div className="mt-6 pt-6 border-t border-slate-200">
                        <h3 className="text-sm font-semibold text-rose-700 mb-3">
                            Session Totals ({processedImages.length} images)
                        </h3>
                        <div className="grid grid-cols-3 gap-3">
                            <div className="bg-rose-50 rounded-lg p-3 text-center border border-rose-100">
                                <p className="text-xl font-bold text-rose-700">{aggregatedCounts.wbc}</p>
                                <p className="text-xs text-rose-600">WBC</p>
                            </div>
                            <div className="bg-rose-50 rounded-lg p-3 text-center border border-rose-100">
                                <p className="text-xl font-bold text-rose-600">{aggregatedCounts.rbc}</p>
                                <p className="text-xs text-rose-600">RBC</p>
                            </div>
                            <div className="bg-rose-50 rounded-lg p-3 text-center border border-rose-100">
                                <p className="text-xl font-bold text-rose-500">{aggregatedCounts.platelets}</p>
                                <p className="text-xs text-rose-600">Platelets</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Reset Button */}
                {processedImages.length > 0 && (
                    <button
                        onClick={handleReset}
                        className="w-full mt-4 px-4 py-2 bg-white border border-slate-300 text-slate-600 
                        rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium"
                    >
                        Reset Analysis Session
                    </button>
                )}
            </div>
        </div>
    );
};
