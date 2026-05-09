import React from 'react';
import { View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { ThemeProvider, useAppTheme } from './src/context/ThemeContext';
import { colors as staticColors } from './src/lib/theme';

// Screens
import DashboardScreen from './src/screens/DashboardScreen';
import TransactionsScreen from './src/screens/TransactionsScreen';
import InvoicesScreen from './src/screens/InvoicesScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import LoginScreen from './src/screens/LoginScreen';
import MenuScreen from './src/screens/MenuScreen';
import PlaceholderScreen from './src/screens/PlaceholderScreen';

// Components
import FloatingActionButton from './src/components/FloatingActionButton';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Menu Stack Navigator
function MenuStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MenuMain" component={MenuScreen} />
      
      {/* Financial Records */}
      <Stack.Screen name="GeneralLedger" component={PlaceholderScreen} />
      <Stack.Screen name="ChartOfAccounts" component={PlaceholderScreen} />
      <Stack.Screen name="JournalEntries" component={PlaceholderScreen} />
      <Stack.Screen name="TrialBalance" component={PlaceholderScreen} />
      
      {/* Financial Statements */}
      <Stack.Screen name="ProfitAndLoss" component={PlaceholderScreen} />
      <Stack.Screen name="BalanceSheet" component={PlaceholderScreen} />
      <Stack.Screen name="CashFlow" component={PlaceholderScreen} />
      
      {/* People & Operations */}
      <Stack.Screen name="Team" component={PlaceholderScreen} />
      <Stack.Screen name="Payroll" component={PlaceholderScreen} />
      
      {/* More */}
      <Stack.Screen name="Reports" component={PlaceholderScreen} />
      <Stack.Screen name="Tax" component={PlaceholderScreen} />
      <Stack.Screen name="SettingsStack" component={SettingsScreen} />
    </Stack.Navigator>
  );
}

// Empty component for the center "Action" tab
const EmptyScreen = () => <View />;

function MainTabs() {
  const { colors } = useAppTheme();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarStyle: {
            backgroundColor: colors.bgCard,
            borderTopColor: colors.border,
            height: 75,
            paddingBottom: 20,
            paddingTop: 8,
          },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textSecondary,
          tabBarIcon: ({ color, size }) => {
            let iconName: keyof typeof Ionicons.glyphMap = 'home';

            if (route.name === 'Dashboard') iconName = 'home';
            else if (route.name === 'Transactions') iconName = 'list';
            else if (route.name === 'InvoicesTab') iconName = 'document-text';
            else if (route.name === 'Menu') iconName = 'grid';

            // Return empty icon for Action tab so FAB can take its place
            if (route.name === 'Action') return null;

            return <Ionicons name={iconName} size={size} color={color} />;
          },
        })}
      >
        <Tab.Screen name="Dashboard" component={DashboardScreen} />
        <Tab.Screen name="Transactions" component={TransactionsScreen} />
        
        <Tab.Screen 
          name="Action" 
          component={EmptyScreen} 
          options={{
            tabBarLabel: () => null, // Hide label
            tabBarButton: () => null, // Make unclickable (FAB handles clicks)
          }}
        />
        
        <Tab.Screen name="InvoicesTab" component={InvoicesScreen} options={{ title: 'Invoices' }} />
        <Tab.Screen name="Menu" component={MenuStackNavigator} />
      </Tab.Navigator>
      
      {/* Floating Action Button overlay */}
      <FloatingActionButton />
    </View>
  );
}

function AppNavigator() {
  const { session, loading } = useAuth();

  if (loading) {
    return null; // Or splash screen
  }

  return (
    <NavigationContainer>
      {session ? <MainTabs /> : <LoginScreen />}
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <AppNavigator />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
