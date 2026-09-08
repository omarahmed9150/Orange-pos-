import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useOffline } from '../context/OfflineContext';

export default function OfflineIndicator() {
  const { isOffline } = useOffline();

  if (!isOffline) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.text}>أنت تعمل في وضع عدم الاتصال</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ff9900',
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});