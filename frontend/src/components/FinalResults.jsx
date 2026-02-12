import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

import { generatePDF } from '../utils/pdfGenerator';

// Helper to transform cell type names for display (UI only - backend unchanged)
const formatCellTypeForDisplay = (name) => {
    if (!name) return name;
    // Transform B_Lymphoblast or B_lymphoblast to just Lymphoblast
    return name.replace(/B_[Ll]ymphoblast/g, 'Lymphoblast');
};

// Classification category helper for new 7-class model
const CLASS_LABELS = {
    'Normal WBC': { short: 'Normal', isDisease: false },
    'Normal RBC': { short: 'Normal RBC', isDisease: false },
    'Acute Lymphoblastic Leukemia': { short: 'ALL', isDisease: true },
    'Acute Myeloid Leukemia': { short: 'AML', isDisease: true },
    'Chronic Lymphocytic Leukemia': { short: 'CLL', isDisease: true },
    'Chronic Myeloid Leukemia': { short: 'CML', isDisease: true },
    'Sickle Cell Anemia': { short: 'SCA', isDisease: true },
};

export const FinalResults = ({
    aggregatedResults,
    processedImages,
    onReset,
    saveReport,
    patientName,
    patientId,
    patientAge,
    patientGender,
    patientPhone
}) => {
    const navigate = useNavigate();
    const [showWBCExamination, setShowWBCExamination] = useState(false);
    const [showRBCExamination, setShowRBCExamination] = useState(false);
    const [showAbnormalWBCs, setShowAbnormalWBCs] = useState(false);
    const [wbcFilter, setWbcFilter] = useState('all');
    const [expandedDiseaseCard, setExpandedDiseaseCard] = useState(null); // Track which disease card is expanded
    const [expandedSickleCell, setExpandedSickleCell] = useState(false); // Track sickle cell expansion
    const [activeTab, setActiveTab] = useState('overview'); // Tabs: overview, analysis, counts
    const [showDetailedMetrics, setShowDetailedMetrics] = useState(false); // Detailed Metrics panel

    if (!aggregatedResults || !aggregatedResults.thresholdMet) {

        return null;
    }

    const {
        totalWBC,
        totalRBC,
        totalPlatelets,
        estimatedWBCCount,
        estimatedRBCCount,
        avgRBCPerField,
        wbcClassifications,
        abnormalWBCs,
        diseaseFindings,
        normalWBCCount,
        diseaseWBCCount,
        overallClassification,
        sickleCell,
        patientStatus
    } = aggregatedResults;

    // Get classification category based on new 7-class ConvNeXt model
    const getClassificationCategory = (classification) => {
        if (!classification) {
            return { category: 'Other', label: 'Unknown', color: 'bg-slate-100 text-slate-800 border-slate-300' };
        }

        const info = CLASS_LABELS[classification];
        if (!info) {
            return { category: 'Other', label: classification, color: 'bg-slate-100 text-slate-800 border-slate-300' };
        }

        if (classification === 'Normal WBC') {
            return { category: 'Normal', label: 'Normal WBC', color: 'bg-green-100 text-green-800 border-green-300' };
        }
        if (classification === 'Normal RBC') {
            return { category: 'Normal', label: 'Normal RBC', color: 'bg-green-100 text-green-800 border-green-300' };
        }
        if (classification === 'Acute Lymphoblastic Leukemia') {
            return { category: 'ALL', label: 'ALL', color: 'bg-purple-100 text-purple-800 border-purple-300' };
        }
        if (classification === 'Acute Myeloid Leukemia') {
            return { category: 'AML', label: 'AML', color: 'bg-red-100 text-red-800 border-red-300' };
        }
        if (classification === 'Chronic Myeloid Leukemia') {
            return { category: 'CML', label: 'CML', color: 'bg-amber-100 text-amber-800 border-amber-300' };
        }
        if (classification === 'Chronic Lymphocytic Leukemia') {
            return { category: 'CLL', label: 'CLL', color: 'bg-orange-100 text-orange-800 border-orange-300' };
        }
        if (classification === 'Sickle Cell Anemia') {
            return { category: 'Sickle', label: 'Sickle Cell', color: 'bg-rose-100 text-rose-800 border-rose-300' };
        }

        return { category: 'Other', label: classification, color: 'bg-slate-100 text-slate-800 border-slate-300' };
    };



    // Classification Reference - Clinically established disease-specific thresholds
    // Each leukemia type uses clinically accurate thresholds
    const diseaseInterprestationRef = {
        'AML': [
            { level: 'Below Threshold', range: '< 20%', desc: 'Blasts detected below blast phase classification threshold.' },
            { level: 'Blast Phase', range: '≥ 20%', desc: 'AML blast phase classification threshold reached (≥ 20% blasts).' }
        ],
        'ALL': [
            { level: 'Below Threshold', range: '< 20%', desc: 'Lymphoblasts detected below lymphoblast classification threshold.' },
            { level: 'Lymphoblast Phase', range: '≥ 20%', desc: 'ALL lymphoblast classification threshold reached (≥ 20% lymphoblasts).' }
        ],
        'CML': [
            { level: 'Chronic Phase', range: '< 10%', desc: 'Blasts below 10%. Below accelerated phase threshold.' },
            { level: 'Accelerated Phase', range: '10% - 19%', desc: 'Blasts 10-19%. Accelerated phase classification threshold reached.' },
            { level: 'Blast Phase', range: '≥ 20%', desc: 'Blast Crisis – Blast phase classification threshold reached (≥ 20% blasts).' }
        ],
        'CLL': [
            { level: 'Below Suspicious', range: '< 40%', desc: 'Abnormal lymphocytes below suspicious threshold.' },
            { level: 'Suspicious Lymphocytosis', range: '40% - 50%', desc: 'Above monitoring threshold. Further evaluation may be warranted.' },
            { level: 'Typical CLL', range: '50% - 70%', desc: 'Moderate CLL classification threshold reached. Consistent with CLL classification.' },
            { level: 'Advanced/Untreated CLL', range: '> 70%', desc: 'High CLL classification threshold reached (> 70% abnormal lymphocytes).' }
        ]
    };

    // Filter WBCs based on selected filter
    const getFilteredWBCs = () => {
        if (!wbcClassifications) return [];
        if (wbcFilter === 'all') return wbcClassifications;
        if (wbcFilter === 'abnormal') {
            return wbcClassifications.filter(wbc => {
                const cat = getClassificationCategory(wbc.classification);
                return cat.category !== 'Normal';
            });
        }
        return wbcClassifications.filter(wbc => {
            const cat = getClassificationCategory(wbc.classification);
            return cat.category === wbcFilter;
        });
    };

    // Count WBCs by category
    const getCategoryCounts = () => {
        if (!wbcClassifications) return {};
        const counts = { 'Normal': 0, 'AML': 0, 'ALL': 0, 'CML': 0, 'CLL': 0, 'Other': 0 };
        wbcClassifications.forEach(wbc => {
            const cat = getClassificationCategory(wbc.classification);
            counts[cat.category] = (counts[cat.category] || 0) + 1;
        });
        return counts;
    };

    const categoryCounts = getCategoryCounts();
    const filteredWBCs = getFilteredWBCs();

    // Get severity styling
    const getStatusStyle = (status) => {
        switch (status?.toLowerCase()) {
            case 'critical':
                return 'bg-red-50 border-red-600 text-red-800';
            case 'abnormal':
                return 'bg-amber-50 border-amber-600 text-amber-800';
            case 'normal':
            default:
                return 'bg-green-50 border-green-600 text-green-800';
        }
    };

    const getStatusIcon = (status) => {
        switch (status?.toLowerCase()) {
            case 'critical':
                return '!';
            case 'abnormal':
                return '*';
            case 'normal':
            default:
                return '';
        }
    };
    // saveReport is now passed as a prop from Homepage.jsx

    // Generate PDF Report using shared utility
    const handlePrint = () => {
        console.log('handlePrint called');
        console.log('Patient:', patientName, patientId);
        const reportData = {
            id: Date.now().toString(),
            timestamp: new Date().toLocaleString(),
            patientData: {
                name: patientName,
                id: patientId, // MRN
                age: patientAge,
                gender: patientGender,
                phone: patientPhone
            },
            summary: {
                totalCells: (totalWBC + totalRBC + totalPlatelets),
                wbcCount: totalWBC,
                rbcCount: totalRBC,
                plateletCount: totalPlatelets,
                estimatedWBCCount: estimatedWBCCount,
                estimatedRBCCount: estimatedRBCCount,
                imagesAnalyzed: processedImages.length
            },
            data: {
                diseaseFindings: diseaseFindings,
                classificationCounts: wbcClassifications,
                normalWBCCount: normalWBCCount,
                diseaseWBCCount: diseaseWBCCount,
                sickleCell: sickleCell
            }
        };

        console.log('Generated report data:', reportData);
        try {
            generatePDF(reportData);
            console.log('PDF generation completed');
        } catch (error) {
            console.error('PDF generation failed:', error);
            alert('Failed to generate PDF: ' + error.message);
        }
    };

    return (
        <div className="bg-white rounded-lg border-2 border-slate-200 shadow-lg overflow-hidden">
            {/* Header */}
            <div className="bg-slate-800 text-white px-6 py-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <span className="text-2xl"></span>
                            Final Analysis Report
                        </h2>
                        <p className="text-slate-300 text-sm mt-1">
                            Analysis complete - 10 images processed
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-sm text-slate-300">Images Analyzed</p>
                        <p className="text-2xl font-bold">{processedImages.length}</p>
                    </div>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="bg-white border-b border-slate-200 px-6">
                <nav className="flex gap-6 overflow-x-auto" aria-label="Tabs">
                    <button
                        onClick={() => setActiveTab('overview')}
                        className={`py-4 px-1 inline-flex items-center gap-2 border-b-2 font-medium text-sm transition-colors ${activeTab === 'overview'
                            ? 'border-red-500 text-red-600'
                            : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                            }`}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        Overview
                    </button>
                    <button
                        onClick={() => setActiveTab('analysis')}
                        className={`py-4 px-1 inline-flex items-center gap-2 border-b-2 font-medium text-sm transition-colors ${activeTab === 'analysis'
                            ? 'border-red-500 text-red-600'
                            : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                            }`}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                        </svg>
                        Detailed Analysis
                    </button>
                    <button
                        onClick={() => setActiveTab('counts')}
                        className={`py-4 px-1 inline-flex items-center gap-2 border-b-2 font-medium text-sm transition-colors ${activeTab === 'counts'
                            ? 'border-red-500 text-red-600'
                            : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                            }`}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Cell Counts & Raw Data
                    </button>
                </nav>
            </div>

            {/* Enhanced Patient Status Banner with Detailed Counts and Condition Assessment */}
            {/* TAB CONTENT: OVERVIEW */}
            {activeTab === 'overview' && (
                <div className="bg-slate-50">
                    <div className={`px-6 py-6 border-l-4 bg-white border-b border-slate-200 ${getStatusStyle(patientStatus)}`}>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <span className="text-4xl shadow-sm rounded-full bg-white p-2">
                                        {patientStatus === 'Critical' ? (
                                            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        ) : patientStatus === 'Abnormal' ? (
                                            <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                        ) : (
                                            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        )}
                                    </span>
                                    <div>
                                        <p className="text-sm font-medium opacity-75 text-slate-500">Overall Classification Status</p>
                                        <p className="text-3xl font-bold text-slate-800">{patientStatus || 'Normal'}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm opacity-75 text-slate-500">Total WBCs Counted</p>
                                    <p className="text-4xl font-bold text-slate-800">{totalWBC}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="px-6 py-6">
                        <h3 className="text-lg font-semibold text-slate-700 mb-4">Classification Summary</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                <p className="text-sm font-medium text-slate-500 mb-1">Classified WBCs</p>
                                <p className="text-3xl font-bold text-slate-800">{totalWBC}</p>
                            </div>
                            <div className={`bg-white p-4 rounded-xl border shadow-sm ${abnormalWBCs.length > 0 ? 'border-amber-200' : 'border-slate-200'}`}>
                                <p className="text-sm font-medium text-slate-500 mb-1">Abnormal WBCs</p>
                                <p className={`text-3xl font-bold ${abnormalWBCs.length > 0 ? 'text-amber-600' : 'text-slate-700'}`}>{abnormalWBCs.length}</p>
                                <p className="text-xs text-slate-500 mt-1">{totalWBC > 0 ? ((abnormalWBCs.length / totalWBC) * 100).toFixed(1) : 0}% of detected</p>
                            </div>
                            <div className={`bg-white p-4 rounded-xl border shadow-sm ${sickleCell.severity !== 'NORMAL' ? 'border-red-200' : 'border-slate-200'}`}>
                                <p className="text-sm font-medium text-slate-500 mb-1">Sickle Cells</p>
                                <p className={`text-3xl font-bold ${sickleCell.severity !== 'NORMAL' ? 'text-red-600' : 'text-slate-700'}`}>{sickleCell.count}</p>
                                <p className="text-xs text-slate-500 mt-1">{totalRBC > 0 ? ((sickleCell.count / totalRBC) * 100).toFixed(1) : 0}% of RBCs</p>
                            </div>
                        </div>

                        {/* Overall Normal vs Disease Classification */}
                        {overallClassification && (
                            <div className={`mt-4 p-4 rounded-xl border shadow-sm ${
                                overallClassification.level === 'normal' ? 'bg-green-50 border-green-200' :
                                overallClassification.level === 'low' ? 'bg-blue-50 border-blue-200' :
                                overallClassification.level === 'moderate' ? 'bg-amber-50 border-amber-200' :
                                'bg-red-50 border-red-200'
                            }`}>
                                <div className="flex items-center justify-between mb-2">
                                    <p className={`text-sm font-semibold ${
                                        overallClassification.level === 'normal' ? 'text-green-700' :
                                        overallClassification.level === 'low' ? 'text-blue-700' :
                                        overallClassification.level === 'moderate' ? 'text-amber-700' :
                                        'text-red-700'
                                    }`}>Normal vs Disease WBC Ratio</p>
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase ${
                                        overallClassification.level === 'normal' ? 'bg-green-200 text-green-800' :
                                        overallClassification.level === 'low' ? 'bg-blue-200 text-blue-800' :
                                        overallClassification.level === 'moderate' ? 'bg-amber-200 text-amber-800' :
                                        'bg-red-200 text-red-800'
                                    }`}>{overallClassification.level}</span>
                                </div>
                                <div className="flex items-center gap-4 mb-2">
                                    <div className="flex-1">
                                        <div className="w-full h-4 bg-slate-200 rounded-full overflow-hidden flex">
                                            <div className="h-full bg-green-500 transition-all duration-700 rounded-l-full" 
                                                style={{ width: `${overallClassification.normalPercentage}%` }} />
                                            <div className="h-full bg-red-400 transition-all duration-700 rounded-r-full" 
                                                style={{ width: `${overallClassification.diseasePercentage}%` }} />
                                        </div>
                                    </div>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-green-700 font-semibold">Normal: {overallClassification.normalPercentage?.toFixed(1)}%</span>
                                    <span className="text-red-600 font-semibold">Disease: {overallClassification.diseasePercentage?.toFixed(1)}%</span>
                                </div>
                                <p className="text-xs text-slate-600 mt-2">{overallClassification.interpretation}</p>
                            </div>
                        )}

                        {/* Combined Confidence + Classification Bar Chart + Per-Image Severity */}
                        {(() => {
                            // Combined average confidence across all classified WBCs
                            const allConfs = (wbcClassifications || []).map(c => c.classification_confidence || c.confidence || 0).filter(c => c > 0);
                            const avgConf = allConfs.length > 0 ? allConfs.reduce((a, b) => a + b, 0) / allConfs.length : 0;

                            // Classification breakdown for bar chart
                            const BAR_CLASSES = [
                                { key: 'Normal WBC', label: 'Normal', color: 'bg-green-500', text: 'text-green-700' },
                                { key: 'Acute Lymphoblastic Leukemia', label: 'ALL', color: 'bg-purple-500', text: 'text-purple-700' },
                                { key: 'Acute Myeloid Leukemia', label: 'AML', color: 'bg-red-500', text: 'text-red-700' },
                                { key: 'Chronic Lymphocytic Leukemia', label: 'CLL', color: 'bg-orange-500', text: 'text-orange-700' },
                                { key: 'Chronic Myeloid Leukemia', label: 'CML', color: 'bg-amber-500', text: 'text-amber-700' },
                                { key: 'Sickle Cell Anemia', label: 'SCA', color: 'bg-rose-500', text: 'text-rose-700' },
                            ];
                            const classCounts = {};
                            (wbcClassifications || []).forEach(cls => {
                                const t = cls.classification || '';
                                classCounts[t] = (classCounts[t] || 0) + 1;
                            });
                            const classPcts = BAR_CLASSES.map(c => ({
                                ...c,
                                count: classCounts[c.key] || 0,
                                pct: totalWBC > 0 ? ((classCounts[c.key] || 0) / totalWBC) * 100 : 0
                            }));

                            // Per-image severity breakdown
                            const severityCounts = { Normal: 0, Abnormal: 0, Critical: 0 };
                            (processedImages || []).forEach(img => {
                                const classifications = img.wbcClassifications || img.classifications || img.results?.wbc_classifications || img.results?.stage2_classification || [];
                                const imgTotal = classifications.length;
                                if (imgTotal === 0) { severityCounts.Normal++; return; }
                                const diseaseCount = classifications.filter(c => {
                                    const cl = c.classification || '';
                                    return cl !== 'Normal WBC' && cl !== 'Normal RBC' && cl !== '';
                                }).length;
                                const diseasePct = (diseaseCount / imgTotal) * 100;
                                if (diseasePct >= 20) severityCounts.Critical++;
                                else if (diseasePct > 0) severityCounts.Abnormal++;
                                else severityCounts.Normal++;
                            });

                            return (
                                <>
                                    {/* Combined Classification Confidence */}
                                    {avgConf > 0 && (
                                        <div className="mt-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                            <div className="flex items-center justify-between mb-2">
                                                <p className="text-sm font-medium text-slate-600">Combined Classification Confidence</p>
                                                <span className={`text-sm font-bold ${
                                                    avgConf >= 0.8 ? 'text-green-700' : avgConf >= 0.6 ? 'text-amber-700' : 'text-red-700'
                                                }`}>{(avgConf * 100).toFixed(1)}%</span>
                                            </div>
                                            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                                                <div className={`h-full rounded-full transition-all duration-700 ${
                                                    avgConf >= 0.8 ? 'bg-green-500' : avgConf >= 0.6 ? 'bg-amber-500' : 'bg-red-400'
                                                }`} style={{ width: `${avgConf * 100}%` }} />
                                            </div>
                                            <p className="text-xs text-slate-400 mt-1">Based on {allConfs.length} classified cells across {processedImages?.length || 0} images</p>
                                        </div>
                                    )}

                                    {/* Classification Breakdown Bar Chart */}
                                    <div className="mt-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                        <p className="text-sm font-medium text-slate-600 mb-3">Classification Breakdown (All Images)</p>
                                        <div className="space-y-2">
                                            {[...classPcts].sort((a, b) => b.pct - a.pct).map((cls) => (
                                                <div key={cls.key} className="flex items-center gap-2">
                                                    <span className={`${cls.text} text-xs w-14 font-semibold`}>{cls.label}</span>
                                                    <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full ${cls.color} transition-all duration-500 rounded-full`}
                                                            style={{ width: `${cls.pct}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-slate-700 text-xs font-medium w-20 text-right">
                                                        {cls.count > 0 ? `${cls.count} (${cls.pct.toFixed(1)}%)` : '0'}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                        {/* Legend matching bar colors */}
                                        <div className="mt-3 pt-2 border-t border-slate-100 flex flex-wrap justify-center gap-4 text-xs font-medium text-slate-500">
                                            {BAR_CLASSES.map(cls => (
                                                <div key={cls.key} className="flex items-center gap-1.5">
                                                    <span className={`w-2.5 h-2.5 rounded-full ${cls.color}`}></span>
                                                    <span>{cls.label}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Per-Image Severity Summary */}
                                    {processedImages && processedImages.length > 0 && (
                                        <div className="mt-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                            <p className="text-sm font-medium text-slate-600 mb-3">Per-Image Analysis Summary</p>
                                            <div className="grid grid-cols-3 gap-3">
                                                <div className="bg-green-50 rounded-lg p-3 border border-green-200 text-center">
                                                    <p className="text-green-600 text-xs font-medium">Normal</p>
                                                    <p className="text-2xl font-bold text-green-700">{severityCounts.Normal}</p>
                                                    <p className="text-green-500 text-xs">images</p>
                                                </div>
                                                <div className={`rounded-lg p-3 border text-center ${severityCounts.Abnormal > 0 ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
                                                    <p className={`text-xs font-medium ${severityCounts.Abnormal > 0 ? 'text-amber-600' : 'text-slate-500'}`}>Abnormal</p>
                                                    <p className={`text-2xl font-bold ${severityCounts.Abnormal > 0 ? 'text-amber-700' : 'text-slate-400'}`}>{severityCounts.Abnormal}</p>
                                                    <p className={`text-xs ${severityCounts.Abnormal > 0 ? 'text-amber-500' : 'text-slate-400'}`}>images</p>
                                                </div>
                                                <div className={`rounded-lg p-3 border text-center ${severityCounts.Critical > 0 ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
                                                    <p className={`text-xs font-medium ${severityCounts.Critical > 0 ? 'text-red-600' : 'text-slate-500'}`}>Critical</p>
                                                    <p className={`text-2xl font-bold ${severityCounts.Critical > 0 ? 'text-red-700' : 'text-slate-400'}`}>{severityCounts.Critical}</p>
                                                    <p className={`text-xs ${severityCounts.Critical > 0 ? 'text-red-500' : 'text-slate-400'}`}>images</p>
                                                </div>
                                            </div>
                                            {/* Alert banner if there are critical/abnormal images */}
                                            {(severityCounts.Critical > 0 || severityCounts.Abnormal > 0) && (
                                                <div className={`mt-3 px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2 ${
                                                    severityCounts.Critical > 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                                                }`}>
                                                    <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                                    </svg>
                                                    {severityCounts.Critical > 0 
                                                        ? `${severityCounts.Critical} image(s) flagged as Critical (\u226520% disease cells). Further review recommended.`
                                                        : `${severityCounts.Abnormal} image(s) flagged as Abnormal (disease cells detected). Further evaluation recommended.`
                                                    }
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </>
                            );
                        })()}
                    </div>

                        {/* Detailed Metrics Button */}
                        <div className="mt-4">
                            <button
                                onClick={() => setShowDetailedMetrics(!showDetailedMetrics)}
                                className="w-full flex items-center justify-between px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors border border-slate-200"
                            >
                                <span className="font-medium flex items-center gap-2">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                    </svg>
                                    Detailed Metrics
                                </span>
                                <svg className={`w-5 h-5 transition-transform ${showDetailedMetrics ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>

                            {showDetailedMetrics && (
                                <div className="mt-3 bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-5">
                                    {/* Estimated Cell Counts */}
                                    <div>
                                        <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                                            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                                            </svg>
                                            Estimated Cell Counts
                                        </h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {/* WBC Estimation */}
                                            <div className={`rounded-lg p-4 border ${
                                                estimatedWBCCount > 0 && estimatedWBCCount < 5000 ? 'bg-amber-50 border-amber-300' :
                                                estimatedWBCCount > 10000 ? 'bg-red-50 border-red-300' : 'bg-blue-50 border-blue-200'
                                            }`}>
                                                <div className="flex items-center justify-between mb-1">
                                                    <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Estimated WBC Count</p>
                                                    {estimatedWBCCount > 0 && estimatedWBCCount < 5000 && (
                                                        <span className="flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">
                                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                                                            LOW
                                                        </span>
                                                    )}
                                                    {estimatedWBCCount > 10000 && (
                                                        <span className="flex items-center gap-1 text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">
                                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
                                                            HIGH
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-2xl font-bold text-blue-900">
                                                    {estimatedWBCCount ? estimatedWBCCount.toLocaleString() : '—'} <span className="text-sm font-normal text-blue-600">cells/mm³</span>
                                                </p>
                                                <p className="text-xs text-blue-600 mt-1">
                                                    {estimatedWBCCount ? `${(estimatedWBCCount / 1000).toFixed(1)} × 10⁹/L` : '—'}
                                                </p>
                                                <p className="text-xs text-slate-500 mt-2">Formula: Ave. WBC/HPF × 2,000</p>
                                                <div className="mt-2 pt-2 border-t border-blue-200 space-y-1">
                                                    <p className="text-xs text-slate-600">
                                                        <span className="font-medium">Normal Range:</span> 5,000 – 10,000 /mm³ (5–10 × 10⁹/L)
                                                    </p>
                                                    {estimatedWBCCount > 0 && (
                                                        <p className={`text-xs font-semibold mt-1 ${
                                                            estimatedWBCCount < 5000 ? 'text-amber-600' :
                                                            estimatedWBCCount > 10000 ? 'text-red-600' : 'text-green-600'
                                                        }`}>
                                                            {estimatedWBCCount < 5000 ? '↓ Below normal range (Leukopenia)' :
                                                             estimatedWBCCount > 10000 ? '↑ Above normal range (Leukocytosis)' :
                                                             '✓ Within normal range'}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* RBC Estimation */}
                                            {(() => {
                                                const rbcM = estimatedRBCCount ? estimatedRBCCount / 1e6 : 0;
                                                const isMale = patientGender?.toLowerCase() === 'male';
                                                const isFemale = patientGender?.toLowerCase() === 'female';
                                                const low = isFemale ? 4.0 : 4.5;
                                                const high = isFemale ? 5.5 : 6.0;
                                                const genderLabel = isMale ? 'Male' : isFemale ? 'Female' : 'General';
                                                const isLow = rbcM > 0 && rbcM < low;
                                                const isHigh = rbcM > high;
                                                return (
                                                    <div className={`rounded-lg p-4 border ${
                                                        isLow ? 'bg-amber-50 border-amber-300' :
                                                        isHigh ? 'bg-red-50 border-red-300' : 'bg-red-50 border-red-200'
                                                    }`}>
                                                        <div className="flex items-center justify-between mb-1">
                                                            <p className="text-xs font-semibold text-red-700 uppercase tracking-wide">Estimated RBC Count</p>
                                                            {isLow && (
                                                                <span className="flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">
                                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                                                                    LOW
                                                                </span>
                                                            )}
                                                            {isHigh && (
                                                                <span className="flex items-center gap-1 text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">
                                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
                                                                    HIGH
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-2xl font-bold text-red-900">
                                                            {rbcM > 0 ? rbcM.toFixed(2) : '—'} <span className="text-sm font-normal text-red-600">M/mm³</span>
                                                        </p>
                                                        <p className="text-xs text-red-600 mt-1">
                                                            {rbcM > 0 ? `${rbcM.toFixed(2)} × 10¹²/L` : '—'}
                                                        </p>
                                                        <p className="text-xs text-slate-500 mt-2">Formula: Ave. RBC/field × 200,000</p>
                                                        <p className="text-xs text-slate-500">Avg RBC/field: {avgRBCPerField ? avgRBCPerField.toFixed(1) : '—'}</p>
                                                        <div className="mt-2 pt-2 border-t border-red-200 space-y-1">
                                                            <p className="text-xs text-slate-600">
                                                                <span className="font-medium">♂ Male Normal:</span> 4.5 – 6.0 M/mm³ (4.5–6.0 × 10¹²/L)
                                                            </p>
                                                            <p className="text-xs text-slate-600">
                                                                <span className="font-medium">♀ Female Normal:</span> 4.0 – 5.5 M/mm³ (4.0–5.5 × 10¹²/L)
                                                            </p>
                                                            {rbcM > 0 && (
                                                                <p className={`text-xs font-semibold mt-1 ${
                                                                    isLow ? 'text-amber-600' :
                                                                    isHigh ? 'text-red-600' : 'text-green-600'
                                                                }`}>
                                                                    {isLow ? `↓ Below normal (${genderLabel} range: ${low}–${high} M/mm³)` :
                                                                     isHigh ? `↑ Above normal (${genderLabel} range: ${low}–${high} M/mm³)` :
                                                                     `✓ Within normal (${genderLabel} range: ${low}–${high} M/mm³)`}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    </div>

                                    {/* Raw Detection Counts */}
                                    <div>
                                        <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                                            <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                                            </svg>
                                            Raw Detection Counts
                                        </h4>
                                        <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                                            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-center">
                                                <p className="text-lg font-bold text-slate-800">{totalWBC}</p>
                                                <p className="text-xs text-slate-500">WBCs Detected</p>
                                            </div>
                                            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-center">
                                                <p className="text-lg font-bold text-slate-800">{totalRBC}</p>
                                                <p className="text-xs text-slate-500">RBCs Detected</p>
                                            </div>
                                            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-center">
                                                <p className="text-lg font-bold text-slate-800">{totalPlatelets}</p>
                                                <p className="text-xs text-slate-500">Platelets</p>
                                            </div>
                                            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-center">
                                                <p className="text-lg font-bold text-green-700">{normalWBCCount}</p>
                                                <p className="text-xs text-slate-500">Normal WBCs</p>
                                            </div>
                                            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-center">
                                                <p className="text-lg font-bold text-red-700">{diseaseWBCCount}</p>
                                                <p className="text-xs text-slate-500">Disease WBCs</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Analysis Info */}
                                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 text-xs text-slate-500">
                                        <p>
                                            <strong>Note:</strong> Estimated counts are calculated from {processedImages.length} fields of view 
                                            (100× oil immersion). WBC formula: Average WBC per HPF × 2,000. RBC formula: Average RBC per field × 200,000.
                                            Reference ranges based on established hematology standards.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                </div>
            )}


            {/* TAB CONTENT: DETAILED ANALYSIS */}
            {activeTab === 'analysis' && (
                <div>
                    <div className="px-6 py-6 border-b border-slate-200 bg-white">
                        <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">Classification Analysis</h3>
                        <p className="text-sm text-slate-500 mb-4">Leukemia classification markers based on cellular morphology.</p>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                            {['AML', 'ALL', 'CML', 'CLL'].map(diseaseType => {
                                const finding = diseaseFindings.find(f => f.type.includes(diseaseType));
                                const pct = finding ? finding.percentage : 0;
                                const sev = finding ? finding.severity : 'NORMAL';
                                // Treat 'NORMAL' or 'INFO' as effectively 'Normal/Low concern' for styling - use Green
                                const style = (pct === 0 || sev === 'NORMAL') ? 'bg-white border-green-200' : sev === 'HIGH' ? 'bg-red-50 border-red-300' : sev === 'MODERATE' ? 'bg-amber-50 border-amber-300' : 'bg-yellow-50 border-yellow-300';
                                const textStyle = (pct === 0 || sev === 'NORMAL') ? 'text-green-600' : sev === 'HIGH' ? 'text-red-700' : 'text-amber-700';
                                const refData = diseaseInterprestationRef[diseaseType];

                                return (
                                    <div key={diseaseType} className={`group relative rounded-lg border ${style} p-3 transition-all hover:shadow-md cursor-help`}>
                                        <div className="flex justify-between items-center mb-1">
                                            <h4 className="font-bold text-slate-800 text-sm">{diseaseType}</h4>
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white/50 border">{sev}</span>
                                        </div>
                                        <p className={`text-2xl font-bold ${textStyle}`}>{pct.toFixed(2)}%</p>
                                        <p className="text-xs text-slate-500 mt-1 truncate">{finding ? finding.interpretation : 'Not Detected'}</p>

                                        {/* Hover Tooltip */}
                                        <div className="absolute z-10 bottom-full left-0 w-64 p-3 bg-slate-800 text-white text-xs rounded shadow-xl hidden group-hover:block mb-2 pointer-events-none">
                                            <p className="font-bold border-b border-slate-600 pb-1 mb-1">{diseaseType} Severity Scale</p>
                                            {refData.map((r, idx) => (
                                                <div key={idx} className="flex justify-between mb-1 last:mb-0">
                                                    <span className={`font-mono ${(sev === r.level.toUpperCase()) || (sev === 'NORMAL' && r.level === 'Normal') ? 'text-yellow-400 font-bold' : 'text-slate-400'}`}>{r.range}</span>
                                                    <span className="text-right truncate ml-2">{r.level}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Disease-Specific Classification Thresholds */}
                    <div className="mt-8 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                </svg>
                                <h4 className="font-bold text-slate-800 text-base">Disease Classification Thresholds</h4>
                            </div>
                            <p className="text-xs text-slate-500 mb-5 ml-7">Percentage thresholds used for each leukemia subtype. Calculated as (disease-type count ÷ total WBC) × 100.</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                {Object.entries(diseaseInterprestationRef).map(([disease, levels]) => (
                                    <div key={disease} className="bg-slate-50 rounded-xl p-4 border border-slate-200 hover:shadow-md transition-shadow">
                                        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-200">
                                            <span className={`w-2.5 h-2.5 rounded-full ${
                                                disease === 'AML' ? 'bg-red-500' : disease === 'ALL' ? 'bg-purple-500' : disease === 'CML' ? 'bg-amber-500' : 'bg-orange-500'
                                            }`}></span>
                                            <h5 className="font-bold text-slate-800 text-sm tracking-wide uppercase">{disease}</h5>
                                        </div>
                                        <div className="space-y-2.5">
                                            {levels.map((level, idx) => (
                                                <div key={idx} className="flex items-start gap-3">
                                                    <span className={`font-mono font-bold flex-shrink-0 w-[5.5rem] px-2 py-1 rounded-md text-center text-[11px] border ${
                                                        idx === levels.length - 1 ? 'bg-red-50 text-red-700 border-red-200' :
                                                        idx >= levels.length - 2 ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                        'bg-green-50 text-green-700 border-green-200'
                                                    }`}>{level.range}</span>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-semibold text-slate-700 text-xs leading-tight">{level.level}</p>
                                                        <p className="text-slate-500 text-[11px] mt-0.5 leading-snug">{level.desc}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {sickleCell && (
                        <div className="mt-8 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                            <div className="flex items-center gap-2 mb-1">
                                <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                                </svg>
                                <h3 className="font-bold text-slate-800 text-base">Sickle Cell Detailed Analysis</h3>
                            </div>
                            <p className="text-xs text-slate-500 mb-5 ml-7">RBC morphology assessment for sickle cell classification based on detected cell proportions.</p>
                            <div className={`rounded-xl border p-5 ${sickleCell.severity !== 'NORMAL' ? 'bg-red-50/50 border-red-200' : 'bg-green-50/50 border-green-200'}`}>
                                <div className="flex justify-between items-center mb-4 pb-3 border-b border-black/5">
                                    <h4 className="font-bold text-slate-800 text-sm tracking-wide uppercase flex items-center gap-2">
                                        RBC Morphology Status
                                    </h4>
                                    <span className={`text-xs font-bold px-3 py-1 rounded-full border ${sickleCell.severity !== 'NORMAL' ? 'bg-red-100 text-red-800 border-red-200' : 'bg-green-100 text-green-800 border-green-200'}`}>
                                        {sickleCell.severity}
                                    </span>
                                </div>

                                {/* Sickle Cell Statistics */}
                                <div className="grid grid-cols-3 gap-4 mb-4">
                                    <div className="bg-white/80 rounded-lg p-3 text-center border border-black/5">
                                        <p className={`text-2xl font-bold ${sickleCell.severity !== 'NORMAL' ? 'text-red-600' : 'text-slate-700'}`}>
                                            {sickleCell.count}
                                        </p>
                                        <p className="text-xs text-slate-500">Sickle Cells</p>
                                    </div>
                                    <div className="bg-white/80 rounded-lg p-3 text-center border border-black/5">
                                        <p className={`text-2xl font-bold ${sickleCell.severity !== 'NORMAL' ? 'text-red-600' : 'text-slate-700'}`}>
                                            {sickleCell.percentage?.toFixed(2) || '0.00'}%
                                        </p>
                                        <p className="text-xs text-slate-500">Percentage of RBCs</p>
                                    </div>
                                    <div className="bg-white/80 rounded-lg p-3 text-center border border-black/5">
                                        <p className="text-2xl font-bold text-slate-700">
                                            {sickleCell.totalRBC || totalRBC}
                                        </p>
                                        <p className="text-xs text-slate-500">Total RBCs Analyzed</p>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Interpretation</h5>
                                        <p className="text-slate-900 font-medium leading-relaxed">{sickleCell.interpretation || 'No interpretation available.'}</p>
                                    </div>

                                    <div className="bg-white/60 rounded-lg p-3 border border-black/5">
                                        <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                                            Classification Note
                                        </h5>
                                        <p className="text-sm text-slate-800 leading-relaxed">
                                            {sickleCell.recommendation || 'No specific recommendation provided.'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Detailed Sickle Cell Reference */}
                            <div className="mt-5 bg-white/80 p-4 rounded-xl border border-slate-200">
                                <h4 className="font-bold text-slate-700 mb-3 text-xs tracking-wide uppercase flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                                    Sickle Cell Classification Levels
                                </h4>
                                <div className="grid grid-cols-1 gap-2.5 text-sm text-slate-600">
                                    <div className="flex items-start gap-3">
                                        <span className="font-mono font-bold flex-shrink-0 w-[5.5rem] px-2 py-1 rounded-md text-center text-[11px] border bg-green-50 text-green-700 border-green-200">&lt; 3%</span>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-slate-700 text-xs leading-tight">Normal</p>
                                            <p className="text-slate-500 text-[11px] mt-0.5 leading-snug">Below classification threshold. Likely artifact or normal variant.</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <span className="font-mono font-bold flex-shrink-0 w-[5.5rem] px-2 py-1 rounded-md text-center text-[11px] border bg-yellow-50 text-yellow-700 border-yellow-200">3 – 10%</span>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-slate-700 text-xs leading-tight">Mild</p>
                                            <p className="text-slate-500 text-[11px] mt-0.5 leading-snug">Mild sickling threshold met. Suggestive of sickle cell trait (HbAS) pattern.</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <span className="font-mono font-bold flex-shrink-0 w-[5.5rem] px-2 py-1 rounded-md text-center text-[11px] border bg-amber-50 text-amber-700 border-amber-200">10 – 30%</span>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-slate-700 text-xs leading-tight">Moderate</p>
                                            <p className="text-slate-500 text-[11px] mt-0.5 leading-snug">Moderate sickling threshold met. Suggestive of sickle cell disease (HbSS/HbSC) pattern.</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <span className="font-mono font-bold flex-shrink-0 w-[5.5rem] px-2 py-1 rounded-md text-center text-[11px] border bg-red-50 text-red-700 border-red-200">&gt; 30%</span>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-slate-700 text-xs leading-tight">Severe</p>
                                            <p className="text-slate-500 text-[11px] mt-0.5 leading-snug">Severe sickling threshold met. Classification consistent with active sickle cell morphology.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )
            }

            {/* TAB CONTENT: CELL COUNTS */}
            {
                activeTab === 'counts' && (
                    <div>

                        <div className="hidden">
                            <div className={`px-6 py-6 border-l-4 ${getStatusStyle(patientStatus)}`}>
                                <div className="space-y-4">
                                    {/* Main Status and WBC Count Row */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <span className="text-4xl shadow-sm rounded-full bg-white p-2">
                                                {patientStatus === 'Critical' ? (
                                                    <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                ) : patientStatus === 'Abnormal' ? (
                                                    <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                    </svg>
                                                ) : (
                                                    <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                )}
                                            </span>
                                            <div>
                                                <p className="text-sm font-medium opacity-75">Overall Classification Status</p>
                                                <p className="text-3xl font-bold">{patientStatus || 'Normal'}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm opacity-75">Total WBCs Counted</p>
                                            <p className="text-4xl font-bold">{totalWBC}</p>
                                        </div>
                                    </div>

                                    {/* Classification Summary Section - Enhanced with Click-to-Expand */}
                                    <div className="bg-white/50 rounded-lg p-4 space-y-4">
                                        <div className="flex items-center justify-between border-b pb-2">
                                            <h4 className="font-semibold text-sm">Classification Summary (Across 10 Images)</h4>
                                            <span className="text-[10px] text-blue-600 bg-blue-50 px-2 py-1 rounded-full font-medium">
                                                Click cards for medical interpretation
                                            </span>
                                        </div>

                                        {/* Total Classified WBCs */}
                                        <div className="grid grid-cols-3 gap-3">
                                            <div className="bg-white rounded-lg p-3 border">
                                                <p className="text-xs opacity-75 mb-1">Classified WBCs</p>
                                                <p className="text-2xl font-bold text-blue-700">
                                                    {wbcClassifications?.length || 0}
                                                </p>
                                                <p className="text-xs text-slate-500 mt-1">
                                                    {totalWBC > 0 ? ((wbcClassifications?.length / totalWBC) * 100).toFixed(1) : 0}% of detected
                                                </p>
                                            </div>

                                            {/* Abnormal WBCs Count */}
                                            <div className="bg-white rounded-lg p-3 border border-amber-200">
                                                <p className="text-xs opacity-75 mb-1">Abnormal WBCs</p>
                                                <p className="text-2xl font-bold text-amber-700">
                                                    {abnormalWBCs?.length || 0}
                                                </p>
                                                <p className="text-xs text-slate-500 mt-1">
                                                    {wbcClassifications?.length > 0 ? ((abnormalWBCs?.length / wbcClassifications.length) * 100).toFixed(1) : 0}% abnormal
                                                </p>
                                            </div>

                                            {/* Sickle Cells Count */}
                                            <div className={`bg-white rounded-lg p-3 border ${sickleCell && sickleCell.count > 0 ? 'border-red-300' : 'border-green-200'
                                                }`}>
                                                <p className="text-xs opacity-75 mb-1">Sickle Cells</p>
                                                <p className={`text-2xl font-bold ${sickleCell && sickleCell.count > 0 ? 'text-red-700' : 'text-green-700'
                                                    }`}>
                                                    {sickleCell?.count || 0}
                                                </p>
                                                <p className="text-xs text-slate-500 mt-1">
                                                    {sickleCell?.percentage?.toFixed(1) || 0}% of RBCs
                                                </p>
                                            </div>
                                        </div>

                                        {/* Disease Findings - Interactive Cards */}
                                        {diseaseFindings && diseaseFindings.length > 0 && (
                                            <div className="space-y-3 mt-4">
                                                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider flex items-center gap-2">
                                                    <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                    </svg>
                                                    Detected Conditions
                                                </p>

                                                {diseaseFindings.map((finding, idx) => {
                                                    const isExpanded = expandedDiseaseCard === `summary-${idx}`;

                                                    // Get medical interpretation based on finding type
                                                    const getMedicalInfo = () => {
                                                        const pct = finding.percentage || 0;
                                                        const type = finding.type || '';

                                                        // Disease-specific threshold interpretation
                                                        const getAMLInfo = () => {
                                                            if (pct >= 20) return {
                                                                title: 'AML - Blast Phase Threshold',
                                                                interpretation: finding.interpretation,
                                                                action: `AML classification threshold met (≥ 20% blasts).`,
                                                                clinicalNote: `${pct.toFixed(1)}% of WBCs classified as AML blasts. Classification threshold for AML blast phase reached.`,
                                                                reference: `AML threshold: ≥ 20% blasts = classification threshold met.`,
                                                                color: 'red'
                                                            };
                                                            if (pct >= 10) return {
                                                                title: 'AML - Intermediate Level',
                                                                interpretation: finding.interpretation,
                                                                action: `AML blasts at intermediate level (10–19%). Below 20% classification threshold.`,
                                                                clinicalNote: `${pct.toFixed(1)}% blasts detected. Below the 20% threshold for AML classification.`,
                                                                reference: `AML threshold: ≥ 20% blasts required for classification.`,
                                                                color: 'amber'
                                                            };
                                                            return {
                                                                title: 'AML - Below Threshold',
                                                                interpretation: finding.interpretation,
                                                                action: `AML blasts below classification threshold (< 10%).`,
                                                                clinicalNote: `${pct.toFixed(1)}% blasts detected. Well below 20% classification threshold.`,
                                                                reference: `AML threshold: ≥ 20% blasts required for classification.`,
                                                                color: 'yellow'
                                                            };
                                                        };

                                                        const getALLInfo = () => {
                                                            if (pct >= 20) return {
                                                                title: 'ALL - Lymphoblast Phase Threshold',
                                                                interpretation: finding.interpretation,
                                                                action: `ALL classification threshold met (≥ 20% lymphoblasts).`,
                                                                clinicalNote: `${pct.toFixed(1)}% of WBCs classified as ALL lymphoblasts. Classification threshold reached.`,
                                                                reference: `ALL threshold: ≥ 20% lymphoblasts = classification threshold met.`,
                                                                color: 'red'
                                                            };
                                                            if (pct >= 10) return {
                                                                title: 'ALL - Intermediate Level',
                                                                interpretation: finding.interpretation,
                                                                action: `ALL lymphoblasts at intermediate level (10–19%). Below 20% classification threshold.`,
                                                                clinicalNote: `${pct.toFixed(1)}% lymphoblasts detected. Below the 20% classification threshold.`,
                                                                reference: `ALL threshold: ≥ 20% lymphoblasts required for classification.`,
                                                                color: 'amber'
                                                            };
                                                            return {
                                                                title: 'ALL - Below Threshold',
                                                                interpretation: finding.interpretation,
                                                                action: `ALL lymphoblasts below classification threshold (< 10%).`,
                                                                clinicalNote: `${pct.toFixed(1)}% lymphoblasts detected. Well below 20% classification threshold.`,
                                                                reference: `ALL threshold: ≥ 20% lymphoblasts required for classification.`,
                                                                color: 'yellow'
                                                            };
                                                        };

                                                        const getCMLInfo = () => {
                                                            if (pct >= 20) return {
                                                                title: 'CML - Blast Phase Threshold',
                                                                interpretation: finding.interpretation,
                                                                action: `CML blast phase classification threshold met (≥ 20% blasts).`,
                                                                clinicalNote: `${pct.toFixed(1)}% blasts detected. Blast crisis classification threshold reached.`,
                                                                reference: `CML thresholds: < 10% chronic, 10–19% accelerated, ≥ 20% blast phase.`,
                                                                color: 'red'
                                                            };
                                                            if (pct >= 10) return {
                                                                title: 'CML - Accelerated Phase',
                                                                interpretation: finding.interpretation,
                                                                action: `CML accelerated phase classification threshold met (10–19% blasts).`,
                                                                clinicalNote: `${pct.toFixed(1)}% blasts detected. Within accelerated phase range.`,
                                                                reference: `CML thresholds: < 10% chronic, 10–19% accelerated, ≥ 20% blast phase.`,
                                                                color: 'amber'
                                                            };
                                                            return {
                                                                title: 'CML - Chronic Phase',
                                                                interpretation: finding.interpretation,
                                                                action: `CML blasts in chronic phase range (< 10%).`,
                                                                clinicalNote: `${pct.toFixed(1)}% blasts detected. Within chronic phase range.`,
                                                                reference: `CML thresholds: < 10% chronic, 10–19% accelerated, ≥ 20% blast phase.`,
                                                                color: 'yellow'
                                                            };
                                                        };

                                                        const getCLLInfo = () => {
                                                            if (pct > 70) return {
                                                                title: 'CLL - High Classification Threshold',
                                                                interpretation: finding.interpretation,
                                                                action: `High CLL classification threshold met (> 70% abnormal lymphocytes).`,
                                                                clinicalNote: `${pct.toFixed(1)}% abnormal lymphocytes. High classification threshold exceeded.`,
                                                                reference: `CLL thresholds: < 40% below suspicious, 40–50% suspicious, 50–70% typical, > 70% advanced.`,
                                                                color: 'red'
                                                            };
                                                            if (pct >= 50) return {
                                                                title: 'CLL - Typical CLL Range',
                                                                interpretation: finding.interpretation,
                                                                action: `Moderate CLL classification threshold met (50–70% abnormal lymphocytes).`,
                                                                clinicalNote: `${pct.toFixed(1)}% abnormal lymphocytes. Within typical CLL classification range.`,
                                                                reference: `CLL thresholds: < 40% below suspicious, 40–50% suspicious, 50–70% typical, > 70% advanced.`,
                                                                color: 'amber'
                                                            };
                                                            if (pct >= 40) return {
                                                                title: 'CLL - Suspicious Lymphocytosis',
                                                                interpretation: finding.interpretation,
                                                                action: `CLL above monitoring threshold (40–50%).`,
                                                                clinicalNote: `${pct.toFixed(1)}% abnormal lymphocytes. Above CLL monitoring threshold.`,
                                                                reference: `CLL thresholds: < 40% below suspicious, 40–50% suspicious, 50–70% typical, > 70% advanced.`,
                                                                color: 'yellow'
                                                            };
                                                            return {
                                                                title: 'CLL - Below Suspicious Threshold',
                                                                interpretation: finding.interpretation,
                                                                action: `CLL below suspicious threshold (< 40%).`,
                                                                clinicalNote: `${pct.toFixed(1)}% abnormal lymphocytes detected. Below CLL suspicious threshold.`,
                                                                reference: `CLL thresholds: < 40% below suspicious, 40–50% suspicious, 50–70% typical, > 70% advanced.`,
                                                                color: 'yellow'
                                                            };
                                                        };

                                                        if (type.includes('AML')) return getAMLInfo();
                                                        if (type.includes('ALL')) return getALLInfo();
                                                        if (type.includes('CML')) return getCMLInfo();
                                                        if (type.includes('CLL')) return getCLLInfo();

                                                        return {
                                                            title: finding.condition || finding.type,
                                                            interpretation: finding.interpretation,
                                                            action: 'Classification recorded.',
                                                            clinicalNote: 'Uncommon classification type.',
                                                            reference: 'See standard hematology classification references.',
                                                            color: 'slate'
                                                        };
                                                    };

                                                    const medicalInfo = getMedicalInfo();

                                                    return (
                                                        <div
                                                            key={idx}
                                                            onClick={() => setExpandedDiseaseCard(isExpanded ? null : `summary - ${idx} `)}
                                                            className={`group relative cursor - pointer rounded - xl border - 2 transition - all duration - 300 overflow - hidden ${medicalInfo.color === 'red' ? 'bg-red-50/80 border-red-200 hover:border-red-400 hover:bg-red-50 hover:shadow-lg hover:shadow-red-900/10' :
                                                                medicalInfo.color === 'amber' ? 'bg-amber-50/80 border-amber-200 hover:border-amber-400 hover:bg-amber-50 hover:shadow-lg hover:shadow-amber-900/10' :
                                                                    medicalInfo.color === 'yellow' ? 'bg-yellow-50/80 border-yellow-200 hover:border-yellow-400 hover:bg-yellow-50 hover:shadow-lg hover:shadow-yellow-900/10' :
                                                                        'bg-slate-50 border-slate-200 hover:border-slate-300 hover:shadow-lg'
                                                                } `}
                                                        >
                                                            {/* Hover Tooltip for Quick Action */}
                                                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                                                <div className="bg-slate-800 text-white text-xs py-1 px-2 rounded shadow-lg whitespace-nowrap">
                                                                    Click for details & actions
                                                                </div>
                                                            </div>

                                                            {/* Main Card Content */}
                                                            <div className="p-4">
                                                                <div className="flex justify-between items-start gap-4">
                                                                    <div className="flex-1">
                                                                        {/* Header with Severity Badge */}
                                                                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                                                                            <h5 className="font-bold text-slate-800 text-base">{medicalInfo.title}</h5>
                                                                            <span className={`px - 2 py - 0.5 rounded - full text - [10px] font - bold uppercase tracking - wide ${finding.severity === 'HIGH' ? 'bg-red-500 text-white shadow-sm' :
                                                                                finding.severity === 'MODERATE' ? 'bg-amber-500 text-white shadow-sm' :
                                                                                    finding.severity === 'LOW' ? 'bg-yellow-400 text-yellow-900' :
                                                                                        'bg-slate-400 text-white'
                                                                                } `}>
                                                                                {finding.severity}
                                                                            </span>
                                                                        </div>

                                                                        <p className="text-sm text-slate-700 leading-snug mb-3">
                                                                            {finding.interpretation}
                                                                        </p>

                                                                        {/* Action Preview (Visible when collapsed) */}
                                                                        {!isExpanded && (
                                                                            <div className={`text - xs font - semibold flex items - center gap - 1 ${medicalInfo.color === 'red' ? 'text-red-700' :
                                                                                medicalInfo.color === 'amber' ? 'text-amber-700' :
                                                                                    'text-slate-600'
                                                                                } `}>
                                                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                                                </svg>
                                                                                Recommended Action: {medicalInfo.action}
                                                                            </div>
                                                                        )}

                                                                        <div className="flex items-center gap-1 text-[11px] text-blue-600 font-bold mt-2 uppercase tracking-wide">
                                                                            <svg className={`w - 3 h - 3 transition - transform duration - 300 ${isExpanded ? 'rotate-180' : ''} `} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                                            </svg>
                                                                            {isExpanded ? 'Collapse Details' : 'View Classification Details'}
                                                                        </div>
                                                                    </div>

                                                                    <div className="text-right">
                                                                        <p className={`text - 4xl font - black tracking - tight ${finding.severity === 'HIGH' ? 'text-red-600' :
                                                                            finding.severity === 'MODERATE' ? 'text-amber-600' :
                                                                                finding.severity === 'LOW' ? 'text-yellow-600' :
                                                                                    'text-slate-600'
                                                                            } `}>
                                                                            {finding.percentage?.toFixed(1)}%
                                                                        </p>
                                                                        <p className="text-[10px] uppercase font-bold text-slate-400 mt-1">Confidence</p>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Expandable Medical Details */}
                                                            <div className={`transition - all duration - 300 ease -in -out ${isExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'} `}>
                                                                <div className={`border - t bg - white p - 5 ${medicalInfo.color === 'red' ? 'border-red-100' :
                                                                    medicalInfo.color === 'amber' ? 'border-amber-100' :
                                                                        'border-slate-100'
                                                                    } `}>
                                                                    <div className="grid md:grid-cols-2 gap-4">
                                                                        {/* Action Column */}
                                                                        <div className="space-y-3">
                                                                            <div className={`p - 3 rounded - lg border ${medicalInfo.color === 'red' ? 'bg-red-50 border-red-100' :
                                                                                medicalInfo.color === 'amber' ? 'bg-amber-50 border-amber-100' :
                                                                                    'bg-blue-50 border-blue-100'
                                                                                } `}>
                                                                                <h6 className={`text - xs font - bold uppercase tracking - wider mb - 1 flex items - center gap - 1 ${medicalInfo.color === 'red' ? 'text-red-800' : 'text-slate-700'
                                                                                    } `}>
                                                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                                                    </svg>
                                                                                    What to do
                                                                                </h6>
                                                                                <p className="text-sm font-medium text-slate-800">{medicalInfo.action}</p>
                                                                            </div>

                                                                            <div>
                                                                                <h6 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Classification Note</h6>
                                                                                <p className="text-sm text-slate-700 leading-relaxed">{medicalInfo.clinicalNote}</p>
                                                                            </div>
                                                                        </div>

                                                                        {/* Stats & Reference Column */}
                                                                        <div className="space-y-3">
                                                                            {/* Cell Breakdown */}
                                                                            {finding.breakdown && Object.keys(finding.breakdown).length > 0 && (
                                                                                <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
                                                                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Cell Count Breakdown</p>
                                                                                    <div className="grid grid-cols-2 gap-2">
                                                                                        {Object.entries(finding.breakdown)
                                                                                            .filter(([_, val]) => typeof val === 'number')
                                                                                            .map(([key, val]) => (
                                                                                                <div key={key} className="bg-white rounded border border-slate-100 p-2 flex justify-between items-center">
                                                                                                    <span className="text-[10px] font-medium text-slate-500 truncate mr-2" title={key.replace(/CML:|CLL:|AML:|ALL:/g, '')}>
                                                                                                        {key.replace(/CML:|CLL:|AML:|ALL:/g, '').replace(/_/g, ' ')}
                                                                                                    </span>
                                                                                                    <span className="text-sm font-bold text-slate-800">{val}</span>
                                                                                                </div>
                                                                                            ))
                                                                                        }
                                                                                    </div>
                                                                                </div>
                                                                            )}

                                                                            <div className="text-[10px] text-slate-400 italic border-t border-slate-100 pt-2">
                                                                                <span className="font-bold not-italic text-slate-500">Reference:</span> {medicalInfo.reference}
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    {/* Disclaimer Footer */}
                                                                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-start gap-2">
                                                                        <svg className="w-4 h-4 text-slate-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                                        </svg>
                                                                        <p className="text-[10px] text-slate-500 leading-tight">
                                                                            <strong>AI Disclaimer:</strong> This analysis is computer-generated. All results, especially those marked High/Critical,
                                                                            must be verified by manual microscopic review by a qualified professional.
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {/* Sickle Cell Analysis - Interactive Card */}
                                        {sickleCell && (() => {
                                            const pct = sickleCell.percentage || 0;
                                            const isExpanded = expandedSickleCell;

                                            const getSickleInfo = () => {
                                                if (pct >= 30) return {
                                                    title: 'Severe Sickling Threshold Met',
                                                    interpretation: `High sickle cell classification rate (${pct.toFixed(1)}%).`,
                                                    action: 'Above severe sickling threshold (> 30%). HbSS classification threshold met.',
                                                    clinicalNote: 'Classification consistent with significant sickle cell morphology.',
                                                    reference: 'Sickle cell thresholds: < 3% normal, 3–10% mild, 10–30% moderate, > 30% severe.',
                                                    severity: 'SEVERE'
                                                };
                                                if (pct >= 10) return {
                                                    title: 'Moderate Sickling Threshold',
                                                    interpretation: `Moderate sickle cell classification rate (${pct.toFixed(1)}%).`,
                                                    action: 'Moderate sickling threshold met (10–30%).',
                                                    clinicalNote: 'Classification suggests moderate sickling morphology.',
                                                    reference: 'Sickle cell thresholds: < 3% normal, 3–10% mild, 10–30% moderate, > 30% severe.',
                                                    severity: 'MODERATE'
                                                };
                                                if (pct >= 3) return {
                                                    title: 'Mild Sickling Detected',
                                                    interpretation: `Low sickle cell classification rate (${pct.toFixed(1)}%).`,
                                                    action: 'Mild sickling threshold met (3–10%).',
                                                    clinicalNote: 'Classification suggests low-level sickle cell morphology.',
                                                    reference: 'Sickle cell thresholds: < 3% normal, 3–10% mild, 10–30% moderate, > 30% severe.',
                                                    severity: 'MILD'
                                                };
                                                return {
                                                    title: 'Normal RBC Morphology',
                                                    interpretation: 'No sickling detected.',
                                                    action: 'Below sickling classification threshold (< 3%).',
                                                    clinicalNote: 'Normal red cell morphology observed.',
                                                    reference: 'Sickle cell thresholds: < 3% normal, 3–10% mild, 10–30% moderate, > 30% severe.',
                                                    severity: 'NORMAL'
                                                };
                                            };

                                            const sickleInfo = getSickleInfo();

                                            return (
                                                <div
                                                    onClick={() => setExpandedSickleCell(!isExpanded)}
                                                    className={`group relative cursor - pointer rounded - xl border - 2 transition - all duration - 300 overflow - hidden mt - 3 ${pct >= 30 ? 'bg-red-50/80 border-red-200 hover:border-red-400 hover:shadow-lg' :
                                                        pct >= 10 ? 'bg-amber-50/80 border-amber-200 hover:border-amber-400 hover:shadow-lg' :
                                                            pct >= 3 ? 'bg-yellow-50/80 border-yellow-200 hover:border-yellow-400 hover:shadow-lg' :
                                                                'bg-slate-50 border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/30'
                                                        } `}
                                                >
                                                    {/* Hover Tooltip */}
                                                    {pct >= 3 && (
                                                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                                            <div className="bg-slate-800 text-white text-xs py-1 px-2 rounded shadow-lg whitespace-nowrap">
                                                                Click for details
                                                            </div>
                                                        </div>
                                                    )}

                                                    <div className="p-4">
                                                        <div className="flex justify-between items-start gap-4">
                                                            <div className="flex-1">
                                                                <div className="flex items-center gap-2 mb-2">
                                                                    <svg className="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                                                                    </svg>
                                                                    <h5 className="font-bold text-slate-800 text-base">Sickle Cell Analysis</h5>
                                                                    <span className={`px - 2 py - 0.5 rounded - full text - [10px] font - bold uppercase ${sickleCell.severity === 'SEVERE' ? 'bg-red-500 text-white' :
                                                                        sickleCell.severity === 'MODERATE' ? 'bg-amber-500 text-white' :
                                                                            sickleCell.severity === 'MILD' ? 'bg-yellow-400 text-yellow-900' :
                                                                                'bg-emerald-500 text-white'
                                                                        } `}>
                                                                        {sickleCell.severity || 'NORMAL'}
                                                                    </span>
                                                                </div>

                                                                <p className="text-sm text-slate-700 leading-snug mb-3">
                                                                    {sickleInfo.interpretation}
                                                                </p>

                                                                {!isExpanded && (
                                                                    <p className="text-xs text-slate-500">
                                                                        <span className="font-mono font-semibold text-slate-700">{sickleCell.count}</span> sickle cells detected in <span className="font-mono font-semibold text-slate-700">{sickleCell.totalRBC}</span> RBCs
                                                                    </p>
                                                                )}

                                                                <div className="flex items-center gap-1 text-[11px] text-blue-600 font-bold mt-2 uppercase tracking-wide">
                                                                    <svg className={`w - 3 h - 3 transition - transform duration - 300 ${isExpanded ? 'rotate-180' : ''} `} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                                    </svg>
                                                                    {isExpanded ? 'Collapse Details' : 'View Classification Details'}
                                                                </div>
                                                            </div>
                                                            <div className="text-right">
                                                                <p className={`text - 4xl font - black tracking - tight ${pct >= 30 ? 'text-red-600' :
                                                                    pct >= 10 ? 'text-amber-600' :
                                                                        pct >= 3 ? 'text-yellow-600' :
                                                                            'text-emerald-600'
                                                                    } `}>

                                                                    {pct.toFixed(2)}%
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {isExpanded && (
                                                        <div className={`border - t - 2 bg - white ${pct >= 30 ? 'border-red-300' :
                                                            pct >= 10 ? 'border-amber-300' :
                                                                pct >= 3 ? 'border-yellow-300' :
                                                                    'border-green-300'
                                                            } `}>
                                                            <div className={`px - 4 py - 2 ${pct >= 30 ? 'bg-red-600 text-white' :
                                                                pct >= 10 ? 'bg-amber-500 text-white' :
                                                                    pct >= 3 ? 'bg-yellow-400 text-yellow-900' :
                                                                        'bg-green-600 text-white'
                                                                } `}>
                                                                <p className="text-sm font-bold">{sickleInfo.title}</p>
                                                            </div>
                                                            <div className="p-4 space-y-3">
                                                                <div>
                                                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Interpretation</p>
                                                                    <p className="text-sm text-slate-700">{sickleInfo.interpretation}</p>
                                                                </div>
                                                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                                                    <p className="text-[10px] font-bold text-blue-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                                                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                                        </svg>
                                                                        Classification Note
                                                                    </p>
                                                                    <p className="text-sm text-blue-800">{sickleInfo.clinicalNote}</p>
                                                                </div>
                                                                <div className="border-t border-slate-100 pt-2">
                                                                    <p className="text-[10px] text-slate-400 italic">
                                                                        <span className="font-semibold not-italic text-slate-500">Reference:</span> {sickleInfo.reference}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })()}

                                        {/* If no disease findings and no sickle cells */}
                                        {(!diseaseFindings || diseaseFindings.length === 0) &&
                                            (!sickleCell || sickleCell.count === 0) && (
                                                <div className="bg-green-50 rounded-lg p-4 border border-green-200 mt-3">
                                                    <p className="text-sm font-semibold text-green-800 flex items-center gap-2">
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                        </svg>
                                                        No significant disease markers detected. Results within normal thresholds.
                                                    </p>
                                                </div>
                                            )}
                                    </div>
                                </div>
                            </div>


                        </div>
                        {/* Cell Counts Summary */}
                        <div className="px-6 py-4 border-b border-slate-200">
                            <h3 className="text-lg font-semibold text-slate-700 mb-3">Cell Count Summary</h3>

                            {/* Raw Detection Counts */}
                            <div className="mb-4">
                                <p className="text-sm text-slate-500 mb-2">Cells Detected (across 10 images)</p>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="bg-slate-50 rounded-lg p-4 text-center">
                                        <p className="text-2xl font-bold text-slate-800">{totalWBC}</p>
                                        <p className="text-sm text-slate-600">WBC Detected</p>
                                    </div>
                                    <div className="bg-slate-50 rounded-lg p-4 text-center">
                                        <p className="text-2xl font-bold text-red-600">{totalRBC}</p>
                                        <p className="text-sm text-slate-600">RBC Detected</p>
                                    </div>
                                    <div className="bg-slate-50 rounded-lg p-4 text-center">
                                        <p className="text-2xl font-bold text-amber-600">{totalPlatelets}</p>
                                        <p className="text-sm text-slate-600">Platelets</p>
                                    </div>
                                </div>
                            </div>

                            {/* Estimated Cell Counts */}
                            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                                <p className="text-sm font-medium text-blue-800 mb-3">Estimated Cell Counts (per µL)</p>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-white rounded-lg p-3 border border-blue-100">
                                        <p className="text-2xl font-bold text-blue-700">
                                            {estimatedWBCCount?.toLocaleString() || 0}
                                        </p>
                                        <p className="text-sm text-blue-600">WBC/µL</p>
                                        <p className="text-xs text-slate-500 mt-1">
                                            Formula: ({totalWBC} / 10) × 2,000
                                        </p>
                                    </div>
                                    <div className="bg-white rounded-lg p-3 border border-blue-100">
                                        <p className="text-2xl font-bold text-red-600">
                                            {estimatedRBCCount?.toLocaleString() || 0}
                                        </p>
                                        <p className="text-sm text-red-500">RBC/µL</p>
                                        <p className="text-xs text-slate-500 mt-1">
                                            Formula: ({avgRBCPerField?.toFixed(1) || 0} avg) × 200,000
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ConvNeXt Classification Breakdown */}
                        <div className="px-6 py-4 border-b border-slate-200">
                            <h3 className="text-lg font-semibold text-slate-700 mb-3">Classification Breakdown</h3>
                            {(() => {
                                const ALL_CLASSES = [
                                    { key: 'Normal WBC', label: 'Normal', color: 'bg-green-100 text-green-800 border-green-300', barColor: 'bg-green-500' },
                                    { key: 'Acute Lymphoblastic Leukemia', label: 'ALL', color: 'bg-purple-100 text-purple-800 border-purple-300', barColor: 'bg-purple-500' },
                                    { key: 'Acute Myeloid Leukemia', label: 'AML', color: 'bg-red-100 text-red-800 border-red-300', barColor: 'bg-red-500' },
                                    { key: 'Chronic Lymphocytic Leukemia', label: 'CLL', color: 'bg-orange-100 text-orange-800 border-orange-300', barColor: 'bg-orange-500' },
                                    { key: 'Chronic Myeloid Leukemia', label: 'CML', color: 'bg-amber-100 text-amber-800 border-amber-300', barColor: 'bg-amber-500' },
                                    { key: 'Sickle Cell Anemia', label: 'SCA', color: 'bg-rose-100 text-rose-800 border-rose-300', barColor: 'bg-rose-500' },
                                ];
                                const cc = aggregatedResults.classificationCounts || {};
                                const items = ALL_CLASSES.map(c => ({
                                    ...c,
                                    count: cc[c.key] || 0,
                                    pct: totalWBC > 0 ? ((cc[c.key] || 0) / totalWBC) * 100 : 0
                                })).sort((a, b) => b.pct - a.pct);
                                return (
                                    <div className="space-y-2">
                                        {items.map(cls => (
                                            <div key={cls.key} className="flex items-center gap-2">
                                                <span className={`text-xs w-14 font-semibold ${cls.color.split(' ')[1]}`}>{cls.label}</span>
                                                <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden">
                                                    <div className={`h-full ${cls.barColor} transition-all duration-500 rounded-full`} style={{ width: `${cls.pct}%` }} />
                                                </div>
                                                <span className="text-slate-700 text-xs font-medium w-20 text-right">
                                                    {cls.count > 0 ? `${cls.count} (${cls.pct.toFixed(1)}%)` : '0'}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })()}
                        </div>

                    </div>
                )
            }

            {/* Actions */}
            <div className="px-6 py-4 bg-rose-50 flex gap-4 flex-wrap">
                <button
                    onClick={handlePrint}
                    className="flex-1 min-w-[120px] flex items-center justify-center gap-2 px-4 py-2 bg-rose-700 text-white rounded-lg hover:bg-rose-800 transition-colors font-medium text-sm"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                    Save/Print PDF
                </button>
                <button
                    onClick={saveReport}
                    className="flex-1 min-w-[120px] flex items-center justify-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors font-medium text-sm"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                    </svg>
                    Save Report
                </button>
                {/* Abnormal WBCs Button - Shows WBCs with disease markers (CML, CLL, ALL, AML) */}
                {abnormalWBCs && abnormalWBCs.length > 0 && (
                    <button
                        onClick={() => setShowAbnormalWBCs(!showAbnormalWBCs)}
                        className="flex-1 min-w-[120px] flex items-center justify-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors font-medium text-sm"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        {showAbnormalWBCs ? 'Hide' : 'Show'} Abnormal WBCs ({abnormalWBCs.length})
                    </button>
                )}
                <button
                    onClick={() => setShowWBCExamination(!showWBCExamination)}
                    className="flex-1 min-w-[120px] flex items-center justify-center gap-2 px-4 py-2 bg-rose-800 text-white rounded-lg hover:bg-rose-900 transition-colors font-medium text-sm"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    {showWBCExamination ? 'Hide' : 'Show'} WBC Examination
                </button>
                <button
                    onClick={() => setShowRBCExamination(!showRBCExamination)}
                    className="flex-1 min-w-[120px] flex items-center justify-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors font-medium text-sm"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    {showRBCExamination ? 'Hide' : 'Show'} RBC/Sickle Cell Examination
                </button>
                <button
                    onClick={onReset}
                    className="px-4 py-2 bg-white border-2 border-rose-300 text-rose-700 rounded-lg hover:bg-rose-50 transition-colors font-medium text-sm"
                >
                    New Analysis
                </button>
            </div>

            {/* WBC Manual Examination Section */}
            {
                showWBCExamination && wbcClassifications && wbcClassifications.length > 0 && (
                    <div className="border-t border-rose-200">
                        <div className="px-6 py-4 bg-rose-50">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-lg font-semibold text-rose-900 flex items-center gap-2">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                    WBC Manual Examination
                                </h3>
                                <p className="text-sm text-rose-600">
                                    {filteredWBCs.length} of {wbcClassifications.length} cells shown
                                </p>
                            </div>

                            {/* Category Filter Buttons */}
                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={() => setWbcFilter('all')}
                                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${wbcFilter === 'all' ? 'bg-red-700 text-white' : 'bg-white text-red-700 hover:bg-red-100'
                                        }`}
                                >
                                    All ({wbcClassifications.length})
                                </button>
                                <button
                                    onClick={() => setWbcFilter('abnormal')}
                                    className={`px - 3 py - 1.5 rounded - full text - sm font - medium transition - colors ${wbcFilter === 'abnormal' ? 'bg-red-600 text-white' : 'bg-white text-red-700 hover:bg-red-100'
                                        } `}
                                >
                                    Abnormal ({wbcClassifications.length - categoryCounts['Normal']})
                                </button>
                                <button
                                    onClick={() => setWbcFilter('Normal')}
                                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${wbcFilter === 'Normal' ? 'bg-green-600 text-white' : 'bg-white text-green-700 hover:bg-green-100'
                                        }`}
                                >
                                    Normal ({categoryCounts['Normal'] || 0})
                                </button>
                                {categoryCounts['AML'] > 0 && (
                                    <button
                                        onClick={() => setWbcFilter('AML')}
                                        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${wbcFilter === 'AML' ? 'bg-red-600 text-white' : 'bg-white text-red-700 hover:bg-red-100'
                                            }`}
                                    >
                                        AML ({categoryCounts['AML']})
                                    </button>
                                )}
                                {categoryCounts['ALL'] > 0 && (
                                    <button
                                        onClick={() => setWbcFilter('ALL')}
                                        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${wbcFilter === 'ALL' ? 'bg-red-600 text-white' : 'bg-white text-red-700 hover:bg-red-100'
                                            }`}
                                    >
                                        ALL ({categoryCounts['ALL']})
                                    </button>
                                )}
                                {categoryCounts['CML'] > 0 && (
                                    <button
                                        onClick={() => setWbcFilter('CML')}
                                        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${wbcFilter === 'CML' ? 'bg-amber-600 text-white' : 'bg-white text-amber-700 hover:bg-amber-100'
                                            }`}
                                    >
                                        CML ({categoryCounts['CML']})
                                    </button>
                                )}
                                {categoryCounts['CLL'] > 0 && (
                                    <button
                                        onClick={() => setWbcFilter('CLL')}
                                        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${wbcFilter === 'CLL' ? 'bg-amber-600 text-white' : 'bg-white text-amber-700 hover:bg-amber-100'
                                            }`}
                                    >
                                        CLL ({categoryCounts['CLL']})
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Scrollable WBC Grid */}
                        <div className="px-6 py-4 max-h-96 overflow-y-auto bg-white">
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                {filteredWBCs.map((wbc, idx) => {
                                    const catInfo = getClassificationCategory(wbc.classification);
                                    return (
                                        <div
                                            key={wbc.wbc_id || idx}
                                            className={`rounded-lg border-2 overflow-hidden ${catInfo.color}`}
                                        >
                                            {/* Cell Image */}
                                            {wbc.cropped_image && (
                                                <div className="aspect-square bg-slate-100">
                                                    <img
                                                        src={`data: image / png; base64, ${wbc.cropped_image} `}
                                                        alt={wbc.classification}
                                                        className="w-full h-full object-cover"
                                                    />
                                                </div>
                                            )}

                                            {/* Classification Label */}
                                            <div className="p-2 text-center">
                                                <p className="text-xs font-bold truncate" title={catInfo.label}>
                                                    {catInfo.label}
                                                </p>

                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {filteredWBCs.length === 0 && (
                                <div className="text-center py-8 text-slate-500">
                                    No cells match the selected filter
                                </div>
                            )}
                        </div>

                        {/* Classification Legend */}
                        <div className="px-6 py-3 bg-red-50 border-t border-red-200">
                            <p className="text-xs text-red-700 font-medium mb-2">Classification Legend (7-Class ConvNeXt Model):</p>
                            <div className="flex flex-wrap gap-2 text-xs">
                                <span className="px-2 py-1 bg-green-100 text-green-800 rounded">Normal WBC: Healthy white blood cells</span>
                                <span className="px-2 py-1 bg-red-100 text-red-800 rounded">All Leukemia Types (AML, ALL, CML, CLL): Unified thresholds - &lt;5% Normal, 5-10% Low, 10-20% Moderate, ≥20% High</span>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Abnormal WBCs Examination Section - WBCs with disease markers not in 5 main categories */}
            {
                showAbnormalWBCs && abnormalWBCs && abnormalWBCs.length > 0 && (
                    <div className="border-t border-amber-200">
                        <div className="px-6 py-4 bg-amber-50">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-lg font-semibold text-amber-900 flex items-center gap-2">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                    Abnormal WBCs for Review
                                </h3>
                                <p className="text-sm text-amber-700">
                                    {abnormalWBCs.length} abnormal cells detected (non-Normal classifications)
                                </p>
                            </div>
                            <p className="text-xs text-amber-700 mb-3">
                                These WBCs have been classified with abnormal markers (CML, CLL, ALL, AML) and require further review.
                            </p>
                        </div>

                        {/* Abnormal WBCs Grid */}
                        <div className="px-6 py-4 max-h-96 overflow-y-auto bg-white">
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                {abnormalWBCs.map((wbc, idx) => {
                                    const catInfo = getClassificationCategory(wbc.classification);
                                    return (
                                        <div
                                            key={wbc.wbc_id || `abnormal - ${idx} `}
                                            className={`rounded-lg border-2 overflow-hidden ${catInfo.color}`}
                                        >
                                            {/* Cell Image */}
                                            {wbc.cropped_image && (
                                                <div className="aspect-square bg-slate-100">
                                                    <img
                                                        src={`data: image / png; base64, ${wbc.cropped_image} `}
                                                        alt={wbc.classification}
                                                        className="w-full h-full object-cover"
                                                    />
                                                </div>
                                            )}

                                            {/* Classification Label */}
                                            <div className="p-2 text-center">
                                                <p className="text-xs font-bold truncate" title={wbc.classification}>
                                                    {wbc.classification}
                                                </p>

                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Abnormal WBCs Legend */}
                        <div className="px-6 py-3 bg-amber-50 border-t border-amber-200">
                            <p className="text-xs text-amber-700 font-medium mb-2">Abnormal Classification Markers:</p>
                            <div className="flex flex-wrap gap-2 text-xs">
                                <span className="px-2 py-1 bg-red-100 text-red-800 rounded">AML: Acute Myeloid Leukemia</span>
                                <span className="px-2 py-1 bg-red-100 text-red-800 rounded">ALL: Acute Lymphoblastic Leukemia</span>
                                <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded">CML: Chronic Myeloid Leukemia</span>
                                <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded">CLL: Chronic Lymphocytic Leukemia</span>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* RBC/Sickle Cell Manual Examination Section */}
            {
                showRBCExamination && aggregatedResults.rbcClassifications && aggregatedResults.rbcClassifications.length > 0 && (
                    <div className="border-t border-slate-200">
                        {/* RBC Section Header */}
                        <div className="px-6 py-3 bg-red-50 border-b border-slate-200">
                            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                                </svg>
                                RBC/Sickle Cell Manual Examination
                                <span className="text-sm font-normal text-slate-600">
                                    ({aggregatedResults.rbcClassifications.length} RBC cells detected)
                                </span>
                            </h3>
                        </div>

                        {/* RBC Cells Scrollable Grid */}
                        <div className="px-6 py-4 max-h-[500px] overflow-y-auto">
                            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-3">
                                {aggregatedResults.rbcClassifications
                                    .map((rbc, idx) => {
                                        const isSickle = rbc.is_abnormal;
                                        const borderColor = isSickle ? 'border-red-500' : 'border-green-500';
                                        const label = isSickle ? 'Sickle Cell' : 'Normal RBC';

                                        return (
                                            <div
                                                key={rbc.rbc_id || idx}
                                                className={`rounded-lg border-2 overflow-hidden ${borderColor}`}
                                            >
                                                {/* Cell Image */}
                                                {rbc.cropped_image && (
                                                    <div className="aspect-square bg-slate-100">
                                                        <img
                                                            src={`data: image / png; base64, ${rbc.cropped_image} `}
                                                            alt={label}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    </div>
                                                )}

                                                {/* Classification Label */}
                                                <div className="p-2 text-center">
                                                    <p className={`text-xs font-bold truncate ${isSickle ? 'text-red-800' : 'text-green-800'}`} title={label}>
                                                        {label}
                                                    </p>

                                                </div>
                                            </div>
                                        );
                                    })}
                            </div>

                            {aggregatedResults.rbcClassifications.length === 0 && (
                                <div className="text-center py-8 text-slate-500">
                                    No RBC cells detected
                                </div>
                            )}
                        </div>

                        {/* Sickle Cell Threshold Legend */}
                        <div className="px-6 py-3 bg-red-50 border-t border-slate-200">
                            <p className="text-xs text-slate-600 font-medium mb-2">Sickle Cell Thresholds (Based on About Page):</p>
                            <div className="flex flex-wrap gap-2 text-xs">
                                <span className="px-2 py-1 bg-green-100 text-green-800 rounded">&lt;3%: Normal</span>
                                <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded">3-10%: Mild (HbAS)</span>
                                <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded">10-30%: Moderate</span>
                                <span className="px-2 py-1 bg-red-200 text-red-900 rounded font-bold">&gt;30%: Severe (HbSS)</span>
                            </div>
                            <p className="text-xs text-slate-500 mt-2">
                                <strong>Current Sickle Cell Percentage:</strong> {aggregatedResults.sickleCell.percentage.toFixed(2)}%
                                ({aggregatedResults.sickleCell.count} sickle cells / {aggregatedResults.totalRBC} total RBCs)
                            </p>
                        </div>
                    </div>
                )
            }

            {/* Disclaimer */}
            {/* Highlighted Disclaimer - Footer */}
            <div className="px-6 py-4 bg-red-50 border-t border-red-100">
                <div className="flex items-start gap-3 justify-center">
                    <span className="font-bold bg-red-200 text-red-800 px-2 py-0.5 rounded text-xs shrink-0 mt-0.5">DISCLAIMER:</span>
                    <p className="text-xs text-red-800 leading-relaxed max-w-3xl">
                        This analysis is for research and educational purposes only. It is not a medical diagnosis.
                        All classification results are based on automated cell morphology analysis and established threshold comparisons.
                        Results should be verified by a qualified professional before any clinical interpretation.
                    </p>
                </div>
            </div>
        </div >
    );
};

export default FinalResults;
