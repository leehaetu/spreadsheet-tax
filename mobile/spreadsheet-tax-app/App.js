/**
 * Spreadsheet Tax mobile shell (iOS + Android via Expo).
 * Loads the product web surface — bridging app, portals, sales.
 * IP belongs to Lee Hine.
 */

import { useMemo, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  Pressable,
  StyleSheet,
  StatusBar,
  Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';

const DEFAULT_URL = 'https://spreadsheet-tax-production.up.railway.app';

const PRODUCT_BASE = (
  process.env.EXPO_PUBLIC_PRODUCT_URL || DEFAULT_URL
).replace(/\/$/, '');

/** Path constants — string maps only, no enums */
const PATH_HOME = '/';
const PATH_APP = '/app';
const PATH_PORTAL = '/portal';
const PATH_ACCOUNTANT = '/accountant';
const PATH_PRACTICE = '/practice';

const TABS = [
  { id: 'app', label: 'Import', path: PATH_APP },
  { id: 'portal', label: 'Portal', path: PATH_PORTAL },
  { id: 'accountant', label: 'Accountant', path: PATH_ACCOUNTANT },
  { id: 'practice', label: 'Practice', path: PATH_PRACTICE },
  { id: 'home', label: 'Sales', path: PATH_HOME },
];

export default function App() {
  const [path, setPath] = useState(PATH_APP);
  const uri = useMemo(() => `${PRODUCT_BASE}${path}`, [path]);

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <Text style={styles.title}>Spreadsheet Tax</Text>
        <Text style={styles.sub} numberOfLines={1}>
          {uri}
        </Text>
      </View>
      <View style={styles.tabs}>
        {TABS.map((tab) => (
          <Pressable
            key={tab.id}
            onPress={() => setPath(tab.path)}
            style={[styles.tab, path === tab.path && styles.tabActive]}
          >
            <Text
              style={[
                styles.tabText,
                path === tab.path && styles.tabTextActive,
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <WebView
        source={{ uri }}
        style={styles.web}
        startInLoadingState
        allowsBackForwardNavigationGestures
        originWhitelist={['https://*', 'http://*']}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0f1419',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2a3648',
  },
  title: {
    color: '#e8eef6',
    fontWeight: '700',
    fontSize: 16,
  },
  sub: {
    color: '#9aabbd',
    fontSize: 11,
    marginTop: 2,
  },
  tabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2a3648',
  },
  tab: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#1c2533',
  },
  tabActive: {
    backgroundColor: '#3d9cfd',
  },
  tabText: {
    color: '#9aabbd',
    fontSize: 12,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#061018',
  },
  web: {
    flex: 1,
    backgroundColor: '#0f1419',
  },
});
