import React, { useState, Suspense } from 'react';
import { Store } from './types';
import { StoreSelector } from './components/StoreSelector';
import { useApi } from './hooks/useApi';

// Lazy load components for better initial loading performance
const StoreReport = React.lazy(() => import('./components/StoreReport').then(module => ({ default: module.StoreReport })));
const ViewAllStores = React.lazy(() => import('./components/ViewAllStores').then(module => ({ default: module.ViewAllStores })));
const ReadOnlyStoreReport = React.lazy(() => import('./components/ReadOnlyStoreReport').then(module => ({ default: module.ReadOnlyStoreReport })));

type ViewMode = 'selector' | 'single-store' | 'all-stores' | 'readonly-store';

// Enhanced loading component with progress and mobile optimization
const ComponentLoader = ({ message = "Loading...", progress = 0 }: { message?: string; progress?: number }) => (
  <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4">
    <div className="text-center max-w-sm mx-auto">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto mb-4"></div>
      <p className="text-slate-300 text-lg mb-4">{message}</p>
      
      {progress > 0 && (
        <div className="w-full bg-slate-700 rounded-full h-3 mb-4">
          <div 
            className="bg-gradient-to-r from-blue-500 to-blue-400 h-3 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          ></div>
        </div>
      )}
      
      <div className="bg-blue-900/30 border border-blue-500/30 rounded-lg p-4">
        <p className="text-blue-200 text-sm font-semibold mb-2">🚀 Dashboard API</p>
        <p className="text-blue-300 text-xs">
          Loading optimized data for mobile devices
        </p>
      </div>
    </div>
  </div>
);

// Enhanced loading screen with progress tracking
const LoadingScreen = ({ 
  progress, 
  message, 
  retryCount, 
  connectionTimeout, 
  onRetry 
}: { 
  progress: number; 
  message: string; 
  retryCount: number; 
  connectionTimeout: boolean;
  onRetry: () => void;
}) => (
  <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4">
    <div className="text-center max-w-md mx-auto">
      <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-400 mx-auto mb-6"></div>
      <h2 className="text-2xl font-bold text-white mb-4">Loading Tank Data</h2>
      <p className="text-slate-300 text-lg mb-4">{message}</p>
      
      {/* Enhanced progress bar */}
      <div className="w-full bg-slate-700 rounded-full h-4 mb-4 overflow-hidden">
        <div 
          className="bg-gradient-to-r from-blue-500 to-blue-400 h-4 rounded-full transition-all duration-500 ease-out relative"
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        >
          <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
        </div>
      </div>
      
      <div className="text-sm text-slate-400 mb-4">
        {progress}% complete
      </div>
      
      {/* Connection status */}
      <div className="bg-blue-900/30 border border-blue-500/30 rounded-lg p-4 mb-4">
        <p className="text-blue-200 text-sm font-semibold mb-2">
          📱 Mobile-Optimized Loading
        </p>
        <p className="text-blue-300 text-xs">
          Fetching data with extended timeout for mobile connections
        </p>
        {retryCount > 0 && (
          <p className="text-yellow-300 text-xs mt-2">
            Retry attempt {retryCount}/3
          </p>
        )}
      </div>
      
      {/* Retry button for connection issues */}
      {connectionTimeout && (
        <div className="bg-yellow-900/30 border border-yellow-500/30 rounded-lg p-4">
          <p className="text-yellow-200 text-sm mb-3">
            Connection is taking longer than usual
          </p>
          <button
            onClick={onRetry}
            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-white text-sm transition-colors"
          >
            Retry Connection
          </button>
        </div>
      )}
    </div>
  </div>
);

