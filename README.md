# BizOs - Mobile Application 📱

BizOs mobile application built with **React Native** and **Expo**. This app serves as the portable Point of Sale (POS) and business management interface for the BizOs ecosystem, enabling users to manage sales, inventory, and analytics on the go.

## Features ✨

- **Mobile Point of Sale (POS)**: Quick and intuitive checkout experience.
- **Offline Capabilities**: Uses local storage (MMKV/AsyncStorage) and SQLite to store transactions when internet is unavailable, syncing seamlessly once online.
- **Dynamic KPI Dashboard**: Real-time sales data, transaction history, and business metrics.
- **Inventory & Settings Management**: Manage products, adjust stock, and configure shop details directly from the app.
- **Cross-Platform**: Built for both Android and iOS devices using Expo.

## Getting Started 🚀

### Prerequisites
- Node.js (v18+)
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- Android Studio (for Android emulator/builds) or Xcode (for iOS)

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables:
   Copy `.env.example` to `.env` and update the backend API URL.
   ```bash
   cp .env.example .env
   ```

3. Start the development server:
   ```bash
   npm start
   ```

### Building for Production 📦

#### Android APK (Local Build)
You can generate a release APK locally using Gradle:
```bash
cd android
./gradlew assembleRelease
```
The generated APK will be located at `android/app/build/outputs/apk/release/app-release.apk`.

#### Using EAS (Expo Application Services)
```bash
eas build -p android --profile preview
```

## Tech Stack 🛠️

- **Framework**: React Native, Expo
- **Styling**: NativeWind (Tailwind CSS for React Native)
- **Navigation**: React Navigation / Expo Router
- **State & Data Fetching**: React Query, Zustand
- **Local Storage**: React Native MMKV, Async Storage
- **Icons**: Lucide React Native
