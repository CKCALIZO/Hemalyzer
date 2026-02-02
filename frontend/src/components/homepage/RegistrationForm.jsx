import React from 'react';

export const RegistrationForm = ({
    patientName, setPatientName,
    patientId, setPatientId,
    patientAge, setPatientAge,
    patientGender, setPatientGender,
    patientPhone, setPatientPhone,
    onRegister
}) => {
    /**
     * Generate Structured MRN (Medical Record Number)
     * Format: YYMMDD-XXXX (Date + 4-digit sequential number)
     * Example: 260202-0001 (Feb 2, 2026, patient #1 that day)
     * 
     * This follows healthcare best practices:
     * - Uses date prefix for temporal organization
     * - Sequential numbering within each day
     * - Check digit appended for error detection
     */
    const generatePatientId = () => {
        const now = new Date();

        // Format: YYMMDD
        const year = String(now.getFullYear()).slice(-2);  // Last 2 digits of year
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const datePrefix = `${year}${month}${day}`;

        // Get/increment daily counter from localStorage
        const storageKey = `hemalyzer_mrn_counter_${datePrefix}`;
        let counter = parseInt(localStorage.getItem(storageKey) || '0', 10);
        counter += 1;
        localStorage.setItem(storageKey, counter.toString());

        // Format: YYMMDD-XXXX (4-digit sequential padded)
        const sequentialNum = String(counter).padStart(4, '0');

        // Calculate Luhn check digit for error detection
        const baseNumber = `${datePrefix}${sequentialNum}`;
        const checkDigit = calculateLuhnCheckDigit(baseNumber);

        // Final MRN: YYMMDD-XXXX-C (e.g., 260202-0001-7)
        const mrn = `${datePrefix}-${sequentialNum}-${checkDigit}`;
        setPatientId(mrn);
    };

    /**
     * Calculate Luhn check digit (Mod 10 algorithm)
     * Follows the standard method shown in the reference:
     * 1. Double the FIRST digit and every 2nd digit from the left
     * 2. If result > 9, subtract 9 (equivalent to adding digits: 16 -> 1+6=7)
     * 3. Sum all digits
     * 4. Check digit = value needed to make sum divisible by 10
     */
    const calculateLuhnCheckDigit = (number) => {
        const digits = number.split('').map(Number);
        let sum = 0;

        // Double the FIRST digit (index 0) and every 2nd from left (0, 2, 4, 6...)
        for (let i = 0; i < digits.length; i++) {
            let digit = digits[i];
            // Double at even positions (0, 2, 4, 6...) = first and every 2nd
            if (i % 2 === 0) {
                digit *= 2;
                if (digit > 9) digit -= 9; // Same as adding digits (e.g., 16 -> 7)
            }
            sum += digit;
        }

        // Check digit makes the total sum end in 0
        return (10 - (sum % 10)) % 10;
    };

    /**
     * Validate MRN using Luhn algorithm
     * For validation: Double the FIRST digit and every 2nd from left
     * If total sum ends in 0, MRN is valid
     */
    const validateMRN = (mrn) => {
        // Remove dashes to get just the numbers
        const cleanMRN = mrn.replace(/-/g, '');
        const digits = cleanMRN.split('').map(Number);
        let sum = 0;

        console.log('=== MRN Validation (Luhn Algorithm) ===');
        console.log(`MRN: ${mrn} -> Digits: ${cleanMRN}`);

        const processedDigits = [];

        for (let i = 0; i < digits.length; i++) {
            let digit = digits[i];
            let processed = digit;

            // Double first and every 2nd digit (positions 0, 2, 4...)
            if (i % 2 === 0) {
                processed = digit * 2;
                if (processed > 9) processed -= 9;
            }
            processedDigits.push(processed);
            sum += processed;
        }

        console.log(`Step 1: Original digits:  [${digits.join(', ')}]`);
        console.log(`Step 2: After doubling:   [${processedDigits.join(', ')}]`);
        console.log(`Step 3: Sum = ${sum}`);
        console.log(`Step 4: Sum % 10 = ${sum % 10}`);
        console.log(`Result: ${sum % 10 === 0 ? '✓ VALID (ends in 0)' : '✗ INVALID'}`);

        return sum % 10 === 0;
    };

    // Make validation available globally for testing
    React.useEffect(() => {
        window.validateMRN = validateMRN;
    }, []);

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
                    <label htmlFor="patientName" className="block text-sm font-semibold text-slate-700 mb-1.5">Full Name *</label>
                    <input
                        id="patientName"
                        name="patientName"
                        type="text"
                        required
                        autoComplete="name"
                        value={patientName}
                        onChange={(e) => setPatientName(e.target.value)}
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none transition-all placeholder:text-slate-400"
                        placeholder="e.g. John Doe"
                    />
                </div>

                {/* MRN (Medical Record Number) - Auto-generated */}
                <div>
                    <label htmlFor="patientMRN" className="block text-sm font-semibold text-slate-700 mb-1.5">Medical Record Number (MRN)</label>
                    <div className="relative">
                        <input
                            id="patientMRN"
                            name="patientMRN"
                            type="text"
                            readOnly
                            autoComplete="off"
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
                        <label htmlFor="patientAge" className="block text-sm font-semibold text-slate-700 mb-1.5">Age *</label>
                        <input
                            id="patientAge"
                            name="patientAge"
                            type="number"
                            required
                            min="0"
                            max="120"
                            autoComplete="off"
                            value={patientAge}
                            onChange={(e) => setPatientAge(e.target.value)}
                            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none transition-all"
                            placeholder="Age"
                        />
                    </div>
                    <div>
                        <label htmlFor="patientGender" className="block text-sm font-semibold text-slate-700 mb-1.5">Gender</label>
                        <select
                            id="patientGender"
                            name="patientGender"
                            autoComplete="sex"
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
                    <label htmlFor="patientPhone" className="block text-sm font-semibold text-slate-700 mb-1.5">Phone Number</label>
                    <input
                        id="patientPhone"
                        name="patientPhone"
                        type="tel"
                        autoComplete="tel"
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
