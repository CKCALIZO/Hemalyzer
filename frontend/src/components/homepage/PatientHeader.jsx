import React from 'react';

export const PatientHeader = ({
    patientName,
    patientId,
    patientAge,
    patientGender,
    onChangePatient
}) => {
    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center text-rose-700 font-bold text-xl">
                    {patientName.charAt(0)}
                </div>
                <div>
                    <h2 className="text-lg font-bold text-slate-900">{patientName}</h2>
                    <div className="flex items-center gap-4 text-sm text-slate-500">
                        <span>ID: <span className="font-mono text-slate-700">{patientId}</span></span>
                        <span>|</span>
                        <span>{patientAge} Y/O</span>
                        <span>|</span>
                        <span>{patientGender}</span>
                    </div>
                </div>
            </div>
            <button
                onClick={onChangePatient}
                className="text-sm text-rose-600 hover:text-rose-800 hover:underline"
            >
                Change Patient
            </button>
        </div>
    );
};
