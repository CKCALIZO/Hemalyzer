import { Link } from "react-router-dom";

export const Header = () => {
    return(
        <>
        <header className="flex items-center justify-between bg-gradient-to-r from-[#cb2a49] to-[#a02038] shadow-lg px-8 py-6">
            <Link to="/" className="transition-transform hover:scale-105">
                <h1 className="text-white text-5xl font-bold m-0 leading-none tracking-tight">
                    Hemalyzer
                </h1>
            </Link>
            <nav className="flex items-center">
                <ul className="flex gap-4 m-0 p-0 list-none">
                    <li className="flex items-center">
                        <div className="flex items-center gap-4">
                        <Link to="/reports">
                            <button className="inline-flex items-center justify-center
                            text-white bg-white/10 backdrop-blur-sm border border-white/20
                            hover:bg-white/20 hover:border-white/30 transition-all duration-300 
                            focus:ring-4 focus:outline-none focus:ring-white/30 shadow-md hover:shadow-xl 
                            font-semibold rounded-lg text-base px-6 py-3 cursor-pointer">
                                Reports
                            </button>
                        </Link> 
                        <Link to="/about">
                            <button className="inline-flex items-center justify-center
                            text-white bg-white/10 backdrop-blur-sm border border-white/20
                            hover:bg-white/20 hover:border-white/30 transition-all duration-300 
                            focus:ring-4 focus:outline-none focus:ring-white/30 shadow-md hover:shadow-xl 
                            font-semibold rounded-lg text-base px-6 py-3 cursor-pointer">
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