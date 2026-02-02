import { useState } from "react";
import { Link, useLocation } from "react-router-dom";

export const Sidebar = () => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const location = useLocation();

    const navItems = [
        {
            path: "/instructions",
            label: "Instructions",
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
            )
        },
        {
            path: "/",
            label: "Home",
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
            )
        },
        {
            path: "/reports",
            label: "Reports",
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
            )
        },
        {
            path: "/simulation",
            label: "Simulation",
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
            )
        },
        {
            path: "/about",
            label: "About",
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            )
        }
    ];

    const isActive = (path) => {
        if (path === "/") {
            return location.pathname === "/";
        }
        return location.pathname.startsWith(path);
    };

    return (
        <>
            {/* Spacer div that matches sidebar width */}
            <div 
                className={`flex-shrink-0 transition-all duration-300 ease-in-out ${isCollapsed ? "w-16" : "w-56"}`}
            />
            <aside
                className={`fixed left-0 top-0 h-full bg-rose-800 shadow-xl z-40 transition-all duration-300 ease-in-out flex flex-col ${isCollapsed ? "w-16" : "w-56"
                    }`}
            >
            {/* Sidebar Header */}
            <div className="flex items-center justify-between p-4 border-b border-rose-700">
                {!isCollapsed && (
                    <span className="text-white font-semibold text-sm uppercase tracking-wider">
                        Hemalyzer
                    </span>
                )}
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="p-2 rounded-lg hover:bg-rose-700 text-white transition-colors ml-auto"
                    title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                >
                    <svg
                        className={`w-5 h-5 transition-transform duration-300 ${isCollapsed ? "rotate-180" : ""
                            }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
                        />
                    </svg>
                </button>
            </div>

            {/* Navigation Items */}
            <nav className="flex-1 py-4 overflow-y-auto">
                <ul className="space-y-1 px-2">
                    {navItems.map((item) => (
                        <li key={item.path}>
                            <Link
                                to={item.path}
                                className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 group ${isActive(item.path)
                                        ? "bg-white text-rose-800 shadow-md"
                                        : "text-rose-100 hover:bg-rose-700 hover:text-white"
                                    }`}
                                title={isCollapsed ? item.label : ""}
                            >
                                <span
                                    className={`flex-shrink-0 ${isActive(item.path)
                                            ? "text-rose-700"
                                            : "text-rose-200 group-hover:text-white"
                                        }`}
                                >
                                    {item.icon}
                                </span>
                                {!isCollapsed && (
                                    <span className="font-medium text-sm whitespace-nowrap">
                                        {item.label}
                                    </span>
                                )}
                            </Link>
                        </li>
                    ))}
                </ul>
            </nav>

            {/* Sidebar Footer */}
            <div className="p-4 border-t border-rose-700">
                {!isCollapsed && (
                    <p className="text-rose-300 text-xs text-center">
                        © 2026 Hemalyzer
                    </p>
                )}
            </div>
            </aside>
        </>
    );
};

export default Sidebar;
