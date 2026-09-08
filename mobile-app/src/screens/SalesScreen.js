import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { Card, Title, Paragraph } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import { useOffline } from '../context/OfflineContext';
import { API_BASE_URL } from '../config/api';

export default function SalesScreen() {
  const [sales, setSales] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();
  const { isOffline } = useOffline();

  useEffect(() => {
    fetchSales();
  }, []);

  const fetchSales = async () => {
    try {
      let response;
      if (isOffline) {
        const localSales = await AsyncStorage.getItem('local_sales') || '[]';
        setSales(JSON.parse(localSales));
      } else {
        response = await fetch(`${API_BASE_URL}/sales`);
        const data = await response.json();
        setSales(data);
      }
    } catch (error) {
      console.error('Error fetching sales:', error);
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

  const renderSaleItem = ({ item }) => (
    <Card style={styles.saleCard}>
      <Card.Content>
        <Title style={styles.saleTitle}>الفاتورة #{item.id}</Title>
        <Paragraph style={styles.saleText}>العميل: {item.customerName}</Paragraph>
        <Paragraph style={styles.saleText}>المبلغ: {formatCurrency(item.total)}</Paragraph>
        <Paragraph style={styles.saleText}>التاريخ: {new Date(item.date).toLocaleDateString()}</Paragraph>
        <Paragraph style={styles.saleText}>العناصر: {item.items?.length || 0}</Paragraph>
      </Card.Content>
    </Card>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Title style={styles.headerTitle}>المبيعات</Title>
        {isOffline && (
          <Text style={styles.offlineText}>أنت تعمل في وضع عدم الاتصال</Text>
        )}
      </View>

      <FlatList
        data={sales}
        renderItem={renderSaleItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        refreshing={isLoading}
        onRefresh={fetchSales}
      />

      <TouchableOpacity style={styles.fab}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
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
  offlineText: {
    fontSize: 14,
    color: '#ff9900',
    marginTop: 5,
  },
  listContent: {
    padding: 10,
  },
  saleCard: {
    margin: 10,
    backgroundColor: '#fff',
  },
  saleTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  saleText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 3,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    backgroundColor: '#ff6600',
    borderRadius: 30,
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
  },
  fabText: {
    fontSize: 30,
    color: '#fff',
    fontWeight: 'bold',
  },
});