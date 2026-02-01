import { useState, useEffect } from "react";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { Header } from "../components/Header.jsx";
import { Footer } from "../components/Footer.jsx";
import { ThresholdResults } from "../components/ThresholdResults.jsx";

export const Reports = () => {
    const [reports, setReports] = useState([]);
    const [selectedReport, setSelectedReport] = useState(null);

    useEffect(() => {
        // Load saved reports from localStorage
        const savedReports = JSON.parse(localStorage.getItem('hemalyzer_reports') || '[]');
        setReports(savedReports);
    }, []);

    const deleteReport = (id) => {
        const updatedReports = reports.filter(r => r.id !== id);
        setReports(updatedReports);
        localStorage.setItem('hemalyzer_reports', JSON.stringify(updatedReports));
        if (selectedReport?.id === id) {
            setSelectedReport(null);
        }
    };

    const clearAllReports = () => {
        if (confirm('Are you sure you want to delete all reports?')) {
            setReports([]);
            setSelectedReport(null);
            localStorage.removeItem('hemalyzer_reports');
        }
    };

    // Robust Clinical Analysis Helper
    const getClinicalAnalysis = (type, status) => {
        const analyses = {
            'Neutrophil': {
                high: {
                    interpretation: 'Neutrophilia: Increased neutrophils often indicate acute bacterial infection, severe stress, burns, or tissue necrosis.',
                    recommendation: 'Clinical Recommendation: Evaluate for signs of infection (fever, localized pain). Consider CBC with differential repeats and inflammatory markers (CRP, ESR).'
                },
                low: {
                    interpretation: 'Neutropenia: Decreased neutrophils significantly increase infection risk. May be caused by viral infections, chemotherapy, aplastic anemia, or severe overwhelming infection (sepsis).',
                    recommendation: 'Clinical Recommendation: Urgent clinical assessment for infection. Review medication history (look for marrow-suppressive drugs). Hematology consultation recommended if persistent or severe (<1000/µL).'
                },
                normal: {
                    interpretation: 'Neutrophil count is within the healthy reference range, suggesting adequate innate immune function against bacteria.',
                    recommendation: 'Clinical Recommendation: Routine monitoring as part of standard wellness checks.'
                }
            },
            'Lymphocyte': {
                high: {
                    interpretation: 'Lymphocytosis: Elevated lymphocytes are common in viral infections (Epstein-Barr, Cytomegalovirus), chronic lymphocytic leukemia (CLL), or pertussis.',
                    recommendation: 'Clinical Recommendation: Assess for viral symptoms (sore throat, lymphadenopathy). If elderly or asymptomatic, rule out lymphoproliferative disorders (CLL).'
                },
                low: {
                    interpretation: 'Lymphocytopenia: Decreased lymphocytes may be seen in HIV/AIDS, high-dose steroid therapy, autoimmune diseases (Lupus), or acute stress response.',
                    recommendation: 'Clinical Recommendation: detailed history taking for autoimmune symptoms or immunodeficiency risk factors. Consider HIV screening if clinically indicated.'
                },
                normal: {
                    interpretation: 'Lymphocyte count is within the healthy reference range, indicating normal adaptive immune capacity.',
                    recommendation: 'Clinical Recommendation: Routine monitoring.'
                }
            },
            'Monocyte': {
                high: {
                    interpretation: 'Monocytosis: Often associated with chronic infections (Tuberculosis, fungal), bacterial endocarditis, recovery phase of acute infections, or autoimmune disorders.',
                    recommendation: 'Clinical Recommendation: Evaluate for chronic inflammatory conditions. If persistent, consider screening for chronic infections or myelomonocytic leukemia in elderly patients.'
                },
                low: {
                    interpretation: 'Monocytopenia: Rare. Can be associated with hairy cell leukemia, severe aplastic anemia, or acute stress.',
                    recommendation: 'Clinical Recommendation: Usually not clinically significant in isolation. Monitor trend. Review peripheral smear for hairy cells.'
                },
                normal: {
                    interpretation: 'Monocyte count is within the healthy reference range.',
                    recommendation: 'Clinical Recommendation: Routine monitoring.'
                }
            },
            'Eosinophil': {
                high: {
                    interpretation: 'Eosinophilia: Strongly suggestive of allergic conditions (asthma, eczema), parasitic infections (worms), or drug hypersensitivity.',
                    recommendation: 'Clinical Recommendation: Review allergy history and medications. Consider stool ova/parasite exam if travel history is relevant. Screen for asthma.'
                },
                low: {
                    interpretation: 'Eosinopenia: Often occurs during acute adrenal stress (Cushing’s syndrome), severe acute infection, or corticosteroid use.',
                    recommendation: 'Clinical Recommendation: Usually transient and responsive to stress/infection resolution. No specific intervention typically needed unless Cushing’s suspected.'
                },
                normal: {
                    interpretation: 'Eosinophil count is within the healthy reference range.',
                    recommendation: 'Clinical Recommendation: Routine monitoring.'
                }
            },
            'Basophil': {
                high: {
                    interpretation: 'Basophilia: Uncommon. Can be a marker for Chronic Myeloid Leukemia (CML) or other myeloproliferative neoplasms. Also seen in hypersensitivity reactions.',
                    recommendation: 'Clinical Recommendation: IMPORTANT: Rule out myeloproliferative disorders (CML). Check for splenomegaly. Hematology referral suggested if persistent.'
                },
                low: {
                    interpretation: 'Basopenia: Difficult to demonstrate as normal count is low. May be seen in acute phase of infection, hyperthyroidism, or stress.',
                    recommendation: 'Clinical Recommendation: Generally not clinically significant.'
                },
                normal: {
                    interpretation: 'Basophil count is within the healthy reference range.',
                    recommendation: 'Clinical Recommendation: Routine monitoring.'
                }
            }
        };
        return analyses[type]?.[status] || {
            interpretation: 'Clinical correlation recommended.',
            recommendation: 'Clinical Recommendation: Correlate with clinical findings.'
        };
    };

    // Generate PDF Report
    const generatePDF = (report) => {
        if (!report) return;
        const doc = new jsPDF();

        // Header
        doc.setFillColor(185, 28, 28); // Red-700
        doc.rect(0, 0, 210, 30, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(20);
        doc.setFont("helvetica", "bold");
        doc.text("HEMALYZER REPORT", 15, 20);

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`Generated: ${report.timestamp}`, 150, 15);
        doc.text(`ID: ${report.id}`, 150, 22);

        let y = 45;

        // Patient Info
        if (report.patientData) {
            doc.setDrawColor(200, 200, 200);
            doc.setLineWidth(0.5);
            doc.line(15, y - 5, 195, y - 5);

            doc.setTextColor(185, 28, 28);
            doc.setFontSize(12);
            doc.setFont("helvetica", "bold");
            doc.text("PATIENT INFORMATION", 15, y);
            y += 7;

            doc.setTextColor(0, 0, 0);
            doc.setFontSize(10);
            doc.setFont("helvetica", "normal");
            const pd = report.patientData;
            doc.text(`Name: ${pd.name || 'N/A'}`, 15, y);
            doc.text(`ID: ${pd.id || 'N/A'}`, 80, y);
            doc.text(`Age: ${pd.age || 'N/A'}`, 140, y);
            doc.text(`Gender: ${pd.gender || 'N/A'}`, 170, y);
            y += 6;
            if (pd.phone) doc.text(`Contact: ${pd.phone}`, 15, y);
            y += 10;
        }

        // Summary Statistics
        const summary = [
            ["Total Cells", report.summary?.totalCells || 0],
            ["WBC Count", report.summary?.wbcCount || 0],
            ["RBC Count", report.summary?.rbcCount || 0],
            ["Platelets", report.summary?.plateletCount || 0],
            ["Sickle Cells", report.summary?.sickleCount || 0]
        ];


        doc.autoTable({
            startY: y,
            head: [['Parameter', 'Value']],
            body: summary,
            theme: 'grid',
            headStyles: { fillColor: [185, 28, 28] },
            styles: { fontSize: 10, cellPadding: 2 },
            columnStyles: { 0: { fontStyle: 'bold', width: 80 } }
        });

        y = doc.lastAutoTable.finalY + 10;

        // WBC Differential
        if (report.data?.wbcDifferential) {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(12);
            doc.setTextColor(185, 28, 28);
            doc.text("WBC DIFFERENTIAL", 15, y);
            y += 5;

            const diffBody = Object.entries(report.data.wbcDifferential).map(([key, val]) => [
                key,
                (val.percentage || 0).toFixed(1) + '%',
                val.count || 0,
                val.status || 'Normal'
            ]);

            doc.autoTable({
                startY: y,
                head: [['Cell Type', '%', 'Count', 'Status']],
                body: diffBody,
                theme: 'striped',
                headStyles: { fillColor: [60, 60, 60] }
            });
            y = doc.lastAutoTable.finalY + 10;

            // Detailed Clinical Interpretation Section
            doc.setTextColor(30, 58, 95);
            doc.setFontSize(12);
            doc.setFont("helvetica", "bold");
            doc.text("Clinical Interpretation & Recommendations", 15, y);
            y += 5;

            const interpretationBody = Object.entries(report.data.wbcDifferential).map(([name, data]) => {
                const analysis = getClinicalAnalysis(name, data.status);
                return [
                    { content: `${name} (${data.status === 'normal' ? 'Normal' : data.status.toUpperCase()})`, styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } },
                    { content: `Interpretation: ${analysis.interpretation}\n\n${analysis.recommendation}`, styles: { cellPadding: 3 } }
                ];
            });

            doc.autoTable({
                startY: y,
                body: interpretationBody,
                theme: 'grid',
                showHead: false,
                columnStyles: {
                    0: { cellWidth: 40 },
                    1: { cellWidth: 'auto' }
                },
                styles: { fontSize: 9, cellPadding: 4, valign: 'top' },
                margin: { left: 15, right: 15 }
            });
            y = doc.lastAutoTable.finalY + 15;
        }

        // Disease Findings
        if (report.data?.diseaseFindings && report.data.diseaseFindings.length > 0) {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(12);
            doc.setTextColor(185, 28, 28);
            if (y > 250) { doc.addPage(); y = 20; }
            doc.text("DISEASE FINDINGS & INTERPRETATION", 15, y);
            y += 5;

            const diseaseBody = report.data.diseaseFindings.map(f => [
                f.condition || f.name,
                f.severity || 'Detected',
                (f.confidence ? (f.confidence * 100).toFixed(1) + '%' : 'N/A'),
                f.description || f.interpretation || ''
            ]);

            doc.autoTable({
                startY: y,
                head: [['Condition', 'Severity', 'Conf.', 'Interpretation']],
                body: diseaseBody,
                theme: 'grid',
                headStyles: { fillColor: [185, 28, 28] },
                columnStyles: { 3: { cellWidth: 80 } }
            });
            y = doc.lastAutoTable.finalY + 15;
        }

        // Disclaimer
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.setFont("helvetica", "italic");
        doc.text("Disclaimer: Automated analysis for research and screening purposes only. Diagnosis must be confirmed by a professional.", 15, 280);

        doc.save(`Hemalyzer_Report_${report.id}.pdf`);
    };

    const PieChart = ({ data }) => {
        if (!data || Object.keys(data).length === 0) return <div className="text-gray-400 text-xs">No data for chart</div>;

        const total = Object.values(data).reduce((a, b) => a + typeof b === 'number' ? b : 0, 0);
        if (total === 0) return <div className="text-gray-400 text-xs">No count data</div>;

        let cumulativePercent = 0;

        // Sort for better visualization
        const sortedData = Object.entries(data).sort((a, b) => b[1] - a[1]);
        // Colors palette
        const colors = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#6366F1', '#EC4899', '#8B5CF6', '#64748B'];

        const getCoordinatesForPercent = (percent) => {
            const x = Math.cos(2 * Math.PI * percent);
            const y = Math.sin(2 * Math.PI * percent);
            return [x, y];
        };

        const slices = sortedData.map(([label, value], i) => {
            const percent = value / total;
            const startPercent = cumulativePercent;
            cumulativePercent += percent;
            const endPercent = cumulativePercent;

            const [startX, startY] = getCoordinatesForPercent(startPercent);
            const [endX, endY] = getCoordinatesForPercent(endPercent);

            const largeArcFlag = percent > 0.5 ? 1 : 0;
            const pathData = `M 0 0 L ${startX} ${startY} A 1 1 0 ${largeArcFlag} 1 ${endX} ${endY} L 0 0`;

            return { path: pathData, color: colors[i % colors.length], label, value, percent };
        });

        return (
            <div className="flex items-center gap-4">
                <div className="relative w-32 h-32 shrink-0">
                    <svg viewBox="-1 -1 2 2" className="transform -rotate-90 w-full h-full">
                        {slices.map((slice, i) => (
                            <path key={i} d={slice.path} fill={slice.color} stroke="white" strokeWidth="0.05">
                                <title>{`${slice.label}: ${slice.value}`}</title>
                            </path>
                        ))}
                    </svg>
                </div>
                <div className="text-xs space-y-1">
                    {slices.map((slice, i) => (
                        <div key={i} className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: slice.color }}></span>
                            <span className="font-medium text-slate-700">{slice.label}</span>
                            <span className="text-slate-500">{Math.round(slice.percent * 100)}%</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col min-h-screen bg-red-50">
            <Header />
            <main className="flex grow flex-col items-start justify-start p-8">
                <div className="w-full max-w-7xl mx-auto">
                    <div className="flex justify-between items-center mb-6">
                        <h1 className="text-4xl font-bold text-red-900">Analysis Reports</h1>
                        {reports.length > 0 && (
                            <button
                                onClick={clearAllReports}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                            >
                                Clear All Reports
                            </button>
                        )}
                    </div>

                    {reports.length === 0 ? (
                        <div className="text-center py-16 bg-white rounded-lg border border-red-200">
                            <p className="text-xl text-red-600">No reports saved yet</p>
                            <p className="text-sm text-red-400 mt-2">Analyze an image and save the report to view it here</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Reports List */}
                            <div className="lg:col-span-1 space-y-4">
                                <h2 className="text-xl font-semibold mb-4 text-red-900">Saved Reports ({reports.length})</h2>
                                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                                    {reports.map((report) => (
                                        <div
                                            key={report.id}
                                            onClick={() => setSelectedReport(report)}
                                            className={`p-4 rounded-lg cursor-pointer border-2 transition-all ${selectedReport?.id === report.id
                                                ? 'border-red-600 bg-red-50'
                                                : 'border-red-200 hover:border-red-400 bg-white'
                                                }`}
                                        >
                                            <div className="flex justify-between items-start">
                                                <div className="flex-1">
                                                    <p className="font-semibold text-sm text-red-800">Report #{report.id}</p>
                                                    <p className="text-xs text-red-500">{report.timestamp}</p>
                                                    <div className="mt-2 text-xs text-red-600">
                                                        <span className="font-medium">
                                                            Total: {report.summary?.totalCells || report.data.stage1_detection?.total || 0} cells
                                                        </span>
                                                        {report.summary && (
                                                            <div className="mt-1 space-y-1">
                                                                <div>WBC: {report.summary.wbcCount}, RBC: {report.summary.rbcCount}</div>
                                                                <div>Images: {report.summary.imagesAnalyzed || report.imagesCount}/10</div>
                                                                {report.summary.estimatedWBCCount > 0 && (
                                                                    <div className="text-blue-600 font-medium">
                                                                        Est. WBC: {report.summary.estimatedWBCCount.toLocaleString()}/μL
                                                                    </div>
                                                                )}
                                                                {report.summary.estimatedRBCCount > 0 && (
                                                                    <div className="text-red-600 font-medium">
                                                                        Est. RBC: {(report.summary.estimatedRBCCount / 1e6).toFixed(2)}M/μL
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        deleteReport(report.id);
                                                    }}
                                                    className="text-red-500 hover:text-red-700 text-sm"
                                                >
                                                    X
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Report Details */}
                            <div className="lg:col-span-2">
                                {selectedReport ? (
                                    <div className="bg-white rounded-lg border border-red-200 p-6 shadow-sm">
                                        <div className="flex justify-between items-start mb-6">
                                            <div>
                                                <h2 className="text-2xl font-bold text-red-900">Report #{selectedReport.id}</h2>
                                                <p className="text-sm text-red-500 mt-1">{selectedReport.timestamp}</p>
                                            </div>
                                            <button
                                                onClick={() => generatePDF(selectedReport)}
                                                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors shadow-sm text-sm font-medium"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                                Save as PDF
                                            </button>
                                        </div>

                                        {/* Patient Information Section */}
                                        {selectedReport.patientData && (
                                            <div className="bg-slate-50 p-4 rounded-lg mb-6 border border-slate-200">
                                                <h3 className="font-semibold text-lg mb-3 text-slate-800 flex items-center gap-2">
                                                    <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                    </svg>
                                                    Patient Information
                                                </h3>
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                    <div className="bg-white p-3 rounded border border-slate-200">
                                                        <p className="text-xs text-slate-500">Name</p>
                                                        <p className="font-medium text-slate-800">{selectedReport.patientData.name || 'N/A'}</p>
                                                    </div>
                                                    <div className="bg-white p-3 rounded border border-slate-200">
                                                        <p className="text-xs text-slate-500">Patient ID</p>
                                                        <p className="font-medium text-slate-800 font-mono">{selectedReport.patientData.id || 'N/A'}</p>
                                                    </div>
                                                    <div className="bg-white p-3 rounded border border-slate-200">
                                                        <p className="text-xs text-slate-500">Demographics</p>
                                                        <p className="font-medium text-slate-800">
                                                            {selectedReport.patientData.age ? `${selectedReport.patientData.age} yrs` : 'Age N/A'} • {selectedReport.patientData.gender || 'N/A'}
                                                        </p>
                                                    </div>
                                                    {selectedReport.patientData.phone && (
                                                        <div className="bg-white p-3 rounded border border-slate-200">
                                                            <p className="text-xs text-slate-500">Contact</p>
                                                            <p className="font-medium text-slate-800">{selectedReport.patientData.phone}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}



                                        {/* Cell Detection Summary */}
                                        <div className="bg-slate-50 p-4 rounded-lg mb-6">
                                            <h3 className="font-semibold text-lg mb-3 text-slate-800">Cell Detection Summary</h3>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                <div className="bg-white p-3 rounded border border-slate-200">
                                                    <p className="text-sm text-slate-600">Total Cells</p>
                                                    <p className="text-2xl font-bold text-slate-700">
                                                        {selectedReport.summary?.totalCells || selectedReport.data.stage1_detection?.total || 0}
                                                    </p>
                                                </div>
                                                <div className="bg-white p-3 rounded border border-slate-200">
                                                    <p className="text-sm text-slate-600">Red Blood Cells</p>
                                                    <p className="text-2xl font-bold text-red-600">
                                                        {selectedReport.summary?.rbcCount || selectedReport.data.stage1_detection?.counts?.RBC || 0}
                                                    </p>
                                                </div>
                                                <div className="bg-white p-3 rounded border border-slate-200">
                                                    <p className="text-sm text-slate-600">White Blood Cells</p>
                                                    <p className="text-2xl font-bold text-green-600">
                                                        {selectedReport.summary?.wbcCount || selectedReport.data.stage1_detection?.counts?.WBC || 0}
                                                    </p>
                                                </div>
                                                <div className="bg-white p-3 rounded border border-slate-200">
                                                    <p className="text-sm text-slate-600">Platelets</p>
                                                    <p className="text-2xl font-bold text-amber-600">
                                                        {selectedReport.summary?.plateletCount || selectedReport.data.stage1_detection?.counts?.Platelets || 0}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Estimated Counts Section */}
                                            {selectedReport.summary && (selectedReport.summary.estimatedWBCCount > 0 || selectedReport.summary.estimatedRBCCount > 0) && (
                                                <div className="mt-4 pt-4 border-t border-slate-200">
                                                    <h4 className="font-semibold text-md mb-3 text-slate-800">Estimated Cell Concentrations</h4>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        {selectedReport.summary.estimatedWBCCount > 0 && (
                                                            <div className="bg-blue-50 p-3 rounded border border-blue-200">
                                                                <p className="text-sm text-blue-600">Estimated WBC Count</p>
                                                                <p className="text-xl font-bold text-blue-700">
                                                                    {selectedReport.summary.estimatedWBCCount.toLocaleString()} cells/μL
                                                                </p>
                                                                <p className="text-xs text-blue-500 mt-1">
                                                                    Formula: (Total WBC / 10) × 2,000
                                                                </p>
                                                            </div>
                                                        )}
                                                        {selectedReport.summary.estimatedRBCCount > 0 && (
                                                            <div className="bg-red-50 p-3 rounded border border-red-200">
                                                                <p className="text-sm text-red-600">Estimated RBC Count</p>
                                                                <p className="text-xl font-bold text-red-700">
                                                                    {(selectedReport.summary.estimatedRBCCount / 1e6).toFixed(2)} × 10⁶ cells/μL
                                                                </p>
                                                                <p className="text-xs text-red-500 mt-1">
                                                                    Formula: (Average RBC per image ÷ 10) × 200,000
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* WBC Differential Counts */}
                                        {selectedReport.data?.wbcDifferential && Object.keys(selectedReport.data.wbcDifferential).length > 0 && (
                                            <div className="bg-blue-50 p-4 rounded-lg mb-6 border border-blue-200">
                                                <h3 className="font-semibold text-lg mb-3 text-blue-800">WBC Differential Count</h3>
                                                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                                    {Object.entries(selectedReport.data.wbcDifferential).map(([cellType, data]) => (
                                                        <div key={cellType} className="bg-white p-3 rounded border border-blue-100">
                                                            <p className="text-xs text-blue-600 font-medium">{cellType}</p>
                                                            <p className="text-lg font-bold text-blue-800">{data.percentage?.toFixed(1) || 0}%</p>
                                                            <p className="text-xs text-slate-500">({data.count || 0} cells)</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Abnormal Cells Summary */}
                                        {/* Abnormal Cells Summary & Pie Chart */}
                                        <div className="bg-amber-50 p-4 rounded-lg mb-6 border border-amber-200">
                                            <div className="flex flex-col md:flex-row gap-6">
                                                <div className="flex-1">
                                                    <h3 className="font-semibold text-lg mb-3 text-amber-800">Cell Classification Summary</h3>
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="bg-white p-3 rounded border border-amber-200">
                                                            <p className="text-sm text-amber-600">Abnormal WBCs</p>
                                                            <p className="text-2xl font-bold text-amber-700">{selectedReport.data?.abnormalWBCs || 0}</p>
                                                        </div>
                                                        <div className="bg-white p-3 rounded border border-green-200">
                                                            <p className="text-sm text-green-600">Normal WBCs</p>
                                                            <p className="text-2xl font-bold text-green-700">{(selectedReport.summary?.wbcCount || 0) - (selectedReport.data?.abnormalWBCs || 0)}</p>
                                                        </div>
                                                        <div className="bg-white p-3 rounded border border-red-200">
                                                            <p className="text-sm text-red-600">Sickle Cells</p>
                                                            <p className="text-2xl font-bold text-red-700">{selectedReport.data?.sickleCount || selectedReport.summary?.sickleCount || 0}</p>
                                                        </div>
                                                        <div className="bg-white p-3 rounded border border-slate-200">
                                                            <p className="text-sm text-slate-600">Analyzed Images</p>
                                                            <p className="text-2xl font-bold text-slate-700">{selectedReport.sessionData?.totalImagesAnalyzed || selectedReport.imagesCount || 0}/10</p>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="md:w-1/3 border-l border-amber-200 pl-6 hidden md:block">
                                                    <h4 className="font-semibold text-sm mb-3 text-amber-900">Classification Breakdown</h4>
                                                    <PieChart data={selectedReport.data?.classificationCounts || (selectedReport.data?.wbcDifferential && Object.fromEntries(Object.entries(selectedReport.data.wbcDifferential).map(([k, v]) => [k, v.count])))} />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Disease Findings / Patient Condition */}
                                        {selectedReport.data?.diseaseFindings && selectedReport.data.diseaseFindings.length > 0 && (
                                            <div className="bg-rose-50 p-4 rounded-lg mb-6 border border-rose-200">
                                                <h3 className="font-semibold text-lg mb-3 text-rose-800">Patient Condition Assessment</h3>
                                                <div className="space-y-3">
                                                    {selectedReport.data.diseaseFindings.map((finding, idx) => (
                                                        <div key={idx} className="bg-white p-4 rounded-lg border border-rose-200">
                                                            <div className="flex justify-between items-center mb-2">
                                                                <span className="font-bold text-rose-800 text-lg">{finding.condition || finding.name}</span>
                                                                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${finding.severity === 'HIGH' ? 'bg-red-100 text-red-700' :
                                                                    finding.severity === 'MODERATE' ? 'bg-amber-100 text-amber-700' :
                                                                        'bg-green-100 text-green-700'
                                                                    }`}>
                                                                    {finding.severity || 'DETECTED'}
                                                                </span>
                                                            </div>
                                                            {finding.confidence && (
                                                                <p className="text-sm text-slate-600">
                                                                    Confidence: {(finding.confidence * 100).toFixed(1)}%
                                                                </p>
                                                            )}
                                                            {finding.description && (
                                                                <p className="text-sm text-slate-600 mt-1">{finding.description}</p>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Analysis Summary */}
                                        <div className="bg-slate-50 p-4 rounded-lg">
                                            <h3 className="font-semibold text-lg mb-3 text-slate-800">Analysis Summary</h3>
                                            <div className="grid grid-cols-2 gap-4 text-sm">
                                                <div className="flex justify-between text-slate-700">
                                                    <span>Analysis Date:</span>
                                                    <span>{selectedReport.timestamp}</span>
                                                </div>
                                                <div className="flex justify-between text-slate-700">
                                                    <span>Analysis Status:</span>
                                                    <span className={`font-semibold ${selectedReport.sessionData?.analysisComplete ? 'text-green-600' : 'text-amber-600'}`}>
                                                        {selectedReport.sessionData?.analysisComplete ? 'Complete' : 'In Progress'}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between text-slate-700">
                                                    <span>Total Cells Detected:</span>
                                                    <span className="font-semibold">{selectedReport.summary?.totalCells || 0}</span>
                                                </div>
                                                <div className="flex justify-between text-slate-700">
                                                    <span>WBC Classifications:</span>
                                                    <span className="font-semibold">{selectedReport.sessionData?.wbcClassificationCount || 0}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Clinical Interpretation */}
                                        {selectedReport.data?.disease_interpretation && (
                                            <div className="mt-6 bg-slate-50 border border-slate-200 p-4 rounded-lg">
                                                <h3 className="font-semibold text-lg mb-3 text-slate-800">Clinical Thresholds & Interpretation</h3>
                                                <ThresholdResults
                                                    diseaseInterpretation={selectedReport.data.disease_interpretation}
                                                    clinicalThresholds={selectedReport.data.clinical_thresholds}
                                                />
                                            </div>
                                        )}

                                        {/* Clinical Note */}
                                        <div className="mt-6 bg-slate-50 border border-slate-200 p-4 rounded-lg">
                                            <p className="font-semibold text-slate-700">Clinical Note:</p>
                                            <p className="text-sm text-slate-600 mt-1">
                                                This is a research tool for educational purposes. Results should be validated by trained
                                                hematologists and confirmed with additional diagnostic tests.
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-slate-50 rounded-lg p-16 text-center">
                                        <p className="text-slate-500">Select a report from the list to view details</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </main>
            <Footer />
        </div>
    )
}