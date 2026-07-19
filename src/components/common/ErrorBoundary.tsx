/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught render error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-white flex flex-col items-center justify-center p-8 text-center">
          <div className="w-24 h-24 bg-red-50 rounded-[40px] flex items-center justify-center text-red-600 mb-8 border-4 border-red-100 shadow-xl shadow-red-50">
            <AlertTriangle className="w-12 h-12" />
          </div>
          <h1 className="text-4xl font-black text-gray-900 mb-4 tracking-tighter italic">
            Something went wrong
          </h1>
          <p className="text-gray-500 max-w-md mx-auto mb-10 font-medium">
            An unexpected error occurred while loading this page. Please try reloading —
            if the problem continues, contact our support team.
          </p>
          <button
            onClick={this.handleReload}
            className="flex items-center gap-3 px-10 py-5 bg-gray-900 text-white rounded-3xl font-black hover:bg-black transition-all shadow-xl"
          >
            <RefreshCw className="w-6 h-6" /> Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
