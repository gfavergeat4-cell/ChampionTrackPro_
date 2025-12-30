// src/components/FCMDebugPanel.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Platform } from 'react-native';
import { tokens } from '../theme/tokens';

interface ServiceWorkerRegistration {
  scope: string;
  active: boolean;
  activeState?: string;
  activeScriptURL?: string;
  waiting?: boolean;
  installing?: boolean;
}

interface DebugInfo {
  notificationPermission: string;
  serviceWorkerSupported: boolean;
  isSecureContext: boolean;
  protocol: string;
  origin: string;
  registrations: ServiceWorkerRegistration[];
  swFileStatus?: {
    status: number;
    contentType: string;
    isJS: boolean;
  };
}

export default function FCMDebugPanel() {
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDebugInfo = async () => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      setError('Debug panel only available on web');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Récupérer les informations de base
      const notificationPermission = 'Notification' in window ? Notification.permission : 'not supported';
      const serviceWorkerSupported = 'serviceWorker' in navigator;
      const isSecureContext = window.isSecureContext;
      const protocol = window.location.protocol;
      const origin = window.location.origin;

      // Récupérer les service workers enregistrés
      let registrations: ServiceWorkerRegistration[] = [];
      if (serviceWorkerSupported) {
        const regs = await navigator.serviceWorker.getRegistrations();
        registrations = regs.map((reg) => ({
          scope: reg.scope,
          active: !!reg.active,
          activeState: reg.active?.state,
          activeScriptURL: reg.active?.scriptURL,
          waiting: !!reg.waiting,
          installing: !!reg.installing,
        }));
      }

      // Tester l'accès au fichier service worker
      let swFileStatus: DebugInfo['swFileStatus'];
      try {
        const response = await fetch('/firebase-messaging-sw.js');
        const contentType = response.headers.get('content-type') || 'unknown';
        const text = await response.text();
        const isJS = !text.trim().startsWith('<!DOCTYPE') && !text.includes('<html>');

        swFileStatus = {
          status: response.status,
          contentType,
          isJS,
        };
      } catch (fetchError: any) {
        swFileStatus = {
          status: 0,
          contentType: 'error',
          isJS: false,
        };
      }

      setDebugInfo({
        notificationPermission,
        serviceWorkerSupported,
        isSecureContext,
        protocol,
        origin,
        registrations,
        swFileStatus,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to fetch debug info');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDebugInfo();
  }, []);

  if (Platform.OS !== 'web') {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Debug panel only available on web</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🔔 FCM Service Worker Debug</Text>
        <Pressable onPress={fetchDebugInfo} style={styles.refreshButton}>
          <Text style={styles.refreshText}>🔄 Refresh</Text>
        </Pressable>
      </View>

      {loading && (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading debug info...</Text>
        </View>
      )}

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Error: {error}</Text>
        </View>
      )}

      {debugInfo && (
        <ScrollView style={styles.scrollView}>
          {/* Environment Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Environment</Text>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Origin:</Text>
              <Text style={styles.value}>{debugInfo.origin}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Protocol:</Text>
              <Text style={styles.value}>{debugInfo.protocol}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Secure Context:</Text>
              <Text style={[styles.value, debugInfo.isSecureContext ? styles.success : styles.error]}>
                {debugInfo.isSecureContext ? '✅ Yes' : '❌ No'}
              </Text>
            </View>
          </View>

          {/* Notification Permission */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notification Permission</Text>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Status:</Text>
              <Text
                style={[
                  styles.value,
                  debugInfo.notificationPermission === 'granted' ? styles.success : styles.warning,
                ]}
              >
                {debugInfo.notificationPermission === 'granted'
                  ? '✅ Granted'
                  : debugInfo.notificationPermission === 'denied'
                  ? '❌ Denied'
                  : '⚠️ Default'}
              </Text>
            </View>
          </View>

          {/* Service Worker Support */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Service Worker Support</Text>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Supported:</Text>
              <Text style={[styles.value, debugInfo.serviceWorkerSupported ? styles.success : styles.error]}>
                {debugInfo.serviceWorkerSupported ? '✅ Yes' : '❌ No'}
              </Text>
            </View>
          </View>

          {/* Service Worker File Status */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Service Worker File (/firebase-messaging-sw.js)</Text>
            {debugInfo.swFileStatus && (
              <>
                <View style={styles.infoRow}>
                  <Text style={styles.label}>HTTP Status:</Text>
                  <Text
                    style={[
                      styles.value,
                      debugInfo.swFileStatus.status === 200 ? styles.success : styles.error,
                    ]}
                  >
                    {debugInfo.swFileStatus.status === 200 ? '✅ 200 OK' : `❌ ${debugInfo.swFileStatus.status}`}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.label}>Content-Type:</Text>
                  <Text style={styles.value}>{debugInfo.swFileStatus.contentType}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.label}>Is JavaScript:</Text>
                  <Text
                    style={[styles.value, debugInfo.swFileStatus.isJS ? styles.success : styles.error]}
                  >
                    {debugInfo.swFileStatus.isJS ? '✅ Yes' : '❌ No (HTML detected)'}
                  </Text>
                </View>
              </>
            )}
          </View>

          {/* Service Worker Registrations */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Service Worker Registrations ({debugInfo.registrations.length})
            </Text>
            {debugInfo.registrations.length === 0 ? (
              <Text style={styles.warning}>⚠️ No service workers registered</Text>
            ) : (
              debugInfo.registrations.map((reg, idx) => (
                <View key={idx} style={styles.registrationCard}>
                  <Text style={styles.registrationTitle}>SW #{idx + 1}</Text>
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>Scope:</Text>
                    <Text style={styles.value}>{reg.scope}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>Active:</Text>
                    <Text style={[styles.value, reg.active ? styles.success : styles.error]}>
                      {reg.active ? '✅ Yes' : '❌ No'}
                    </Text>
                  </View>
                  {reg.activeState && (
                    <View style={styles.infoRow}>
                      <Text style={styles.label}>Active State:</Text>
                      <Text style={styles.value}>{reg.activeState}</Text>
                    </View>
                  )}
                  {reg.activeScriptURL && (
                    <View style={styles.infoRow}>
                      <Text style={styles.label}>Script URL:</Text>
                      <Text style={styles.value}>{reg.activeScriptURL}</Text>
                    </View>
                  )}
                  {reg.waiting && (
                    <View style={styles.infoRow}>
                      <Text style={styles.label}>Waiting:</Text>
                      <Text style={styles.warning}>⚠️ Yes</Text>
                    </View>
                  )}
                  {reg.installing && (
                    <View style={styles.infoRow}>
                      <Text style={styles.label}>Installing:</Text>
                      <Text style={styles.warning}>⚠️ Yes</Text>
                    </View>
                  )}
                </View>
              ))
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.bg,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: tokens.colors.text,
  },
  refreshButton: {
    backgroundColor: tokens.colors.accent,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: tokens.radii.md,
  },
  refreshText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  loadingContainer: {
    padding: 16,
    alignItems: 'center',
  },
  loadingText: {
    color: tokens.colors.textSecondary,
  },
  errorContainer: {
    padding: 16,
    backgroundColor: '#FF4444',
    borderRadius: tokens.radii.md,
    marginBottom: 16,
  },
  errorText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    backgroundColor: tokens.colors.surface,
    padding: 16,
    borderRadius: tokens.radii.md,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: tokens.colors.text,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    color: tokens.colors.textSecondary,
    flex: 1,
  },
  value: {
    fontSize: 14,
    color: tokens.colors.text,
    flex: 2,
    textAlign: 'right',
  },
  success: {
    color: '#00FF00',
    fontWeight: '600',
  },
  warning: {
    color: '#FFAA00',
    fontWeight: '600',
  },
  error: {
    color: '#FF4444',
    fontWeight: '600',
  },
  registrationCard: {
    backgroundColor: tokens.colors.bgSecondary,
    padding: 12,
    borderRadius: tokens.radii.sm,
    marginBottom: 12,
  },
  registrationTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: tokens.colors.text,
    marginBottom: 8,
  },
});