function App() {
  const { 
    stores, 
    loading, 
    loadingProgress, 
    loadingMessage, 
    error, 
    isLiveData, 
    refreshData, 
    newStoreDetected,
    retryCount,
    connectionTimeout
  } = useApi();
  
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('selector');

  // Check if we're in read-only mode (via URL parameter)
  const urlParams = new URLSearchParams(window.location.search);
  const isReadOnlyMode = urlParams.get('readonly') === 'true';
  const readOnlyStore = urlParams.get('store');

  // If read-only mode is detected, automatically switch to that view
  React.useEffect(() => {
    if (isReadOnlyMode && readOnlyStore && stores.length > 0) {
      const store = stores.find(s => s.store_name === readOnlyStore);
      if (store) {
        setSelectedStore(store);
        setViewMode('readonly-store');
      }
    }
  }, [isReadOnlyMode, readOnlyStore, stores]);

  const handleStoreSelect = (store: Store) => {
    setSelectedStore(store);
    setViewMode('single-store');
  };

  const handleViewAll = () => {
    setViewMode('all-stores');
  };

  const handleBack = () => {
    setSelectedStore(null);
    setViewMode('selector');
  };

  const handleRefresh = async () => {
    await refreshData();
  };

  // Show enhanced loading screen during initial load
  if (loading) {
    return (
      <LoadingScreen
        progress={loadingProgress}
        message={loadingMessage}
        retryCount={retryCount}
        connectionTimeout={connectionTimeout}
        onRetry={handleRefresh}
      />
    );
  }

  // Show error screen if connection failed
  if (error && stores.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4">
        <div className="text-center max-w-md mx-auto">
          <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-6">
            <div className="text-red-400 text-6xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold text-white mb-4">Connection Failed</h1>
            <p className="text-red-300 mb-6 text-sm">{error}</p>
            
            {connectionTimeout && (
              <div className="bg-yellow-900/30 border border-yellow-500/30 rounded-lg p-4 mb-4">
                <p className="text-yellow-200 text-sm">
                  This may be due to a slow mobile connection. Please try again.
                </p>
              </div>
            )}
            
            <div className="space-y-3">
              <button
                onClick={handleRefresh}
                className="w-full bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg text-white font-medium transition-colors"
              >
                Retry Connection
              </button>
              <button
                onClick={() => window.location.reload()}
                className="w-full bg-slate-700 hover:bg-slate-600 px-6 py-3 rounded-lg text-white font-medium transition-colors"
              >
                Refresh Page
              </button>
            </div>
            
            <p className="text-slate-400 text-xs mt-6">
              The application requires a connection to the Dashboard API. 
              Please check your internet connection and try again.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      {/* Connection Status Banner */}
      {error && stores.length > 0 && (
        <div className="bg-yellow-900/50 border-b border-yellow-500/30 px-4 py-2">
          <div className="container mx-auto">
            <p className="text-yellow-200 text-sm">
              ⚠️ {error} - Using cached data, background updates may be affected
            </p>
          </div>
        </div>
      )}

      {viewMode === 'selector' && !isReadOnlyMode && (
        <StoreSelector 
          stores={stores} 
          onStoreSelect={handleStoreSelect}
          onViewAll={handleViewAll}
          loading={loading}
          newStoreDetected={newStoreDetected}
        />
      )}

      {viewMode === 'single-store' && selectedStore && (
        <Suspense fallback={<ComponentLoader message="Loading store report..." />}>
          <StoreReport 
            store={selectedStore} 
            onBack={handleBack}
            isLiveData={isLiveData}
          />
        </Suspense>
      )}

      {viewMode === 'all-stores' && (
        <Suspense fallback={<ComponentLoader message="Loading all stores view..." />}>
          <ViewAllStores 
            stores={stores}
            onBack={handleBack}
            onRefresh={handleRefresh}
            loading={loading}
            isLiveData={isLiveData}
          />
        </Suspense>
      )}

      {viewMode === 'readonly-store' && selectedStore && (
        <Suspense fallback={<ComponentLoader message="Loading read-only report..." />}>
          <ReadOnlyStoreReport 
            store={selectedStore}
            isLiveData={isLiveData}
          />
        </Suspense>
      )}
    </div>
  );
}

export default App;