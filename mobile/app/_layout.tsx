import { ActivityIndicator, View } from 'react-native';
import { Redirect, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '@/hooks/useAuth';

export default function RootLayout() {
  const { isSignedIn, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000000' }}>
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        {isSignedIn ? (
          <>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="weekly" />
            <Stack.Screen name="monthly" />
            <Stack.Screen name="templates" />
          </>
        ) : (
          <Stack.Screen name="login" />
        )}
      </Stack>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {!isSignedIn && <Redirect href={'/login' as any} />}
      <StatusBar style="dark" />
    </>
  );
}
