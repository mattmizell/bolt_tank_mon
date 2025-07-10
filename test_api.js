// Simple API connection test
const API_BASE_URL = 'https://central-tank-server.onrender.com';

async function testApiConnection() {
  console.log('🚀 Testing API connection to:', API_BASE_URL);
  
  try {
    // Test 1: Basic health check
    console.log('\n=== TEST 1: Health Check ===');
    const healthResponse = await fetch(`${API_BASE_URL}/health`);
    console.log('Health check status:', healthResponse.status);
    console.log('Health check headers:', Object.fromEntries(healthResponse.headers.entries()));
    
    if (!healthResponse.ok) {
      console.error('❌ Health check failed:', healthResponse.status, healthResponse.statusText);
      const errorText = await healthResponse.text();
      console.error('❌ Error response:', errorText);
    } else {
      const healthData = await healthResponse.json();
      console.log('✅ Health check success:', healthData);
    }
    
    // Test 2: Dashboard stores endpoint
    console.log('\n=== TEST 2: Dashboard Stores ===');
    const dashboardResponse = await fetch(`${API_BASE_URL}/dashboard/stores`);
    console.log('Dashboard stores status:', dashboardResponse.status);
    console.log('Dashboard stores headers:', Object.fromEntries(dashboardResponse.headers.entries()));
    
    if (!dashboardResponse.ok) {
      console.error('❌ Dashboard stores failed:', dashboardResponse.status, dashboardResponse.statusText);
      const errorText = await dashboardResponse.text();
      console.error('❌ Error response:', errorText);
    } else {
      const dashboardData = await dashboardResponse.json();
      console.log('✅ Dashboard stores success:', JSON.stringify(dashboardData, null, 2));
    }
    
    // Test 3: Legacy stores endpoint
    console.log('\n=== TEST 3: Legacy Stores ===');
    const legacyResponse = await fetch(`${API_BASE_URL}/stores`);
    console.log('Legacy stores status:', legacyResponse.status);
    console.log('Legacy stores headers:', Object.fromEntries(legacyResponse.headers.entries()));
    
    if (!legacyResponse.ok) {
      console.error('❌ Legacy stores failed:', legacyResponse.status, legacyResponse.statusText);
      const errorText = await legacyResponse.text();
      console.error('❌ Error response:', errorText);
    } else {
      const legacyData = await legacyResponse.json();
      console.log('✅ Legacy stores success:', JSON.stringify(legacyData, null, 2));
    }
    
    // Test 4: Full stores endpoint
    console.log('\n=== TEST 4: Full Stores ===');
    const fullResponse = await fetch(`${API_BASE_URL}/stores/full`);
    console.log('Full stores status:', fullResponse.status);
    console.log('Full stores headers:', Object.fromEntries(fullResponse.headers.entries()));
    
    if (!fullResponse.ok) {
      console.error('❌ Full stores failed:', fullResponse.status, fullResponse.statusText);
      const errorText = await fullResponse.text();
      console.error('❌ Error response:', errorText);
    } else {
      const fullData = await fullResponse.json();
      console.log('✅ Full stores success - first store:', JSON.stringify(fullData[0], null, 2));
    }
    
  } catch (error) {
    console.error('💥 API test completely failed:', error);
    console.error('Error type:', typeof error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
  }
}

testApiConnection();