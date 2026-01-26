export const Footer = () => {
    return(
        <footer className="bg-zinc-950 text-rose-100 py-6 px-8 border-t border-rose-900/30">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-rose-700 rounded flex items-center justify-center shadow-lg shadow-rose-900/20">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4" />
                        </svg>
                    </div>
                    <div>
                        <span className="text-sm font-black text-white uppercase tracking-wider">Hemalyzer</span>
                        <span className="mx-2 text-rose-900/50">|</span>
                        <span className="text-[10px] text-rose-500 font-bold uppercase tracking-widest">Medical Analysis Suite</span>
                    </div>
                </div>
                <div className="text-[10px] font-black uppercase tracking-[0.15em] text-zinc-500">
                    &copy; {new Date().getFullYear()} RESEARCH & EDUCATIONAL PURPOSES ONLY
                </div>
            </div>
        </footer>
    )
}

export default Footer;