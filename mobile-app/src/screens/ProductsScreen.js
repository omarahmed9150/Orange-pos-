import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { Card, Title, Paragraph } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import { useOffline } from '../context/OfflineContext';
import { API_BASE_URL } from '../config/api';

export default function ProductsScreen() {
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();
  const { isOffline } = useOffline();

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      let response;
      if (isOffline) {
        const localProducts = await AsyncStorage.getItem('local_products') || '[]';
        setProducts(JSON.parse(localProducts));
      } else {
        response = await fetch(`${API_BASE_URL}/products`);
        const data = await response.json();
        setProducts(data);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
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

  const renderProductItem = ({ item }) => (
    <Card style={styles.productCard}>
      <Card.Content>
        <Title style={styles.productTitle}>{item.name}</Title>
        <Paragraph style={styles.productText}>السعر: {formatCurrency(item.price)}</Paragraph>
        <Paragraph style={styles.productText}>الكمية: {item.quantity}</Paragraph>
        <Paragraph style={styles.productText}>الفئة: {item.category}</Paragraph>
        <Paragraph style={styles.productText}>الباركود: {item.barcode}</Paragraph>
      </Card.Content>
    </Card>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Title style={styles.headerTitle}>المنتجات</Title>
        {isOffline && (
          <Text style={styles.offlineText}>أنت تعمل في وضع عدم الاتصال</Text>
        )}
      </View>

      <FlatList
        data={products}
        renderItem={renderProductItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        refreshing={isLoading}
        onRefresh={fetchProducts}
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
  productCard: {
    margin: 10,
    backgroundColor: '#fff',
  },
  productTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  productText: {
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