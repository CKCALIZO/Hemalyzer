import React, { useState } from "react";

/**
 * ProcessedImagesThumbnails Component
 * Displays a clickable thumbnail bar of all processed images
 * Allows users to view individual image results
 */
export const ProcessedImagesThumbnails = ({ 
    processedImages, 
    onImageClick,
    currentWBCCount,
    targetWBCCount = 100
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null);

    if (!processedImages || processedImages.length === 0) {
        return null;
    }

    const progress = Math.min(100, (currentWBCCount / targetWBCCount) * 100);

    const handleImageClick = (image, index) => {
        setSelectedImage({ ...image, index });
        if (onImageClick) {
            onImageClick(image, index);
        }
    };

    const closeModal = () => {
        setSelectedImage(null);
    };

    return (
        <>
            {/* Thumbnail Bar */}
            <div className="bg-red-700 rounded-lg overflow-hidden mb-4">
                {/* Header with progress */}
                <div 
                    className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-red-800 transition-colors"
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                            <svg 
                                className={`w-4 h-4 text-white transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
                                fill="none" 
                                stroke="currentColor" 
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                            <span className="text-white font-medium text-sm">
                                Processed Images ({processedImages.length})
                            </span>
                        </div>
                        
                        {/* Mini thumbnails preview when collapsed */}
                        {!isExpanded && (
                            <div className="flex items-center gap-1 ml-2">
                                {processedImages.slice(0, 5).map((img, idx) => (
                                    <div 
                                        key={idx}
                                        className="w-8 h-8 rounded border-2 border-red-500 overflow-hidden"
                                    >
                                        <img 
                                            src={img.preview || `data:image/jpeg;base64,${img.annotated}`}
                                            alt={`Img ${idx + 1}`}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                ))}
                                {processedImages.length > 5 && (
                                    <span className="text-red-200 text-xs ml-1">+{processedImages.length - 5}</span>
                                )}
                            </div>
                        )}
                    </div>

                    {/* WBC Progress */}
                    <div className="flex items-center gap-3">
                        <div className="text-right">
                            <p className="text-xs text-red-200">WBC Count</p>
                            <p className={`text-sm font-bold ${currentWBCCount >= targetWBCCount ? 'text-green-300' : 'text-white'}`}>
                                {currentWBCCount} / {targetWBCCount}
                            </p>
                        </div>
                        <div className="w-24 h-2 bg-red-900 rounded-full overflow-hidden">
                            <div 
                                className={`h-full transition-all duration-500 ${
                                    currentWBCCount >= targetWBCCount ? 'bg-green-400' : 'bg-white'
                                }`}
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                        {currentWBCCount >= targetWBCCount && (
                            <span className="text-green-300 text-lg font-bold">OK</span>
                        )}
                    </div>
                </div>

                {/* Expanded thumbnail grid */}
                {isExpanded && (
                    <div className="px-4 pb-4 border-t border-red-600">
                        <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-2 mt-3">
                            {processedImages.map((img, idx) => (
                                <div 
                                    key={idx}
                                    className="relative group cursor-pointer"
                                    onClick={() => handleImageClick(img, idx)}
                                >
                                    <div className="aspect-square rounded-lg overflow-hidden border-2 border-red-500 hover:border-white transition-colors">
                                        <img 
                                            src={img.preview || `data:image/jpeg;base64,${img.annotated}`}
                                            alt={`Image ${idx + 1}`}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                    {/* Overlay with WBC count */}
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                                        <div className="text-center">
                                            <p className="text-white text-xs font-bold">{img.wbcCount || 0} WBC</p>
                                        </div>
                                    </div>
                                    {/* Image number badge */}
                                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-900 rounded-full flex items-center justify-center">
                                        <span className="text-white text-xs font-bold">{idx + 1}</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Summary stats */}
                        <div className="mt-4 pt-3 border-t border-red-600 grid grid-cols-4 gap-4 text-center">
                            <div>
                                <p className="text-red-200 text-xs">Total WBC</p>
                                <p className="text-white font-bold">{currentWBCCount}</p>
                            </div>
                            <div>
                                <p className="text-red-200 text-xs">Total RBC</p>
                                <p className="text-white font-bold">
                                    {processedImages.reduce((sum, img) => sum + (img.rbcCount || 0), 0)}
                                </p>
                            </div>
                            <div>
                                <p className="text-red-200 text-xs">Platelets</p>
                                <p className="text-white font-bold">
                                    {processedImages.reduce((sum, img) => sum + (img.plateletCount || 0), 0)}
                                </p>
                            </div>
                            <div>
                                <p className="text-red-200 text-xs">Progress</p>
                                <p className={`font-bold ${currentWBCCount >= targetWBCCount ? 'text-green-300' : 'text-yellow-300'}`}>
                                    {progress.toFixed(0)}%
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Image Detail Modal */}
            {selectedImage && (
                <div 
                    className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
                    onClick={closeModal}
                >
                    <div 
                        className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="sticky top-0 bg-slate-800 text-white px-6 py-4 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-bold">Image #{selectedImage.index + 1}</h3>
                                <p className="text-sm text-slate-300">{selectedImage.fileName || 'Blood Smear Image'}</p>
                            </div>
                            <button 
                                onClick={closeModal}
                                className="text-white hover:text-slate-300 transition-colors"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-6">
                            {/* Annotated Image */}
                            {selectedImage.annotated && (
                                <div className="mb-6">
                                    <h4 className="text-sm font-semibold text-slate-600 mb-2">Annotated Image</h4>
                                    <img 
                                        src={`data:image/jpeg;base64,${selectedImage.annotated}`}
                                        alt="Annotated"
                                        className="w-full rounded-lg border border-slate-200"
                                    />
                                </div>
                            )}

                            {/* Cell Counts */}
                            <div className="grid grid-cols-3 gap-4 mb-6">
                                <div className="bg-slate-50 rounded-lg p-4 text-center">
                                    <p className="text-2xl font-bold text-slate-800">{selectedImage.wbcCount || 0}</p>
                                    <p className="text-sm text-slate-600">WBC</p>
                                </div>
                                <div className="bg-slate-50 rounded-lg p-4 text-center">
                                    <p className="text-2xl font-bold text-red-600">{selectedImage.rbcCount || 0}</p>
                                    <p className="text-sm text-slate-600">RBC</p>
                                </div>
                                <div className="bg-slate-50 rounded-lg p-4 text-center">
                                    <p className="text-2xl font-bold text-amber-600">{selectedImage.plateletCount || 0}</p>
                                    <p className="text-sm text-slate-600">Platelets</p>
                                </div>
                            </div>

                            {/* WBC Classifications for this image */}
                            {selectedImage.classifications && selectedImage.classifications.length > 0 && (
                                <div>
                                    <h4 className="text-sm font-semibold text-slate-600 mb-2">WBC Classifications</h4>
                                    <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                                        {selectedImage.classifications.map((cls, idx) => (
                                            <div 
                                                key={idx}
                                                className={`p-2 rounded text-sm ${
                                                    cls.classification === 'Normal' 
                                                        ? 'bg-green-50 text-green-800' 
                                                        : 'bg-amber-50 text-amber-800'
                                                }`}
                                            >
                                                <span className="font-medium">{cls.classification}</span>
                                                <span className="text-xs ml-2 opacity-75">
                                                    ({(cls.confidence * 100).toFixed(1)}%)
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default ProcessedImagesThumbnails;
