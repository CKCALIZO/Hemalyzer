import React, { Component } from 'react';

class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
        this.setState({ error, errorInfo });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-rose-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-lg p-8 max-w-lg w-full">
                        <div className="flex items-center gap-3 text-rose-600 mb-4">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <h1 className="text-xl font-bold">Something went wrong</h1>
                        </div>
                        <p className="text-gray-600 mb-4">
                            An error occurred while rendering this page. Please try refreshing.
                        </p>
                        {this.state.error && (
                            <div className="bg-rose-50 p-4 rounded-lg mb-4 overflow-auto max-h-48">
                                <p className="text-sm font-mono text-rose-700">
                                    {this.state.error.toString()}
                                </p>
                            </div>
                        )}
                        <button 
                            onClick={() => window.location.reload()}
                            className="w-full bg-rose-600 text-white py-2 px-4 rounded-lg hover:bg-rose-700 font-semibold"
                        >
                            Refresh Page
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
