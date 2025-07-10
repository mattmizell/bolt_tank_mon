# Tank Monitoring Dashboard

A professional tank monitoring dashboard for Better Day Energy fuel stations with real-time data visualization and intelligent caching.

## 🚀 Features

- **Real-time Tank Monitoring**: Live data from Central Tank Server
- **Intelligent Caching**: Fast 2-3 second load times with Supabase cache
- **Professional UI**: Modern, responsive design with Better Day Energy branding
- **Advanced Analytics**: Run rate calculations, predictions, and status monitoring
- **Multi-store Support**: Monitor multiple fuel stations from one dashboard
- **Auto-configuration**: Automatic detection and setup of new stores

## 🛠️ Technology Stack

- **Frontend**: React 18 + TypeScript + Tailwind CSS
- **Charts**: Chart.js with React integration
- **Icons**: Lucide React
- **Build Tool**: Vite
- **Cache**: Supabase (PostgreSQL)
- **Data Source**: Central Tank Server API

## 📊 Performance

- **Load Time**: 2-3 seconds (down from 30+ seconds)
- **Data Updates**: Every 30 seconds via background sync
- **Cache Duration**: 5-day rolling window for optimal performance
- **Scalability**: Handles millions of IoT records efficiently

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account (for caching)

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/yourusername/tank-monitoring-dashboard.git
   cd tank-monitoring-dashboard
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   ```bash
   cp .env.example .env
   ```
   
   Update `.env` with your credentials:
   ```env
   VITE_SUPABASE_URL=your-supabase-url
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
   VITE_REACT_APP_API_URL=https://central-tank-server.onrender.com
   ```

4. **Run database migration** (in Supabase SQL Editor):
   - Copy SQL from `supabase/migrations/20250628122537_purple_oasis.sql`
   - Execute in Supabase dashboard

5. **Start development server**:
   ```bash
   npm run dev
   ```

## 🏗️ Architecture

### Data Flow
```
Central Tank Server → Background Sync Service → Supabase Cache → Dashboard App
```

### Key Components

- **Dashboard API**: Optimized endpoints for fast data retrieval
- **Background Sync**: Continuous data synchronization every 30 seconds
- **Cache Layer**: Supabase tables with 5-day retention and automatic cleanup
- **Analytics Engine**: Real-time run rate and prediction calculations

## 📱 Usage

### Store Selection
- View all stores from the main dashboard
- Click individual stores for detailed monitoring
- Use "View All Stores" for multi-store overview

### Tank Monitoring
- Real-time volume, height, and temperature readings
- Run rate calculations based on 4-week historical averages
- Predictive analytics for refill timing
- Status indicators (Normal, Warning, Critical)

### Configuration
- Store hours and admin contacts
- Tank specifications and alert thresholds
- System-wide settings and preferences

## 🔧 Configuration

### Store Hours
Configure business hours for accurate predictions:
```javascript
{
  store_name: "Mascoutah",
  open_hour: 5,    // 5 AM
  close_hour: 23,  // 11 PM
  timezone: "America/Chicago"
}
```

### Tank Configuration
Set up tank specifications:
```javascript
{
  store_name: "Mascoutah",
  tank_id: 1,
  tank_name: "UNLEADED",
  product_type: "Regular Unleaded",
  critical_height_inches: 10,
  warning_height_inches: 20
}
```

## 🚀 Deployment

### Background Sync Service

Deploy the background sync service for 24/7 data updates:

**Option 1: Render ($7/month)**
```bash
# See RENDER_DEPLOYMENT_GUIDE.md for detailed instructions
```

**Option 2: Railway ($5/month)**
```bash
npm install -g @railway/cli
railway login
railway init
railway up
```

### Frontend Deployment

Deploy to any static hosting provider:

```bash
npm run build
# Upload dist/ folder to your hosting provider
```

## 📊 Performance Optimization

### Caching Strategy
- **5-day retention**: Raw data automatically cleaned up
- **Hourly aggregates**: 1-year retention for historical trends
- **Pre-calculated metrics**: Run rates and predictions cached
- **Background updates**: Fresh data every 30 seconds

### Database Optimization
- Optimized indexes for fast queries
- Automatic cleanup functions
- Efficient data structures for IoT scale

## 🔍 Monitoring

### Health Checks
- Service uptime monitoring
- Data freshness indicators
- Connection status tracking
- Error rate monitoring

### Alerts
- Critical tank levels (≤10 inches)
- Service downtime notifications
- Data staleness warnings
- Prediction accuracy tracking

## 🛠️ Development

### Project Structure
```
src/
├── components/          # React components
├── hooks/              # Custom React hooks
├── services/           # API and business logic
├── types/              # TypeScript type definitions
├── utils/              # Utility functions
└── data/               # Mock data and constants

supabase/
└── migrations/         # Database schema and migrations

services/
└── production-sync-service.js  # Background sync service
```

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

### Environment Variables

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Central Tank Server
VITE_REACT_APP_API_URL=https://central-tank-server.onrender.com
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is proprietary software for Better Day Energy.

## 🆘 Support

For support and questions:
- Check the troubleshooting guides in `/docs`
- Review the deployment guides for common issues
- Contact the development team

## 🎯 Roadmap

- [ ] Mobile app development
- [ ] Advanced analytics dashboard
- [ ] Automated alert system
- [ ] Multi-tenant support
- [ ] API rate limiting
- [ ] Enhanced security features

---

**Better Day Energy** - Professional Fuel Management Solutions