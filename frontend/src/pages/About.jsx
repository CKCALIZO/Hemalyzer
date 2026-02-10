import { Header } from "../components/Header.jsx";
import { Footer } from "../components/Footer.jsx";
import { Sidebar } from "../components/Sidebar.jsx";
import { useState } from "react";

export const About = () => {
    const [activeTable, setActiveTable] = useState(null);

    const toggleTable = (tableName) => {
        setActiveTable(activeTable === tableName ? null : tableName);
    };

    return (
        <div className="flex min-h-screen bg-red-50">
            <Sidebar />
            <div className="flex flex-col flex-1 transition-all duration-300">
                <Header />
                <main className="flex grow flex-col items-center justify-start p-8">
                    <div className="max-w-6xl w-full mb-8">
                        <h1 className="text-3xl font-bold text-center text-red-900 mb-4">About Hemalyzer</h1>
                        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-red-700">
                            <p className="text-base text-red-800 leading-relaxed mb-3">
                                Hemalyzer is a thesis project designed to assist in the classification of
                                hematological diseases, particularly leukemia and its subtypes
                                (AML, ALL, CML, CLL), using NAS-optimized YOLOv8 with attention-enhanced
                                feature pyramids for ConvNeXt classification.
                            </p>
                            <div className="bg-red-50 p-4 rounded border-l-4 border-red-600">
                                <h4 className="font-semibold text-red-800 mb-2">Enhanced 20-Class Model Features:</h4>
                                <ul className="text-sm text-red-700 space-y-1">
                                    <li>• <strong>Adaptive Cell Preprocessing:</strong> Stain normalization, CLAHE enhancement, automatic cell detection</li>
                                    <li>• <strong>20 Cell Classes:</strong> 12 normal cell types + 8 disease classifications (AML/ALL/CML/CLL/Sickle Cell)</li>
                                    <li>• <strong>Enhanced Training:</strong> Quality-robust augmentation and balanced class weights</li>
                                    <li>• <strong>High Confidence Thresholds:</strong> 90% for Sickle Cell detection, 85% for disease classifications</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    {/* How Hemalyzer Works Section */}
                    <div className="max-w-6xl w-full mb-8">
                        <h2 className="text-2xl font-bold text-red-900 mb-4">How Hemalyzer Works</h2>
                        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-red-700">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Analysis Pipeline */}
                                <div className="space-y-4">
                                    <h3 className="text-lg font-bold text-red-800 flex items-center">
                                        <span className="bg-red-700 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm mr-2">1</span>
                                        Analysis Pipeline
                                    </h3>
                                    <ol className="text-sm text-red-700 space-y-2 ml-8">
                                        <li><strong>Image Upload:</strong> Upload 10 blood smear images (100x magnification)</li>
                                        <li><strong>Cell Detection:</strong> NAS-optimized YOLOv8 detects and locates blood cells</li>
                                        <li><strong>Cell Classification:</strong> ConvNeXt classifier identifies cell type and disease markers</li>
                                        <li><strong>WBC Differential:</strong> Calculates percentages of Neutrophils, Lymphocytes, Monocytes, Eosinophils, Basophils</li>
                                        <li><strong>Disease Analysis:</strong> Evaluates AML/ALL, CML, CLL, and Sickle Cell indicators</li>
                                        <li><strong>Report Generation:</strong> Produces comprehensive analysis report with interpretations</li>
                                    </ol>
                                </div>

                                {/* Technical Enhancements */}
                                <div className="space-y-4">
                                    <h3 className="text-lg font-bold text-red-800 flex items-center">
                                        <span className="bg-red-700 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm mr-2">2</span>
                                        Technical Enhancements
                                    </h3>
                                    <div className="text-sm text-red-700 space-y-3 ml-8">
                                        <div className="bg-red-50 p-3 rounded">
                                            <strong className="text-red-800">NAS-Optimized YOLOv8:</strong>
                                            <p className="mt-1">Neural Architecture Search (NAS) optimized detection model for accurate cell localization in blood smear images.</p>
                                        </div>
                                        <div className="bg-red-50 p-3 rounded">
                                            <strong className="text-red-800">Attention-Enhanced FPN:</strong>
                                            <p className="mt-1">Feature Pyramid Network with attention mechanisms for improved multi-scale cell detection.</p>
                                        </div>
                                        <div className="bg-red-50 p-3 rounded">
                                            <strong className="text-red-800">ConvNeXt Classification:</strong>
                                            <p className="mt-1">State-of-the-art convolutional network for precise 20-class cell type and disease classification.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Disease Analysis Summary */}
                            <div className="mt-6 pt-4 border-t border-red-200">
                                <h3 className="text-lg font-bold text-red-800 mb-3">Disease Analysis Methodology</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                                    <div className="bg-slate-50 p-3 rounded border-l-4 border-slate-600">
                                        <strong className="text-slate-800">AML Analysis</strong>
                                        <p className="text-slate-600 mt-1">Based on myeloblast percentage. Shares severity thresholds with CML (&lt;10% Normal, 10-20% Moderate, ≥20% High).</p>
                                    </div>
                                    <div className="bg-slate-50 p-3 rounded border-l-4 border-slate-600">
                                        <strong className="text-slate-800">CML Analysis</strong>
                                        <p className="text-slate-600 mt-1">Based on CML-marked granulocyte percentage. Shares severity thresholds with AML (&lt;10% Normal, 10-20% Moderate, ≥20% High).</p>
                                    </div>
                                    <div className="bg-slate-50 p-3 rounded border-l-4 border-slate-600">
                                        <strong className="text-slate-800">ALL Analysis</strong>
                                        <p className="text-slate-600 mt-1">Based on lymphoblast percentage. Shares 5-tier severity scale with CLL (&lt;35% Normal, 35-50% Low, 51-65% Moderate, ≥66% High, &gt;80% Advanced).</p>
                                    </div>
                                    <div className="bg-slate-50 p-3 rounded border-l-4 border-slate-600">
                                        <strong className="text-slate-800">CLL Analysis</strong>
                                        <p className="text-slate-600 mt-1">Based on CLL-marked lymphocyte percentage. Shares 5-tier severity scale with ALL (&lt;35% Normal, 35-50% Low, 51-65% Moderate, ≥66% High, &gt;80% Advanced).</p>
                                    </div>
                                    <div className="bg-slate-50 p-3 rounded border-l-4 border-slate-600">
                                        <strong className="text-slate-800">Sickle Cell Analysis</strong>
                                        <p className="text-slate-600 mt-1">Based on sickle cell percentage in RBC count. Detects trait (HbAS) and disease (HbSS).</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="max-w-6xl w-full mb-6">
                        <h2 className="text-2xl font-bold text-red-900 mb-2">Classification Reference Tables</h2>
                        <p className="text-red-600 text-sm">Click on any category below to view detailed classification criteria</p>
                    </div>

                    <div className="max-w-6xl w-full mb-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <button
                            onClick={() => toggleTable('aml')}
                            className={`p-5 rounded-lg shadow-sm transition-all duration-200 border ${activeTable === 'aml'
                                ? 'bg-red-700 text-white border-red-700'
                                : 'bg-white text-red-800 hover:bg-red-50 border-red-200 cursor-pointer'
                                }`}
                        >
                            <h3 className="text-lg font-bold mb-1">AML Leukemia</h3>
                            <p className={`text-sm ${activeTable === 'aml' ? 'text-red-200' : 'text-red-600'}`}>
                                Acute Myeloid Leukemia classification
                            </p>
                        </button>

                        <button
                            onClick={() => toggleTable('all')}
                            className={`p-5 rounded-lg shadow-sm transition-all duration-200 border ${activeTable === 'all'
                                ? 'bg-red-700 text-white border-red-700'
                                : 'bg-white text-red-800 hover:bg-red-50 border-red-200 cursor-pointer'
                                }`}
                        >
                            <h3 className="text-lg font-bold mb-1">ALL Leukemia</h3>
                            <p className={`text-sm ${activeTable === 'all' ? 'text-red-200' : 'text-red-600'}`}>
                                Acute Lymphoblastic Leukemia classification
                            </p>
                        </button>

                        <button
                            onClick={() => toggleTable('cml')}
                            className={`p-5 rounded-lg shadow-sm transition-all duration-200 border ${activeTable === 'cml'
                                ? 'bg-red-700 text-white border-red-700'
                                : 'bg-white text-red-800 hover:bg-red-50 border-red-200 cursor-pointer'
                                }`}
                        >
                            <h3 className="text-lg font-bold mb-1">CML Leukemia</h3>
                            <p className={`text-sm ${activeTable === 'cml' ? 'text-red-200' : 'text-red-600'}`}>
                                Chronic Myeloid Leukemia classification
                            </p>
                        </button>

                        <button
                            onClick={() => toggleTable('cll')}
                            className={`p-5 rounded-lg shadow-sm transition-all duration-200 border ${activeTable === 'cll'
                                ? 'bg-red-700 text-white border-red-700'
                                : 'bg-white text-red-800 hover:bg-red-50 border-red-200 cursor-pointer'
                                }`}
                        >
                            <h3 className="text-lg font-bold mb-1">CLL Leukemia</h3>
                            <p className={`text-sm ${activeTable === 'cll' ? 'text-red-200' : 'text-red-600'}`}>
                                Chronic Lymphocytic Leukemia classification
                            </p>
                        </button>

                        <button
                            onClick={() => toggleTable('sickle')}
                            className={`p-5 rounded-lg shadow-sm transition-all duration-200 border ${activeTable === 'sickle'
                                ? 'bg-red-700 text-white border-red-700'
                                : 'bg-white text-red-800 hover:bg-red-50 border-red-200 cursor-pointer'
                                }`}
                        >
                            <h3 className="text-lg font-bold mb-1">Sickle Cell Anemia</h3>
                            <p className={`text-sm ${activeTable === 'sickle' ? 'text-red-200' : 'text-red-600'}`}>
                                Sickle cell disease classification
                            </p>
                        </button>

                        <button
                            onClick={() => setActiveTable(null)}
                            className={`p-5 rounded-lg shadow-sm transition-all duration-200 border ${activeTable === null
                                ? 'bg-red-700 text-white border-red-700'
                                : 'bg-white text-red-700 hover:bg-red-50 border-red-200 cursor-pointer'
                                }`}
                        >
                            <h3 className="text-lg font-bold mb-1">View All</h3>
                            <p className={`text-sm ${activeTable === null ? 'text-red-200' : 'text-red-600'}`}>
                                Display all classification tables
                            </p>
                        </button>
                    </div>

                    {/* Tables Section */}
                    <div className="max-w-6xl w-full space-y-8">
                        {/* AML Table */}
                        {(activeTable === 'aml' || activeTable === null) && (
                            <div className="bg-white rounded-lg shadow-sm p-6 border-t-4 border-slate-700 animate-fadeIn">
                                <h3 className="text-xl font-bold text-slate-800 mb-4">AML Leukemia Classification</h3>
                                <div className="overflow-x-auto">
                                    <table className="w-full border-collapse">
                                        <thead>
                                            <tr className="bg-slate-800 text-white">
                                                <th className="border border-slate-700 px-6 py-3 text-left text-sm font-semibold">Myeloblast Cells in Smear (%)</th>
                                                <th className="border border-slate-700 px-6 py-3 text-left text-sm font-semibold">Interpretation</th>
                                                <th className="border border-slate-700 px-6 py-3 text-left text-sm font-semibold">Condition</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr className="hover:bg-slate-50 transition-colors">
                                                <td className="border border-slate-200 px-6 py-3 font-semibold text-slate-700">&lt; 10%</td>
                                                <td className="border border-slate-200 px-6 py-3 text-slate-600">Normal Blood, with some blast cells; may be reactive or artifactual.</td>
                                                <td className="border border-slate-200 px-6 py-3 text-slate-600">Normal</td>
                                            </tr>
                                            <tr className="hover:bg-slate-50 transition-colors bg-slate-50/50">
                                                <td className="border border-slate-200 px-6 py-3 font-semibold text-slate-700">10% - 19%</td>
                                                <td className="border border-slate-200 px-6 py-3 text-slate-600">Suspicious for pre-leukemic conditions (MDS) or evolving acute leukemia. Requires bone marrow biopsy.</td>
                                                <td className="border border-slate-200 px-6 py-3 text-slate-600">Suspicious / Pre-leukemic (AML)</td>
                                            </tr>
                                            <tr className="hover:bg-slate-50 transition-colors">
                                                <td className="border border-slate-200 px-6 py-3 font-semibold text-slate-700">&ge; 20%</td>
                                                <td className="border border-slate-200 px-6 py-3 text-slate-600">Diagnostic threshold for Acute Myeloid Leukemia (WHO criteria). Immediate hematology referral required.</td>
                                                <td className="border border-slate-200 px-6 py-3 text-slate-600">Acute Myeloid Leukemia (AML)</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* ALL Table */}
                        {(activeTable === 'all' || activeTable === null) && (
                            <div className="bg-white rounded-lg shadow-sm p-6 border-t-4 border-slate-700 animate-fadeIn">
                                <h3 className="text-xl font-bold text-slate-800 mb-4">ALL Leukemia Classification</h3>
                                <div className="overflow-x-auto">
                                    <table className="w-full border-collapse">
                                        <thead>
                                            <tr className="bg-slate-800 text-white">
                                                <th className="border border-slate-700 px-6 py-3 text-left text-sm font-semibold">Lymphoblast Cells in Smear (%)</th>
                                                <th className="border border-slate-700 px-6 py-3 text-left text-sm font-semibold">Interpretation</th>
                                                <th className="border border-slate-700 px-6 py-3 text-left text-sm font-semibold">Condition</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr className="hover:bg-slate-50 transition-colors">
                                                <td className="border border-slate-200 px-6 py-3 font-semibold text-slate-700">&lt; 35%</td>
                                                <td className="border border-slate-200 px-6 py-3 text-slate-600">Lymphoblasts within reactive ranges; balanced white cell differential.</td>
                                                <td className="border border-slate-200 px-6 py-3 text-slate-600">Normal</td>
                                            </tr>
                                            <tr className="hover:bg-slate-50 transition-colors bg-slate-50/50">
                                                <td className="border border-slate-200 px-6 py-3 font-semibold text-slate-700">35% - 50%</td>
                                                <td className="border border-slate-200 px-6 py-3 text-slate-600">Slight increase in lymphoblasts; may occur with viral infections or reactive conditions.</td>
                                                <td className="border border-slate-200 px-6 py-3 text-slate-600">Reactive / Secondary Lymphocytosis</td>
                                            </tr>
                                            <tr className="hover:bg-slate-50 transition-colors">
                                                <td className="border border-slate-200 px-6 py-3 font-semibold text-slate-700">51% - 65%</td>
                                                <td className="border border-slate-200 px-6 py-3 text-slate-600">Persistent lymphoblast elevation; suggestive of early-stage lymphoproliferative disorder.</td>
                                                <td className="border border-slate-200 px-6 py-3 text-slate-600">Suspicious for Early ALL</td>
                                            </tr>
                                            <tr className="hover:bg-slate-50 transition-colors bg-slate-50/50">
                                                <td className="border border-slate-200 px-6 py-3 font-semibold text-slate-700">66% - 80%</td>
                                                <td className="border border-slate-200 px-6 py-3 text-slate-600">Marked lymphoblastic predominance; numerous lymphoblasts visible on smear.</td>
                                                <td className="border border-slate-200 px-6 py-3 text-slate-600">Acute Lymphoblastic Leukemia (ALL)</td>
                                            </tr>
                                            <tr className="hover:bg-slate-50 transition-colors">
                                                <td className="border border-slate-200 px-6 py-3 font-semibold text-slate-700">&gt; 80%</td>
                                                <td className="border border-slate-200 px-6 py-3 text-slate-600">Lymphoblasts overwhelmingly dominate the smear; indicative of advanced ALL.</td>
                                                <td className="border border-slate-200 px-6 py-3 text-slate-600">Advanced / Progressive ALL</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* CML Table */}
                        {(activeTable === 'cml' || activeTable === null) && (
                            <div className="bg-white rounded-lg shadow-sm p-6 border-t-4 border-slate-700 animate-fadeIn">
                                <h3 className="text-xl font-bold text-slate-800 mb-4">CML Leukemia Classification</h3>
                                <div className="overflow-x-auto">
                                    <table className="w-full border-collapse">
                                        <thead>
                                            <tr className="bg-slate-800 text-white">
                                                <th className="border border-slate-700 px-6 py-3 text-left text-sm font-semibold">CML-Marked Granulocytes (%)</th>
                                                <th className="border border-slate-700 px-6 py-3 text-left text-sm font-semibold">Interpretation</th>
                                                <th className="border border-slate-700 px-6 py-3 text-left text-sm font-semibold">Condition</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr className="hover:bg-slate-50 transition-colors">
                                                <td className="border border-slate-200 px-6 py-3 font-semibold text-slate-700">&lt; 10%</td>
                                                <td className="border border-slate-200 px-6 py-3 text-slate-600">CML-marked cells detected but below diagnostic threshold; may be reactive or artifactual.</td>
                                                <td className="border border-slate-200 px-6 py-3 text-slate-600">Normal</td>
                                            </tr>
                                            <tr className="hover:bg-slate-50 transition-colors bg-slate-50/50">
                                                <td className="border border-slate-200 px-6 py-3 font-semibold text-slate-700">10% - 19%</td>
                                                <td className="border border-slate-200 px-6 py-3 text-slate-600">Suspicious for pre-leukemic conditions or early CML. BCR-ABL1 testing recommended.</td>
                                                <td className="border border-slate-200 px-6 py-3 text-slate-600">Suspicious / Pre-leukemic (CML)</td>
                                            </tr>
                                            <tr className="hover:bg-slate-50 transition-colors">
                                                <td className="border border-slate-200 px-6 py-3 font-semibold text-slate-700">&ge; 20%</td>
                                                <td className="border border-slate-200 px-6 py-3 text-slate-600">Diagnostic level for CML. Significant CML-marked granulocyte proliferation. Immediate hematology referral required.</td>
                                                <td className="border border-slate-200 px-6 py-3 text-slate-600">Chronic Myeloid Leukemia (CML)</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* CLL Table */}
                        {(activeTable === 'cll' || activeTable === null) && (
                            <div className="bg-white rounded-lg shadow-sm p-6 border-t-4 border-slate-700 animate-fadeIn">
                                <h3 className="text-xl font-bold text-slate-800 mb-4">CLL Leukemia Classification</h3>
                                <div className="overflow-x-auto">
                                    <table className="w-full border-collapse">
                                        <thead>
                                            <tr className="bg-slate-800 text-white">
                                                <th className="border border-slate-700 px-6 py-3 text-left text-sm font-semibold">Lymphocytes (% )</th>
                                                <th className="border border-slate-700 px-6 py-3 text-left text-sm font-semibold">Interpretation</th>
                                                <th className="border border-slate-700 px-6 py-3 text-left text-sm font-semibold">Condition</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr className="hover:bg-slate-50 transition-colors">
                                                <td className="border border-slate-200 px-6 py-3 font-semibold text-slate-700">&lt; 35%</td>
                                                <td className="border border-slate-200 px-6 py-3 text-slate-600">Normal lymphocyte count; balanced white cell differential.</td>
                                                <td className="border border-slate-200 px-6 py-3 text-slate-600">Normal</td>
                                            </tr>
                                            <tr className="hover:bg-slate-50 transition-colors bg-slate-50/50">
                                                <td className="border border-slate-200 px-6 py-3 font-semibold text-slate-700">35% - 50%</td>
                                                <td className="border border-slate-200 px-6 py-3 text-slate-600">Slight lymphocytosis; may occur with viral infections (e.g., EBV, CMV) or stress.</td>
                                                <td className="border border-slate-200 px-6 py-3 text-slate-600">Reactive / Secondary Lymphocytosis</td>
                                            </tr>
                                            <tr className="hover:bg-slate-50 transition-colors">
                                                <td className="border border-slate-200 px-6 py-3 font-semibold text-slate-700">51% - 65%</td>
                                                <td className="border border-slate-200 px-6 py-3 text-slate-600">Persistent lymphocytosis with many small, mature lymphocytes.</td>
                                                <td className="border border-slate-200 px-6 py-3 text-slate-600">Suspicious for Early / Smoldering CLL</td>
                                            </tr>
                                            <tr className="hover:bg-slate-50 transition-colors bg-slate-50/50">
                                                <td className="border border-slate-200 px-6 py-3 font-semibold text-slate-700">66% - 80%</td>
                                                <td className="border border-slate-200 px-6 py-3 text-slate-600">Marked lymphocytic predominance; numerous lymphocytes visible on smear.</td>
                                                <td className="border border-slate-200 px-6 py-3 text-slate-600"> Chronic Lymphocytic Leukemia (CLL)</td>
                                            </tr>
                                            <tr className="hover:bg-slate-50 transition-colors">
                                                <td className="border border-slate-200 px-6 py-3 font-semibold text-slate-700">&gt; 80%</td>
                                                <td className="border border-slate-200 px-6 py-3 text-slate-600">Lymphocytes overwhelmingly dominate the smear; may show prolymphocyte transformation or increased atypical cells.</td>
                                                <td className="border border-slate-200 px-6 py-3 text-slate-600">Advanced / Progressive CLL</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Sickle Cell Table */}
                        {(activeTable === 'sickle' || activeTable === null) && (
                            <div className="bg-white rounded-lg shadow-sm p-6 border-t-4 border-slate-700 animate-fadeIn">
                                <h3 className="text-xl font-bold text-slate-800 mb-4">Sickle Cell Anemia Classification</h3>
                                <div className="overflow-x-auto">
                                    <table className="w-full border-collapse">
                                        <thead>
                                            <tr className="bg-slate-800 text-white">
                                                <th className="border border-slate-700 px-6 py-3 text-left text-sm font-semibold">Sickle cells in smear (%)</th>
                                                <th className="border border-slate-700 px-6 py-3 text-left text-sm font-semibold">Interpretation</th>
                                                <th className="border border-slate-700 px-6 py-3 text-left text-sm font-semibold">Condition</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr className="hover:bg-slate-50 transition-colors">
                                                <td className="border border-slate-200 px-6 py-3 font-semibold text-slate-700">&lt; 3%</td>
                                                <td className="border border-slate-200 px-6 py-3 text-slate-600">Normal blood, no clinically significant sickling observed. May include smudge cells or artifacts.</td>
                                                <td className="border border-slate-200 px-6 py-3 text-slate-600">Normal / Smudge Cells</td>
                                            </tr>
                                            <tr className="hover:bg-slate-50 transition-colors bg-slate-50/50">
                                                <td className="border border-slate-200 px-6 py-3 font-semibold text-slate-700">3% - 10%</td>
                                                <td className="border border-slate-200 px-6 py-3 text-slate-600">Mild sickling present; individual typically asymptomatic or has mild symptoms under stress.</td>
                                                <td className="border border-slate-200 px-6 py-3 text-slate-600">Mild Sickling - Heterozygous HbAS condition (Sickle Cell Trait)</td>
                                            </tr>
                                            <tr className="hover:bg-slate-50 transition-colors">
                                                <td className="border border-slate-200 px-6 py-3 font-semibold text-slate-700">10% - 30%</td>
                                                <td className="border border-slate-200 px-6 py-3 text-slate-600">Moderate proportion of sickled cells; may correlate with symptoms, stress, or hypoxic conditions.</td>
                                                <td className="border border-slate-200 px-6 py-3 text-slate-600">Moderate Sickling (possible HbSS)</td>
                                            </tr>
                                            <tr className="hover:bg-slate-50 transition-colors bg-slate-50/50">
                                                <td className="border border-slate-200 px-6 py-3 font-semibold text-slate-700">&gt; 30%</td>
                                                <td className="border border-slate-200 px-6 py-3 text-slate-600">Severe sickling with majority of RBCs showing sickle morphology; indicative of homozygous sickle cell disease.</td>
                                                <td className="border border-slate-200 px-6 py-3 text-slate-600">Severe Sickling - suggestive of Sickle Cell Disease (HbSS)</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                </main>
                <Footer />
            </div>
        </div>
    )
}