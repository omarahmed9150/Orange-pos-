import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Card, Title, Paragraph } from 'react-native-paper';
import { useAuth } from '../context/AuthContext';
import { useOffline } from '../context/OfflineContext';

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const { isOffline, triggerSync, pendingSync } = useOffline();
  const [isSyncing, setIsSyncing] = useState(false);

  const handleLogout = () => {
    Alert.alert(
      'تسجيل الخروج',
      'هل أنت متأكد من تسجيل الخروج؟',
      [
        { text: 'إلغاء', style: 'cancel' },
        { text: 'تسجيل الخروج', onPress: logout },
      ]
    );
  };

  const handleSync = async () => {
    if (!isOffline) {
      setIsSyncing(true);
      try {
        await triggerSync();
        Alert.alert('نجاح', 'تمت المزامنة بنجاح');
      } catch (error) {
        Alert.alert('خطأ', 'فشل في المزامنة');
      } finally {
        setIsSyncing(false);
      }
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Title style={styles.headerTitle}>الإعدادات</Title>
      </View>

      <View style={styles.content}>
        <Card style={styles.infoCard}>
          <Card.Content>
            <Title style={styles.cardTitle}>معلومات المستخدم</Title>
            <Paragraph style={styles.infoText}>الاسم: {user?.fullName || user?.username}</Paragraph>
            <Paragraph style={styles.infoText}>الدور: {user?.role}</Paragraph>
            <Paragraph style={styles.infoText}>المتجر: {user?.storeId}</Paragraph>
          </Card.Content>
        </Card>

        <Card style={styles.infoCard}>
          <Card.Content>
            <Title style={styles.cardTitle}>الحالة</Title>
            <Paragraph style={styles.infoText}>الحالة: {isOffline ? 'غير متصل' : 'متصل'}</Paragraph>
            <Paragraph style={styles.infoText}>العمليات المعلقة: {pendingSync.length}</Paragraph>
          </Card.Content>
        </Card>

        <TouchableOpacity
          style={[styles.button, isOffline && styles.buttonOffline]}
          onPress={handleSync}
          disabled={isSyncing || !isOffline}
        >
          <Text style={styles.buttonText}>
            {isSyncing ? 'جاري المزامنة...' : 'مزامنة البيانات'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>تسجيل الخروج</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>ORANGE POS v1.0.0</Text>
        <Text style={styles.footerText}>Copyright © 2024</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  content: {
    padding: 20,
  },
  infoCard: {
    marginBottom: 15,
    backgroundColor: '#fff',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  button: {
    backgroundColor: '#ff6600',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    marginBottom: 15,
  },
  buttonOffline: {
    backgroundColor: '#ff9900',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  logoutButton: {
    backgroundColor: '#dc3545',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    paddingBottom: 40,
  },
  footerText: {
    fontSize: 12,
    color: '#999',
    marginBottom: 5,
  },
});