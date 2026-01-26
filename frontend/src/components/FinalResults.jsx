import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/**
 * FinalResults Component
 * Displays final diagnosis when 10 images threshold is met
 * Includes printable PDF report functionality
 * Includes scrollable WBC examination section for manual review
 * 
 * Cell Count Formulas:
 * - RBC count: (Avg RBC in 10 images) x 200,000
 * - WBC count: (Overall WBC count / 10) x 2,000
 * 
 * WBC Differential - 5 Main Categories with Normal Ranges:
 * - Neutrophil: 45% - 65%
 * - Lymphocyte: 20% - 35%
 * - Monocyte: 2% - 6%
 * - Eosinophil: 2% - 4%
 * - Basophil: 0% - 1%
 */
export const FinalResults = ({ 
    aggregatedResults, 
    processedImages, 
    onReset 
}) => {
    const navigate = useNavigate();
    const [showWBCExamination, setShowWBCExamination] = useState(false);
    const [showRBCExamination, setShowRBCExamination] = useState(false);
    const [showAbnormalWBCs, setShowAbnormalWBCs] = useState(false);
    const [wbcFilter, setWbcFilter] = useState('all');
    const [rbcFilter, setRbcFilter] = useState('all');
    
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
        wbcDifferential,
        sickleCell,
        patientStatus
    } = aggregatedResults;

    // Get classification category based on ConvNeXt class
    // Model classes are in format: "CellType: Condition" (e.g., "Basophil: Normal", "Basophil: CML")
    const getClassificationCategory = (classification) => {
        if (!classification) {
            return { category: 'Other', label: 'Unknown', color: 'bg-slate-100 text-slate-800 border-slate-300' };
        }
        
        const lowerClass = classification.toLowerCase();
        
        // Check for disease markers in the classification string
        // ALL (Acute Lymphoblastic Leukemia)
        if (lowerClass.includes(': all') || lowerClass.includes('lymphoblast: all') || lowerClass.includes('b_lymphoblast: all')) {
            const cellType = classification.split(':')[0] || 'Lymphoblast';
            return { category: 'ALL', label: `ALL: ${cellType}`, color: 'bg-red-100 text-red-800 border-red-300' };
        }
        
        // AML (Acute Myeloid Leukemia)
        if (lowerClass.includes(': aml') || lowerClass.includes('myeloblast: aml')) {
            const cellType = classification.split(':')[0] || 'Myeloblast';
            return { category: 'AML', label: `AML: ${cellType}`, color: 'bg-red-100 text-red-800 border-red-300' };
        }
        
        // CML (Chronic Myeloid Leukemia)
        if (lowerClass.includes(': cml')) {
            const cellType = classification.split(':')[0] || 'Granulocyte';
            return { category: 'CML', label: `CML: ${cellType}`, color: 'bg-amber-100 text-amber-800 border-amber-300' };
        }
        
        // CLL (Chronic Lymphocytic Leukemia)
        if (lowerClass.includes(': cll')) {
            const cellType = classification.split(':')[0] || 'Lymphocyte';
            return { category: 'CLL', label: `CLL: ${cellType}`, color: 'bg-amber-100 text-amber-800 border-amber-300' };
        }
        
        // Sickle Cell (RBC condition)
        if (lowerClass.includes('sickle')) {
            return { category: 'Sickle', label: 'Sickle Cell', color: 'bg-red-100 text-red-800 border-red-300' };
        }
        
        // Normal cells - check for ": normal" pattern or just Normal WBC types
        if (lowerClass.includes(': normal') || lowerClass === 'normal') {
            const cellType = classification.split(':')[0] || 'WBC';
            return { category: 'Normal', label: cellType.trim(), color: 'bg-green-100 text-green-800 border-green-300' };
        }
        
        // Handle legacy class names (without ":" format)
        const normalCellTypes = ['basophil', 'eosinophil', 'neutrophil', 'lymphocyte', 'monocyte', 'erythroblast', 'metamyelocyte', 'myelocyte', 'promyelocyte', 'platelet'];
        if (normalCellTypes.some(type => lowerClass === type)) {
            return { category: 'Normal', label: classification, color: 'bg-green-100 text-green-800 border-green-300' };
        }
        
        return { category: 'Other', label: classification, color: 'bg-slate-100 text-slate-800 border-slate-300' };
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

    // Save report to localStorage
    const saveReport = () => {
        const reports = JSON.parse(localStorage.getItem('hemalyzer_reports') || '[]');
        const newReport = {
            id: Date.now(),
            timestamp: new Date().toLocaleString(),
            data: aggregatedResults,
            imagesCount: processedImages.length
        };
        
        reports.unshift(newReport);
        localStorage.setItem('hemalyzer_reports', JSON.stringify(reports));
        
        alert('Report saved successfully!');
        navigate('/reports');
    };

    // Generate PDF Report
    const generatePDF = () => {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 14;
        let yPos = 20;

        // Header
        doc.setFillColor(9, 9, 11); // Zinc-950
        doc.rect(0, 0, pageWidth, 40, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(24);
        doc.setFont("helvetica", "bold");
        doc.text("HEMALYZER", margin, 25);
        
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text("Automated Hematology Suite • Clinical Output Report", margin, 33);

        // Report metadata
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(9);
        const dateStr = new Date().toLocaleString();
        doc.text(`Generated: ${dateStr}`, pageWidth - margin - 60, 25);
        doc.text(`Images Analyzed: ${processedImages.length}`, pageWidth - margin - 60, 33);

        yPos = 50;

        // Patient Status Banner
        doc.setFillColor(
            patientStatus === 'Critical' ? 220 : patientStatus === 'Abnormal' ? 245 : 220,
            patientStatus === 'Critical' ? 53 : patientStatus === 'Abnormal' ? 158 : 252,
            patientStatus === 'Critical' ? 69 : patientStatus === 'Abnormal' ? 11 : 231
        );
        doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 20, 3, 3, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text(`OVERALL STATUS: ${patientStatus?.toUpperCase() || 'NORMAL'}`, margin + 5, yPos + 13);

        yPos += 30;

        // Cell Count Summary
        doc.setTextColor(30, 58, 95);
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("Cell Count Summary", margin, yPos);
        yPos += 8;

        autoTable(doc, {
            startY: yPos,
            head: [['Cell Type', 'Detected', 'Estimated Count', 'Formula']],
            body: [
                ['White Blood Cells (WBC)', totalWBC.toString(), `${estimatedWBCCount?.toLocaleString() || 0}/µL`, `(${totalWBC}/10) × 2,000`],
                ['Red Blood Cells (RBC)', totalRBC.toString(), `${estimatedRBCCount?.toLocaleString() || 0}/µL`, `(${avgRBCPerField?.toFixed(1) || 0} avg) × 200,000`],
                ['Platelets', totalPlatelets.toString(), '-', '-']
            ],
            theme: 'striped',
            headStyles: { fillColor: [30, 58, 95], textColor: 255 },
            styles: { fontSize: 9, cellPadding: 4 },
            margin: { left: margin, right: margin }
        });

        yPos = doc.lastAutoTable.finalY + 15;

        // WBC Differential - 5 Main Categories
        if (wbcDifferential && Object.keys(wbcDifferential).length > 0) {
            doc.setTextColor(30, 58, 95);
            doc.setFontSize(12);
            doc.setFont("helvetica", "bold");
            doc.text("WBC Differential (5 Main Categories)", margin, yPos);
            yPos += 8;

            const diffData = Object.entries(wbcDifferential).map(([name, data]) => [
                name,
                `${data.count}`,
                `${data.percentage.toFixed(1)}%`,
                data.normalRange || '-',
                data.status === 'normal' ? 'Normal' : data.status === 'high' ? 'HIGH' : 'LOW'
            ]);

            autoTable(doc, {
                startY: yPos,
                head: [['Cell Type', 'Count', 'Percentage', 'Normal Range', 'Status']],
                body: diffData,
                theme: 'striped',
                headStyles: { fillColor: [30, 58, 95], textColor: 255 },
                styles: { fontSize: 9, cellPadding: 3 },
                margin: { left: margin, right: margin },
                didDrawCell: (data) => {
                    // Color code status column
                    if (data.column.index === 4 && data.section === 'body') {
                        const status = data.cell.text[0];
                        if (status === 'HIGH') {
                            doc.setFillColor(254, 226, 226);
                        } else if (status === 'LOW') {
                            doc.setFillColor(219, 234, 254);
                        } else {
                            doc.setFillColor(220, 252, 231);
                        }
                    }
                }
            });

            yPos = doc.lastAutoTable.finalY + 15;
        }

        // Disease Findings
        if (diseaseFindings && diseaseFindings.length > 0) {
            // Check if we need a new page
            if (yPos > 220) {
                doc.addPage();
                yPos = 20;
            }

            doc.setTextColor(30, 58, 95);
            doc.setFontSize(12);
            doc.setFont("helvetica", "bold");
            doc.text("Disease Analysis Findings", margin, yPos);
            yPos += 8;

            const findingsData = diseaseFindings.map(finding => [
                finding.type || '-',
                `${finding.percentage?.toFixed(1) || 0}%`,
                finding.interpretation || '-',
                finding.severity || '-'
            ]);

            autoTable(doc, {
                startY: yPos,
                head: [['Disease Type', 'Percentage', 'Interpretation', 'Severity']],
                body: findingsData,
                theme: 'striped',
                headStyles: { fillColor: [30, 58, 95], textColor: 255 },
                styles: { fontSize: 9, cellPadding: 3 },
                columnStyles: { 2: { cellWidth: 60 } },
                margin: { left: margin, right: margin }
            });

            yPos = doc.lastAutoTable.finalY + 15;
        }

        // Sickle Cell Analysis
        if (sickleCell) {
            if (yPos > 240) {
                doc.addPage();
                yPos = 20;
            }

            doc.setTextColor(30, 58, 95);
            doc.setFontSize(12);
            doc.setFont("helvetica", "bold");
            doc.text("Sickle Cell Analysis", margin, yPos);
            yPos += 8;

            autoTable(doc, {
                startY: yPos,
                head: [['Metric', 'Value']],
                body: [
                    ['Sickle Cells Detected', sickleCell.count?.toString() || '0'],
                    ['Total RBCs Analyzed', sickleCell.totalRBC?.toString() || '0'],
                    ['Percentage', `${sickleCell.percentage?.toFixed(2) || 0}%`],
                    ['Interpretation', sickleCell.interpretation || 'Normal']
                ],
                theme: 'striped',
                headStyles: { fillColor: [30, 58, 95], textColor: 255 },
                styles: { fontSize: 10, cellPadding: 4 },
                margin: { left: margin, right: margin }
            });

            yPos = doc.lastAutoTable.finalY + 15;
        }

        // Footer / Disclaimer
        if (yPos > 250) {
            doc.addPage();
            yPos = 20;
        }

        doc.setFillColor(245, 245, 245);
        doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 30, 2, 2, 'F');
        
        doc.setTextColor(100, 100, 100);
        doc.setFontSize(8);
        doc.setFont("helvetica", "italic");
        doc.text("CLINICAL DISCLAIMER", margin + 5, yPos + 8);
        doc.setFont("helvetica", "normal");
        const disclaimer = "This report is generated by an automated blood cell analysis system for research and educational purposes. Results should be verified by a qualified hematologist. Additional diagnostic tests may be required for confirmation.";
        const splitDisclaimer = doc.splitTextToSize(disclaimer, pageWidth - 2 * margin - 10);
        doc.text(splitDisclaimer, margin + 5, yPos + 15);

        // Save the PDF
        const fileName = `Hemalyzer_Report_${new Date().toISOString().split('T')[0]}_${Date.now()}.pdf`;
        doc.save(fileName);
    };

    return (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-5 duration-1000">
            {/* Clinical Verdict - Primary Results Card */}
            <div className={`rounded-[40px] overflow-hidden border shadow-2xl relative ${getStatusStyle(patientStatus)}`}>
                <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full -mr-48 -mt-48 blur-[120px] opacity-30"></div>
                
                <div className="p-12 relative z-10">
                    <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-12">
                        <div className="flex-grow">
                            <div className="flex flex-wrap items-center gap-4 mb-8">
                                <span className="px-6 py-2.5 bg-zinc-950 text-white rounded-full text-[12px] font-black uppercase tracking-[0.3em] flex items-center gap-3">
                                    <span className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                                    </span>
                                    Final Clinical Verdict
                                </span>
                                {diseaseFindings && diseaseFindings.length > 0 && (
                                    <span className="px-6 py-2.5 bg-rose-600 text-white rounded-full text-[12px] font-black uppercase tracking-[0.3em] shadow-lg shadow-rose-900/20">
                                        Morphological Indicators Present
                                    </span>
                                )}
                            </div>
                            
                            <h2 className="text-7xl font-black tracking-tighter mb-4 leading-none uppercase italic underline decoration-rose-600 decoration-8 underline-offset-[16px]">
                                {patientStatus || 'Awaiting Status'}
                                <span className="text-4xl ml-6 opacity-30 not-italic">{getStatusIcon(patientStatus)}</span>
                            </h2>
                            <p className="text-xl font-bold opacity-70 max-w-2xl leading-relaxed mt-12">
                                Integrated morphological consensus established through {processedImages.length} analyzed fields. 
                                Statistical normalization applied across automated differential thresholds.
                            </p>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row xl:flex-col gap-4 min-w-[280px]">
                            <button
                                onClick={generatePDF}
                                className="w-full py-6 bg-zinc-950 text-white hover:bg-zinc-900 rounded-[30px] font-black text-xs tracking-[0.2em] uppercase transition-all shadow-2xl flex items-center justify-center gap-4 hover:scale-[1.02] active:scale-95"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                                </svg>
                                Export Clinical PDF
                            </button>
                            <button
                                onClick={saveReport}
                                className="w-full py-6 bg-rose-600 text-white hover:bg-rose-700 rounded-[30px] font-black text-xs tracking-[0.2em] uppercase transition-all shadow-2xl flex items-center justify-center gap-4 hover:scale-[1.02] active:scale-95"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                                </svg>
                                Save to Archive
                            </button>
                        </div>
                    </div>

                    {/* Metric Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-20">
                        <div className="bg-white/50 backdrop-blur-sm rounded-[35px] p-8 border border-black/5 group hover:bg-white/80 transition-all duration-500">
                            <p className="text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] mb-3">Absolute WBC Est.</p>
                            <p className="text-4xl font-black text-zinc-950 tabular-nums lowercase leading-none">
                                {estimatedWBCCount?.toLocaleString()} <span className="text-[10px] opacity-40 uppercase tracking-widest font-black block mt-2">cells / µl</span>
                            </p>
                        </div>
                        <div className="bg-white/50 backdrop-blur-sm rounded-[35px] p-8 border border-black/5 group hover:bg-white/80 transition-all duration-500">
                            <p className="text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] mb-3">Absolute RBC Est.</p>
                            <p className="text-4xl font-black text-zinc-950 tabular-nums lowercase leading-none">
                                {estimatedRBCCount?.toLocaleString()} <span className="text-[10px] opacity-40 uppercase tracking-widest font-black block mt-2">million / µl</span>
                            </p>
                        </div>
                        <div className="bg-white/50 backdrop-blur-sm rounded-[35px] p-8 border border-black/5 group hover:bg-white/80 transition-all duration-500">
                            <p className="text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] mb-3">Platelet Density</p>
                            <p className="text-4xl font-black text-zinc-950 tabular-nums lowercase leading-none">
                                {totalPlatelets} <span className="text-[10px] opacity-40 uppercase tracking-widest font-black block mt-2">total detected</span>
                            </p>
                        </div>
                        <div className="bg-zinc-950/5 rounded-[35px] p-8 border border-black/5 group hover:bg-zinc-950/10 transition-all duration-500">
                            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-3">Sampling Capacity</p>
                            <p className="text-4xl font-black text-zinc-950 tabular-nums leading-none">
                                {processedImages.length} <span className="text-[10px] opacity-40 uppercase tracking-widest font-black block mt-2">fields of view</span>
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                {/* Disease Analysis Column */}
                <div className="bg-stone-50 rounded-[40px] p-10 border border-stone-200 shadow-sm">
                    <h3 className="text-2xl font-black text-zinc-950 tracking-tighter mb-10 uppercase flex items-center gap-4 italic">
                        Diagnostic Findings
                        <div className="h-px flex-grow bg-stone-200"></div>
                    </h3>
                    
                    {diseaseFindings && diseaseFindings.length > 0 ? (
                        <div className="space-y-6">
                            {diseaseFindings.map((finding, idx) => (
                                <div key={idx} className="bg-white p-8 rounded-[30px] border border-stone-100 flex items-start gap-6 shadow-sm group hover:border-rose-200 transition-all">
                                    <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="font-black text-xl text-zinc-950 tracking-tight uppercase leading-none mb-2 underline decoration-rose-500/20">{finding.type || finding}</p>
                                        <p className="text-sm font-bold text-stone-400 leading-relaxed italic">{finding.interpretation || 'Morphologically significant indicator detected'}</p>
                                        {finding.severity && (
                                            <span className="mt-4 px-3 py-1 bg-rose-50 text-rose-600 border border-rose-100 rounded-full text-[8px] font-black uppercase tracking-widest inline-block">
                                                Severity: {finding.severity}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-20 bg-white/40 rounded-[30px] border border-dashed border-stone-200">
                            <p className="text-stone-300 font-black text-[10px] uppercase tracking-[0.3em]">No Acute Indicators Detected</p>
                        </div>
                    )}
                </div>

                {/* Composition Column */}
                <div className="bg-stone-50 rounded-[40px] p-10 border border-stone-200 shadow-sm">
                    <h3 className="text-2xl font-black text-zinc-950 tracking-tighter mb-10 uppercase flex items-center gap-4 italic">
                        Cellular Makeup
                        <div className="h-px flex-grow bg-stone-200"></div>
                    </h3>
                    
                    <div className="grid grid-cols-2 gap-4">
                        {aggregatedResults.classificationCounts && Object.entries(aggregatedResults.classificationCounts)
                            .sort((a, b) => b[1] - a[1])
                            .map(([className, count]) => {
                                const catInfo = getClassificationCategory(className);
                                const percentage = totalWBC > 0 ? ((count / totalWBC) * 100).toFixed(1) : 0;
                                return (
                                    <div key={className} className={`p-6 rounded-[25px] border-2 bg-white transition-all hover:scale-[1.02] flex flex-col justify-between h-36 ${catInfo.color.split(' ')[2]}`}>
                                        <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest leading-tight">{catInfo.label}</p>
                                        <div className="flex justify-between items-end">
                                            <span className="text-4xl font-black text-zinc-950 tabular-nums">{count}</span>
                                            <span className="text-xs font-black text-rose-600 tabular-nums bg-rose-50 px-2 py-1 rounded-lg">{percentage}%</span>
                                        </div>
                                    </div>
                                );
                            })
                        }
                    </div>
                </div>
            </div>

            {/* Differential Analysis - 5 Part Focus */}
            {wbcDifferential && Object.keys(wbcDifferential).length > 0 && (
                <div className="bg-white rounded-[40px] p-10 border border-stone-200 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-10">
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-stone-200">Clinical Reference Range Alignment</span>
                    </div>
                    
                    <h3 className="text-2xl font-black text-zinc-950 tracking-tighter mb-12 uppercase flex items-center gap-4 italic">
                        5-Part Differential Profile
                        <div className="h-px w-24 bg-rose-600"></div>
                    </h3>

                    <div className="space-y-10">
                        {Object.entries(wbcDifferential).map(([name, data]) => (
                            <div key={name} className="group transition-all">
                                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-4">
                                    <div>
                                        <div className="flex items-center gap-3">
                                            <h4 className="text-xl font-black text-zinc-950 tracking-tight uppercase group-hover:text-rose-600 transition-colors">{name}</h4>
                                            <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${
                                                data.status === 'high' ? 'bg-rose-600 text-white' :
                                                data.status === 'low' ? 'bg-zinc-950 text-white opacity-40' :
                                                'bg-stone-100 text-stone-400'
                                            }`}>
                                                Status: {data.status}
                                            </span>
                                        </div>
                                        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mt-1">Normal Consensus: {data.normalRange}</p>
                                    </div>
                                    <div className="flex items-baseline gap-6">
                                        <div className="text-right">
                                            <span className="text-4xl font-black text-zinc-950 tabular-nums leading-none tracking-tighter italic">{data.percentage.toFixed(1)}%</span>
                                            <p className="text-[10px] font-black text-stone-300 uppercase tracking-widest mt-1">{data.count} Observed Units</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden shadow-inner">
                                    <div 
                                        className={`h-full transition-all duration-1000 ease-in-out ${
                                            data.status === 'normal' ? 'bg-zinc-950 shadow-[0_0_12px_rgba(9,9,11,0.2)]' : 'bg-rose-600 animate-pulse'
                                        }`}
                                        style={{ width: `${Math.min(100, data.percentage)}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Manual Verification Hub */}
            <div className="bg-zinc-950 rounded-[40px] p-12 text-white shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-rose-600 to-transparent"></div>
                
                <div className="flex flex-col md:flex-row items-center justify-between gap-10">
                    <div>
                        <h3 className="text-2xl font-black tracking-tighter uppercase mb-2 italic">Manual Verification Hub</h3>
                        <p className="text-zinc-500 font-bold text-xs uppercase tracking-[0.3em]">Neural output review & morphological audit</p>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-4">
                        <button
                            onClick={() => setShowWBCExamination(!showWBCExamination)}
                            className={`px-8 py-5 rounded-[25px] font-black text-[10px] tracking-widest uppercase transition-all duration-500 ${
                                showWBCExamination ? 'bg-rose-600 text-white shadow-xl shadow-rose-900/40' : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white'
                            }`}
                        >
                            {showWBCExamination ? 'Conceal Review' : 'WBC Audit Feed'}
                        </button>
                        
                        <button
                            onClick={() => setShowRBCExamination(!showRBCExamination)}
                            className={`px-8 py-5 rounded-[25px] font-black text-[10px] tracking-widest uppercase transition-all duration-500 ${
                                showRBCExamination ? 'bg-rose-600 text-white shadow-xl shadow-rose-900/40' : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white'
                            }`}
                        >
                            {showRBCExamination ? 'Conceal Feed' : 'RBC/Sickle Audit'}
                        </button>

                        <button
                            onClick={onReset}
                            className="px-8 py-5 border border-white/10 text-white/20 hover:text-white hover:bg-white/5 rounded-[25px] font-black text-[10px] tracking-widest uppercase transition-all"
                        >
                            New Diagnostic Session
                        </button>
                    </div>
                </div>
            </div>

            {/* Scrollable WBC Manual Audit Section */}
            {showWBCExamination && wbcClassifications && wbcClassifications.length > 0 && (
                <div className="bg-white rounded-[40px] border border-stone-200 overflow-hidden shadow-sm animate-in zoom-in-95 duration-500">
                    <div className="p-10 bg-stone-50 border-b border-stone-200">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                            <div>
                                <h3 className="text-2xl font-black text-zinc-950 tracking-tighter uppercase italic">WBC Morphological Audit</h3>
                                <p className="text-stone-400 font-bold text-[10px] uppercase tracking-widest mt-1">Reviewing {filteredWBCs.length} of {wbcClassifications.length} detected samples</p>
                            </div>
                            
                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={() => setWbcFilter('all')}
                                    className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                                        wbcFilter === 'all' ? 'bg-zinc-950 text-white' : 'bg-white text-stone-400 border border-stone-200 hover:bg-stone-100'
                                    }`}
                                >
                                    Total ({wbcClassifications.length})
                                </button>
                                <button
                                    onClick={() => setWbcFilter('abnormal')}
                                    className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                                        wbcFilter === 'abnormal' ? 'bg-rose-600 text-white' : 'bg-white text-rose-400 border border-rose-100 hover:bg-rose-50'
                                    }`}
                                >
                                    Abnormal ({wbcClassifications.length - (categoryCounts['Normal'] || 0)})
                                </button>
                                <button
                                    onClick={() => setWbcFilter('Normal')}
                                    className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                                        wbcFilter === 'Normal' ? 'bg-zinc-950 text-white' : 'bg-white text-stone-400 border border-stone-200 hover:bg-stone-100'
                                    }`}
                                >
                                    Normal ({categoryCounts['Normal'] || 0})
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="p-10 max-h-[700px] overflow-y-auto bg-white scrollbar-thin scrollbar-thumb-stone-200">
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
                            {filteredWBCs.map((wbc, idx) => {
                                const catInfo = getClassificationCategory(wbc.classification);
                                return (
                                    <div 
                                        key={wbc.wbc_id || idx}
                                        className={`rounded-[25px] border-2 overflow-hidden transition-all hover:scale-[1.05] hover:shadow-xl ${catInfo.color.split(' ')[2]}`}
                                    >
                                        <div className="aspect-square bg-stone-50">
                                            {wbc.cropped_image && (
                                                <img
                                                    src={`data:image/png;base64,${wbc.cropped_image}`}
                                                    alt={wbc.classification}
                                                    className="w-full h-full object-cover"
                                                />
                                            )}
                                        </div>
                                        <div className="p-4 text-center">
                                            <p className="text-[10px] font-black truncate uppercase tracking-tighter" title={catInfo.label}>{catInfo.label}</p>
                                            <p className="text-[10px] font-black text-rose-600 opacity-60 mt-1 uppercase">{(wbc.confidence * 100).toFixed(0)}% Conf</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Disclaimer Footer */}
            <div className="pt-10 border-t border-stone-100 text-center">
                <p className="text-[10px] font-black text-stone-300 uppercase tracking-[0.4em] max-w-3xl mx-auto leading-relaxed">
                    Clinical Research Interface • Dual-Stage AI Verification • Final results must be validated by a licensed physician or clinical hematologist.
                </p>
            </div>
        </div>
    );
};

export default FinalResults;
