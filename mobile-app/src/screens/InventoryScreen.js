import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { Card, Title, Paragraph } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import { useOffline } from '../context/OfflineContext';
import { API_BASE_URL } from '../config/api';

export default function InventoryScreen() {
  const [inventory, setInventory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();
  const { isOffline } = useOffline();

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    try {
      let response;
      if (isOffline) {
        const localInventory = await AsyncStorage.getItem('local_inventory') || '[]';
        setInventory(JSON.parse(localInventory));
      } else {
        response = await fetch(`${API_BASE_URL}/inventory`);
        const data = await response.json();
        setInventory(data);
      }
    } catch (error) {
      console.error('Error fetching inventory:', error);
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

  const renderInventoryItem = ({ item }) => (
    <Card style={styles.inventoryCard}>
      <Card.Content>
        <Title style={styles.inventoryTitle}>{item.name}</Title>
        <Paragraph style={styles.inventoryText}>الكمية: {item.quantity}</Paragraph>
        <Paragraph style={styles.inventoryText}>السعر: {formatCurrency(item.price)}</Paragraph>
        <Paragraph style={styles.inventoryText}>الحد الأدنى: {item.minQuantity}</Paragraph>
        <Paragraph style={styles.inventoryText}>القسم: {item.category}</Paragraph>
        <Paragraph style={styles.inventoryText}>الموقع: {item.location}</Paragraph>
      </Card.Content>
    </Card>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Title style={styles.headerTitle}>المخزون</Title>
        {isOffline && (
          <Text style={styles.offlineText}>أنت تعمل في وضع عدم الاتصال</Text>
        )}
      </View>

      <FlatList
        data={inventory}
        renderItem={renderInventoryItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        refreshing={isLoading}
        onRefresh={fetchInventory}
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
  inventoryCard: {
    margin: 10,
    backgroundColor: '#fff',
  },
  inventoryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  inventoryText: {
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