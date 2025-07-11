# Tank Monitoring Dashboard

A real-time fuel tank monitoring system built with React and TypeScript, connected to the Central Tank Server API for live tank data visualization and analytics.

## 🚀 Features

### Real-Time Monitoring
- **Live Tank Data**: Real-time fuel levels, volumes, and tank status
- **Multi-Store Support**: Monitor multiple gas station locations
- **Critical Alerts**: Visual indicators for critical and warning tank levels
- **Auto-Refresh**: Background updates every 30 seconds

### Interactive Charts
- **Historical Trends**: 7-day historical fuel level charts with sampling
- **Volume Tracking**: Both product height (inches) and TC volume (gallons)
- **Predictive Analytics**: 48-hour predictions and critical level indicators
- **Smart Sampling**: Intelligent data sampling for optimal chart performance

### Tank Analytics
- **Run Rate Calculations**: Fuel consumption rates (inches/hour)
- **Time to Critical**: Hours remaining until critical level (10")
- **Capacity Monitoring**: Real-time capacity percentages
- **Business Hours Analysis**: Run rates calculated during operational hours only

### User Interface
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Dark Theme**: Professional dark interface optimized for monitoring
- **Grid/Table Views**: Switch between visual grid and detailed table layouts
- **Smart Caching**: Instant loading with intelligent cache management

## 🏗️ Architecture

### Frontend Stack
- **React 18** with TypeScript
- **Vite** for build tooling and development
- **Chart.js** with react-chartjs-2 for data visualization
- **Tailwind CSS** for styling
- **Lucide React** for icons

### API Integration
- **Central Tank Server**: `https://central-tank-server.onrender.com`
- **RESTful Endpoints**: Dashboard API with real-time tank data
- **Smart Caching**: Local storage with TTL for optimal performance
- **Error Handling**: Graceful fallbacks and retry mechanisms

### Data Flow
```
Central Tank Server → Dashboard API → Smart Cache → React Components → Charts
```

## 📊 API Endpoints

### Dashboard Data
- `GET /dashboard/stores` - All stores with tank summaries
- `GET /dashboard/stores/{store}` - Detailed store data with analytics
- `GET /dashboard/stores/{store}/tanks/{id}/sampled` - Historical chart data

### Chart Data Format
```json
[
  {
    "timestamp": "2025-07-11 15:00:00",
    "volume": 4886,
    "height": 72.67
  }
]
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Access to Central Tank Server API

### Installation
```bash
# Clone the repository
git clone <repository-url>
cd project-bolt-tank-mon

# Navigate to project directory
cd project

# Install dependencies
npm install

# Start development server
npm run dev
```

### Development
- Development server runs on `http://localhost:5173`
- Hot reload enabled for rapid development
- TypeScript checking and ESLint integration

### Build for Production
```bash
npm run build
npm run preview
```

## 🏪 Store Configuration

### Supported Stores
- **Mascoutah**: 3 tanks (Unleaded, Premium, Diesel)
- **North City**: 5 tanks with varied fuel types
- **TEST_STORE**: Development/testing environment

### Tank Properties
- **Tank ID**: Unique identifier within store
- **Product Type**: Fuel grade (Unleaded, Premium, Diesel)
- **Capacity**: Maximum gallons (typically 10,000 gal)
- **Critical Level**: 10 inches (configurable)
- **Warning Level**: 20 inches (configurable)

## 📈 Chart Features

### Data Visualization
- **Dual Y-Axis**: Height (inches) and Volume (gallons)
- **Historical Trends**: Up to 7 days of data
- **Critical Lines**: Visual indicators for warning/critical levels
- **Prediction Lines**: 48-hour forecast when available
- **Smart Sampling**: Automatic data point optimization

### Chart Controls
- **Time Ranges**: Configurable from hours to weeks
- **Sampling Rates**: Adaptive based on data density
- **Interactive Tooltips**: Detailed reading information
- **Performance Optimized**: Handles large datasets efficiently

## 🔧 Configuration

### Environment Variables
```bash
# API Configuration
VITE_API_BASE_URL=https://central-tank-server.onrender.com

# Cache Settings
VITE_CACHE_DURATION=120000  # 2 minutes
VITE_REFRESH_INTERVAL=30000  # 30 seconds
```

### Cache Management
- **Smart Cache**: Automatic cache invalidation
- **Local Storage**: Persistent across browser sessions
- **TTL Support**: Time-based cache expiration
- **Background Refresh**: Seamless data updates

## 🛠️ Development

### Project Structure
```
project/
├── src/
│   ├── components/         # React components
│   │   ├── TankChart.tsx   # Chart visualization
│   │   ├── TankTable.tsx   # Table view
│   │   └── TankGrid.tsx    # Grid layout
│   ├── hooks/              # Custom React hooks
│   │   └── useSmartCache.ts # Cache management
│   ├── services/           # API and data services
│   │   ├── api.ts          # API client
│   │   └── smartCache.ts   # Caching logic
│   └── types/              # TypeScript definitions
├── public/                 # Static assets
└── dist/                   # Production build
```

### Key Components

#### TankChart.tsx
- Historical data visualization
- Chart.js integration
- Real-time updates
- Error handling for missing data

#### useSmartCache.ts
- Intelligent caching strategy
- Background refresh management
- API integration
- State management

#### ApiService
- RESTful API client
- Error handling and retries
- Response caching
- TypeScript integration

## 🐛 Troubleshooting

### Common Issues

#### Charts Not Loading
- **Problem**: Charts show "No valid chart data available"
- **Solution**: Check API connectivity and store name encoding
- **Debug**: Enable console logging for API responses

#### Slow Performance
- **Problem**: Dashboard loads slowly
- **Solution**: Clear cache and verify API response times
- **Debug**: Monitor network tab for slow requests

#### Missing Tank Data
- **Problem**: Tanks show N/A values
- **Solution**: Verify Central Tank Server connectivity
- **Debug**: Check latest_reading timestamps

### Debug Mode
Enable detailed logging by modifying console.log statements in:
- `TankChart.tsx` - Chart data processing
- `useSmartCache.ts` - Cache operations
- `api.ts` - API requests

## 🚀 Deployment

### Production Build
```bash
npm run build
```

### Static Hosting
The built application can be deployed to:
- Netlify
- Vercel
- GitHub Pages
- Any static hosting service

### Environment Setup
- Configure API endpoints for production
- Set appropriate cache durations
- Enable production optimizations

## 📝 Recent Updates

### v1.2.0 - Chart Data Loading Fix
- Fixed API response format handling (direct array vs wrapped format)
- Improved error handling and debugging
- Added proper URL encoding for store names
- Reduced excessive console logging
- Enhanced data validation for charts

### v1.1.0 - Smart Caching
- Implemented intelligent cache management
- Added background refresh capabilities
- Improved performance with local storage
- Enhanced error recovery mechanisms

## 🤝 Contributing

### Development Workflow
1. Create feature branch
2. Make changes with TypeScript
3. Test locally with `npm run dev`
4. Build and verify with `npm run build`
5. Submit pull request

### Code Standards
- TypeScript strict mode
- ESLint configuration
- Prettier formatting
- Component-based architecture

## 📄 License

This project is part of the Better Day Energy tank monitoring system.

---

**Tank Monitoring Dashboard** - Real-time fuel monitoring with intelligent analytics