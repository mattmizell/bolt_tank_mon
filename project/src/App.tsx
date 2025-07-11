import React, { useState, Suspense } from 'react';
import { Store } from './types';
import { StoreSelector } from './components/StoreSelector';
import { useSmartCache } from './hooks/useSmartCache';

// Lazy load components for better initial loading performance
const StoreReport = React.lazy(() => import('./components/StoreReport').then(module => ({ default: module.StoreReport })));
const ViewAllStores = React.lazy(() => import('./components/ViewAllStores').then(module => ({ default: module.ViewAllStores })));
const ReadOnlyStoreReport = React.lazy(() => import('./components/ReadOnlyStoreReport').then(module => ({ default: module.ReadOnlyStoreReport })));

type ViewMode = 'selector' | 'single-store' | 'all-stores' | 'readonly-store';

// Loading component with progress indication
const ComponentLoader = ({ message = "Loading..." }: { message?: string }) => (
  <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto mb-4"></div>
      <p className="text-slate-300 text-lg">{message}</p>
      <div className="mt-2 w-48 bg-slate-700 rounded-full h-2 mx-auto">
        <div className="bg-blue-400 h-2 rounded-full animate-pulse" style={{ width: '60%' }}></div>
      </div>
    </div>
  </div>
);

function App() {
  console.warn('🚨 APP.TSX COMPONENT LOADING/RELOADING');
  
  const { stores, loading, error, isLiveData, refreshData, newStoreDetected, cacheInfo } = useSmartCache();
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('selector');

  // 🔍 DEBUG: Log the data flow from useSmartCache to components
  React.useEffect(() => {
    console.warn('🚨 APP.TSX DEBUG - FORCED WARNING LOG');
    console.error('🚨 APP.TSX DEBUG - FORCED ERROR LOG');
    console.log('🔍 APP.TSX DATA FLOW DEBUG:');
    console.log('🔍   stores.length:', stores.length);
    console.log('🔍   loading:', loading);
    console.log('🔍   error:', error);
    console.log('🔍   stores array:', stores);
    console.log('🔍   viewMode:', viewMode);
    
    if (stores.length > 0) {
      stores.forEach((store, index) => {
        console.log(`🔍   Store ${index + 1}: ${store.store_name}`);
        console.log(`🔍     tanks.length: ${store.tanks.length}`);
        if (store.tanks.length > 0) {
          console.log(`🔍     First tank:`, store.tanks[0]);
        }
      });
    }
  }, [stores, loading, error, viewMode]);

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
    console.warn('🚨 HANDLE VIEW ALL CLICKED - viewMode changing to all-stores');
    console.log('🔍 Current stores when clicking View All:', stores);
    setViewMode('all-stores');
  };

  const handleBack = () => {
    setSelectedStore(null);
    setViewMode('selector');
  };

  const handleRefresh = async () => {
    await refreshData();
  };

  // Show loading screen during initial load
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-6">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-400 mx-auto mb-6"></div>
          <h2 className="text-2xl font-bold text-white mb-4">
            {cacheInfo.hasCache ? 'Loading Tank Data' : 'First Time Setup'}
          </h2>
          <p className="text-slate-300 text-lg mb-4">
            {cacheInfo.hasCache 
              ? 'Loading cached data and checking for updates...' 
              : 'Fetching and caching data - this will be slow the first time but instant afterwards'
            }
          </p>
          
          {/* Progress indicator */}
          <div className="w-full bg-slate-700 rounded-full h-3 mb-4">
            <div className="bg-gradient-to-r from-blue-500 to-blue-400 h-3 rounded-full animate-pulse" style={{ width: cacheInfo.hasCache ? '85%' : '35%' }}></div>
          </div>
          
          {cacheInfo.hasCache ? (
            <div className="bg-green-900/30 border border-green-500/30 rounded-lg p-4">
              <p className="text-green-200 text-sm font-semibold mb-2">⚡ Cached Data Available</p>
              <p className="text-green-300 text-xs">
                Cached data loaded instantly, now fetching fresh updates in background
              </p>
            </div>
          ) : (
            <div className="bg-blue-900/30 border border-blue-500/30 rounded-lg p-4 mt-4">
              <p className="text-blue-200 text-sm font-semibold mb-2">💡 First Load Performance Notice</p>
              <p className="text-blue-300 text-xs">
                This first load will take 30+ seconds as we fetch and calculate all tank data. 
                However, we're caching everything locally so your next app load will be under 1 second!
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Show error screen if connection failed
  if (error && stores.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-6">
          <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-8">
            <div className="text-red-400 text-6xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold text-white mb-4">Connection Failed</h1>
            <p className="text-red-300 mb-6">{error}</p>
            <div className="space-y-4">
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
            <p className="text-slate-400 text-sm mt-6">
              The application requires a connection to load data. 
              Please check your internet connection and server status.
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
          cacheInfo={cacheInfo}
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