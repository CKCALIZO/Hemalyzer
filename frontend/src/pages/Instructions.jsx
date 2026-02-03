import { Header } from "../components/Header.jsx";
import { Footer } from "../components/Footer.jsx";
import { Sidebar } from "../components/Sidebar.jsx";

export const Instructions = () => {
    return (
        <div className="flex min-h-screen bg-slate-50">
            <Sidebar />
            <div className="flex flex-col flex-1 transition-all duration-300">
                <Header />
                <main className="flex-grow container mx-auto px-4 py-8">
                    <div className="max-w-5xl mx-auto">
                        {/* Page Title */}
                        <div className="mb-8 text-center">
                            <h1 className="text-3xl font-bold text-slate-800 mb-2">
                                How to Use Hemalyzer
                            </h1>
                            <p className="text-slate-600">
                                Complete guide to analyzing blood smear images with Hemalyzer
                            </p>
                        </div>

                        {/* Quick Start Section */}
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 bg-rose-100 rounded-lg flex items-center justify-center">
                                    <svg className="w-6 h-6 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                </div>
                                <h2 className="text-xl font-bold text-slate-800">Quick Start Guide</h2>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="bg-slate-50 rounded-lg p-4 border-l-4 border-rose-500">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="w-6 h-6 bg-rose-600 text-white rounded-full flex items-center justify-center text-sm font-bold">1</span>
                                        <h3 className="font-semibold text-slate-800">Register Patient</h3>
                                    </div>
                                    <p className="text-sm text-slate-600">Enter patient details including name, age, and gender</p>
                                </div>
                                <div className="bg-slate-50 rounded-lg p-4 border-l-4 border-rose-500">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="w-6 h-6 bg-rose-600 text-white rounded-full flex items-center justify-center text-sm font-bold">2</span>
                                        <h3 className="font-semibold text-slate-800">Upload Images</h3>
                                    </div>
                                    <p className="text-sm text-slate-600">Upload 10 blood smear images (JPG or PNG format only)</p>
                                </div>
                                <div className="bg-slate-50 rounded-lg p-4 border-l-4 border-rose-500">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="w-6 h-6 bg-rose-600 text-white rounded-full flex items-center justify-center text-sm font-bold">3</span>
                                        <h3 className="font-semibold text-slate-800">Analyze</h3>
                                    </div>
                                    <p className="text-sm text-slate-600">Click analyze to process each image through our AI system</p>
                                </div>
                                <div className="bg-slate-50 rounded-lg p-4 border-l-4 border-rose-500">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="w-6 h-6 bg-rose-600 text-white rounded-full flex items-center justify-center text-sm font-bold">4</span>
                                        <h3 className="font-semibold text-slate-800">View Results</h3>
                                    </div>
                                    <p className="text-sm text-slate-600">Review the comprehensive analysis report and save for records</p>
                                </div>
                            </div>
                        </div>

                        {/* Detailed Instructions */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                            {/* Image Requirements */}
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                    </div>
                                    <h2 className="text-xl font-bold text-slate-800">Image Requirements</h2>
                                </div>
                                <div className="space-y-3">
                                    <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                        <svg className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                        </svg>
                                        <div>
                                            <p className="font-semibold text-amber-800">Critical: x100 Magnification Required</p>
                                            <p className="text-sm text-amber-700">Images MUST be taken at x100 magnification with oil immersion for accurate results</p>
                                        </div>
                                    </div>
                                    <ul className="space-y-2 text-sm text-slate-600">
                                        <li className="flex items-center gap-2">
                                            <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                            <span><strong>Supported formats:</strong> JPG and PNG only</span>
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                            <span>Wright-Giemsa stained peripheral blood smear</span>
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                            <span>Clear, well-focused images without blur</span>
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                            <span>Proper exposure (not over/under-exposed)</span>
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                            <span>10 distinct fields of view for accuracy</span>
                                        </li>
                                    </ul>
                                </div>
                            </div>

                            {/* Upload Methods */}
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                                        <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                        </svg>
                                    </div>
                                    <h2 className="text-xl font-bold text-slate-800">Upload Methods</h2>
                                </div>
                                <div className="space-y-4">
                                    <div className="p-4 bg-slate-50 rounded-lg">
                                        <h3 className="font-semibold text-slate-800 mb-2 flex items-center gap-2">
                                            <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                            Single Image Upload
                                        </h3>
                                        <p className="text-sm text-slate-600">Upload and analyze one image at a time. Good for step-by-step analysis with immediate feedback.</p>
                                    </div>
                                    <div className="p-4 bg-slate-50 rounded-lg">
                                        <h3 className="font-semibold text-slate-800 mb-2 flex items-center gap-2">
                                            <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                            </svg>
                                            Bulk Upload
                                        </h3>
                                        <p className="text-sm text-slate-600">Upload multiple images at once (up to 10). The system will process them sequentially and generate a combined report.</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Understanding Results */}
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                    </svg>
                                </div>
                                <h2 className="text-xl font-bold text-slate-800">Understanding Results</h2>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-3">
                                    <h3 className="font-semibold text-slate-800">WBC Differential Count</h3>
                                    <p className="text-sm text-slate-600">The system calculates percentages of different white blood cell types:</p>
                                    <ul className="text-sm text-slate-600 space-y-1 ml-4">
                                        <li>• <strong>Neutrophils:</strong> 40-70% (normal range)</li>
                                        <li>• <strong>Lymphocytes:</strong> 20-35% (normal range)</li>
                                        <li>• <strong>Monocytes:</strong> 2-8% (normal range)</li>
                                        <li>• <strong>Eosinophils:</strong> 1-4% (normal range)</li>
                                        <li>• <strong>Basophils:</strong> 0-1% (normal range)</li>
                                    </ul>
                                </div>
                                <div className="space-y-3">
                                    <h3 className="font-semibold text-slate-800">Disease Indicators</h3>
                                    <p className="text-sm text-slate-600">The system screens for indicators of:</p>
                                    <ul className="text-sm text-slate-600 space-y-1 ml-4">
                                        <li>• <strong>AML/ALL:</strong> Acute leukemias based on blast cells</li>
                                        <li>• <strong>CML:</strong> Chronic Myeloid Leukemia markers</li>
                                        <li>• <strong>CLL:</strong> Chronic Lymphocytic Leukemia markers</li>
                                        <li>• <strong>Sickle Cell:</strong> Abnormal RBC morphology</li>
                                    </ul>
                                </div>
                            </div>
                        </div>

                        {/* Tips & Best Practices */}
                        <div className="bg-gradient-to-r from-rose-50 to-pink-50 rounded-xl border border-rose-200 p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 bg-rose-100 rounded-lg flex items-center justify-center">
                                    <svg className="w-6 h-6 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                    </svg>
                                </div>
                                <h2 className="text-xl font-bold text-slate-800">Tips for Best Results</h2>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-white/60 rounded-lg p-4">
                                    <h3 className="font-semibold text-slate-800 mb-2">Sample Preparation</h3>
                                    <p className="text-sm text-slate-600">Ensure blood smears are properly stained and dried before imaging. Fresh stains provide better color differentiation.</p>
                                </div>
                                <div className="bg-white/60 rounded-lg p-4">
                                    <h3 className="font-semibold text-slate-800 mb-2">Image Capture</h3>
                                    <p className="text-sm text-slate-600">Use consistent lighting and focus across all 10 fields. Avoid areas with staining artifacts or debris.</p>
                                </div>
                                <div className="bg-white/60 rounded-lg p-4">
                                    <h3 className="font-semibold text-slate-800 mb-2">Field Selection</h3>
                                    <p className="text-sm text-slate-600">Choose areas with evenly distributed cells. Avoid clumped cells or areas that are too thick or thin.</p>
                                </div>
                            </div>
                        </div>

                        {/* Disclaimer */}
                        <div className="mt-6 p-4 bg-slate-100 rounded-lg border border-slate-200">
                            <p className="text-xs text-slate-500 text-center">
                                <strong>Disclaimer:</strong> Hemalyzer is a thesis project designed to assist in the classification of hematological conditions.
                                Results should be validated by qualified medical professionals. This system is not intended for clinical diagnosis without expert verification.
                            </p>
                        </div>
                    </div>
                </main>
                <Footer />
            </div>
        </div>
    );
};

export default Instructions;
