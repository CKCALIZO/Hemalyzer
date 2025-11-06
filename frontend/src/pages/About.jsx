import { Header} from "../components/Header.jsx";
import { Footer } from "../components/Footer.jsx";
import { useState } from "react";

export const About = () => {
    const [activeTable, setActiveTable] = useState(null);

    const toggleTable = (tableName) => {
        setActiveTable(activeTable === tableName ? null : tableName);
    };

    return(
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex grow flex-col items-center justify-start p-8">
                <div className="max-w-6xl w-full mb-8">
                    <h1 className="text-5xl font-bold text-center text-[#a02038] mb-4">About Hemalyzer</h1>
                    <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-[#cb2a49]">
                        <p className="text-lg text-gray-700 leading-relaxed">
                            Hemalyzer is a thesis project designed to assist in the classification of 
                            hematological diseases, particularly leukemia and its subtypes 
                            (AML, ALL, CML, CLL), using NAS-optimized YOLOv8 with attention-enhanced 
                            feature pyramids for ConvNeXt classification.
                        </p>
                    </div>
                </div>

                <div className="max-w-6xl w-full mb-6">
                    <h2 className="text-3xl font-bold text-[#a02038] mb-2">Classification Reference Tables</h2>
                    <p className="text-gray-600">Click on any category below to view detailed classification criteria</p>
                </div>

                <div className="max-w-6xl w-full mb-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <button
                        onClick={() => toggleTable('aml-all')}
                        className={`p-6 rounded-lg shadow-md transition-all duration-300 transform hover:scale-105 ${
                            activeTable === 'aml-all' 
                            ? 'bg-gradient-to-r from-[#cb2a49] to-[#a02038] text-white shadow-xl' 
                            : 'bg-white text-[#a02038] hover:bg-[#fff7ee] cursor-pointer'
                        }`}
                    >
                        <h3 className="text-xl font-bold mb-2">AML / ALL Leukemia</h3>
                        <p className={`text-sm ${activeTable === 'aml-all' ? 'text-white/90' : 'text-gray-600'}`}>
                            Acute Myeloid / Lymphoblastic Leukemia classification
                        </p>
                    </button>

                    <button
                        onClick={() => toggleTable('cml')}
                        className={`p-6 rounded-lg shadow-md transition-all duration-300 transform hover:scale-105 ${
                            activeTable === 'cml' 
                            ? 'bg-gradient-to-r from-[#cb2a49] to-[#a02038] text-white shadow-xl' 
                            : 'bg-white text-[#a02038] hover:bg-[#fff7ee] cursor-pointer'
                        }`}
                    >
                        <h3 className="text-xl font-bold mb-2">CML Leukemia</h3>
                        <p className={`text-sm ${activeTable === 'cml' ? 'text-white/90' : 'text-gray-600'}`}>
                            Chronic Myeloid Leukemia classification
                        </p>
                    </button>

                    <button
                        onClick={() => toggleTable('cll')}
                        className={`p-6 rounded-lg shadow-md transition-all duration-300 transform hover:scale-105 ${
                            activeTable === 'cll' 
                            ? 'bg-gradient-to-r from-[#cb2a49] to-[#a02038] text-white shadow-xl' 
                            : 'bg-white text-[#a02038] hover:bg-[#fff7ee] cursor-pointer'
                        }`}
                    >
                        <h3 className="text-xl font-bold mb-2">CLL Leukemia</h3>
                        <p className={`text-sm ${activeTable === 'cll' ? 'text-white/90' : 'text-gray-600'}`}>
                            Chronic Lymphocytic Leukemia classification
                        </p>
                    </button>

                    <button
                        onClick={() => toggleTable('sickle')}
                        className={`p-6 rounded-lg shadow-md transition-all duration-300 transform hover:scale-105 ${
                            activeTable === 'sickle' 
                            ? 'bg-gradient-to-r from-[#cb2a49] to-[#a02038] text-white shadow-xl' 
                            : 'bg-white text-[#a02038] hover:bg-[#fff7ee] cursor-pointer'
                        }`}
                    >
                        <h3 className="text-xl font-bold mb-2">Sickle Cell Anemia</h3>
                        <p className={`text-sm ${activeTable === 'sickle' ? 'text-white/90' : 'text-gray-600'}`}>
                            Sickle cell disease classification
                        </p>
                    </button>

                    <button
                        onClick={() => setActiveTable(null)}
                        className={`p-6 rounded-lg shadow-md transition-all duration-300 transform hover:scale-105 ${
                            activeTable === null 
                            ? 'bg-gradient-to-r from-[#cb2a49] to-[#a02038] text-white shadow-xl' 
                            : 'bg-white text-gray-900 hover:bg-[#fff7ee] cursor-pointer'
                        }`}
                    >
                        <h3 className="text-xl font-bold mb-2">View All</h3>
                        <p className={`text-sm ${activeTable === null ? 'text-white/90' : 'text-gray-600'}`}>
                            Display all classification tables
                        </p>
                    </button>
                </div>

                {/* Tables Section */}
                <div className="max-w-6xl w-full space-y-8">
                    {/* AML/ALL Table */}
                    {(activeTable === 'aml-all' || activeTable === null) && (
                        <div className="bg-white rounded-lg shadow-xl p-6 border-t-4 border-[#cb2a49] animate-fadeIn">
                            <h3 className="text-2xl font-bold text-[#a02038] mb-4">AML / ALL Leukemia Classification</h3>
                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse">
                                    <thead>
                                        <tr className="bg-gradient-to-r from-[#cb2a49] to-[#a02038] text-white">
                                            <th className="border border-[#cb2a49] px-6 py-3 text-left">Blast Cells in Smear (%)</th>
                                            <th className="border border-[#cb2a49] px-6 py-3 text-left">Typical Interpretation</th>
                                            <th className="border border-[#cb2a49] px-6 py-3 text-left">Possible Condition</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr className="hover:bg-[#fff7ee] transition-colors">
                                            <td className="border border-gray-300 px-6 py-3 font-semibold text-[#a02038]">&lt; 5%</td>
                                            <td className="border border-gray-300 px-6 py-3">Normal Blood, with some blast cells</td>
                                            <td className="border border-gray-300 px-6 py-3">Normal</td>
                                        </tr>
                                        <tr className="hover:bg-[#fff7ee] transition-colors bg-gray-50">
                                            <td className="border border-gray-300 px-6 py-3 font-semibold text-[#a02038]">6% - 10%</td>
                                            <td className="border border-gray-300 px-6 py-3">Slightly Increased, possibly reactive</td>
                                            <td className="border border-gray-300 px-6 py-3">May be normal/reactive condition</td>
                                        </tr>
                                        <tr className="hover:bg-[#fff7ee] transition-colors">
                                            <td className="border border-gray-300 px-6 py-3 font-semibold text-[#a02038]">11% - 19%</td>
                                            <td className="border border-gray-300 px-6 py-3">Suspicious / Pre-leukemic</td>
                                            <td className="border border-gray-300 px-6 py-3">Suspicious for evolving leukemia</td>
                                        </tr>
                                        <tr className="hover:bg-[#fff7ee] transition-colors bg-gray-50">
                                            <td className="border border-gray-300 px-6 py-3 font-semibold text-[#a02038]">&ge; 20%</td>
                                            <td className="border border-gray-300 px-6 py-3">Diagnostic level for acute leukemia; large number of blasts (lymphoblasts or myeloblasts).</td>
                                            <td className="border border-gray-300 px-6 py-3">
                                                <strong>Acute Leukemia:</strong>
                                                <ul className="list-disc ml-5 mt-2">
                                                    <li>Higher lymphoblast percentage → Acute Lymphoblastic Leukemia (ALL)</li>
                                                    <li>Higher myeloblast percentage → Acute Myeloid Leukemia (AML)</li>
                                                </ul>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* CML Table */}
                    {(activeTable === 'cml' || activeTable === null) && (
                        <div className="bg-white rounded-lg shadow-xl p-6 border-t-4 border-[#cb2a49] animate-fadeIn">
                            <h3 className="text-2xl font-bold text-[#a02038] mb-4">CML Leukemia Classification</h3>
                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse">
                                    <thead>
                                        <tr className="bg-gradient-to-r from-[#cb2a49] to-[#a02038] text-white">
                                            <th className="border border-[#cb2a49] px-6 py-3 text-left">Granulocytes (Basophil, Eosinophil, Myeloblast, Neutrophils) (%)</th>
                                            <th className="border border-[#cb2a49] px-6 py-3 text-left">Typical Interpretation</th>
                                            <th className="border border-[#cb2a49] px-6 py-3 text-left">Possible Condition</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr className="hover:bg-[#fff7ee] transition-colors">
                                            <td className="border border-gray-300 px-6 py-3 font-semibold text-[#a02038]">&lt; 60%</td>
                                            <td className="border border-gray-300 px-6 py-3">Normal differential count; balanced white cell maturation.</td>
                                            <td className="border border-gray-300 px-6 py-3">Normal</td>
                                        </tr>
                                        <tr className="hover:bg-[#fff7ee] transition-colors bg-gray-50">
                                            <td className="border border-gray-300 px-6 py-3 font-semibold text-[#a02038]">60% - 75%</td>
                                            <td className="border border-gray-300 px-6 py-3">Mild granulocytic predominance; may reflect infection, stress response, or early reactive leukocytosis (CML).</td>
                                            <td className="border border-gray-300 px-6 py-3">Reactive / Secondary Leukocytosis (CML)</td>
                                        </tr>
                                        <tr className="hover:bg-[#fff7ee] transition-colors">
                                            <td className="border border-gray-300 px-6 py-3 font-semibold text-[#a02038]">76% - 89%</td>
                                            <td className="border border-gray-300 px-6 py-3">Marked granulocytic proliferation with left shift granulocytes; may show mild increase in basophil and eosinophil</td>
                                            <td className="border border-gray-300 px-6 py-3">Suspicious for Early Chronic Myeloid Leukemia (CML - Chronic Phase)</td>
                                        </tr>
                                        <tr className="hover:bg-[#fff7ee] transition-colors bg-gray-50">
                                            <td className="border border-gray-300 px-6 py-3 font-semibold text-[#a02038]">90% - 95% <br/><span className="text-sm text-gray-600">(Blast cells usually &lt; 5%)</span></td>
                                            <td className="border border-gray-300 px-6 py-3">Granulocytes dominate differential; significant left shift with numerous granulocytes; circulating blasts usually &lt; 5%.</td>
                                            <td className="border border-gray-300 px-6 py-3">Typical Chronic Phase CML</td>
                                        </tr>
                                        <tr className="hover:bg-[#fff7ee] transition-colors">
                                            <td className="border border-gray-300 px-6 py-3 font-semibold text-[#a02038]">&gt; 95% <br/><span className="text-sm text-gray-600">(Blasts &ge; 10%)</span></td>
                                            <td className="border border-gray-300 px-6 py-3">Extreme granulocytic proliferation with increased granulocytes; increasing blast count indicates transition.</td>
                                            <td className="border border-gray-300 px-6 py-3">Accelerated Phase CML</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* CLL Table */}
                    {(activeTable === 'cll' || activeTable === null) && (
                        <div className="bg-white rounded-lg shadow-xl p-6 border-t-4 border-[#cb2a49] animate-fadeIn">
                            <h3 className="text-2xl font-bold text-[#a02038] mb-4">CLL Leukemia Classification</h3>
                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse">
                                    <thead>
                                        <tr className="bg-gradient-to-r from-[#cb2a49] to-[#a02038] text-white">
                                            <th className="border border-[#cb2a49] px-6 py-3 text-left">Lymphocytes (%)</th>
                                            <th className="border border-[#cb2a49] px-6 py-3 text-left">Typical Interpretation</th>
                                            <th className="border border-[#cb2a49] px-6 py-3 text-left">Possible Condition</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr className="hover:bg-[#fff7ee] transition-colors">
                                            <td className="border border-gray-300 px-6 py-3 font-semibold text-[#a02038]">&lt; 20%</td>
                                            <td className="border border-gray-300 px-6 py-3">Normal lymphocyte count; balanced white cell differential.</td>
                                            <td className="border border-gray-300 px-6 py-3">Normal</td>
                                        </tr>
                                        <tr className="hover:bg-[#fff7ee] transition-colors bg-gray-50">
                                            <td className="border border-gray-300 px-6 py-3 font-semibold text-[#a02038]">20% - 40%</td>
                                            <td className="border border-gray-300 px-6 py-3">Slight lymphocytosis; may occur with viral infections (e.g., EBV, CMV) or stress.</td>
                                            <td className="border border-gray-300 px-6 py-3">Reactive / Secondary Lymphocytosis</td>
                                        </tr>
                                        <tr className="hover:bg-[#fff7ee] transition-colors">
                                            <td className="border border-gray-300 px-6 py-3 font-semibold text-[#a02038]">41% - 60%</td>
                                            <td className="border border-gray-300 px-6 py-3">Persistent lymphocytosis with many small, mature lymphocytes.</td>
                                            <td className="border border-gray-300 px-6 py-3">Suspicious for Early / Smoldering CLL</td>
                                        </tr>
                                        <tr className="hover:bg-[#fff7ee] transition-colors bg-gray-50">
                                            <td className="border border-gray-300 px-6 py-3 font-semibold text-[#a02038]">61% - 80%</td>
                                            <td className="border border-gray-300 px-6 py-3">Marked lymphocytic predominance; numerous lymphocytes visible on smear.</td>
                                            <td className="border border-gray-300 px-6 py-3">Typical Chronic Lymphocytic Leukemia (CLL)</td>
                                        </tr>
                                        <tr className="hover:bg-[#fff7ee] transition-colors">
                                            <td className="border border-gray-300 px-6 py-3 font-semibold text-[#a02038]">&gt; 80%</td>
                                            <td className="border border-gray-300 px-6 py-3">Lymphocytes overwhelmingly dominate the smear; may show prolymphocyte transformation or increased atypical cells.</td>
                                            <td className="border border-gray-300 px-6 py-3">Advanced / Progressive CLL</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Sickle Cell Table */}
                    {(activeTable === 'sickle' || activeTable === null) && (
                        <div className="bg-white rounded-lg shadow-xl p-6 border-t-4 border-[#cb2a49] animate-fadeIn">
                            <h3 className="text-2xl font-bold text-[#a02038] mb-4">Sickle Cell Anemia Classification</h3>
                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse">
                                    <thead>
                                        <tr className="bg-gradient-to-r from-[#cb2a49] to-[#a02038] text-white">
                                            <th className="border border-[#cb2a49] px-6 py-3 text-left">Sickle cells in smear (%)</th>
                                            <th className="border border-[#cb2a49] px-6 py-3 text-left">Typical Interpretation</th>
                                            <th className="border border-[#cb2a49] px-6 py-3 text-left">Possible Condition</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr className="hover:bg-[#fff7ee] transition-colors">
                                            <td className="border border-gray-300 px-6 py-3 font-semibold text-[#a02038]">0% - 3%</td>
                                            <td className="border border-gray-300 px-6 py-3">Normal blood, no sickling observed</td>
                                            <td className="border border-gray-300 px-6 py-3">Normal</td>
                                        </tr>
                                        <tr className="hover:bg-[#fff7ee] transition-colors bg-gray-50">
                                            <td className="border border-gray-300 px-6 py-3 font-semibold text-[#a02038]">0.4% - 0.6%</td>
                                            <td className="border border-gray-300 px-6 py-3">Minimal sickling, often due to external stress, dehydration, or lab artifact</td>
                                            <td className="border border-gray-300 px-6 py-3">May be normal or carrier</td>
                                        </tr>
                                        <tr className="hover:bg-[#fff7ee] transition-colors">
                                            <td className="border border-gray-300 px-6 py-3 font-semibold text-[#a02038]">0.7% - 1%</td>
                                            <td className="border border-gray-300 px-6 py-3">Moderate number of sickled cells</td>
                                            <td className="border border-gray-300 px-6 py-3">Sickle Cell Trait (heterozygous, HbAS) — usually mild or asymptomatic</td>
                                        </tr>
                                        <tr className="hover:bg-[#fff7ee] transition-colors bg-gray-50">
                                            <td className="border border-gray-300 px-6 py-3 font-semibold text-[#a02038]">1.1% - 1.5%</td>
                                            <td className="border border-gray-300 px-6 py-3">High proportion of sickled cells</td>
                                            <td className="border border-gray-300 px-6 py-3">Sickle Cell Disease — symptomatic, chronic anemia</td>
                                        </tr>
                                        <tr className="hover:bg-[#fff7ee] transition-colors">
                                            <td className="border border-gray-300 px-6 py-3 font-semibold text-[#a02038]">&gt; 1.6%</td>
                                            <td className="border border-gray-300 px-6 py-3">Almost all RBCs are sickled</td>
                                            <td className="border border-gray-300 px-6 py-3">Severe sickle cell anemia (advanced HbSS)</td>
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
    )
}