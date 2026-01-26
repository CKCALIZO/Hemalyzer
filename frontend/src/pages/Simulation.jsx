import React, { useState, useRef, useEffect } from 'react';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { 
  Activity, 
  Beaker, 
  Layers, 
  Search, 
  Upload, 
  Zap, 
  ShieldCheck, 
  Cpu, 
  BarChart3, 
  ChevronRight,
  Info,
  Droplets,
  Microscope,
  Calculator
} from 'lucide-react';
import '../styles/index.css';

export function Simulation() {
  // State for file upload and results
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('comparison'); // 'comparison', 'calculation', 'methodology'
  
  // Model comparison state
  const [comparisonResults, setComparisonResults] = useState(null);
  
  // Test images state
  const [testImages, setTestImages] = useState([]);
  const [showTestImages, setShowTestImages] = useState(false);
  
  // Manual calculation state
  const [manualInputs, setManualInputs] = useState({
    cellType: 'WBC',
    fieldCounts: ['', '', '', '', '', '', '', '', '', ''], // 10 HPFs
    averagePerField: '',
    numFields: 10,
    multiplierOverride: ''
  });
  const [calculationResults, setCalculationResults] = useState(null);
  
  // Methodology state
  const [methodologyData, setMethodologyData] = useState(null);
  
  const fileInputRef = useRef(null);
  const API_URL = 'http://localhost:5000';

  // Load test images on mount
  useEffect(() => {
    fetchTestImages();
  }, []);

  const fetchTestImages = async () => {
    try {
      const response = await fetch(`${API_URL}/api/simulation/test-images`);
      const data = await response.json();
      if (data.success) {
        setTestImages(data.images);
      }
    } catch (error) {
      console.error('Error loading test images:', error);
    }
  };

  // Handle image selection
  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
      setComparisonResults(null);
    }
  };

  // Select test image
  const selectTestImage = async (image) => {
    try {
      const response = await fetch(`${API_URL}${image.path}`);
      const blob = await response.blob();
      const file = new File([blob], image.filename, { type: 'image/jpeg' });
      setSelectedImage(file);
      setImagePreview(`${API_URL}${image.path}`);
      setComparisonResults(null);
      setShowTestImages(false);
    } catch (error) {
      console.error('Error loading test image:', error);
    }
  };

  // Run model comparison
  const runModelComparison = async () => {
    if (!selectedImage) {
      alert('Please select an image first');
      return;
    }

    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append('image', selectedImage);

      const response = await fetch(`${API_URL}/api/simulation/compare-models`, {
        method: 'POST',
        body: formData
      });

      const data = await response.json();
      if (data.success) {
        setComparisonResults(data);
      } else {
        alert('Error: ' + data.error);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to connect to backend');
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate estimated count
  const calculateManualCount = async () => {
    const { cellType, fieldCounts, averagePerField, numFields, multiplierOverride, useHighMultiplier } = manualInputs;
    
    // Parse field counts if provided
    const validFieldCounts = fieldCounts
      .filter(c => c !== '' && !isNaN(parseInt(c)))
      .map(c => parseInt(c));
    
    let avgPerField = parseFloat(averagePerField);
    
    // Calculate average from field counts if available
    if (validFieldCounts.length > 0) {
      avgPerField = validFieldCounts.reduce((a, b) => a + b, 0) / validFieldCounts.length;
    }

    if (isNaN(avgPerField) || avgPerField < 0) {
      alert('Please enter valid field count(s) or average per field');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/simulation/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cell_type: cellType,
          average_per_field: avgPerField,
          num_fields: validFieldCounts.length > 0 ? validFieldCounts.length : parseInt(numFields),
          field_counts: validFieldCounts.length > 0 ? validFieldCounts : undefined,
          multiplier_override: multiplierOverride ? parseInt(multiplierOverride) : undefined
        })
      });

      const data = await response.json();
      if (data.success) {
        setCalculationResults(data);
      } else {
        alert('Error: ' + data.error);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to calculate');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch methodology data
  const fetchMethodology = async () => {
    try {
      const response = await fetch(`${API_URL}/api/simulation/classification-basis`);
      const data = await response.json();
      if (data.success) {
        setMethodologyData(data.classification_methodology);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  // Load methodology on tab switch
  React.useEffect(() => {
    if (activeTab === 'methodology' && !methodologyData) {
      fetchMethodology();
    }
  }, [activeTab]);

  return (
    <div className="min-h-screen bg-stone-50 text-zinc-900 flex flex-col font-sans selection:bg-rose-100 selection:text-rose-900">
      <Header />
      
      {/* Hero Section */}
      <section className="bg-zinc-950 text-white pt-32 pb-24 px-6 relative overflow-hidden">
        {/* Abstract Background Elements */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-rose-600/10 rounded-full blur-[120px] -mr-64 -mt-64"></div>
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-rose-900/10 rounded-full blur-[100px] -ml-32 -mb-32"></div>

        <div className="max-w-6xl mx-auto relative z-10">
          <div className="flex flex-col items-center text-center space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-rose-600/10 border border-rose-500/20 text-rose-500 text-xs font-black tracking-[0.2em] uppercase">
              <Activity className="w-4 h-4" />
              Diagnostic Simulation Suite
            </div>
            
            <h1 className="text-6xl md:text-8xl font-black tracking-tighter leading-tight max-w-4xl">
              Benchmarking <span className="text-rose-600 block sm:inline">&</span> Analytics
            </h1>
            
            <p className="text-xl md:text-2xl text-slate-400 leading-relaxed max-w-3xl font-medium tracking-tight">
              A professional environment for validating deep learning performance, exploring hematological methodology, and performing high-precision manual simulations.
            </p>
          </div>
        </div>
      </section>

      <main className="flex-grow container mx-auto px-6 -mt-12 relative z-20 pb-24">
        {/* High-Contrast Tab Navigation */}
        <div className="flex justify-center mb-16">
          <nav className="bg-white p-2 rounded-[40px] shadow-2xl shadow-zinc-900/5 border border-stone-200 flex gap-2 overflow-x-auto no-scrollbar">
            {[
              { id: 'comparison', label: 'Model Benchmarking', icon: <Zap className="w-4 h-4" /> },
              { id: 'calculation', label: 'Manual Calculator', icon: <Calculator className="w-4 h-4" /> },
              { id: 'methodology', label: 'Scientific Basis', icon: <Microscope className="w-4 h-4" /> }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-10 py-5 rounded-[32px] font-black text-sm tracking-tight transition-all duration-500 whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-rose-600 text-white shadow-xl shadow-rose-600/30 ring-4 ring-rose-600/10'
                    : 'text-slate-400 hover:text-zinc-900 hover:bg-stone-50'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Model Comparison Tab */}
        {activeTab === 'comparison' && (
          <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Control Panel */}
            <div className="bg-white rounded-[40px] shadow-sm border border-stone-200 p-12">
              <div className="flex flex-col lg:flex-row gap-16 items-center">
                <div className="flex-1 w-full space-y-8">
                  <div>
                    <h2 className="text-3xl font-black text-zinc-900 tracking-tighter mb-4 flex items-center gap-3">
                      <div className="w-2 h-8 bg-rose-600 rounded-full"></div>
                      Specimen Input
                    </h2>
                    <p className="text-slate-500 font-medium">Upload a digital peripheral blood smear or select from the validated clinical library.</p>
                  </div>

                  <div className="relative group">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleImageSelect}
                      accept="image/*"
                      className="hidden"
                    />
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className={`relative overflow-hidden cursor-pointer rounded-[32px] border-2 border-dashed transition-all duration-500 ${
                        imagePreview ? 'border-rose-500 ring-4 ring-rose-50' : 'border-stone-200 hover:border-rose-400 bg-stone-50'
                      }`}
                    >
                      {imagePreview ? (
                        <div className="relative aspect-video lg:aspect-auto lg:h-[400px]">
                          <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-zinc-950/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Upload className="w-12 h-12 text-white" />
                          </div>
                        </div>
                      ) : (
                        <div className="py-24 flex flex-col items-center text-center px-6">
                          <div className="w-20 h-20 bg-white rounded-3xl shadow-lg flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                            <Upload className="w-8 h-8 text-rose-600" />
                          </div>
                          <p className="text-lg font-black text-zinc-900 tracking-tight">Drop smear image here</p>
                          <p className="text-slate-500 text-sm mt-2">Maximum file size: 15MB (.jpg, .png)</p>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-4">
                    <button
                      onClick={() => setShowTestImages(!showTestImages)}
                      className="flex-1 px-8 py-5 bg-stone-100 hover:bg-stone-200 text-zinc-900 rounded-[24px] font-black text-sm tracking-tight transition-all flex items-center justify-center gap-2"
                    >
                      <Layers className="w-4 h-4" />
                      {showTestImages ? 'Hide Library' : `Clinical Dataset (${testImages.length} Samples)`}
                    </button>
                    
                    <button
                      onClick={runModelComparison}
                      disabled={!selectedImage || isLoading}
                      className={`flex-[1.5] py-5 rounded-[24px] font-black text-sm tracking-tighter text-white shadow-xl transition-all flex items-center justify-center gap-2 ${
                        !selectedImage || isLoading
                          ? 'bg-stone-200 text-stone-400 cursor-not-allowed shadow-none'
                          : 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20 active:scale-[0.98]'
                      }`}
                    >
                      {isLoading ? (
                        <div className="flex items-center gap-3">
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                          Processing Simulation...
                        </div>
                      ) : (
                        <>
                          <Zap className="w-4 h-4" />
                          Execute Multi-Model Benchmark
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {showTestImages && (
                  <div className="w-full lg:w-96 h-[600px] overflow-y-auto no-scrollbar border border-stone-100 rounded-[32px] p-6 bg-stone-50 animate-in fade-in slide-in-from-right-4 duration-500">
                    <div className="flex items-center justify-between mb-6 sticky top-0 bg-stone-50 py-2 z-10">
                      <h4 className="font-black text-xs uppercase tracking-widest text-slate-500">Library Samples</h4>
                      <BarChart3 className="w-4 h-4 text-slate-400" />
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                      {testImages.map((img, idx) => (
                        <button
                          key={idx}
                          onClick={() => selectTestImage(img)}
                          className="group text-left p-5 bg-white border border-stone-200 rounded-2xl hover:border-rose-300 hover:shadow-lg hover:shadow-rose-600/5 transition-all text-sm relative overflow-hidden"
                        >
                          <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <ChevronRight className="w-4 h-4 text-rose-500" />
                          </div>
                          <div className="font-black text-zinc-900 mb-1">{img.disease_type}</div>
                          <div className="text-xs text-slate-500 font-mono truncate">{img.filename}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Results Grid */}
            {comparisonResults && (
              <div className="space-y-12 animate-in fade-in duration-1000">
                {/* Comparative Analytics */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                   {/* Enhanced Model - High Contrast */}
                  <div className="bg-zinc-950 rounded-[40px] shadow-2xl p-12 border border-zinc-800 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-rose-600/10 -mr-32 -mt-32 rounded-full blur-[80px] group-hover:bg-rose-600/20 transition-all duration-1000"></div>
                    
                    <div className="flex flex-col h-full relative z-10">
                      <div className="flex justify-between items-start mb-12">
                         <div className="space-y-2">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-600 text-white text-[10px] font-black uppercase tracking-[0.2em]">
                              <ShieldCheck className="w-3 h-3" />
                              Primary Engine
                            </div>
                            <h3 className="text-4xl font-black text-white tracking-tighter">
                              {comparisonResults.enhanced_model.name}
                            </h3>
                         </div>
                         <Cpu className="w-10 h-10 text-rose-600" />
                      </div>
                      
                      <p className="text-slate-400 text-lg font-medium mb-10 leading-relaxed border-l-2 border-rose-600/30 pl-6">
                         {comparisonResults.enhanced_model.description}
                      </p>
                      
                      {/* Architecture Matrix */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                          {[
                            { label: 'White Cells', val: comparisonResults.enhanced_model.detection_results.counts.WBC, icon: <Droplets className="w-4 h-4" /> },
                            { label: 'Red Cells', val: comparisonResults.enhanced_model.detection_results.counts.RBC, icon: <Activity className="w-4 h-4" /> },
                            { label: 'Platelets', val: comparisonResults.enhanced_model.detection_results.counts.Platelets, icon: <Beaker className="w-4 h-4" /> }
                          ].map((stat, i) => (
                            <div key={i} className="bg-white/5 rounded-3xl p-6 border border-white/5 hover:border-rose-500/30 transition-colors">
                              <div className="text-rose-500 mb-2">{stat.icon}</div>
                              <div className="text-3xl font-black text-white">{stat.val}</div>
                              <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">{stat.label}</div>
                            </div>
                          ))}
                      </div>

                      {/* Differential Analysis */}
                      <div className="mt-auto bg-rose-600 rounded-[32px] p-8 shadow-2xl shadow-rose-600/20">
                        <div className="flex items-center justify-between mb-8">
                           <h4 className="font-black text-white text-xs uppercase tracking-[0.2em]">Differential Dynamics</h4>
                           <div className="px-3 py-1 bg-black/20 rounded-full text-[10px] font-black text-white uppercase">
                             ConvNeXt-V2 Analysis
                           </div>
                        </div>
                        
                        <div className="space-y-6">
                          <div className="flex justify-between items-end">
                            <div className="space-y-1">
                              <div className="text-rose-100 text-[10px] font-black uppercase tracking-widest">Disease Proliferation</div>
                              <div className="text-4xl font-black text-white tracking-tighter">
                                {comparisonResults.enhanced_model.wbc_classification.disease_cells}
                              </div>
                            </div>
                            <Search className="w-8 h-8 text-black/20" />
                          </div>
                          
                          {comparisonResults.enhanced_model.wbc_classification.differential && (
                            <div className="pt-6 border-t border-white/10 space-y-4">
                              {Object.entries(comparisonResults.enhanced_model.wbc_classification.differential).slice(0, 4).map(([type, data]) => (
                                <div key={type} className="space-y-1.5">
                                  <div className="flex justify-between text-[10px] font-black text-white uppercase tracking-widest px-1">
                                    <span>{type}</span>
                                    <span>{data.percentage?.toFixed(0)}%</span>
                                  </div>
                                  <div className="h-1.5 w-full bg-black/20 rounded-full overflow-hidden">
                                    <div 
                                      className="h-full bg-white transition-all duration-1000 ease-out" 
                                      style={{ width: `${data.percentage}%` }}
                                    ></div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Baseline Model - Minimal Slate */}
                  <div className="bg-white rounded-[40px] shadow-sm p-12 border border-stone-200 flex flex-col">
                    <div className="mb-12">
                       <span className="bg-stone-100 text-stone-500 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border border-stone-200">
                        Legacy Baseline
                       </span>
                       <h3 className="text-4xl font-black mt-4 text-zinc-900 tracking-tighter">
                         {comparisonResults.baseline_model.name}
                       </h3>
                    </div>
                    
                    <p className="text-slate-500 font-medium mb-10 leading-relaxed italic">
                       "{comparisonResults.baseline_model.description}"
                    </p>
                    
                    <div className="space-y-8 flex-grow">
                      {/* Architecture Stack */}
                      <div className="bg-stone-50 rounded-[32px] p-8 border border-stone-100">
                        <h4 className="font-black text-xs uppercase tracking-widest text-slate-400 mb-6">Stack Configuration</h4>
                        <div className="space-y-4">
                          {[
                            { label: 'Detection', val: comparisonResults.baseline_model.architecture.detection },
                            { label: 'Attention', val: 'Not Applied' },
                            { label: 'Classification', val: comparisonResults.baseline_model.architecture.classification }
                          ].map((row, i) => (
                            <div key={i} className="flex justify-between items-center text-sm">
                              <span className="text-slate-500 font-bold">{row.label}</span>
                              <span className="font-black text-zinc-900">{row.val}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Performance Metrics */}
                      <div className="grid grid-cols-3 gap-4">
                        {[
                          { l: 'WBC', v: comparisonResults.baseline_model.detection_results.counts.WBC },
                          { l: 'RBC', v: comparisonResults.baseline_model.detection_results.counts.RBC },
                          { l: 'PLAT', v: comparisonResults.baseline_model.detection_results.counts.Platelets }
                        ].map((s, i) => (
                          <div key={i} className="text-center p-6 bg-white border border-stone-100 rounded-3xl shadow-sm">
                            <div className="text-2xl font-black text-zinc-900">{s.v}</div>
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{s.l}</div>
                          </div>
                        ))}
                      </div>

                      <div className="p-8 bg-stone-900 rounded-[32px] text-white">
                         <div className="flex justify-between items-center mb-4">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Malignancy Markers</span>
                            <span className="text-2xl font-black text-white">{comparisonResults.baseline_model.wbc_classification.disease_cells}</span>
                         </div>
                         <div className="w-full h-1 bg-white/10 rounded-full">
                            <div className="h-full bg-stone-500 w-1/3"></div>
                         </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Efficiency Index */}
                <div className="bg-white rounded-[40px] shadow-sm border border-stone-200 overflow-hidden">
                  <div className="bg-stone-50 px-12 py-10 border-b border-stone-200">
                    <h3 className="text-2xl font-black tracking-tighter text-zinc-900">Efficiency Transformation</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-stone-100">
                    <div className="p-12 group hover:bg-rose-50 transition-colors">
                      <div className="text-5xl font-black text-rose-600 mb-2 tracking-tighter">
                        +{comparisonResults.comparison.detection.improvement_percent}%
                      </div>
                      <div className="text-sm font-black text-zinc-900 uppercase tracking-widest mb-4">Detection Gain</div>
                      <p className="text-slate-500 text-sm leading-relaxed">Structural optimization yielded an additional {comparisonResults.comparison.detection.cells_detected_difference} identifiable cellular entities.</p>
                    </div>
                    
                    <div className="p-12 group hover:bg-rose-50 transition-colors">
                      <div className="text-5xl font-black text-rose-600 mb-2 tracking-tighter">
                        +{comparisonResults.comparison.classification.disease_difference}
                      </div>
                      <div className="text-sm font-black text-zinc-900 uppercase tracking-widest mb-4">Pathology Sensitivity</div>
                      <p className="text-slate-500 text-sm leading-relaxed">Enhanced model identified more neoplastic cells vs baseline standard.</p>
                    </div>

                    <div className="p-12 group hover:bg-rose-50 transition-colors">
                      <div className="text-5xl font-black text-rose-600 mb-2 tracking-tighter">
                        +{comparisonResults.comparison.speed.improvement_percent}%
                      </div>
                      <div className="text-sm font-black text-zinc-900 uppercase tracking-widest mb-4">Inference Velocity</div>
                      <p className="text-slate-500 text-sm leading-relaxed">{comparisonResults.comparison.speed.enhanced_ms}ms processing time per high-definition frame.</p>
                    </div>
                  </div>
                  <div className="px-12 py-6 bg-zinc-950 text-slate-400 text-xs font-medium italic text-center uppercase tracking-widest">
                    {comparisonResults.comparison.summary}
                  </div>
                </div>

                {/* Technical Specification Table */}
                <div className="bg-white rounded-[40px] shadow-sm border border-stone-200 p-12 overflow-x-auto">
                   <h3 className="text-2xl font-black text-zinc-900 tracking-tighter mb-10">Architectural Divergence Matrix</h3>
                   <table className="w-full">
                      <thead>
                        <tr className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-stone-100">
                          <th className="text-left pb-6 px-4">Parametric Feature</th>
                          <th className="text-left pb-6 px-4">Enhanced (SOTA)</th>
                          <th className="text-left pb-6 px-4 text-slate-300">Baseline</th>
                          <th className="text-left pb-6 px-4">Clinical Impact</th>
                        </tr>
                      </thead>
                      <tbody>
                        {comparisonResults.key_improvements.map((improvement, idx) => (
                          <tr key={idx} className="group border-b border-stone-50 last:border-0 hover:bg-stone-50 transition-colors">
                            <td className="py-6 px-4 font-black text-zinc-900 tracking-tight text-sm">{improvement.feature}</td>
                            <td className="py-6 px-4 text-rose-600 font-black text-sm">{improvement.enhanced}</td>
                            <td className="py-6 px-4 text-slate-400 font-medium text-sm">{improvement.baseline}</td>
                            <td className="py-6 px-4 text-slate-600 font-medium text-sm">{improvement.impact}</td>
                          </tr>
                        ))}
                      </tbody>
                   </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Manual Calculation Tab */}
        {activeTab === 'calculation' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Calculator Input */}
            <div className="bg-white rounded-[40px] shadow-sm border border-stone-200 p-12 relative overflow-hidden">
               <div className="absolute top-0 right-0 p-12 opacity-[0.03] rotate-12">
                  <Calculator className="w-32 h-32" />
               </div>

              <div className="relative z-10 mb-12">
                <div className="inline-flex px-3 py-1 rounded-full bg-rose-600 text-white text-[10px] font-black uppercase tracking-widest mb-4">
                  Clinical Estimation
                </div>
                <h2 className="text-4xl font-black text-zinc-900 tracking-tighter">Manual Count Simulation</h2>
              </div>
              
              <div className="space-y-10">
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Cell Type Configuration</label>
                  <div className="flex p-1 bg-stone-100 rounded-[20px]">
                    {['WBC', 'RBC'].map((type) => (
                      <button
                        key={type}
                        onClick={() => setManualInputs({...manualInputs, cellType: type})}
                        className={`flex-1 py-4 rounded-[16px] font-black text-sm transition-all duration-300 ${
                          manualInputs.cellType === type 
                            ? 'bg-white text-rose-600 shadow-sm' 
                            : 'text-slate-400 hover:text-zinc-600'
                        }`}
                      >
                        {type === 'WBC' ? 'White Blood Cells' : 'Red Blood Cells'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Field Distribution (10 HPF)</label>
                  <div className="grid grid-cols-5 gap-3">
                    {manualInputs.fieldCounts.map((count, idx) => (
                      <input
                        key={idx}
                        type="number"
                        value={count}
                        onChange={(e) => {
                          const newCounts = [...manualInputs.fieldCounts];
                          newCounts[idx] = e.target.value;
                          setManualInputs({...manualInputs, fieldCounts: newCounts});
                        }}
                        placeholder={`${idx + 1}`}
                        className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-2 py-4 text-center font-black text-zinc-900 focus:ring-2 focus:ring-rose-600/20 focus:border-rose-600 outline-none transition-all"
                      />
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-4 py-2">
                  <div className="h-[1px] flex-grow bg-stone-100"></div>
                  <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">or specify average</span>
                  <div className="h-[1px] flex-grow bg-stone-100"></div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Average Coefficient</label>
                  <input
                    type="number"
                    step="0.1"
                    value={manualInputs.averagePerField}
                    onChange={(e) => setManualInputs({...manualInputs, averagePerField: e.target.value})}
                    placeholder="e.g. 3.5 per field"
                    className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-6 py-5 font-black text-zinc-900 focus:ring-2 focus:ring-rose-600/20 focus:border-rose-600 outline-none transition-all"
                  />
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Precision Multiplier (Optional)</label>
                  <input
                    type="number"
                    value={manualInputs.multiplierOverride}
                    onChange={(e) => setManualInputs({...manualInputs, multiplierOverride: e.target.value})}
                    placeholder={manualInputs.cellType === 'WBC' ? 'Default: 2,000' : 'Default: 200,000'}
                    className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-6 py-5 font-black text-zinc-900 focus:ring-2 focus:ring-rose-600/20 focus:border-rose-600 outline-none transition-all"
                  />
                </div>

                <button
                  onClick={calculateManualCount}
                  disabled={isLoading}
                  className="w-full py-6 bg-rose-600 hover:bg-rose-700 text-white rounded-[24px] font-black text-sm tracking-[0.1em] uppercase shadow-xl shadow-rose-600/20 transition-all active:scale-[0.98] disabled:bg-stone-100 disabled:text-stone-300 disabled:shadow-none"
                >
                  {isLoading ? 'Processing Calculation...' : 'Execute Calculation'}
                </button>
              </div>
            </div>

            {/* Results Display */}
            <div className="space-y-8">
              <div className="bg-zinc-950 rounded-[40px] shadow-2xl p-12 text-white border border-zinc-800 h-full">
                <div className="flex items-center gap-3 mb-10">
                   <div className="w-10 h-10 bg-rose-600 rounded-2xl flex items-center justify-center">
                      <Activity className="w-6 h-6 text-white" />
                   </div>
                   <h2 className="text-2xl font-black tracking-tighter">Live Calculation Core</h2>
                </div>

                {calculationResults ? (
                  <div className="space-y-12 animate-in fade-in zoom-in-95 duration-500">
                    <div className="space-y-2">
                       <span className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">{calculationResults.cell_type} Estimation</span>
                       <div className="text-7xl font-black text-rose-500 tracking-tighter">
                         {calculationResults.estimated_calculation.cells_per_ul?.toLocaleString()}
                       </div>
                       <div className="text-xl text-slate-400 font-medium">cells per microliter (μL)</div>
                    </div>

                    <div className="bg-white/5 rounded-3xl p-8 border border-white/5 flex items-center justify-between group overflow-hidden relative">
                       <div className="relative z-10">
                          <div className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-2">Algorithm Logic</div>
                          <div className="text-xl font-mono font-black text-white">{calculationResults.estimated_calculation.formula}</div>
                       </div>
                       <div className="absolute right-6 rotate-12 transition-transform group-hover:scale-110">
                           <Info className="w-12 h-12 text-white/5" />
                       </div>
                    </div>

                    <div className="grid grid-cols-2 gap-8 border-t border-white/10 pt-10">
                       <div className="space-y-1">
                          <div className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Avg Coefficient</div>
                          <div className="text-xl font-black text-white">{calculationResults.estimated_calculation.average_per_hpf || calculationResults.estimated_calculation.average_per_field}</div>
                       </div>
                       <div className="space-y-1 text-right">
                          <div className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Scientific Unit</div>
                          <div className="text-xl font-black text-white">{calculationResults.estimated_calculation.cells_per_liter_scientific} L⁻¹</div>
                       </div>
                    </div>

                    {/* INTERPRETATION ENGINE */}
                    <div className="pt-8 border-t border-white/10">
                      <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6">Clinical Interpretation</div>
                      {(() => {
                        const result = calculationResults.estimated_calculation;
                        const ranges = calculationResults.reference_ranges[calculationResults.cell_type];
                        const cellsPerUl = result.cells_per_ul;
                        let status = "NORMAL";
                        let color = "text-green-400";
                        let message = ranges.interpretation.normal;

                        if (calculationResults.cell_type === 'WBC') {
                          if (cellsPerUl < ranges.low) { status = "LOW"; color = "text-amber-400"; message = ranges.interpretation.low; }
                          else if (cellsPerUl > ranges.high) { status = "HIGH"; color = "text-rose-500"; message = ranges.interpretation.high; }
                        } else {
                          if (cellsPerUl < ranges.female_min) { status = "LOW"; color = "text-amber-400"; message = ranges.interpretation.low; }
                          else if (cellsPerUl > ranges.male_max) { status = "HIGH"; color = "text-rose-500"; message = ranges.interpretation.high; }
                        }

                        return (
                          <div className={`p-8 rounded-[32px] bg-white/5 border border-white/10 ${color}`}>
                            <div className="flex items-center justify-between mb-4">
                               <span className="font-black text-xs uppercase tracking-[0.3em] opacity-80">Physiological State</span>
                               <span className={`px-4 py-1.5 rounded-full bg-current bg-opacity-10 text-xs font-black`}>{status}</span>
                            </div>
                            <div className="text-2xl font-black tracking-tight text-white mb-2">{message}</div>
                            <p className="text-sm text-slate-500 font-medium">This is an algorithmic estimation based on provided morphological data.</p>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full py-20 text-slate-600">
                    <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mb-6">
                      <Microscope className="w-10 h-10 text-slate-700" />
                    </div>
                    <p className="text-lg font-black tracking-tight text-slate-500">Awaiting input data...</p>
                    <p className="text-sm font-medium opacity-50">Enter values to activate calculation engine</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Methodology Tab */}
        {activeTab === 'methodology' && (
          <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {methodologyData ? (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                {/* Lateral Navigation Sidebar */}
                <div className="lg:col-span-3 space-y-4">
                   <div className="p-8 bg-zinc-950 rounded-[32px] text-white overflow-hidden relative group">
                      <div className="absolute inset-0 bg-rose-600/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      <h4 className="font-black text-xs uppercase tracking-widest text-rose-500 mb-6 relative z-10">Neural Architecture</h4>
                      <p className="text-sm text-slate-400 font-medium relative z-10 leading-relaxed mb-8">Detailed documentation of the triple-stage diagnostic pipeline.</p>
                      <button className="flex items-center gap-2 text-white font-black text-xs uppercase tracking-widest relative z-10 group-hover:gap-4 transition-all">
                        Whitepaper <ChevronRight className="w-4 h-4 text-rose-500" />
                      </button>
                   </div>
                   
                   <div className="bg-white rounded-[32px] border border-stone-200 p-6 space-y-3">
                      {['Detection Stack', 'Classification Core', 'Interpretive Engine'].map((item, i) => (
                        <div key={i} className="flex items-center gap-3 p-4 hover:bg-stone-50 rounded-2xl cursor-pointer group transition-all">
                           <div className="w-2 h-2 bg-stone-300 group-hover:bg-rose-600 rounded-full transition-colors"></div>
                           <span className="text-sm font-black text-zinc-900 tracking-tight">{item}</span>
                        </div>
                      ))}
                   </div>
                </div>

                {/* Content Area */}
                <div className="lg:col-span-9 space-y-12">
                  {/* Detection Stage */}
                  <section className="bg-white rounded-[40px] shadow-sm border border-stone-200 p-12 hover:shadow-xl transition-all duration-500">
                    <div className="flex flex-col md:flex-row gap-12">
                      <div className="flex-1">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-stone-900 text-white text-[10px] font-black uppercase tracking-widest mb-6">
                           Phase 01 • Detection
                        </div>
                        <h2 className="text-4xl font-black text-zinc-900 tracking-tighter mb-6">
                          Cellular Localization <span className="text-rose-600">&</span> Masking
                        </h2>
                        <p className="text-slate-500 text-lg font-medium leading-relaxed mb-8 border-l-4 border-rose-600 pl-8">
                          {methodologyData.detection_stage.description}
                        </p>
                        <div className="space-y-3">
                           {methodologyData.detection_stage.capabilities.map((cap, i) => (
                              <div key={i} className="flex items-center gap-3 text-zinc-900 font-black text-sm tracking-tight">
                                 <ShieldCheck className="w-4 h-4 text-rose-600" />
                                 {cap}
                              </div>
                           ))}
                        </div>
                      </div>
                      <div className="w-full md:w-80 bg-stone-50 rounded-[32px] p-8 border border-stone-100 flex flex-col justify-between">
                         <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 border-b border-stone-200 pb-4">Backbone Specification</h4>
                         <div className="space-y-6">
                            {[
                              { l: 'Foundation', v: methodologyData.detection_stage.architecture.backbone },
                              { l: 'Neck', v: methodologyData.detection_stage.architecture.neck },
                              { l: 'Input Size', v: methodologyData.detection_stage.architecture.input_size },
                              { l: 'Dataset', v: methodologyData.detection_stage.architecture.training_images }
                            ].map((spec, i) => (
                              <div key={i}>
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{spec.l}</div>
                                <div className="text-sm font-black text-zinc-900">{spec.v}</div>
                              </div>
                            ))}
                         </div>
                      </div>
                    </div>
                  </section>

                  {/* Classification Stage */}
                  <section className="bg-zinc-950 rounded-[40px] shadow-2xl p-12 text-white overflow-hidden relative">
                    <div className="absolute bottom-0 right-0 w-96 h-96 bg-rose-600/10 -mr-48 -mb-48 rounded-full blur-[100px]"></div>
                    
                    <div className="relative z-10">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-600 text-white text-[10px] font-black uppercase tracking-widest mb-6">
                         Phase 02 • Classification
                      </div>
                      <h2 className="text-4xl font-black text-white tracking-tighter mb-8 max-w-xl leading-tight">
                        Deep Feature Extraction via ConvNeXt-V2
                      </h2>
                      <p className="text-slate-400 text-lg font-medium leading-relaxed mb-12 max-w-2xl italic">
                         “{methodologyData.classification_stage.description}”
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
                        {[
                          { title: 'Normal Morphology', data: methodologyData.classification_stage.class_categories.normal_wbc, color: 'border-white/10' },
                          { title: 'Pathological markers', data: methodologyData.classification_stage.class_categories.leukemia_wbc, color: 'border-rose-500/30 bg-rose-500/5' },
                          { title: 'Erythrocyte Profile', data: methodologyData.classification_stage.class_categories.rbc, color: 'border-white/10' }
                        ].map((cat, i) => (
                          <div key={i} className={`rounded-3xl p-8 border ${cat.color} backdrop-blur-sm transition-all hover:border-rose-500/50`}>
                            <h3 className="font-black text-xs uppercase tracking-widest text-white mb-6 flex items-center gap-2">
                               <div className="w-1.5 h-1.5 bg-rose-600 rounded-full"></div>
                               {cat.title}
                            </h3>
                            <ul className="space-y-3">
                              {cat.data.map((cls, j) => (
                                <li key={j} className="text-xs font-black text-slate-400 uppercase tracking-tight flex items-center gap-2">
                                   <div className="w-1 h-1 bg-white/10 rounded-full"></div>
                                   {cls}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>

                      {/* Pipeline Steps */}
                      <div className="bg-white/5 border border-white/10 rounded-3xl p-8">
                         <h4 className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-6">Preprocessing Workflow</h4>
                         <div className="flex flex-wrap gap-3">
                            {methodologyData.classification_stage.preprocessing.steps.map((step, i) => (
                              <div key={i} className="bg-white px-4 py-2 rounded-xl text-[10px] font-black text-zinc-900 uppercase tracking-widest">
                                 {step}
                              </div>
                            ))}
                         </div>
                      </div>
                    </div>
                  </section>

                  {/* Interpretation Matrix */}
                  <section className="bg-white rounded-[40px] shadow-sm border border-stone-200 p-12">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-stone-900 text-white text-[10px] font-black uppercase tracking-widest mb-6">
                       Phase 03 • Interpretation
                    </div>
                    <h2 className="text-4xl font-black text-zinc-900 tracking-tighter mb-12">Clinical Threshold Matrix</h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                      {/* Sickle Cell */}
                      <div className="p-8 bg-stone-50 rounded-[32px] border border-stone-100 group hover:bg-rose-600 hover:border-rose-600 transition-all duration-500">
                        <Beaker className="w-8 h-8 text-rose-600 mb-6 group-hover:text-white transition-colors" />
                        <h3 className="text-xl font-black text-zinc-900 mb-2 tracking-tight group-hover:text-white transition-colors">Sickle Anemia</h3>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 group-hover:text-rose-100 transition-colors">Morphological Basis</p>
                        <p className="text-sm font-medium text-slate-500 mb-8 leading-relaxed group-hover:text-white transition-colors">{methodologyData.disease_interpretation.sickle_cell_anemia.basis}</p>
                        <div className="space-y-2">
                          {methodologyData.disease_interpretation.sickle_cell_anemia.interpretation_levels.map((level, i) => (
                            <div key={i} className="text-[10px] font-black text-zinc-900 uppercase tracking-widest flex items-center gap-2 group-hover:text-white transition-colors">
                              <div className="w-1.5 h-1.5 bg-rose-600 bg-opacity-30 rounded-full group-hover:bg-white transition-colors"></div>
                              {level}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Leukemia Models */}
                      {[
                        { title: 'Acute (Blast)', data: methodologyData.disease_interpretation.acute_leukemia, types: methodologyData.disease_interpretation.acute_leukemia.types },
                        { title: 'Chronic (Mature)', data: methodologyData.disease_interpretation.chronic_leukemia, types: methodologyData.disease_interpretation.chronic_leukemia.types }
                      ].map((item, i) => (
                        <div key={i} className="p-8 bg-white rounded-[32px] border border-stone-100 shadow-sm relative group hover:shadow-2xl transition-all duration-500">
                           <Activity className="w-8 h-8 text-zinc-900 mb-6" />
                           <h3 className="text-xl font-black text-zinc-900 mb-2 tracking-tight">{item.title}</h3>
                           <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-6">Differential Threshold</p>
                           <p className="text-sm font-medium text-slate-500 mb-8 leading-relaxed">{item.data.basis}</p>
                           <div className="space-y-3">
                              {item.types.map((type, j) => (
                                <div key={j} className="flex justify-between items-center bg-stone-50 p-3 rounded-xl hover:bg-rose-50 transition-colors">
                                   <span className="text-[10px] font-black text-zinc-900 uppercase tracking-widest">{type}</span>
                                   <ChevronRight className="w-4 h-4 text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                              ))}
                           </div>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              </div>
            ) : (
              <div className="py-32 flex flex-col items-center justify-center space-y-8">
                <div className="relative">
                  <div className="w-20 h-20 border-4 border-stone-100 rounded-full"></div>
                  <div className="w-20 h-20 border-4 border-rose-600 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
                </div>
                <div className="text-center">
                  <h3 className="text-xl font-black text-zinc-900 tracking-tighter uppercase mb-2">Retrieving Protocol Data</h3>
                  <p className="text-slate-500 font-medium">Accessing clinical methodology database...</p>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

export default Simulation;
