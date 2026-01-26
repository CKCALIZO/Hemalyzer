import { Link } from "react-router-dom";

export const Header = () => {
    return(
        <>
        <header className="flex items-center justify-between bg-zinc-950 shadow-lg px-8 py-4 border-b border-rose-900/30">
            <Link to="/" className="transition-transform hover:scale-105 flex items-center gap-3">
                <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-inner">
                    <svg className="w-6 h-6 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                </div>
                <div>
                    <h1 className="text-white text-2xl font-black m-0 leading-none tracking-tight">
                        HEMALYZE<span className="text-rose-600">R</span>
                    </h1>
                    <p className="text-rose-500/80 text-[10px] font-bold uppercase tracking-[0.2em] mt-1">Advanced Hematology AI</p>
                </div>
            </Link>
            <nav className="flex items-center">
                <ul className="flex gap-2 m-0 p-0 list-none">
                    <li>
                        <Link to="/">
                            <button className="px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200
                            hover:bg-rose-500/10 hover:text-rose-500 text-slate-400">
                                Dashboard
                            </button>
                        </Link>
                    </li>
                    <li>
                        <Link to="/reports">
                            <button className="px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200
                            hover:bg-rose-500/10 hover:text-rose-500 text-slate-400 flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                Reports
                            </button>
                        </Link> 
                    </li>
                    <li>
                        <Link to="/simulation">
                            <button className="px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200
                            hover:bg-rose-500/10 hover:text-rose-500 text-slate-400 flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                                Simulation
                            </button>
                        </Link>
                    </li>
                    <li>
                        <Link to="/about">
                            <button className="px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200
                            hover:bg-rose-500/10 hover:text-rose-500 text-slate-400 flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                About
                            </button>
                        </Link>
                    </li>
                </ul>
            </nav>
        </header>
        </>
    );
}

export default Header;