import { Link } from "react-router-dom";

export const Header = () => {
    return(
        <>
        <header className="flex items-center justify-between bg-red-700 shadow-lg px-8 py-4">
            <Link to="/" className="transition-transform hover:scale-105 flex items-center gap-3">
                <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-red-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                </div>
                <div>
                    <h1 className="text-white text-2xl font-bold m-0 leading-none tracking-tight">
                        Hemalyzer
                    </h1>
                    <p className="text-red-200 text-xs mt-0.5">Blood Cell Analysis System</p>
                </div>
            </Link>
            <nav className="flex items-center">
                <ul className="flex gap-3 m-0 p-0 list-none">
                    <li className="flex items-center">
                        <div className="flex items-center gap-3">
                        <Link to="/reports">
                            <button className="inline-flex items-center justify-center gap-2
                            text-red-100 bg-red-800/50 border border-red-500
                            hover:bg-red-800 hover:text-white transition-all duration-200 
                            font-medium rounded-lg text-sm px-4 py-2 cursor-pointer">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                Reports
                            </button>
                        </Link> 
                        <Link to="/about">
                            <button className="inline-flex items-center justify-center gap-2
                            text-red-100 bg-red-800/50 border border-red-500
                            hover:bg-red-800 hover:text-white transition-all duration-200 
                            font-medium rounded-lg text-sm px-4 py-2 cursor-pointer">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                About
                            </button>
                        </Link>
                        </div>
                    </li>
                </ul>
            </nav>
        </header>
        </>
    );
}