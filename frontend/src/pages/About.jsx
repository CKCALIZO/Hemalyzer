import { Header} from "../components/Header.jsx";
import { Footer } from "../components/Footer.jsx";
import { useState } from "react";

export const About = () => {
  const [activeTable, setActiveTable] = useState(null);

  const toggleTable = (tableName) => {
    setActiveTable(activeTable === tableName ? null : tableName);
  };

  return (
    <div className="min-h-screen bg-stone-50 text-slate-900 flex flex-col">
      <Header />
      
      {/* Hero Section */}
      <div className="bg-zinc-950 text-white pt-24 pb-20 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-16">
          <div className="flex-1 space-y-8">
            <div className="inline-block px-4 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-500 text-sm font-black tracking-wider uppercase">
              Artificial Intelligence • Clinical Hematology
            </div>
            <h1 className="text-6xl md:text-7xl font-black tracking-tighter leading-tight">
              Clinical Grade <br/>
              <span className="text-rose-600 italic">Cell Analysis</span>
            </h1>
            <p className="text-xl text-slate-400 leading-relaxed max-w-2xl font-medium">
              A sophisticated diagnostic aid designed for rapid, automated identification of white blood cells 
              and detection of leukemia markers using state-of-the-art computer vision.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6 -mt-10 mb-24 grow w-full">
        {/* Selection Tabs */}
        <div className="bg-white p-2 rounded-[32px] shadow-2xl shadow-stone-200 border border-stone-100 flex flex-wrap gap-1 mb-16">
          {[
            { id: 'aml-all', label: 'AML / ALL', sub: 'Acute Leukemia' },
            { id: 'cml', label: 'CML', sub: 'Chronic Myeloid' },
            { id: 'cll', label: 'CLL', sub: 'Chronic Lympho' },
            { id: 'sickle', label: 'SICKLE', sub: 'Anemia' },
            { id: null, label: 'VIEW ALL', sub: 'Reference Master' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => tab.id === null ? setActiveTable(null) : toggleTable(tab.id)}
              className={`flex-1 min-w-[140px] px-6 py-4 rounded-[24px] transition-all duration-300 text-left ${
                activeTable === tab.id 
                ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30' 
                : 'hover:bg-stone-50 text-slate-400 hover:text-slate-800'
              }`}
            >
              <div className={`text-sm font-black tracking-tighter ${activeTable === tab.id ? 'text-white' : 'text-slate-800'}`}>
                {tab.label}
              </div>
              <div className={`text-[10px] uppercase font-bold tracking-widest ${activeTable === tab.id ? 'text-rose-200' : 'text-slate-400'}`}>
                {tab.sub}
              </div>
            </button>
          ))}
        </div>

        {/* Data Sections */}
        <div className="space-y-16">
          {/* AML/ALL Table */}
          {(activeTable === 'aml-all' || activeTable === null) && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
               <div className="flex items-center gap-4 mb-6">
                  <div className="w-1.5 h-8 bg-rose-600 rounded-full"></div>
                  <h2 className="text-2xl font-black text-zinc-900 tracking-tight">AML / ALL Leukemia (Acute)</h2>
               </div>
               <div className="bg-white rounded-[32px] overflow-hidden border border-stone-200 shadow-sm">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50 border-b border-stone-100">
                        <th className="px-8 py-5 text-xs font-black uppercase tracking-widest text-slate-500">Blast Cells in Smear (%)</th>
                        <th className="px-8 py-5 text-xs font-black uppercase tracking-widest text-slate-500">Typical Interpretation</th>
                        <th className="px-8 py-5 text-xs font-black uppercase tracking-widest text-slate-500">Possible Condition</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      <tr>
                        <td className="px-8 py-6 font-bold text-rose-600">&lt; 5%</td>
                        <td className="px-8 py-6 text-slate-600 font-medium">Normal Blood, with some blast cells</td>
                        <td className="px-8 py-6 text-slate-500 text-sm italic">Normal</td>
                      </tr>
                      <tr className="bg-stone-50/30">
                        <td className="px-8 py-6 font-bold text-rose-600">6% - 10%</td>
                        <td className="px-8 py-6 text-slate-600 font-medium">Slightly Increased, possibly reactive</td>
                        <td className="px-8 py-6 text-slate-500 text-sm">May be normal/reactive condition</td>
                      </tr>
                      <tr>
                        <td className="px-8 py-6 font-bold text-rose-600">11% - 19%</td>
                        <td className="px-8 py-6 text-slate-800 font-bold">Suspicious / Pre-leukemic</td>
                        <td className="px-8 py-6 text-slate-500 text-sm">Suspicious for evolving leukemia</td>
                      </tr>
                      <tr className="bg-rose-50/20">
                        <td className="px-8 py-6 font-bold text-rose-700">&ge; 20%</td>
                        <td className="px-8 py-6 text-rose-900 font-black uppercase text-xs tracking-widest leading-loose">
                          Diagnostic level for acute leukemia
                        </td>
                        <td className="px-8 py-6 text-slate-700 text-sm leading-relaxed">
                          <strong>Acute Leukemia:</strong>
                          <ul className="list-disc ml-4 mt-2 opacity-80">
                            <li>Higher lymphoblast % → ALL</li>
                            <li>Higher myeloblast % → AML</li>
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
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
               <div className="flex items-center gap-4 mb-6">
                  <div className="w-1.5 h-8 bg-rose-600 rounded-full"></div>
                  <h2 className="text-2xl font-black text-zinc-900 tracking-tight">CML Leukemia (Chronic Myeloid)</h2>
               </div>
               <div className="bg-white rounded-[32px] overflow-hidden border border-stone-200 shadow-sm">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50 border-b border-stone-100">
                        <th className="px-8 py-5 text-xs font-black uppercase tracking-widest text-slate-500">Granulocytes (%)</th>
                        <th className="px-8 py-5 text-xs font-black uppercase tracking-widest text-slate-500">Typical Interpretation</th>
                        <th className="px-8 py-5 text-xs font-black uppercase tracking-widest text-slate-500">Possible Condition</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      <tr>
                        <td className="px-8 py-6 font-bold text-rose-600">&lt; 60%</td>
                        <td className="px-8 py-6 text-slate-600 font-medium">Normal differential count; balanced maturation.</td>
                        <td className="px-8 py-6 text-slate-500 text-sm italic">Normal</td>
                      </tr>
                      <tr>
                        <td className="px-8 py-6 font-bold text-rose-600">60% - 75%</td>
                        <td className="px-8 py-6 text-slate-600 font-medium">Mild predominance; reactive or stress response.</td>
                        <td className="px-8 py-6 text-slate-500 text-sm">Reactive / Secondary Leukocytosis (CML)</td>
                      </tr>
                      <tr className="bg-stone-50/30">
                        <td className="px-8 py-6 font-bold text-rose-600">76% - 89%</td>
                        <td className="px-8 py-6 text-slate-600 font-medium">Marked proliferation with left shift granulocytes.</td>
                        <td className="px-8 py-6 text-slate-500 text-sm font-bold">Suspicious for Early CML (Chronic Phase)</td>
                      </tr>
                      <tr className="bg-rose-50/20">
                        <td className="px-8 py-6 font-bold text-rose-700">90% - 95%</td>
                        <td className="px-8 py-6 text-rose-900 font-black uppercase text-xs tracking-widest">Typical Chronic Phase</td>
                        <td className="px-8 py-6 text-slate-700 text-sm">Granulocytes dominate; Blasts typically &lt; 5%.</td>
                      </tr>
                      <tr className="bg-rose-100/30">
                        <td className="px-8 py-6 font-bold text-rose-800">&gt; 95%</td>
                        <td className="px-8 py-6 text-rose-950 font-black uppercase text-xs tracking-widest">Accelerated Transition</td>
                        <td className="px-8 py-6 text-slate-700 text-sm font-black">Accelerated Phase CML (Blasts &ge; 10%)</td>
                      </tr>
                    </tbody>
                  </table>
               </div>
            </div>
          )}

          {/* CLL Table */}
          {(activeTable === 'cll' || activeTable === null) && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
               <div className="flex items-center gap-4 mb-6">
                  <div className="w-1.5 h-8 bg-rose-600 rounded-full"></div>
                  <h2 className="text-2xl font-black text-zinc-900 tracking-tight">CLL Leukemia (Chronic Lymphocytic)</h2>
               </div>
               <div className="bg-white rounded-[32px] overflow-hidden border border-stone-200 shadow-sm">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50 border-b border-stone-100">
                        <th className="px-8 py-5 text-xs font-black uppercase tracking-widest text-slate-500">Lymphocytes (%)</th>
                        <th className="px-8 py-5 text-xs font-black uppercase tracking-widest text-slate-500">Typical Interpretation</th>
                        <th className="px-8 py-5 text-xs font-black uppercase tracking-widest text-slate-500">Possible Condition</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      <tr>
                        <td className="px-8 py-6 font-bold text-rose-600">&lt; 20%</td>
                        <td className="px-8 py-6 text-slate-600 font-medium">Normal lymphocyte count; balanced differential.</td>
                        <td className="px-8 py-6 text-slate-500 text-sm italic">Normal</td>
                      </tr>
                      <tr className="bg-stone-50/30">
                        <td className="px-8 py-6 font-bold text-rose-600">20% - 40%</td>
                        <td className="px-8 py-6 text-slate-600 font-medium">Slight lymphocytosis; viral infections or stress.</td>
                        <td className="px-8 py-6 text-slate-500 text-sm">Reactive / Secondary Lymphocytosis</td>
                      </tr>
                      <tr>
                        <td className="px-8 py-6 font-bold text-rose-600">41% - 60%</td>
                        <td className="px-8 py-6 text-slate-800 font-bold">Persistent lymphocytosis</td>
                        <td className="px-8 py-6 text-slate-500 text-sm">Suspicious for Early / Smoldering CLL</td>
                      </tr>
                      <tr className="bg-rose-50/20">
                        <td className="px-8 py-6 font-bold text-rose-700">61% - 80%</td>
                        <td className="px-8 py-6 text-rose-900 font-black uppercase text-xs tracking-widest">Marked Predominance</td>
                        <td className="px-8 py-6 text-slate-700 text-sm font-bold">Typical CLL (Chronic Lymphocytic Leukemia)</td>
                      </tr>
                      <tr className="bg-rose-100/30">
                        <td className="px-8 py-6 font-bold text-rose-800">&gt; 80%</td>
                        <td className="px-8 py-6 text-rose-950 font-black uppercase text-xs tracking-widest">Overwhelming Presence</td>
                        <td className="px-8 py-6 text-slate-700 text-sm font-black">Advanced / Progressive CLL</td>
                      </tr>
                    </tbody>
                  </table>
               </div>
            </div>
          )}

          {/* Sickle Cell Table */}
          {(activeTable === 'sickle' || activeTable === null) && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
               <div className="flex items-center gap-4 mb-6">
                  <div className="w-1.5 h-8 bg-rose-600 rounded-full"></div>
                  <h2 className="text-2xl font-black text-zinc-900 tracking-tight">Sickle Cell Anemia</h2>
               </div>
               <div className="bg-white rounded-[32px] overflow-hidden border border-stone-200 shadow-sm">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50 border-b border-stone-100">
                        <th className="px-8 py-5 text-xs font-black uppercase tracking-widest text-slate-500">Sickle Cells (%)</th>
                        <th className="px-8 py-5 text-xs font-black uppercase tracking-widest text-slate-500">Typical Interpretation</th>
                        <th className="px-8 py-5 text-xs font-black uppercase tracking-widest text-slate-500">Possible Condition</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      <tr>
                        <td className="px-8 py-6 font-bold text-rose-600">&lt; 3%</td>
                        <td className="px-8 py-6 text-slate-600 font-medium">No clinically significant sickling observed.</td>
                        <td className="px-8 py-6 text-slate-500 text-sm italic">Normal / Artifacts</td>
                      </tr>
                      <tr className="bg-stone-50/30">
                        <td className="px-8 py-6 font-bold text-rose-600">3% - 10%</td>
                        <td className="px-8 py-6 text-slate-600 font-medium">Mild sickling; asymptomatic or mild stress issues.</td>
                        <td className="px-8 py-6 text-slate-500 text-sm">HbAS condition (Sickle Cell Trait)</td>
                      </tr>
                      <tr>
                        <td className="px-8 py-6 font-bold text-rose-600">11% - 30%</td>
                        <td className="px-8 py-6 text-slate-800 font-bold">Moderate sickling</td>
                        <td className="px-8 py-6 text-slate-500 text-sm">Moderate Sickling (possible HbSS)</td>
                      </tr>
                      <tr className="bg-rose-50/20">
                        <td className="px-8 py-6 font-bold text-rose-700">&gt; 30%</td>
                        <td className="px-8 py-6 text-rose-900 font-black uppercase text-xs tracking-widest">Severe Morphology</td>
                        <td className="px-8 py-6 text-slate-700 text-sm font-black">Sickle Cell Disease (HbSS)</td>
                      </tr>
                    </tbody>
                  </table>
               </div>
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default About;
