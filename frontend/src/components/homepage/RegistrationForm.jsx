import React from 'react';

export const RegistrationForm = ({
    patientName, setPatientName,
    patientId, setPatientId,
    patientAge, setPatientAge,
    patientGender, setPatientGender,
    patientPhone, setPatientPhone,
    onRegister,
    onClose,
    isEditMode = false
}) => {
    /**
     * Handle phone number input - only accept digits, max 10
     */
    const handlePhoneChange = (e) => {
        const value = e.target.value;
        // Only allow digits and limit to 10 characters
        const digitsOnly = value.replace(/\D/g, '').slice(0, 10);
        setPatientPhone(digitsOnly);
    };

    /**
     * Get the current date prefix and storage key for MRN generation
     */
    const getDateInfo = () => {
        const now = new Date();
        const year = String(now.getFullYear()).slice(-2);
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const datePrefix = `${year}${month}${day}`;
        const storageKey = `hemalyzer_mrn_counter_${datePrefix}`;
        return { datePrefix, storageKey };
    };

    /**
     * Generate Preview MRN (Medical Record Number) - Does NOT increment counter
     * Shows what the next MRN will be without committing it
     * Format: YYMMDD-XXXX-C (Date + 4-digit sequential number + check digit)
     */
    const generatePreviewMRN = () => {
        const { datePrefix, storageKey } = getDateInfo();

        // Get current counter WITHOUT incrementing
        const currentCounter = parseInt(localStorage.getItem(storageKey) || '0', 10);
        const nextCounter = currentCounter + 1;

        // Format: YYMMDD-XXXX (4-digit sequential padded)
        const sequentialNum = String(nextCounter).padStart(4, '0');

        // Calculate Luhn check digit for error detection
        const baseNumber = `${datePrefix}${sequentialNum}`;
        const checkDigit = calculateLuhnCheckDigit(baseNumber);

        // Final MRN: YYMMDD-XXXX-C (e.g., 260203-0001-7)
        const mrn = `${datePrefix}-${sequentialNum}-${checkDigit}`;
        setPatientId(mrn);
    };

    /**
     * Commit MRN - Increments the counter in localStorage
     * Only called when form is actually submitted
     */
    const commitMRN = () => {
        const { storageKey } = getDateInfo();
        const currentCounter = parseInt(localStorage.getItem(storageKey) || '0', 10);
        localStorage.setItem(storageKey, (currentCounter + 1).toString());
    };

    /**
     * Handle form submission - commits the MRN and calls onRegister
     */
    const handleSubmit = (e) => {
        e.preventDefault();
        // Only commit (increment counter) for new patients, not edits
        if (!isEditMode) {
            commitMRN();
        }
        onRegister(e);
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

    // Generate preview MRN on mount or when form is reset for new patient
    // This runs when patientId is empty and we're not in edit mode
    React.useEffect(() => {
        if (!patientId && !isEditMode) {
            generatePreviewMRN();
        }
    }, [patientId, isEditMode]);

    return (
        <div className="w-full max-w-lg bg-white rounded-xl shadow-2xl border border-rose-100 overflow-hidden transform transition-all relative">
            {/* Close Button */}
            {onClose && (
                <button
                    type="button"
                    onClick={onClose}
                    className="absolute top-3 right-3 z-10 p-2 rounded-full bg-white/20 hover:bg-white/40 text-white transition-colors"
                    title="Close"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            )}
            
            <div className={`px-6 py-4 text-white ${isEditMode ? 'bg-gradient-to-r from-rose-600 to-pink-600' : 'bg-gradient-to-r from-rose-600 to-pink-600'}`}>
                <h2 className="text-xl font-bold flex items-center gap-2">
                    
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {isEditMode ? (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        ) : (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        )}
                    </svg>
                    {isEditMode ? 'Edit Patient Information' : 'Patient Registration'}
                </h2>
                <p className={`text-sm mt-0.5 ${isEditMode ? 'text-rose-100' : 'text-rose-100'}`}>
                    {isEditMode ? 'Update patient details below' : 'Enter patient details to begin analysis'}
                </p>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
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
                    <div className="relative flex">
                        <span className="inline-flex items-center px-3 py-2.5 bg-slate-100 border border-r-0 border-slate-300 rounded-l-lg text-slate-600 font-medium text-sm">
                            +63
                        </span>
                        <input
                            id="patientPhone"
                            name="patientPhone"
                            type="tel"
                            inputMode="numeric"
                            autoComplete="tel"
                            value={patientPhone}
                            onChange={handlePhoneChange}
                            maxLength={10}
                            className="w-full px-4 py-2.5 border border-slate-300 rounded-r-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none transition-all"
                            placeholder="9XXXXXXXXX"
                        />
                    </div>
                    <p className="text-xs text-slate-500 mt-1">Enter 10-digit mobile number (e.g., 9171234567)</p>
                </div>

                <div className="pt-4 flex justify-end">
                    <button
                        type="submit"
                        className={`w-full px-8 py-3 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5 active:translate-y-0 ${
                            isEditMode 
                                ? 'bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 shadow-rose-200 hover:shadow-rose-300'
                                : 'bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 shadow-rose-200 hover:shadow-rose-300'
                        }`}
                    >
                        {isEditMode ? 'Save Changes' : 'Start Analysis'}
                    </button>
                </div>
            </form>
        </div>
    );
};
