import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import SplashScreen from 'react-native-splash-screen';

import LoginScreen from './screens/LoginScreen';
import SetupScreen from './screens/SetupScreen';
import DashboardScreen from './screens/DashboardScreen';
import SalesScreen from './screens/SalesScreen';
import ProductsScreen from './screens/ProductsScreen';
import InventoryScreen from './screens/InventoryScreen';
import CustomersScreen from './screens/CustomersScreen';
import SettingsScreen from './screens/SettingsScreen';
import OfflineIndicator from './components/OfflineIndicator';
import SyncStatus from './components/SyncStatus';

import { AuthProvider, useAuth } from './context/AuthContext';
import { OfflineProvider, useOffline } from './context/OfflineContext';
import { API_BASE_URL } from './config/api';

const Tab = createBottomTabNavigator();

function MainApp() {
  const { user, isLoading, login, logout } = useAuth();
  const { isOffline, pendingSync, triggerSync } = useOffline();
  const [needsSetup, setNeedsSetup] = useState(false);
  const [isCheckingSetup, setIsCheckingSetup] = useState(true);

  useEffect(() => {
    SplashScreen.hide();
  }, []);

  useEffect(() => {
    checkSetupStatus();
    const unsubscribe = NetInfo.addEventListener(state => {
      // Handle network changes
    });
    return unsubscribe;
  }, []);

  const checkSetupStatus = async () => {
    try {
      let response;
      if (isOffline) {
        // Check local database for admin user
        const localUsers = await AsyncStorage.getItem('local_users');
        const users = localUsers ? JSON.parse(localUsers) : [];
        setNeedsSetup(users.length === 0);
      } else {
        response = await fetch(`${API_BASE_URL}/check-setup`);
        const data = await response.json();
        setNeedsSetup(data.needsSetup || false);
      }
    } catch (error) {
      console.error('Error checking setup status:', error);
      setNeedsSetup(false);
    } finally {
      setIsCheckingSetup(false);
    }
  };

  const handleLogin = async (username, password) => {
    try {
      let response;
      if (isOffline) {
        // Offline login - check local users
        const localUsers = await AsyncStorage.getItem('local_users');
        const users = localUsers ? JSON.parse(localUsers) : [];
        const user = users.find(u => u.username === username && u.password === password);
        if (user) {
          await login({ user, token: 'offline-token' });
          return { success: true };
        } else {
          return { success: false, message: 'Invalid credentials' };
        }
      } else {
        response = await fetch(`${API_BASE_URL}/auth/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ username, password }),
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          return { success: false, message: errorData.message || 'Login failed' };
        }
        
        const data = await response.json();
        await login({ user: data.user, token: data.accessToken });
        return { success: true };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, message: 'Network error' };
    }
  };

  const handleSetupComplete = async (username, password) => {
    try {
      let response;
      if (isOffline) {
        // Create local admin user
        const localUsers = await AsyncStorage.getItem('local_users') || '[]';
        const users = JSON.parse(localUsers);
        const newUser = {
          id: Date.now().toString(),
          username,
          password,
          role: 'SUPER_ADMIN',
          isActive: true,
          storeId: 'default-store',
          fullName: 'المدير العام',
          createdAt: new Date().toISOString(),
        };
        users.push(newUser);
        await AsyncStorage.setItem('local_users', JSON.stringify(users));
        await login({ user: newUser, token: 'offline-token' });
      } else {
        response = await fetch(`${API_BASE_URL}/setup-admin`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ username, password }),
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Setup failed');
        }
        
        const data = await response.json();
        // Create local user record
        const localUser = {
          id: data.userId,
          username,
          password,
          role: 'SUPER_ADMIN',
          isActive: true,
          storeId: 'default-store',
          fullName: 'المدير العام',
          createdAt: new Date().toISOString(),
        };
        await AsyncStorage.setItem('local_users', JSON.stringify([localUser]));
        await login({ user: localUser, token: 'offline-token' });
      }
      setNeedsSetup(false);
    } catch (error) {
      console.error('Setup error:', error);
      throw error;
    }
  };

  const handleLogout = async () => {
    await logout();
    await AsyncStorage.removeItem('local_users');
  };

  if (isLoading || isCheckingSetup) {
    return null; // Show splash screen or loading indicator
  }

  if (needsSetup) {
    return <SetupScreen onSetupComplete={handleSetupComplete} />;
  }

  if (!user) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <NavigationContainer>
      <OfflineIndicator />
      <SyncStatus onSync={triggerSync} pendingCount={pendingSync.length} />
      
      <Tab.Navigator
        screenOptions={({ navigation }) => ({
          headerShown: false,
          tabBarActiveTintColor: '#ff6600',
          tabBarInactiveTintColor: '#666',
        })}
      >
        <Tab.Screen 
          name="Dashboard" 
          component={DashboardScreen}
          options={{ title: 'الرئيسية' }}
        />
        <Tab.Screen 
          name="Sales" 
          component={SalesScreen}
          options={{ title: 'المبيعات' }}
        />
        <Tab.Screen 
          name="Products" 
          component={ProductsScreen}
          options={{ title: 'المنتجات' }}
        />
        <Tab.Screen 
          name="Inventory" 
          component={InventoryScreen}
          options={{ title: 'المخزون' }}
        />
        <Tab.Screen 
          name="Customers" 
          component={CustomersScreen}
          options={{ title: 'العملاء' }}
        />
        <Tab.Screen 
          name="Settings" 
          component={SettingsScreen}
          options={{ title: 'الإعدادات' }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <OfflineProvider>
          <MainApp />
        </OfflineProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}