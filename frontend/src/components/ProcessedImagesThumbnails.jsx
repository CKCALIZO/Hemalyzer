import React, { useState } from "react";

// Constants for estimation formulas
const WBC_MULTIPLIER = 2000;
const RBC_MULTIPLIER = 200000;
const MIN_IMAGES_FOR_AVERAGE = 10;

// WBC Normal Range (updated)
const WBC_NORMAL_RANGE = { min: 4000, max: 6000 }; // cells/μL

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
    const [showOtherWBCs, setShowOtherWBCs] = useState(false);
    const [showNormalWBCs, setShowNormalWBCs] = useState(false);
    const [showAbnormalWBCs, setShowAbnormalWBCs] = useState(false);

    if (!processedImages || processedImages.length === 0) {
        return null;
    }

    const progress = Math.min(100, (currentImageCount / targetImageCount) * 100);
    
    // Calculate total WBC count from all processed images
    const currentWBCCount = processedImages.reduce((sum, img) => sum + (img.wbcCount || 0), 0);

    // Calculate WBC breakdown for a single image
    const getWBCBreakdown = (classifications) => {
        if (!classifications || classifications.length === 0) return null;
        
        const breakdown = {
            // Main WBC types (aggregated normal + abnormal)
            neutrophil: 0,
            lymphocyte: 0,
            monocyte: 0,
            eosinophil: 0,
            basophil: 0,
            // Normal WBCs (specific normal variants)
            normalWBCs: [],
            // Abnormal WBCs (abnormal variants of the 5 main types)
            abnormalWBCs: [],
            // Other/Disease WBCs (blast cells, leukemia types not in main categories)
            otherWBCs: [],
            totalWBC: 0
        };

        // Main WBC types to track
        const mainWBCTypes = ['Neutrophil', 'Basophil', 'Monocyte', 'Eosinophil', 'Lymphocyte'];
        
        // Disease/blast types for "Other WBCs" (these don't fall into normal/abnormal of main types)
        const diseaseTypes = [
            'Myeloblast', 
            'Acute Myeloid Leukemia', 
            'Acute Lymphoblastic Leukemia',
            'Chronic Myeloid Leukemia',
            'Chronic Lymphocytic Leukemia',
            'AML',
            'ALL',
            'CML',
            'CLL'
        ];

        classifications.forEach(cls => {
            const type = cls.classification;
            breakdown.totalWBC++;
            
            // Check if it's a "detailed" classification (e.g., "Basophil: Normal" or "Lymphocyte: CLL")
            const hasColon = type.includes(':');
            
            if (hasColon) {
                // Parse "CellType: Status" format
                const [cellType, status] = type.split(':').map(s => s.trim());
                
                // Check if it's one of the main 5 WBC types
                const isMainType = mainWBCTypes.some(t => cellType.toLowerCase().includes(t.toLowerCase()));
                
                if (isMainType) {
                    // Increment main type counter
                    if (cellType.toLowerCase().includes('neutrophil')) breakdown.neutrophil++;
                    else if (cellType.toLowerCase().includes('lymphocyte')) breakdown.lymphocyte++;
                    else if (cellType.toLowerCase().includes('monocyte')) breakdown.monocyte++;
                    else if (cellType.toLowerCase().includes('eosinophil')) breakdown.eosinophil++;
                    else if (cellType.toLowerCase().includes('basophil')) breakdown.basophil++;
                    
                    // Categorize into Normal or Abnormal WBCs
                    const isNormal = status.toLowerCase().includes('normal');
                    const targetArray = isNormal ? breakdown.normalWBCs : breakdown.abnormalWBCs;
                    
                    const existing = targetArray.find(o => o.type === type);
                    if (existing) {
                        existing.count++;
                    } else {
                        targetArray.push({ type, count: 1, cellType, status });
                    }
                } else {
                    // Not a main type, put in Other WBCs
                    const existing = breakdown.otherWBCs.find(o => o.type === type);
                    if (existing) {
                        existing.count++;
                    } else {
                        breakdown.otherWBCs.push({ 
                            type, 
                            count: 1,
                            isDisease: diseaseTypes.some(dt => type.includes(dt))
                        });
                    }
                }
            } else {
                // Simple classification without colon (legacy or basic mode)
                // Treat "Normal" as Neutrophil: Normal
                if (type === 'Normal' || type === 'Neutrophil') {
                    breakdown.neutrophil++;
                    const existing = breakdown.normalWBCs.find(o => o.type === 'Neutrophil: Normal');
                    if (existing) {
                        existing.count++;
                    } else {
                        breakdown.normalWBCs.push({ type: 'Neutrophil: Normal', count: 1, cellType: 'Neutrophil', status: 'Normal' });
                    }
                } else if (type === 'Lymphocyte') {
                    breakdown.lymphocyte++;
                    const existing = breakdown.normalWBCs.find(o => o.type === 'Lymphocyte: Normal');
                    if (existing) {
                        existing.count++;
                    } else {
                        breakdown.normalWBCs.push({ type: 'Lymphocyte: Normal', count: 1, cellType: 'Lymphocyte', status: 'Normal' });
                    }
                } else if (type === 'Monocyte') {
                    breakdown.monocyte++;
                    const existing = breakdown.normalWBCs.find(o => o.type === 'Monocyte: Normal');
                    if (existing) {
                        existing.count++;
                    } else {
                        breakdown.normalWBCs.push({ type: 'Monocyte: Normal', count: 1, cellType: 'Monocyte', status: 'Normal' });
                    }
                } else if (type === 'Eosinophil') {
                    breakdown.eosinophil++;
                    const existing = breakdown.normalWBCs.find(o => o.type === 'Eosinophil: Normal');
                    if (existing) {
                        existing.count++;
                    } else {
                        breakdown.normalWBCs.push({ type: 'Eosinophil: Normal', count: 1, cellType: 'Eosinophil', status: 'Normal' });
                    }
                } else if (type === 'Basophil') {
                    breakdown.basophil++;
                    const existing = breakdown.normalWBCs.find(o => o.type === 'Basophil: Normal');
                    if (existing) {
                        existing.count++;
                    } else {
                        breakdown.normalWBCs.push({ type: 'Basophil: Normal', count: 1, cellType: 'Basophil', status: 'Normal' });
                    }
                } else {
                    // Other disease types
                    const existing = breakdown.otherWBCs.find(o => o.type === type);
                    if (existing) {
                        existing.count++;
                    } else {
                        breakdown.otherWBCs.push({ 
                            type, 
                            count: 1,
                            isDisease: diseaseTypes.includes(type)
                        });
                    }
                }
            }
        });

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
        const estimatedRBCPerUL = avgRBCPerField * RBC_MULTIPLIER;

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
        setShowOtherWBCs(false);
        setShowNormalWBCs(false);
        setShowAbnormalWBCs(false);
        if (onImageClick) {
            onImageClick(image, index);
        }
    };

    const closeModal = () => {
        setSelectedImage(null);
        setShowOtherWBCs(false);
        setShowNormalWBCs(false);
        setShowAbnormalWBCs(false);
    };

    const estimates = calculateEstimates();

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

                    {/* Image Progress */}
                    <div className="flex items-center gap-3">
                        <div className="text-right">
                            <p className="text-xs text-red-200">Total WBC</p>
                            <p className="text-sm font-bold text-white">
                                {currentWBCCount} cells
                            </p>
                        </div>
                        <div className="w-24 h-2 bg-red-900 rounded-full overflow-hidden">
                            <div 
                                className={`h-full transition-all duration-500 ${
                                    progress >= 100 ? 'bg-green-400' : 'bg-white'
                                }`}
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                        {progress >= 100 && (
                            <span className="text-green-300 text-lg font-bold">✓</span>
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
                                <p className="text-red-200 text-xs">Images</p>
                                <p className={`font-bold ${processedImages.length >= MIN_IMAGES_FOR_AVERAGE ? 'text-green-300' : 'text-yellow-300'}`}>
                                    {processedImages.length} / {MIN_IMAGES_FOR_AVERAGE}
                                </p>
                            </div>
                            <div>
                                <p className="text-red-200 text-xs">Image Progress</p>
                                <p className={`font-bold ${progress >= 100 ? 'text-green-300' : 'text-yellow-300'}`}>
                                    {progress.toFixed(0)}%
                                </p>
                            </div>
                        </div>

                        {/* Estimated Cell Counts (only after 10 images) */}
                        {estimates ? (
                            <div className="mt-4 pt-3 border-t border-red-600 bg-red-900/50 rounded-lg p-4">
                                <h4 className="text-white font-bold text-sm mb-3 flex items-center gap-2">
                                    <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    Estimated Cell Counts ({estimates.imagesAnalyzed} images analyzed)
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* WBC Estimate */}
                                    <div className={`rounded-lg p-3 ${
                                        estimates.wbcStatus === 'normal' ? 'bg-green-900/50' :
                                        estimates.wbcStatus === 'high' ? 'bg-red-900/70' : 'bg-yellow-900/50'
                                    }`}>
                                        <p className="text-red-200 text-xs mb-1">Estimated WBC</p>
                                        <p className="text-white font-bold text-lg">
                                            {estimates.estimatedWBCPerUL.toLocaleString()} cells/μL
                                        </p>
                                        <p className="text-red-200 text-xs">
                                            SI: {estimates.wbcSIUnits}
                                        </p>
                                        <p className="text-xs mt-1">
                                            <span className={`px-2 py-0.5 rounded ${
                                                estimates.wbcStatus === 'normal' ? 'bg-green-600 text-white' :
                                                estimates.wbcStatus === 'high' ? 'bg-red-600 text-white' : 'bg-yellow-600 text-white'
                                            }`}>
                                                {estimates.wbcStatus === 'normal' ? '✓ Normal' :
                                                 estimates.wbcStatus === 'high' ? '↑ High' : '↓ Low'}
                                            </span>
                                            <span className="text-red-300 ml-2">
                                                (Normal: 4,000-6,000/μL)
                                            </span>
                                        </p>
                                        <p className="text-red-300 text-xs mt-2">
                                            Formula: (Total {estimates.totalWBC} / 10) × {WBC_MULTIPLIER.toLocaleString()}
                                        </p>
                                    </div>

                                    {/* RBC Estimate */}
                                    <div className="bg-red-900/30 rounded-lg p-3">
                                        <p className="text-red-200 text-xs mb-1">Estimated RBC</p>
                                        <p className="text-white font-bold text-lg">
                                            {(estimates.estimatedRBCPerUL / 1e6).toFixed(2)} × 10⁶ cells/μL
                                        </p>
                                        <p className="text-red-200 text-xs">
                                            SI: {estimates.rbcSIUnits}
                                        </p>
                                        <p className="text-xs mt-1 text-red-300">
                                            (Normal Male: 4.5-6.0 × 10⁶, Female: 4.0-5.5 × 10⁶)
                                        </p>
                                        <p className="text-red-300 text-xs mt-2">
                                            Formula: Avg {estimates.avgRBCPerField}/10HPF × {RBC_MULTIPLIER.toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="mt-4 pt-3 border-t border-red-600 bg-yellow-900/30 rounded-lg p-4">
                                <p className="text-yellow-200 text-sm flex items-center gap-2">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    Analyze at least {MIN_IMAGES_FOR_AVERAGE} blood smear images to calculate estimated cell counts.
                                    <span className="font-bold">({MIN_IMAGES_FOR_AVERAGE - processedImages.length} more needed)</span>
                                </p>
                            </div>
                        )}
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
                        <div className="sticky top-0 bg-slate-800 text-white px-6 py-4 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-bold">Blood Smear Image #{selectedImage.index + 1}</h3>
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
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Left: Annotated Image */}
                                <div>
                                    {selectedImage.annotated && (
                                        <div>
                                            <h4 className="text-sm font-semibold text-slate-600 mb-2">Annotated Image</h4>
                                            <img 
                                                src={`data:image/jpeg;base64,${selectedImage.annotated}`}
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

                                    {/* WBC Breakdown */}
                                    {selectedImage.classifications && selectedImage.classifications.length > 0 && (() => {
                                        const breakdown = getWBCBreakdown(selectedImage.classifications);
                                        if (!breakdown) return null;

                                        return (
                                            <div className="bg-blue-50 rounded-lg p-4 mb-4">
                                                <h5 className="font-semibold text-blue-800 mb-3">WBC Classification Breakdown</h5>
                                                <table className="w-full text-sm">
                                                    <thead>
                                                        <tr className="border-b border-blue-200">
                                                            <th className="text-left py-2 text-blue-700">Type</th>
                                                            <th className="text-right py-2 text-blue-700">Count</th>
                                                            <th className="text-right py-2 text-blue-700">%</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        <tr className="border-b border-blue-100">
                                                            <td className="py-2 text-slate-700">Neutrophil</td>
                                                            <td className="text-right font-medium">{breakdown.neutrophil}</td>
                                                            <td className="text-right text-slate-500">
                                                                {breakdown.totalWBC > 0 ? ((breakdown.neutrophil / breakdown.totalWBC) * 100).toFixed(1) : 0}%
                                                            </td>
                                                        </tr>
                                                        <tr className="border-b border-blue-100">
                                                            <td className="py-2 text-slate-700">
                                                                Lymphocyte <span className="text-xs text-amber-600">(CLL/ALL indicator)</span>
                                                            </td>
                                                            <td className="text-right font-medium">{breakdown.lymphocyte}</td>
                                                            <td className="text-right text-slate-500">
                                                                {breakdown.totalWBC > 0 ? ((breakdown.lymphocyte / breakdown.totalWBC) * 100).toFixed(1) : 0}%
                                                            </td>
                                                        </tr>
                                                        <tr className="border-b border-blue-100">
                                                            <td className="py-2 text-slate-700">Monocyte</td>
                                                            <td className="text-right font-medium">{breakdown.monocyte}</td>
                                                            <td className="text-right text-slate-500">
                                                                {breakdown.totalWBC > 0 ? ((breakdown.monocyte / breakdown.totalWBC) * 100).toFixed(1) : 0}%
                                                            </td>
                                                        </tr>
                                                        <tr className="border-b border-blue-100">
                                                            <td className="py-2 text-slate-700">Eosinophil</td>
                                                            <td className="text-right font-medium">{breakdown.eosinophil}</td>
                                                            <td className="text-right text-slate-500">
                                                                {breakdown.totalWBC > 0 ? ((breakdown.eosinophil / breakdown.totalWBC) * 100).toFixed(1) : 0}%
                                                            </td>
                                                        </tr>
                                                        <tr className="border-b border-blue-100">
                                                            <td className="py-2 text-slate-700">Basophil</td>
                                                            <td className="text-right font-medium">{breakdown.basophil}</td>
                                                            <td className="text-right text-slate-500">
                                                                {breakdown.totalWBC > 0 ? ((breakdown.basophil / breakdown.totalWBC) * 100).toFixed(1) : 0}%
                                                            </td>
                                                        </tr>
                                                    </tbody>
                                                </table>

                                                {/* Normal WBCs Button */}
                                                {breakdown.normalWBCs.length > 0 && (
                                                    <div className="mt-3 pt-3 border-t border-blue-200">
                                                        <button
                                                            onClick={() => setShowNormalWBCs(!showNormalWBCs)}
                                                            className="w-full flex items-center justify-between px-3 py-2 bg-green-100 hover:bg-green-200 text-green-800 rounded-lg transition-colors"
                                                        >
                                                            <span className="font-medium flex items-center gap-2">
                                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                                </svg>
                                                                Normal WBCs (Detailed)
                                                            </span>
                                                            <span className="bg-green-600 text-white px-2 py-1 rounded text-xs font-bold">
                                                                {breakdown.normalWBCs.reduce((sum, o) => sum + o.count, 0)}
                                                            </span>
                                                        </button>

                                                        {showNormalWBCs && (
                                                            <div className="mt-2 bg-green-50 rounded-lg p-3 border border-green-200">
                                                                <p className="text-xs text-green-700 mb-2">
                                                                    ✓ These are normal variants of the main WBC types.
                                                                </p>
                                                                <table className="w-full text-sm">
                                                                    <thead>
                                                                        <tr className="border-b border-green-200">
                                                                            <th className="text-left py-1 text-green-700">Type</th>
                                                                            <th className="text-right py-1 text-green-700">Count</th>
                                                                            <th className="text-right py-1 text-green-700">%</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {breakdown.normalWBCs.map((normal, idx) => (
                                                                            <tr key={idx} className="border-b border-green-100">
                                                                                <td className="py-1 text-slate-700">
                                                                                    {normal.type}
                                                                                </td>
                                                                                <td className="text-right font-medium">{normal.count}</td>
                                                                                <td className="text-right text-slate-500">
                                                                                    {breakdown.totalWBC > 0 ? ((normal.count / breakdown.totalWBC) * 100).toFixed(1) : 0}%
                                                                                </td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Abnormal WBCs Button */}
                                                {breakdown.abnormalWBCs.length > 0 && (
                                                    <div className="mt-3 pt-3 border-t border-blue-200">
                                                        <button
                                                            onClick={() => setShowAbnormalWBCs(!showAbnormalWBCs)}
                                                            className="w-full flex items-center justify-between px-3 py-2 bg-orange-100 hover:bg-orange-200 text-orange-800 rounded-lg transition-colors"
                                                        >
                                                            <span className="font-medium flex items-center gap-2">
                                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                                </svg>
                                                                Abnormal WBCs (Detailed)
                                                            </span>
                                                            <span className="bg-orange-600 text-white px-2 py-1 rounded text-xs font-bold">
                                                                {breakdown.abnormalWBCs.reduce((sum, o) => sum + o.count, 0)}
                                                            </span>
                                                        </button>

                                                        {showAbnormalWBCs && (
                                                            <div className="mt-2 bg-orange-50 rounded-lg p-3 border border-orange-200">
                                                                <p className="text-xs text-orange-700 mb-2">
                                                                    ⚠️ These are abnormal variants of the main WBC types, may indicate disease.
                                                                </p>
                                                                <table className="w-full text-sm">
                                                                    <thead>
                                                                        <tr className="border-b border-orange-200">
                                                                            <th className="text-left py-1 text-orange-700">Type</th>
                                                                            <th className="text-right py-1 text-orange-700">Count</th>
                                                                            <th className="text-right py-1 text-orange-700">%</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {breakdown.abnormalWBCs.map((abnormal, idx) => (
                                                                            <tr key={idx} className="border-b border-orange-100 bg-orange-50">
                                                                                <td className="py-1 text-orange-700 font-medium">
                                                                                    {abnormal.type}
                                                                                </td>
                                                                                <td className="text-right font-medium">{abnormal.count}</td>
                                                                                <td className="text-right text-slate-500">
                                                                                    {breakdown.totalWBC > 0 ? ((abnormal.count / breakdown.totalWBC) * 100).toFixed(1) : 0}%
                                                                                </td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Other WBCs Button */}
                                                {breakdown.otherWBCs.length > 0 && (
                                                    <div className="mt-3 pt-3 border-t border-blue-200">
                                                        <button
                                                            onClick={() => setShowOtherWBCs(!showOtherWBCs)}
                                                            className="w-full flex items-center justify-between px-3 py-2 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg transition-colors"
                                                        >
                                                            <span className="font-medium flex items-center gap-2">
                                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                                </svg>
                                                                Other WBCs (Blast cells, Disease types)
                                                            </span>
                                                            <span className="bg-amber-600 text-white px-2 py-1 rounded text-xs font-bold">
                                                                {breakdown.otherWBCs.reduce((sum, o) => sum + o.count, 0)}
                                                            </span>
                                                        </button>

                                                        {showOtherWBCs && (
                                                            <div className="mt-2 bg-amber-50 rounded-lg p-3 border border-amber-200">
                                                                <p className="text-xs text-amber-700 mb-2">
                                                                    ⚠️ These cell types may indicate AML, ALL, CML, or CLL. Review thresholds.
                                                                </p>
                                                                <table className="w-full text-sm">
                                                                    <thead>
                                                                        <tr className="border-b border-amber-200">
                                                                            <th className="text-left py-1 text-amber-700">Type</th>
                                                                            <th className="text-right py-1 text-amber-700">Count</th>
                                                                            <th className="text-right py-1 text-amber-700">%</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {breakdown.otherWBCs.map((other, idx) => (
                                                                            <tr key={idx} className={`border-b border-amber-100 ${other.isDisease ? 'bg-red-50' : ''}`}>
                                                                                <td className={`py-1 ${other.isDisease ? 'text-red-700 font-medium' : 'text-slate-700'}`}>
                                                                                    {other.type}
                                                                                    {other.isDisease && <span className="ml-1 text-xs">🔴</span>}
                                                                                </td>
                                                                                <td className="text-right font-medium">{other.count}</td>
                                                                                <td className="text-right text-slate-500">
                                                                                    {breakdown.totalWBC > 0 ? ((other.count / breakdown.totalWBC) * 100).toFixed(1) : 0}%
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
