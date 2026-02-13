import React, { useState } from "react";

// Constants for estimation formulas
const WBC_MULTIPLIER = 2000;
const RBC_MULTIPLIER = 200000;
const MIN_IMAGES_FOR_AVERAGE = 10;

// WBC Normal Range (updated)
const WBC_NORMAL_RANGE = { min: 4000, max: 6000 }; // cells/μL

// Short label map for disease class names
const SHORT_LABELS = {
    'Acute Lymphoblastic Leukemia': 'ALL',
    'Acute Myeloid Leukemia': 'AML',
    'Chronic Lymphocytic Leukemia': 'CLL',
    'Chronic Myeloid Leukemia': 'CML',
    'Sickle Cell Anemia': 'SCA'
};

// Bar chart class order and colors
const BAR_CLASSES = [
    { key: 'Normal WBC', label: 'Normal', color: 'bg-green-500', text: 'text-green-700' },
    { key: 'Acute Lymphoblastic Leukemia', label: 'ALL', color: 'bg-purple-500', text: 'text-purple-700' },
    { key: 'Acute Myeloid Leukemia', label: 'AML', color: 'bg-red-500', text: 'text-red-700' },
    { key: 'Chronic Lymphocytic Leukemia', label: 'CLL', color: 'bg-orange-500', text: 'text-orange-700' },
    { key: 'Chronic Myeloid Leukemia', label: 'CML', color: 'bg-amber-500', text: 'text-amber-700' },
    { key: 'Sickle Cell Anemia', label: 'SCA', color: 'bg-rose-500', text: 'text-rose-700' },
];

// Determine per-image severity based on disease cell ratio
const getImageSeverity = (breakdown) => {
    if (!breakdown || breakdown.totalWBC === 0) return { level: 'Normal', color: 'bg-green-100 text-green-700 border-green-300', icon: '✓' };
    const diseaseCount = breakdown.diseaseWBCs.reduce((s, d) => s + d.count, 0);
    const diseasePercent = (diseaseCount / breakdown.totalWBC) * 100;
    if (diseasePercent >=20 ) return { level: 'Abnormal', color: 'bg-amber-100 text-amber-700 border-amber-300', icon: '⚠' };
    return { level: 'Normal', color: 'bg-green-100 text-green-700 border-green-300', icon: '✓' };
};

// Calculate combined average confidence for all classified WBCs in an image
const getAverageConfidence = (classifications) => {
    if (!classifications || classifications.length === 0) return 0;
    const confs = classifications.map(c => c.classification_confidence || c.confidence || 0).filter(c => c > 0);
    if (confs.length === 0) return 0;
    return confs.reduce((a, b) => a + b, 0) / confs.length;
};

// Calculate average confidence PER CLASS for all classified WBCs in an image
const getPerClassConfidence = (classifications) => {
    if (!classifications || classifications.length === 0) return [];
    const groups = {};
    classifications.forEach(c => {
        const cls = c.classification || 'Unknown';
        const conf = c.classification_confidence || c.confidence || 0;
        if (conf <= 0) return;
        if (!groups[cls]) groups[cls] = [];
        groups[cls].push(conf);
    });
    // Map to BAR_CLASSES for consistent display, sorted by avgConf highest to lowest
    return BAR_CLASSES
        .filter(bc => groups[bc.key])
        .map(bc => ({
            key: bc.key,
            label: bc.label,
            color: bc.color,
            text: bc.text,
            count: groups[bc.key].length,
            avgConf: groups[bc.key].reduce((a, b) => a + b, 0) / groups[bc.key].length
        }))
        .sort((a, b) => b.avgConf - a.avgConf);
};

