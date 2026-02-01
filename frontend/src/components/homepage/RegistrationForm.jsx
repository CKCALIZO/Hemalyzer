import React from 'react';

export const RegistrationForm = ({
    patientName, setPatientName,
    patientId, setPatientId,
    patientAge, setPatientAge,
    patientGender, setPatientGender,
    patientPhone, setPatientPhone,
    onRegister
}) => {
    // Generate random ID helper
    const generatePatientId = () => {
        const year = new Date().getFullYear().toString().substr(-2);
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        setPatientId(`PAT-${year}-${random}`);
    };

    // Auto-generate ID on mount
    React.useEffect(() => {
        if (!patientId) {
            generatePatientId();
        }
    }, []);

    return (
        <div className="w-full max-w-lg bg-white rounded-xl shadow-2xl border border-rose-100 overflow-hidden transform transition-all">
            <div className="bg-gradient-to-r from-rose-600 to-pink-600 px-6 py-4 text-white">
                <h2 className="text-xl font-bold flex items-center gap-2">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Patient Registration
                </h2>
                <p className="text-rose-100 text-sm mt-0.5">Enter patient details to begin analysis</p>
            </div>

            <form onSubmit={onRegister} className="p-6 space-y-4">
                {/* Patient Name */}
                <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Full Name *</label>
                    <input
                        type="text"
                        required
                        value={patientName}
                        onChange={(e) => setPatientName(e.target.value)}
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none transition-all placeholder:text-slate-400"
                        placeholder="e.g. John Doe"
                    />
                </div>

                {/* Patient ID */}
                <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Patient ID (Auto-Generated)</label>
                    <div className="relative">
                        <input
                            type="text"
                            readOnly
                            value={patientId}
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-500 font-mono cursor-not-allowed"
                        />
                        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                        </div>
                    </div>
                </div>

                {/* Age and Gender Row */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Age *</label>
                        <input
                            type="number"
                            required
                            min="0"
                            max="120"
                            value={patientAge}
                            onChange={(e) => setPatientAge(e.target.value)}
                            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none transition-all"
                            placeholder="Age"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Gender</label>
                        <select
                            value={patientGender}
                            onChange={(e) => setPatientGender(e.target.value)}
                            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none transition-all bg-white"
                        >
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                        </select>
                    </div>
                </div>

                {/* Phone Number */}
                <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Phone Number</label>
                    <input
                        type="tel"
                        value={patientPhone}
                        onChange={(e) => setPatientPhone(e.target.value)}
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none transition-all"
                        placeholder="e.g. +1 (555) 000-0000"
                    />
                </div>

                <div className="pt-4 flex justify-end">
                    <button
                        type="submit"
                        className="w-full px-8 py-3 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 text-white rounded-xl font-bold text-lg shadow-lg shadow-rose-200 hover:shadow-xl hover:shadow-rose-300 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
                    >
                        Start Analysis
                    </button>
                </div>
            </form>
        </div>
    );
};
