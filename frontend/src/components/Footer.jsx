export const Footer = () => {
    return(
        <footer className="bg-rose-700 text-rose-100 py-4 px-6">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <span className="text-sm font-medium text-white">Hemalyzer</span>
                    <span className="text-rose-300">|</span>
                    <span className="text-xs">Blood Cell Analysis System</span>
                </div>
                <div className="text-xs text-rose-200">
                    {new Date().getFullYear()} Research & Educational Purposes Only
                </div>
            </div>
        </footer>
    )
}

export default Footer;