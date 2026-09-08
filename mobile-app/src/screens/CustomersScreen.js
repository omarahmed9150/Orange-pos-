import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { Card, Title, Paragraph } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import { useOffline } from '../context/OfflineContext';
import { API_BASE_URL } from '../config/api';

export default function CustomersScreen() {
  const [customers, setCustomers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();
  const { isOffline } = useOffline();

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      let response;
      if (isOffline) {
        const localCustomers = await AsyncStorage.getItem('local_customers') || '[]';
        setCustomers(JSON.parse(localCustomers));
      } else {
        response = await fetch(`${API_BASE_URL}/customers`);
        const data = await response.json();
        setCustomers(data);
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const renderCustomerItem = ({ item }) => (
    <Card style={styles.customerCard}>
      <Card.Content>
        <Title style={styles.customerTitle}>{item.name}</Title>
        <Paragraph style={styles.customerText}>الهاتف: {item.phone}</Paragraph>
        <Paragraph style={styles.customerText}>البريد الإلكتروني: {item.email}</Paragraph>
        <Paragraph style={styles.customerText}>العنوان: {item.address}</Paragraph>
        <Paragraph style={styles.customerText}>النقاط: {item.points || 0}</Paragraph>
      </Card.Content>
    </Card>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Title style={styles.headerTitle}>العملاء</Title>
        {isOffline && (
          <Text style={styles.offlineText}>أنت تعمل في وضع عدم الاتصال</Text>
        )}
      </View>

      <FlatList
        data={customers}
        renderItem={renderCustomerItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        refreshing={isLoading}
        onRefresh={fetchCustomers}
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
  customerCard: {
    margin: 10,
    backgroundColor: '#fff',
  },
  customerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  customerText: {
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