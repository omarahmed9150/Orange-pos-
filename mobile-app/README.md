# ORANGE POS Mobile App

React Native mobile application for ORANGE POS system with offline-first architecture and synchronization with NestJS backend.

## Features

### Core Features
- **Authentication**: Login, logout, and setup for admin users
- **Offline-First**: Works completely offline with local data storage
- **Synchronization**: Automatic sync with backend when online
- **Responsive Design**: Works on both Android and iOS devices
- **Multi-Screen Navigation**: Tab-based navigation for all main features

### Screens
- **Login**: User authentication
- **Setup**: Initial system setup (admin account creation)
- **Dashboard**: Overview with statistics and quick actions
- **Sales**: Sales management and history
- **Products**: Product catalog and management
- **Inventory**: Stock levels and adjustments
- **Customers**: Customer management
- **Settings**: App settings and user preferences

### Technical Features
- **Local Storage**: AsyncStorage for persistent data
- **Network Detection**: Real-time connectivity monitoring
- **Background Sync**: Automatic synchronization when connectivity restored
- **Error Handling**: Comprehensive error handling and user feedback
- **Responsive UI**: Material Design components with custom styling

## Architecture

### Context Providers
- **AuthProvider**: Manages user authentication state
- **OfflineProvider**: Handles offline data and synchronization

### API Configuration
- **API_BASE_URL**: Points to NestJS backend
- **WS_BASE_URL**: WebSocket connection for real-time updates

### Navigation
- **Tab Navigator**: Bottom tab navigation for main features
- **Stack Navigator**: Screen navigation within each tab

## Installation

### Prerequisites
- Node.js (v16 or higher)
- React Native CLI
- Android Studio (for Android development)
- Xcode (for iOS development)

### Installation Steps

1. Clone the repository
2. Navigate to the mobile-app directory
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the development server:
   ```bash
   npm start
   ```

## Development

### Running the App

#### Android
```bash
npm run android
```

#### iOS
```bash
npm run ios
```

#### Web (Expo)
```bash
npm run web
```

### Backend Integration

The mobile app connects to the NestJS backend at `http://localhost:3000/api`. Ensure the backend is running before using the mobile app.

### Offline Usage

1. Open the app without internet connection
2. Use Login screen with local credentials
3. All features work offline
4. Data is automatically synchronized when connection is restored

## Configuration

### Environment Variables

Create a `.env` file in the mobile-app directory:

```env
API_BASE_URL=http://localhost:3000/api
WS_BASE_URL=ws://localhost:3000
```

### API Endpoints

The app uses the following API endpoints:

- `POST /api/auth/login` - User login
- `POST /api/setup/admin` - Create admin account
- `GET /api/check-setup` - Check if setup is needed
- `GET /api/dashboard` - Dashboard statistics
- `GET /api/sales` - List sales
- `POST /api/sales` - Create sale
- `GET /api/products` - List products
- `POST /api/products` - Create product
- `GET /api/inventory` - List inventory
- `POST /api/inventory` - Create inventory item
- `GET /api/customers` - List customers
- `POST /api/customers` - Create customer
- `GET /api/sync/status` - Sync status
- `POST /api/sync/push` - Push local data to server
- `POST /api/sync/pull` - Pull server data to local

## Testing

### Unit Tests
```bash
npm test
```

### Linting
```bash
npm run lint
```

## Build

### Android
```bash
npm run android
```

### iOS
```bash
npm run ios
```

## Troubleshooting

### Common Issues

#### App won't start
- Ensure Node.js is installed
- Check if all dependencies are installed
- Try clearing cache: `npm start --reset-cache`

#### Network issues
- Ensure backend is running
- Check network connectivity
- Try restarting the app

#### Offline mode issues
- Check device storage
- Clear app data and restart
- Ensure necessary permissions are granted

## Support

For issues and support, please contact:
- GitHub Issues
- Project documentation
- Technical support team

## License

This project is licensed under the MIT License.