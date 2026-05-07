import { StatusBar } from 'expo-status-bar';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';

type Session = {
  accessToken: string;
  refreshToken: string;
  organizationId: string | null;
};

const SESSION_KEY = 'evemange.mobile.session';

export default function App() {
  const [organizationCode, setOrganizationCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    void (async () => {
      const raw = await SecureStore.getItemAsync(SESSION_KEY);
      if (!raw) {
        return;
      }

      try {
        const parsed = JSON.parse(raw) as Session;
        setSession(parsed);
      } catch {
        await SecureStore.deleteItemAsync(SESSION_KEY);
      }
    })();
  }, []);

  async function mockSignIn(): Promise<void> {
    const nextSession: Session = {
      accessToken: 'phase6-placeholder-access-token',
      refreshToken: 'phase6-placeholder-refresh-token',
      organizationId: organizationCode || null
    };

    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(nextSession));
    setSession(nextSession);
  }

  async function signOut(): Promise<void> {
    await SecureStore.deleteItemAsync(SESSION_KEY);
    setSession(null);
  }

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="light" />
      <View style={styles.container}>
        <Text style={styles.title}>EveMange Usher Mobile</Text>
        <Text style={styles.subtitle}>Phase 6 scaffold with secure storage baseline.</Text>

        {session ? (
          <View style={styles.card}>
            <Text style={styles.label}>Session active</Text>
            <Text style={styles.meta}>Org: {session.organizationId || 'unscoped'}</Text>
            <Pressable style={styles.buttonSecondary} onPress={() => void signOut()}>
              <Text style={styles.buttonText}>Sign out</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.card}>
            <TextInput
              value={organizationCode}
              onChangeText={setOrganizationCode}
              placeholder="Organization ID"
              placeholderTextColor="#94a3b8"
              style={styles.input}
            />
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              placeholderTextColor="#94a3b8"
              style={styles.input}
              autoCapitalize="none"
            />
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor="#94a3b8"
              style={styles.input}
              secureTextEntry
            />
            <Pressable style={styles.button} onPress={() => void mockSignIn()}>
              <Text style={styles.buttonText}>Secure Sign-In (Scaffold)</Text>
            </Pressable>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#020617'
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 40
  },
  title: {
    color: '#f8fafc',
    fontSize: 28,
    fontWeight: '700'
  },
  subtitle: {
    color: '#cbd5e1',
    marginTop: 8,
    marginBottom: 20
  },
  card: {
    backgroundColor: '#0f172a',
    borderColor: '#1e293b',
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    gap: 10
  },
  input: {
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 10,
    color: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  button: {
    backgroundColor: '#22d3ee',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 6
  },
  buttonSecondary: {
    backgroundColor: '#334155',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 6
  },
  buttonText: {
    color: '#020617',
    fontWeight: '700'
  },
  label: {
    color: '#22d3ee',
    fontWeight: '700'
  },
  meta: {
    color: '#cbd5e1'
  }
});
