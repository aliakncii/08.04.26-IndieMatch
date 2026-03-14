// App.js - Root of the IndieMatch RN app
// Sets up React Navigation with FeedScreen + ProfileScreen.

import { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import FeedScreen from './src/screens/FeedScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import { ensurePlayablesReady } from './src/utils/assetHelper';

const Stack = createNativeStackNavigator();

export default function App() {
  useEffect(() => {
    // Dev mode: logs the Metro URL. Production: copies assets to document dir.
    ensurePlayablesReady().catch(e =>
      console.warn('[App] ensurePlayablesReady failed:', e.message)
    );
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <NavigationContainer>
          <Stack.Navigator
            screenOptions={{
              headerShown: false,
              animation: 'slide_from_right',
              contentStyle: { backgroundColor: '#000' },
            }}
          >
            <Stack.Screen name="Feed" component={FeedScreen} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
