import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  ActivityIndicator, 
  KeyboardAvoidingView, 
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useAppTheme } from '../context/ThemeContext';
import { spacing, radius, font, shadow } from '../lib/theme';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const { colors, isDark } = useAppTheme();
  const [loginType, setLoginType] = useState<'admin' | 'staff'>('admin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }
    
    setLoading(true);
    setError(null);
    const result = await signIn(email, password);
    if (result.error) {
      setError(result.error.message || 'Invalid email or password. Please try again.');
    }
    setLoading(false);
  };

  const ContentWrapper = Platform.OS === 'web' ? View : TouchableWithoutFeedback;
  const wrapperProps = Platform.OS === 'web' ? {} : { onPress: Keyboard.dismiss };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: colors.bg }]}
    >
      <ContentWrapper {...wrapperProps} style={{ flex: 1 }}>
        <View style={styles.inner}>
          
          {/* Logo & Header */}
          <View style={styles.headerContainer}>
            <Image 
              source={require('../../assets/rova-light.png')} 
              style={styles.logo} 
              resizeMode="contain"
            />
            <Text style={[styles.title, { color: colors.textPrimary }]}>Welcome back</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Sign in to your {loginType === 'admin' ? 'Admin' : 'Staff'} account
            </Text>
          </View>

          {/* Centered Max Width Container */}
          <View style={styles.contentWrapper}>
            {/* Toggle Segment */}
            <View style={[styles.toggleContainer, { borderColor: colors.border }]}>
              <TouchableOpacity 
                style={[styles.toggleBtn, loginType === 'admin' && [styles.toggleBtnActive, { backgroundColor: colors.bgCard }]]}
                onPress={() => setLoginType('admin')}
                activeOpacity={0.7}
              >
                <Ionicons 
                  name={loginType === 'admin' ? "shield-checkmark" : "shield-checkmark-outline"}
                  size={16} 
                  color={loginType === 'admin' ? colors.textPrimary : colors.textMuted} 
                />
                <Text style={[styles.toggleText, { color: colors.textSecondary }, loginType === 'admin' && [styles.toggleTextActive, { color: colors.textPrimary }]]}>
                  Admin Login
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.toggleBtn, loginType === 'staff' && [styles.toggleBtnActive, { backgroundColor: colors.bgCard }]]}
                onPress={() => setLoginType('staff')}
                activeOpacity={0.7}
              >
                <Ionicons 
                  name={loginType === 'staff' ? "people" : "people-outline"}
                  size={18} 
                  color={loginType === 'staff' ? colors.textPrimary : colors.textMuted} 
                />
                <Text style={[styles.toggleText, { color: colors.textSecondary }, loginType === 'staff' && [styles.toggleTextActive, { color: colors.textPrimary }]]}>
                  Staff Login
                </Text>
              </TouchableOpacity>
            </View>

            {/* Login Card */}
            <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.textPrimary }]}>Email</Text>
                <View style={[styles.inputContainer, { borderColor: colors.border, backgroundColor: colors.bgInput }]}>
                  <Ionicons name="mail-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { color: colors.textPrimary }]}
                    placeholder="you@example.com"
                    placeholderTextColor={colors.textMuted}
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.textPrimary }]}>Password</Text>
                <View style={[styles.inputContainer, { borderColor: colors.border, backgroundColor: colors.bgInput }]}>
                  <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { color: colors.textPrimary }]}
                    placeholder="Enter your password"
                    placeholderTextColor={colors.textMuted}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPass}
                  />
                  <TouchableOpacity onPress={() => setShowPass(!showPass)} style={styles.eyeIcon}>
                    <Ionicons name={showPass ? "eye-off-outline" : "eye-outline"} size={20} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>
              </View>

              {error && (
                <View style={[styles.errorContainer, { backgroundColor: colors.dangerBg, borderColor: 'rgba(239, 68, 68, 0.2)' }]}>
                  <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
                </View>
              )}

              <TouchableOpacity style={[styles.button, { backgroundColor: colors.primary }]} onPress={handleLogin} disabled={loading} activeOpacity={0.8}>
                {loading ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={[styles.buttonText, { color: colors.white }]}>Sign In</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Features Row */}
            <View style={styles.featureBar}>
              <View style={styles.featureItem}>
                <Ionicons name="shield-checkmark" size={14} color={colors.success} />
                <Text style={[styles.featureText, { color: colors.textMuted }]}>Secure</Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons name="flash" size={14} color="#F59E0B" />
                <Text style={[styles.featureText, { color: colors.textMuted }]}>Fast</Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
                <Text style={[styles.featureText, { color: colors.textMuted }]}>Verified</Text>
              </View>
            </View>

            {/* Footer */}
            <View style={styles.footerContainer}>
              {loginType === 'admin' ? (
                <Text style={[styles.footerText, { color: colors.textSecondary }]}>
                  Don't have an account? <Text style={[styles.footerLink, { color: colors.primary }]}>Create one</Text>
                </Text>
              ) : (
                <Text style={[styles.footerText, { color: colors.textSecondary }]}>
                  Unauthorized? <Text style={[styles.footerTextMuted, { color: colors.textMuted }]}>Contact admin</Text>
                </Text>
              )}
            </View>
          </View>

        </View>
      </ContentWrapper>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
    alignItems: 'center',
  },
  contentWrapper: {
    width: '100%',
    maxWidth: 450, 
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  logo: {
    width: 140,
    height: 70,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: font.xxl,
    fontWeight: 'bold',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: font.md,
  },
  toggleContainer: {
    flexDirection: 'row',
    borderRadius: radius.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  toggleBtnActive: {
    ...shadow.soft,
    zIndex: 1,
  },
  toggleText: {
    fontSize: font.sm,
    fontWeight: '500',
    marginLeft: spacing.xs,
  },
  toggleTextActive: {
    fontWeight: '600',
  },
  card: {
    borderRadius: radius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    ...shadow.card,
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: font.sm,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    height: 48,
  },
  inputIcon: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: font.md,
    height: '100%',
  },
  eyeIcon: {
    padding: spacing.xs,
  },
  errorContainer: {
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  errorText: {
    fontSize: font.sm,
    textAlign: 'center',
  },
  button: {
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  buttonText: {
    fontSize: font.md,
    fontWeight: 'bold',
  },
  featureBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 24,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  featureText: {
    fontSize: 12,
    fontWeight: '600',
  },
  footerContainer: {
    alignItems: 'center',
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  footerText: {
    fontSize: font.sm,
    textAlign: 'center',
  },
  footerTextMuted: {
    fontSize: font.sm,
  },
  footerLink: {
    fontSize: font.sm,
    fontWeight: '600',
  },
});
