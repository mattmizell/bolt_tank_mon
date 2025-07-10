// Test detailed dashboard store endpoints
const API_BASE_URL = 'https://central-tank-server.onrender.com';

async function testDetailedStores() {
  console.log('🚀 Testing detailed dashboard store endpoints');
  
  try {
    // Get store list first
    const storesResponse = await fetch(`${API_BASE_URL}/dashboard/stores`);
    const stores = await storesResponse.json();
    console.log('📊 Available stores:', stores.map(s => s.store_name));
    
    // Test detailed data for each store
    for (const store of stores) {
      console.log(`\n=== TESTING STORE: ${store.store_name} ===`);
      
      const detailUrl = `${API_BASE_URL}/dashboard/stores/${store.store_name}`;
      console.log('🔗 URL:', detailUrl);
      
      const detailResponse = await fetch(detailUrl);
      console.log('📊 Status:', detailResponse.status);
      console.log('📊 Headers:', Object.fromEntries(detailResponse.headers.entries()));
      
      if (!detailResponse.ok) {
        console.error(`❌ Failed for ${store.store_name}:`, detailResponse.status, detailResponse.statusText);
        const errorText = await detailResponse.text();
        console.error('❌ Error response:', errorText);
      } else {
        const detailData = await detailResponse.json();
        console.log(`✅ Success for ${store.store_name}`);
        console.log('📊 Store data keys:', Object.keys(detailData));
        console.log('📊 Tank count:', detailData.tanks?.length);
        
        if (detailData.tanks && detailData.tanks[0]) {
          const firstTank = detailData.tanks[0];
          console.log('📊 First tank keys:', Object.keys(firstTank));
          console.log('📊 First tank analytics:', firstTank.analytics);
          console.log('📊 First tank configuration:', firstTank.configuration);
          console.log('📊 First tank latest_reading:', firstTank.latest_reading);
          console.log('📊 First tank current_status:', firstTank.current_status);
        }
      }
    }
    
  } catch (error) {
    console.error('💥 Test failed:', error);
  }
}

testDetailedStores();