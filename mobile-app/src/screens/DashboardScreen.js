import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Card, Title, Paragraph } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import { useOffline } from '../context/OfflineContext';
import { API_BASE_URL } from '../config/api';

export default function DashboardScreen() {
  const { user } = useAuth();
  const { isOffline, pendingSync } = useOffline();
  const [dashboardData, setDashboardData] = useState({
    totalSales: 0,
    totalProducts: 0,
    totalCustomers: 0,
    totalRevenue: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      let response;
      if (isOffline) {
        // Use local data
        const localSales = await AsyncStorage.getItem('local_sales') || '[]';
        const localProducts = await AsyncStorage.getItem('local_products') || '[]';
        const localCustomers = await AsyncStorage.getItem('local_customers') || '[]';
        
        const sales = JSON.parse(localSales);
        const products = JSON.parse(localProducts);
        const customers = JSON.parse(localCustomers);
        
        const totalRevenue = sales.reduce((sum, sale) => sum + (sale.total || 0), 0);
        
        setDashboardData({
          totalSales: sales.length,
          totalProducts: products.length,
          totalCustomers: customers.length,
          totalRevenue,
        });
      } else {
        response = await fetch(`${API_BASE_URL}/dashboard`);
        const data = await response.json();
        setDashboardData(data);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('ar-SA', {
      style: 'currency',
      currency: 'SAR',
    }).format(amount);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Title style={styles.welcomeText}>مرحباً، {user?.fullName || user?.username}</Title>
        <Paragraph style={styles.roleText}>الدور: {user?.role}</Paragraph>
        {isOffline && (
          <Paragraph style={styles.offlineText}>أنت تعمل في وضع عدم الاتصال</Paragraph>
        )}
      </View>

      <View style={styles.statsContainer}>
        <Card style={styles.statCard}>
          <Card.Content>
            <Title style={styles.statTitle}>إجمالي المبيعات</Title>
            <Paragraph style={styles.statValue}>{dashboardData.totalSales}</Paragraph>
          </Card.Content>
        </Card>

        <Card style={styles.statCard}>
          <Card.Content>
            <Title style={styles.statTitle}>المنتجات</Title>
            <Paragraph style={styles.statValue}>{dashboardData.totalProducts}</Paragraph>
          </Card.Content>
        </Card>

        <Card style={styles.statCard}>
          <Card.Content>
            <Title style={styles.statTitle}>العملاء</Title>
            <Paragraph style={styles.statValue}>{dashboardData.totalCustomers}</Paragraph>
          </Card.Content>
        </Card>

        <Card style={styles.statCard}>
          <Card.Content>
            <Title style={styles.statTitle}>الإيرادات</Title>
            <Paragraph style={styles.statValue}>{formatCurrency(dashboardData.totalRevenue)}</Paragraph>
          </Card.Content>
        </Card>
      </View>

      {pendingSync.length > 0 && (
        <Card style={styles.syncCard}>
          <Card.Content>
            <Title style={styles.syncTitle}>المزامنة</Title>
            <Paragraph style={styles.syncText}>
              لديك {pendingSync.length} عملية مزامنة معلقة
            </Paragraph>
          </Card.Content>
        </Card>
      )}

      <View style={styles.quickActions}>
        <Title style={styles.sectionTitle}>الإجراءات السريعة</Title>
        
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.actionButton}>
            <Text style={styles.actionButtonText}>فاتورة جديدة</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton}>
            <Text style={styles.actionButtonText}>إضافة منتج</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton}>
            <Text style={styles.actionButtonText}>عرض التقارير</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
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
    marginBottom: 10,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  roleText: {
    fontSize: 16,
    color: '#ff6600',
    fontWeight: '600',
  },
  offlineText: {
    fontSize: 14,
    color: '#ff9900',
    marginTop: 5,
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 10,
  },
  statCard: {
    width: '48%',
    margin: '1%',
    backgroundColor: '#fff',
  },
  statTitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  syncCard: {
    margin: 10,
    backgroundColor: '#fff3cd',
  },
  syncTitle: {
    fontSize: 16,
    color: '#856404',
  },
  syncText: {
    fontSize: 14,
    color: '#856404',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    margin: 15,
    marginLeft: 10,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 10,
  },
  actionButton: {
    backgroundColor: '#ff6600',
    padding: 15,
    borderRadius: 8,
    width: '30%',
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});