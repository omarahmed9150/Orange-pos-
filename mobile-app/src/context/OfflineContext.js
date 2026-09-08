import React, { createContext, useContext, useReducer, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { API_BASE_URL } from '../config/api';

const OfflineContext = createContext();

const initialState = {
  isOffline: false,
  pendingSync: [],
  localData: {},
  syncStatus: 'idle', // idle, syncing, completed, error
  lastSyncTime: null,
  offlineEnabled: true,
};

function offlineReducer(state, action) {
  switch (action.type) {
    case 'SET_OFFLINE_STATUS':
      return { ...state, isOffline: action.payload };
    case 'SET_PENDING_SYNC':
      return { ...state, pendingSync: action.payload };
    case 'ADD_PENDING_SYNC':
      return { 
        ...state, 
        pendingSync: [...state.pendingSync, action.payload] 
      };
    case 'SET_LOCAL_DATA':
      return { ...state, localData: { ...state.localData, ...action.payload } };
    case 'SET_SYNC_STATUS':
      return { ...state, syncStatus: action.payload };
    case 'SET_LAST_SYNC_TIME':
      return { ...state, lastSyncTime: action.payload };
    case 'SET_OFFLINE_ENABLED':
      return { ...state, offlineEnabled: action.payload };
    case 'RESET_OFFLINE_STATE':
      return { ...initialState, offlineEnabled: state.offlineEnabled };
    default:
      return state;
  }
}

export function OfflineProvider({ children }) {
  const [state, dispatch] = useReducer(offlineReducer, initialState);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(handleConnectivityChange);
    loadLocalData();
    return unsubscribe;
  }, []);

  const handleConnectivityChange = (networkState) => {
    const isNowOffline = networkState.isConnected !== true;
    
    dispatch({ type: 'SET_OFFLINE_STATUS', payload: isNowOffline });
    
    if (!isNowOffline) {
      triggerSync();
    }
  };

  const loadLocalData = async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const localData = {};
      
      for (const key of keys) {
        if (key.startsWith('local_')) {
          const value = await AsyncStorage.getItem(key);
          localData[key] = value ? JSON.parse(value) : null;
        }
      }
      
      dispatch({ type: 'SET_LOCAL_DATA', payload: localData });
    } catch (error) {
      console.error('Error loading local data:', error);
    }
  };

  const saveLocalData = async (key, data) => {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(data));
      dispatch({ 
        type: 'SET_LOCAL_DATA', 
        payload: { [key]: data } 
      });
    } catch (error) {
      console.error('Error saving local data:', error);
      throw error;
    }
  };

  const addPendingSync = (operation) => {
    const pendingItem = {
      id: Date.now().toString(),
      operation,
      timestamp: new Date().toISOString(),
      status: 'pending',
    };
    
    dispatch({ type: 'ADD_PENDING_SYNC', payload: pendingItem });
    return pendingItem.id;
  };

  const triggerSync = async () => {
    if (state.pendingSync.length === 0) {
      return;
    }
    
    dispatch({ type: 'SET_SYNC_STATUS', payload: 'syncing' });
    
    try {
      const response = await fetch(`${API_BASE_URL}/sync/push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          operations: state.pendingSync,
          localData: state.localData,
        }),
      });
      
      if (response.ok) {
        const result = await response.json();
        
        // Clear pending sync items
        dispatch({ type: 'SET_PENDING_SYNC', payload: [] });
        dispatch({ type: 'SET_SYNC_STATUS', payload: 'completed' });
        dispatch({ type: 'SET_LAST_SYNC_TIME', payload: new Date().toISOString() });
        
        // Update local data with synced data
        if (result.data) {
          await saveLocalData('synced_data', result.data);
        }
      } else {
        throw new Error('Sync failed');
      }
    } catch (error) {
      console.error('Sync error:', error);
      dispatch({ type: 'SET_SYNC_STATUS', payload: 'error' });
      throw error;
    }
  };

  const value = {
    ...state,
    saveLocalData,
    addPendingSync,
    triggerSync,
  };

  return <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>;
}

export function useOffline() {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error('useOffline must be used within an OfflineProvider');
  }
  return context;
}