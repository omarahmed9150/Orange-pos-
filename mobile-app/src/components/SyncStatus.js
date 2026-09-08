import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useOffline } from '../context/OfflineContext';

export default function SyncStatus({ onSync, pendingCount }) {
  const { syncStatus, triggerSync } = useOffline();

  useEffect(() => {
    if (syncStatus === 'completed' && pendingCount > 0) {
      onSync();
    }
  }, [syncStatus, pendingCount, onSync]);

  if (syncStatus === 'syncing') {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color="#ff6600" />
        <Text style={styles.text}>جاري المزامنة...</Text>
      </View>
    );
  }

  if (syncStatus === 'error') {
    return (
      <View style={[styles.container, styles.errorContainer]}>
        <Text style={[styles.text, styles.errorText]}>فشل في المزامنة</Text>
      </View>
    );
  }

  if (pendingCount > 0) {
    return (
      <View style={[styles.container, styles.pendingContainer]}>
        <Text style={[styles.text, styles.pendingText]}>
          لديك {pendingCount} عملية مزامنة معلقة
        </Text>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    margin: 8,
    borderRadius: 8,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 8,
  },
  errorContainer: {
    backgroundColor: '#ffebee',
  },
  errorText: {
    color: '#c62828',
  },
  pendingContainer: {
    backgroundColor: '#fff3cd',
  },
  pendingText: {
    color: '#856404',
  },
});