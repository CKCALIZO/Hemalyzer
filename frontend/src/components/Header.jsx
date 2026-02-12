import { Link } from "react-router-dom";

export const Header = () => {
    return (
        <header className="flex items-center justify-between bg-rose-700 shadow-lg px-8 py-4">
            <Link to="/" className="transition-transform hover:scale-105 flex items-center gap-3">
                <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                </div>
                <div>
                    <h1 className="text-white text-2xl font-bold m-0 leading-none tracking-tight">
                        Hemalyzer
                    </h1>
                    <p className="text-rose-200 text-xs mt-0.5">Blood Cell Analysis System</p>
                </div>
            </Link>
        </header>
    );
}

export default Header;