import React from 'react';
import MaterialIcon from './common/MaterialIcon';

// FIX: ErrorBoundary prevents a single component crash from blanking the whole app
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Caught error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
          <div className="bg-white rounded-2xl border border-red-100 shadow-lg p-8 text-center max-w-sm space-y-4">
            <div className="w-14 h-14 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto">
              <MaterialIcon name="error_outline" size={28} />
            </div>
            <h2 className="text-lg font-extrabold text-slate-900">Something went wrong</h2>
            <p className="text-sm text-slate-500">
              An unexpected error occurred. Please refresh the page to continue.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-emerald-700 transition cursor-pointer"
            >
              <MaterialIcon name="refresh" size={16} />
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