// Build percentage breakdown for bar chart (all 6 classes)
const getClassPercentages = (classifications) => {
    if (!classifications || classifications.length === 0) return BAR_CLASSES.map(c => ({ ...c, count: 0, pct: 0 }));
    const counts = {};
    classifications.forEach(cls => {
        const t = cls.classification || '';
        counts[t] = (counts[t] || 0) + 1;
    });
    const total = classifications.length;
    return BAR_CLASSES.map(c => ({
        ...c,
        count: counts[c.key] || 0,
        pct: total > 0 ? ((counts[c.key] || 0) / total) * 100 : 0
    }));
};

/**
 * ProcessedImagesThumbnails Component
 * Displays a clickable thumbnail bar of all processed images
 * Allows users to view individual image results with detailed WBC breakdown
 */
export const ProcessedImagesThumbnails = ({
    processedImages,
    onImageClick,
    currentImageCount,
    targetImageCount = 10
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null);
    const [showDiseaseWBCs, setShowDiseaseWBCs] = useState(false);

    // Return null if no images - parent component controls visibility
    if (!processedImages || processedImages.length === 0) {
        return null;
    }

    const progress = Math.min(100, (currentImageCount / targetImageCount) * 100);

    // Calculate total WBC count from all processed images
    const currentWBCCount = processedImages.reduce((sum, img) => sum + (img.wbcCount || 0), 0);

    // Calculate WBC breakdown for a single image - simplified for 7-class model
    const getWBCBreakdown = (classifications) => {
        if (!classifications || classifications.length === 0) return null;

        const breakdown = {
            normalWBC: 0,
            diseaseWBCs: [],
            totalWBC: 0
        };

        const diseaseCounts = {};

        classifications.forEach(cls => {
            const type = cls.classification;
            if (!type) return;
            breakdown.totalWBC++;

            if (type === 'Normal WBC') {
                breakdown.normalWBC++;
            } else {
                // Disease cell (ALL, AML, CML, CLL, or unknown)
                diseaseCounts[type] = (diseaseCounts[type] || 0) + 1;
            }
        });

        // Convert disease counts to array
        breakdown.diseaseWBCs = Object.entries(diseaseCounts).map(([type, count]) => ({
            type,
            count,
            isDisease: true
        }));

        return breakdown;
    };

    // Calculate estimated counts (only after 10 images)
    const calculateEstimates = () => {
        if (processedImages.length < MIN_IMAGES_FOR_AVERAGE) {
            return null;
        }

        // Calculate total WBC count and estimate using new formula: (Total / 10) × 2000
        const totalWBC = processedImages.reduce((sum, img) => sum + (img.wbcCount || 0), 0);
        const avgWBCPerField = totalWBC / processedImages.length;
        const estimatedWBCPerUL = (totalWBC / 10) * WBC_MULTIPLIER;

        // Calculate average RBC per field
        const totalRBC = processedImages.reduce((sum, img) => sum + (img.rbcCount || 0), 0);
        const avgRBCPerField = totalRBC / processedImages.length;
        // RBC Formula: (Average RBC per field ÷ 10) × 200,000 = Estimated RBC/μL
        const estimatedRBCPerUL = (avgRBCPerField / 10) * RBC_MULTIPLIER;

        // Check WBC status against normal range
        let wbcStatus = 'normal';
        if (estimatedWBCPerUL < WBC_NORMAL_RANGE.min) wbcStatus = 'low';
        else if (estimatedWBCPerUL > WBC_NORMAL_RANGE.max) wbcStatus = 'high';

        return {
            imagesAnalyzed: processedImages.length,
            totalWBC: totalWBC,
            avgWBCPerField: avgWBCPerField.toFixed(2),
            estimatedWBCPerUL: Math.round(estimatedWBCPerUL),
            avgRBCPerField: avgRBCPerField.toFixed(2),
            estimatedRBCPerUL: Math.round(estimatedRBCPerUL),
            wbcStatus,
            wbcSIUnits: (estimatedWBCPerUL / 1e3).toFixed(2) + ' × 10⁹/L',
            rbcSIUnits: (estimatedRBCPerUL / 1e6).toFixed(2) + ' × 10¹²/L'
        };
    };

    const handleImageClick = (image, index) => {
        setSelectedImage({ ...image, index });
        setShowDiseaseWBCs(false);
        if (onImageClick) {
            onImageClick(image, index);
        }
    };

    const closeModal = () => {
        setSelectedImage(null);
        setShowDiseaseWBCs(false);
    };

    const estimates = calculateEstimates();

    return (
        <>
            {/* Thumbnail Bar */}
            <div className="bg-rose-100 rounded-lg overflow-hidden mb-4 border border-rose-200">
                {/* Header with progress */}
                <div
                    className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-rose-200 transition-colors"
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                            <svg
                                className={`w-4 h-4 text-rose-700 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                            <span className="text-rose-800 font-medium text-sm">
                                Processed Images ({processedImages.length})
                            </span>
                        </div>

                        {/* Mini thumbnails preview when collapsed */}
                        {!isExpanded && (
                            <div className="flex items-center gap-1 ml-2">
                                {processedImages.slice(0, 5).map((img, idx) => (
                                    <div
                                        key={idx}
                                        className="w-8 h-8 rounded border-2 border-rose-300 overflow-hidden"
                                    >
                                        <img
                                            src={img.annotatedImage ? `data:image/jpeg;base64,${img.annotatedImage}` : (img.preview || `data:image/jpeg;base64,${img.annotated}`)}
                                            alt={`Img ${idx + 1}`}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                ))}
                                {processedImages.length > 5 && (
                                    <span className="text-rose-600 text-xs ml-1">+{processedImages.length - 5}</span>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Image Progress */}
                    <div className="flex items-center gap-3">
                        <div className="text-right">
                            <p className="text-xs text-rose-600">Total WBC</p>
                            <p className="text-sm font-bold text-rose-900">
                                {currentWBCCount} cells
                            </p>
                        </div>
                        <div className="w-24 h-2 bg-rose-200 rounded-full overflow-hidden">
                            <div
                                className={`h-full transition-all duration-700 ease-[cubic-bezier(0.4,0,0.2,1)] ${progress >= 100 ? 'bg-green-500' : 'bg-rose-500'
                                    }`}
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                        {progress >= 100 && (
                            <span className="text-green-300 text-lg font-bold">✓</span>
                        )}
                    </div>
                </div>

                {/* Expanded thumbnail grid with per-image results */}
                {isExpanded && (
                    <div className="px-4 pb-4 border-t border-rose-200">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-3">
                            {processedImages.map((img, idx) => {
                                // Check multiple possible field names for backward compatibility
                                const classifications = img.wbcClassifications || img.classifications || img.results?.wbc_classifications || img.results?.stage2_classification || [];
                                const breakdown = getWBCBreakdown(classifications);
                                return (
                                    <div
                                        key={idx}
                                        className="bg-white rounded-lg p-3 cursor-pointer hover:bg-rose-50 transition-colors border border-rose-200"
                                        onClick={() => handleImageClick(img, idx)}
                                    >
                                        {/* Image header with thumbnail */}
                                        <div className="flex flex-col items-center gap-2 mb-3">
                                            <div className="relative">
                                                <div className="w-16 h-16 rounded-lg overflow-hidden border-2 border-rose-300">
                                                    <img
                                                        src={img.annotatedImage ? `data:image/jpeg;base64,${img.annotatedImage}` : (img.preview || `data:image/jpeg;base64,${img.annotated}`)}
                                                        alt={`Image ${idx + 1}`}
                                                        className="w-full h-full object-cover"
                                                    />
                                                </div>
                                                {/* Image number badge */}
                                                <div className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 rounded-full flex items-center justify-center shadow">
                                                    <span className="text-white text-xs font-bold">{idx + 1}</span>
                                                </div>
                                            </div>
                                            <div className="w-full text-center overflow-hidden">
                                                <p className="text-rose-900 font-semibold text-xs overflow-wrap break-word word-break break-all leading-tight" style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>{img.filename || `Image ${idx + 1}`}</p>
                                                <p className="text-rose-600 text-xs">Blood Smear Analysis</p>
                                            </div>
                                        </div>

                                        {/* Cell counts row */}
                                        <div className="grid grid-cols-2 gap-2 mb-3">
                                            <div className="bg-slate-50 rounded px-2 py-1.5 text-center border border-slate-200">
                                                <p className="text-slate-500 text-xs">RBC</p>
                                                <p className="text-rose-700 font-bold text-sm">{img.rbcCount || 0}</p>
                                            </div>
                                            <div className="bg-slate-50 rounded px-2 py-1.5 text-center border border-slate-200">
                                                <p className="text-slate-500 text-xs">WBC</p>
                                                <p className="text-rose-700 font-bold text-sm">{img.wbcCount || 0}</p>
                                            </div>
                                        </div>

                                        {/* Severity Badge + Confidence */}
                                        {(() => {
                                            const severity = getImageSeverity(breakdown);
                                            const avgConf = getAverageConfidence(classifications);
                                            return (
                                                <>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${severity.color}`}>
                                                            {severity.icon} {severity.level}
                                                        </span>
                                                        {avgConf > 0 && (
                                                            <span className="text-xs text-slate-500" title="Average classification confidence">
                                                                Conf: <span className="font-semibold text-slate-700">{(avgConf * 100).toFixed(1)}%</span>
                                                            </span>
                                                        )}
                                                    </div>
                                                </>
                                            );
                                        })()}

                                        {/* WBC Classification Bar Chart */}
                                        {(breakdown && breakdown.totalWBC > 0) ? (
                                            <div className="bg-slate-50 rounded-lg p-2 border border-slate-200">
                                                <p className="text-slate-600 text-xs mb-2 font-medium">WBC Classification</p>
                                                <div className="space-y-1">
                                                    {[...getClassPercentages(classifications)].sort((a, b) => b.pct - a.pct).map((cls) => {
                                                        return (
                                                            <div key={cls.key} className="flex items-center gap-1.5">
                                                                <span className={`${cls.text} text-[10px] w-12 font-semibold truncate`} title={cls.key}>
                                                                    {cls.label}
                                                                </span>
                                                                <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                                                                    <div
                                                                        className={`h-full ${cls.color} transition-all duration-500`}
                                                                        style={{ width: `${cls.pct}%` }}
                                                                    />
                                                                </div>
                                                                <span className="text-slate-600 text-[10px] font-medium w-10 text-right">
                                                                    {cls.pct.toFixed(0)}%
                                                                </span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                                {/* Disease alert row */}
                                                {breakdown.diseaseWBCs.length > 0 && (
                                                    <div className="mt-2 pt-2 border-t border-slate-200">
                                                        <div className="flex items-center gap-1 text-red-500 text-xs">
                                                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                                            </svg>
                                                            <span>{breakdown.diseaseWBCs.reduce((s, d) => s + d.count, 0)} Disease Cell(s)</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ) : img.wbcCount > 0 ? (
                                            <div className="bg-slate-50 rounded-lg p-2 border border-slate-200">
                                                <p className="text-slate-600 text-xs mb-2 font-medium">WBC Detected</p>
                                                <p className="text-slate-700 text-sm font-bold">{img.wbcCount} WBC(s)</p>
                                                <p className="text-slate-500 text-xs mt-1">Classification data pending...</p>
                                            </div>
                                        ) : null}

                                        {/* Click hint */}
                                        <p className="text-rose-500 text-xs text-center mt-2 opacity-70">
                                            Click for detailed view
                                        </p>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Summary stats */}
                        <div className="mt-4 pt-3 border-t border-rose-200 grid grid-cols-4 gap-4 text-center">
                            <div>
                                <p className="text-rose-600 text-xs">Total WBC</p>
                                <p className="text-rose-900 font-bold">{currentWBCCount}</p>
                            </div>
                            <div>
                                <p className="text-rose-600 text-xs">Total RBC</p>
                                <p className="text-rose-900 font-bold">
                                    {processedImages.reduce((sum, img) => sum + (img.rbcCount || 0), 0)}
                                </p>
                            </div>
                            <div>
                                <p className="text-rose-600 text-xs">Images</p>
                                <p className={`font-bold ${processedImages.length >= MIN_IMAGES_FOR_AVERAGE ? 'text-green-600' : 'text-amber-600'}`}>
                                    {processedImages.length} / {MIN_IMAGES_FOR_AVERAGE}
                                </p>
                            </div>
                            <div>
                                <p className="text-rose-600 text-xs">Image Progress</p>
                                <p className={`font-bold ${progress >= 100 ? 'text-green-600' : 'text-amber-600'}`}>
                                    {progress.toFixed(0)}%
                                </p>
                            </div>
                        </div>

                        {/* Estimated Cell Counts (only after 10 images) */}
                        {estimates ? (
                            <div className="mt-4 pt-3 border-t border-rose-200 bg-white rounded-lg p-4 border">
                                <h4 className="text-rose-900 font-bold text-sm mb-3 flex items-center gap-2">
                                    <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    Estimated Cell Counts ({estimates.imagesAnalyzed} images analyzed)
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* WBC Estimate */}
                                    <div className={`rounded-lg p-3 border ${estimates.wbcStatus === 'normal' ? 'bg-green-50 border-green-200' :
                                        estimates.wbcStatus === 'high' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'
                                        }`}>
                                        <p className="text-slate-600 text-xs mb-1">Estimated WBC</p>
                                        <p className="text-slate-900 font-bold text-lg">
                                            {estimates.estimatedWBCPerUL.toLocaleString()} cells/μL
                                        </p>
                                        <p className="text-slate-500 text-xs">
                                            SI: {estimates.wbcSIUnits}
                                        </p>
                                        <p className="text-xs mt-1">
                                            <span className={`px-2 py-0.5 rounded ${estimates.wbcStatus === 'normal' ? 'bg-green-600 text-white' :
                                                estimates.wbcStatus === 'high' ? 'bg-red-600 text-white' : 'bg-yellow-600 text-white'
                                                }`}>
                                                {estimates.wbcStatus === 'normal' ? '✓ Normal' :
                                                    estimates.wbcStatus === 'high' ? '↑ High' : '↓ Low'}
                                            </span>
                                            <span className="text-slate-500 ml-2">
                                                (Normal: 4,000-6,000/μL)
                                            </span>
                                        </p>
                                        <p className="text-slate-500 text-xs mt-2">
                                            Formula: (Total {estimates.totalWBC} / 10) × {WBC_MULTIPLIER.toLocaleString()}
                                        </p>
                                    </div>

                                    {/* RBC Estimate */}
                                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                                        <p className="text-slate-600 text-xs mb-1">Estimated RBC</p>
                                        <p className="text-slate-900 font-bold text-lg">
                                            {(estimates.estimatedRBCPerUL / 1e6).toFixed(2)} × 10⁶ cells/μL
                                        </p>
                                        <p className="text-slate-500 text-xs">
                                            SI: {estimates.rbcSIUnits}
                                        </p>
                                        <p className="text-xs mt-1 text-slate-500">
                                            (Normal Male: 4.5-6.0 × 10⁶, Female: 4.0-5.5 × 10⁶)
                                        </p>
                                        <p className="text-slate-500 text-xs mt-2">
                                            Formula: Avg {estimates.avgRBCPerField}/10HPF × {RBC_MULTIPLIER.toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="mt-4 pt-3 border-t border-rose-200 bg-amber-50 rounded-lg p-4 border">
                                <p className="text-amber-800 text-sm flex items-center gap-2">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    Analyze at least {MIN_IMAGES_FOR_AVERAGE} blood smear images to calculate estimated cell counts.
                                    <span className="font-bold">({MIN_IMAGES_FOR_AVERAGE - processedImages.length} more needed)</span>
                                </p>
                            </div>
                        )}

                        {/* Cell Type Legend */}
                        <div className="mt-4 pt-3 border-t border-rose-200 flex flex-wrap justify-center gap-4 text-xs font-medium text-slate-600">
                            {BAR_CLASSES.map(cls => (
                                <div key={cls.key} className="flex items-center gap-1.5">
                                    <span className={`w-3 h-3 rounded-full ${cls.color} shadow-sm`}></span>
                                    <span>{cls.label}</span>
                                </div>
                            ))}
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
                        className="bg-white rounded-lg max-w-5xl w-full max-h-[90vh] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="sticky top-0 bg-rose-50 border-b border-rose-200 text-rose-900 px-6 py-4 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-bold">Blood Smear Image #{selectedImage.index + 1}</h3>
                                <p className="text-sm text-rose-600">{selectedImage.filename || 'Blood Smear Image'}</p>
                            </div>
                            <button
                                onClick={closeModal}
                                className="text-black hover:text-slate-500 cursor-pointer transition-colors"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-6">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Left: Annotated Image */}
                                <div>
                                    {(selectedImage.annotatedImage || selectedImage.annotated || selectedImage.preview) && (
                                        <div>
                                            <h4 className="text-sm font-semibold text-slate-600 mb-2">Annotated Image</h4>
                                            <img
                                                src={selectedImage.annotatedImage ? `data:image/jpeg;base64,${selectedImage.annotatedImage}` :
                                                    (selectedImage.annotated ? `data:image/jpeg;base64,${selectedImage.annotated}` : selectedImage.preview)}
                                                alt="Annotated"
                                                className="w-full rounded-lg border border-slate-200"
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* Right: Results Table */}
                                <div>
                                    <h4 className="text-sm font-semibold text-slate-600 mb-3">Cell Analysis Results</h4>

                                    {/* Cell Counts Summary */}
                                    <div className="bg-slate-50 rounded-lg p-4 mb-4">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b border-slate-200">
                                                    <th className="text-left py-2 text-slate-600">Cell Type</th>
                                                    <th className="text-right py-2 text-slate-600">Count</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr className="border-b border-slate-100">
                                                    <td className="py-2 font-medium text-red-700">RBC</td>
                                                    <td className="text-right font-bold text-red-600">{selectedImage.rbcCount || 0}</td>
                                                </tr>
                                                <tr className="border-b border-slate-100">
                                                    <td className="py-2 font-medium text-blue-700">WBC (Total)</td>
                                                    <td className="text-right font-bold text-blue-600">{selectedImage.wbcCount || 0}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* WBC Classification with Severity, Confidence & Bar Chart */}
                                    {(() => {
                                        const classifications = selectedImage.wbcClassifications || selectedImage.classifications || selectedImage.results?.wbc_classifications || selectedImage.results?.stage2_classification || [];
                                        if (!classifications || classifications.length === 0) return null;

                                        const breakdown = getWBCBreakdown(classifications);
                                        if (!breakdown) return null;

                                        const severity = getImageSeverity(breakdown);
                                        const avgConf = getAverageConfidence(classifications);
                                        const classPcts = getClassPercentages(classifications);
                                        const diseaseTotal = breakdown.diseaseWBCs.reduce((s, d) => s + d.count, 0);
                                        const perClassConf = getPerClassConfidence(classifications);

                                        return (
                                            <div className="bg-blue-50 rounded-lg p-4 mb-4">
                                                {/* Header: Title + Severity Badge + Confidence */}
                                                <div className="flex items-center justify-between mb-3">
                                                    <h5 className="font-semibold text-blue-800">WBC Classification Summary</h5>
                                                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${severity.color}`}>
                                                        {severity.icon} {severity.level}
                                                    </span>
                                                </div>
                                                
                                                {/* Combined Confidence */}
                                                {avgConf > 0 && (
                                                    <div className="mb-3 flex items-center gap-2">
                                                        <span className="text-xs text-slate-500">Avg. Confidence:</span>
                                                        <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                                                            <div className={`h-full rounded-full transition-all duration-500 ${
                                                                avgConf >= 0.8 ? 'bg-green-500' : avgConf >= 0.6 ? 'bg-amber-500' : 'bg-red-500'
                                                            }`} style={{ width: `${avgConf * 100}%` }} />
                                                        </div>
                                                        <span className={`text-xs font-bold ${
                                                            avgConf >= 0.8 ? 'text-green-700' : avgConf >= 0.6 ? 'text-amber-700' : 'text-red-700'
                                                        }`}>{(avgConf * 100).toFixed(1)}%</span>
                                                    </div>
                                                )}

                                                {/* Per-Class Average Confidence */}
                                                {perClassConf.length > 0 && (
                                                    <div className="mb-3 bg-white rounded-lg p-3 border border-blue-200">
                                                        <p className="text-xs font-semibold text-slate-600 mb-2">Average Confidence per Class</p>
                                                        <div className="space-y-1.5">
                                                            {perClassConf.map(cls => (
                                                                <div key={cls.key} className="flex items-center gap-2">
                                                                    <span className={`${cls.text} text-xs w-14 font-semibold`}>{cls.label}</span>
                                                                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                                                        <div
                                                                            className={`h-full rounded-full transition-all duration-500 ${
                                                                                cls.avgConf >= 0.8 ? 'bg-green-500' : cls.avgConf >= 0.6 ? 'bg-amber-500' : 'bg-red-400'
                                                                            }`}
                                                                            style={{ width: `${cls.avgConf * 100}%` }}
                                                                        />
                                                                    </div>
                                                                    <span className={`text-xs font-bold w-12 text-right ${
                                                                        cls.avgConf >= 0.8 ? 'text-green-700' : cls.avgConf >= 0.6 ? 'text-amber-700' : 'text-red-600'
                                                                    }`}>
                                                                        {(cls.avgConf * 100).toFixed(1)}%
                                                                    </span>
                                                                    <span className="text-[10px] text-slate-400">({cls.count})</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Normal vs Disease Summary */}
                                                <div className="grid grid-cols-2 gap-3 mb-3">
                                                    <div className="bg-green-50 rounded-lg p-3 border border-green-200 text-center">
                                                        <p className="text-green-700 text-xs font-medium mb-1">Normal WBC</p>
                                                        <p className="text-green-800 text-xl font-bold">{breakdown.normalWBC}</p>
                                                        <p className="text-green-600 text-xs">
                                                            {breakdown.totalWBC > 0 ? ((breakdown.normalWBC / breakdown.totalWBC) * 100).toFixed(1) : 0}%
                                                        </p>
                                                    </div>
                                                    <div className={`rounded-lg p-3 border text-center ${
                                                        diseaseTotal > 0 ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'
                                                    }`}>
                                                        <p className={`text-xs font-medium mb-1 ${
                                                            diseaseTotal > 0 ? 'text-red-700' : 'text-slate-600'
                                                        }`}>Disease Cells</p>
                                                        <p className={`text-xl font-bold ${
                                                            diseaseTotal > 0 ? 'text-red-800' : 'text-slate-700'
                                                        }`}>{diseaseTotal}</p>
                                                        <p className={`text-xs ${
                                                            diseaseTotal > 0 ? 'text-red-600' : 'text-slate-500'
                                                        }`}>
                                                            {breakdown.totalWBC > 0 ? ((diseaseTotal / breakdown.totalWBC) * 100).toFixed(1) : 0}%
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Full Bar Chart Breakdown */}
                                                <div className="bg-white rounded-lg p-3 border border-blue-200 mb-3">
                                                    <p className="text-xs font-semibold text-slate-600 mb-2">Classification Breakdown</p>
                                                    <div className="space-y-1.5">
                                                        {[...classPcts].sort((a, b) => b.pct - a.pct).map((cls) => (
                                                            <div key={cls.key} className="flex items-center gap-2">
                                                                <span className={`${cls.text} text-xs w-14 font-semibold`}>{cls.label}</span>
                                                                <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
                                                                    <div
                                                                        className={`h-full ${cls.color} transition-all duration-500 rounded-full`}
                                                                        style={{ width: `${cls.pct}%` }}
                                                                    />
                                                                </div>
                                                                <span className="text-slate-700 text-xs font-medium w-14 text-right">
                                                                    {cls.count > 0 ? `${cls.count} (${cls.pct.toFixed(1)}%)` : '0'}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Disease WBCs Expandable */}
                                                {breakdown.diseaseWBCs.length > 0 && (
                                                    <div className="pt-3 border-t border-blue-200">
                                                        <button
                                                            onClick={() => setShowDiseaseWBCs(!showDiseaseWBCs)}
                                                            className="w-full flex items-center justify-between px-3 py-2 bg-red-100 hover:bg-red-200 text-red-800 rounded-lg transition-colors"
                                                        >
                                                            <span className="font-medium flex items-center gap-2">
                                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                                </svg>
                                                                Disease Cells (Detailed)
                                                            </span>
                                                            <span className="bg-red-600 text-white px-2 py-1 rounded text-xs font-bold">
                                                                {diseaseTotal}
                                                            </span>
                                                        </button>

                                                        {showDiseaseWBCs && (
                                                            <div className="mt-2 bg-red-50 rounded-lg p-3 border border-red-200">
                                                                <table className="w-full text-sm">
                                                                    <thead>
                                                                        <tr className="border-b border-red-200">
                                                                            <th className="text-left py-1 text-red-700">Disease Type</th>
                                                                            <th className="text-right py-1 text-red-700">Count</th>
                                                                            <th className="text-right py-1 text-red-700">%</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {breakdown.diseaseWBCs.map((disease, idx) => (
                                                                            <tr key={idx} className="border-b border-red-100">
                                                                                <td className="py-1 text-red-700 font-medium">
                                                                                    {SHORT_LABELS[disease.type] || disease.type}
                                                                                    <span className="ml-1 text-xs text-red-500">({disease.type})</span>
                                                                                </td>
                                                                                <td className="text-right font-medium">{disease.count}</td>
                                                                                <td className="text-right text-slate-500">
                                                                                    {breakdown.totalWBC > 0 ? ((disease.count / breakdown.totalWBC) * 100).toFixed(1) : 0}%
                                                                                </td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}

                                    {/* Sickle Cell Info */}
                                    {selectedImage.sickleCount > 0 && (
                                        <div className="bg-red-50 rounded-lg p-4 mb-4 border border-red-200">
                                            <h5 className="font-semibold text-red-800 mb-2">⚠️ Sickle Cells Detected</h5>
                                            <p className="text-sm text-red-700">
                                                <span className="font-bold">{selectedImage.sickleCount}</span> sickle cells found in this image
                                                ({selectedImage.rbcCount > 0 ? ((selectedImage.sickleCount / selectedImage.rbcCount) * 100).toFixed(2) : 0}% of RBCs)
                                            </p>
                                        </div>
                                    )}

                                    {/* Note about averaging */}
                                    <div className="bg-yellow-50 rounded-lg p-3 text-xs text-yellow-800 border border-yellow-200">
                                        <strong>Note:</strong> Estimated cell counts (cells/μL) will be calculated after analyzing {MIN_IMAGES_FOR_AVERAGE} blood smear images.
                                        Currently analyzed: {processedImages.length} image(s).
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default ProcessedImagesThumbnails;
