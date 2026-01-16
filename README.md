# QuietRoute 🚶

> **Navigate Peacefully** - A smart navigation app that finds the quietest, safest, and best-lit routes in Kolkata.

![QuietRoute Banner](https://via.placeholder.com/800x400/1a1a25/8b5cf6?text=QuietRoute+%7C+Navigate+Peacefully)

## 🎯 The Problem

Standard navigation apps optimize purely for distance/time. But what if you want to:

- Walk home through **quiet streets** instead of noisy main roads?
- Find **well-lit paths** for safety at night?
- Avoid **crowded areas** during peak hours?

## 💡 The Solution

QuietRoute uses a **weighted routing algorithm** that factors in:

```
Total Cost = Distance × Noise Multiplier × Darkness Multiplier × User Reports
```

This means a short but loud highway might have a higher "cost" than a slightly longer but peaceful side street.

## ✨ Features

### MVP (Current)

- 🎚️ **Vibe Toggle** - Adjust your priorities between Fastest ↔ Quietest and Dim ↔ Brightest
- 🗺️ **Route Comparison** - See multiple route options with noise/lighting indicators
- 📍 **Crowdsourced Reports** - Tag locations as Loud, Dark, Crowded, or Obstructed
- 🆘 **Panic Button** - Instantly route to nearest safe, well-lit public space

### Coming Soon

- 🕐 **Time-Dependent Routing** - School zones quiet at night, markets crowded by day
- 🌡️ **Sensory Heatmap** - Visual overlay showing noise levels across the city
- 📊 **OSM Integration** - Automatic street attributes from OpenStreetMap

## 🛠️ Tech Stack

| Layer         | Technology                         |
| ------------- | ---------------------------------- |
| **Frontend**  | React + Vite                       |
| **Map**       | Mapbox GL JS / OpenStreetMap       |
| **Routing**   | OSRM (Open Source Routing Machine) |
| **Backend**   | Node.js + Express                  |
| **Database**  | PostgreSQL + PostGIS               |
| **Geocoding** | Nominatim (OpenStreetMap)          |

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Docker & Docker Compose (for database & OSRM)

### 1. Clone & Install

```bash
# Clone the repo
git clone https://github.com/yourusername/quietroute.git
cd quietroute

# Install frontend dependencies
npm install

# Install backend dependencies
cd server && npm install && cd ..
```

### 2. Start Docker Services

```bash
# This will start PostgreSQL/PostGIS and OSRM
# First run will download ~500MB of OSM data for West Bengal
docker-compose up -d
```

### 3. Run the Application

```bash
# Terminal 1: Start the backend
cd server && npm run dev

# Terminal 2: Start the frontend
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## 🗄️ Database Setup

The Docker Compose file automatically initializes the database with the schema. If you need to manually set it up:

```bash
# Connect to PostgreSQL
psql -h localhost -U postgres -d quietroute

# Run the schema
\i server/db/schema.sql
```

## 🔧 Configuration

### Frontend (`src/config.js`)

- `MAPBOX_TOKEN` - Your Mapbox access token (free tier works)
- `DEFAULT_CENTER` - Default map center (Kolkata)
- `OSRM_SERVER` - OSRM routing server URL

### Backend (`server/.env`)

```env
PORT=3001
DB_HOST=localhost
DB_PORT=5432
DB_NAME=quietroute
DB_USER=postgres
DB_PASSWORD=quietroute123
```

## 📡 API Endpoints

| Endpoint                    | Method | Description                    |
| --------------------------- | ------ | ------------------------------ |
| `/api/health`               | GET    | Health check                   |
| `/api/reports`              | GET    | Get reports in bounding box    |
| `/api/reports`              | POST   | Create a new report            |
| `/api/reports/:id/upvote`   | POST   | Upvote a report                |
| `/api/reports/:id/downvote` | POST   | Downvote a report              |
| `/api/street-tags`          | GET    | Get street attributes for area |
| `/api/safe-places`          | GET    | Find nearest safe places       |

## 🧮 The Cost Function

The core innovation is in `src/utils/costFunction.js`:

```javascript
function calculateEdgeCost(edge, preferences) {
  const baseCost = edge.distance;

  // Noise: 1.0 (silent) to 3.0 (very loud)
  const noiseMultiplier = getNoiseMultiplier(edge, preferences.quietness);

  // Darkness: 1.0 (well-lit) to 2.5 (dark)
  const darknessMultiplier = getDarknessMultiplier(
    edge,
    preferences.brightness
  );

  // User reports impact
  const reportsMultiplier = getReportsMultiplier(edge, reports);

  return baseCost * noiseMultiplier * darknessMultiplier * reportsMultiplier;
}
```

## 📁 Project Structure

```
quietroute/
├── src/
│   ├── App.jsx              # Main application
│   ├── config.js            # Configuration
│   ├── index.css            # Design system
│   ├── services/
│   │   ├── routingService.js    # OSRM integration
│   │   ├── geocodingService.js  # Address search
│   │   └── reportService.js     # User reports
│   └── utils/
│       └── costFunction.js      # Weighted routing logic
├── server/
│   ├── index.js             # Express API
│   └── db/
│       └── schema.sql       # PostGIS schema
├── docker-compose.yml       # Docker services
└── package.json
```

## 🎨 Design Philosophy

- **Dark Mode First** - Easy on the eyes for nighttime navigation
- **Glassmorphism** - Modern, premium feel
- **Micro-interactions** - Smooth animations for better UX
- **Accessibility** - High contrast, readable fonts

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

MIT License - See [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

- [OpenStreetMap](https://www.openstreetmap.org/) - Map data
- [OSRM](http://project-osrm.org/) - Routing engine
- [Mapbox](https://www.mapbox.com/) - Beautiful map styling
- [PostGIS](https://postgis.net/) - Spatial database

---

**Made with ❤️ for safer, quieter walks in Kolkata**
