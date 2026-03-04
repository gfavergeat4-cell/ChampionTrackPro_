import React from "react";
import { View, Text, StyleSheet, Platform } from "react-native";

const LogoInline = () => (
  <div style={{ textAlign: "center", marginBottom: 40 }}>
    <div style={{
      fontSize: 30,
      fontFamily: "'Palatino Linotype', Palatino, Georgia, serif",
      letterSpacing: 3,
      lineHeight: 1.2,
    }}>
      <span style={{ color: "#ffffff", textShadow: "0 0 30px rgba(255,255,255,0.4)" }}>CHAMPIONTRACK</span>
      <span style={{ color: "#00D4FF", textShadow: "0 0 25px rgba(0,212,255,0.9)" }}>PRO</span>
    </div>
    <div style={{ fontSize: 10, letterSpacing: 7, color: "rgba(255,255,255,0.45)", marginTop: 6 }}>
      THE TRAINING INTELLIGENCE
    </div>
    <svg style={{ marginTop: 14, display: "block", margin: "14px auto 0" }} width="80" height="18" viewBox="0 0 80 18">
      <defs>
        <linearGradient id="splash-lg" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#0044FF" stopOpacity="0.4" />
          <stop offset="50%" stopColor="#00D4FF" />
          <stop offset="100%" stopColor="#0044FF" stopOpacity="0.4" />
        </linearGradient>
        <filter id="splash-glow"><feGaussianBlur stdDeviation="2.5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
      <line x1="4" y1="9" x2="76" y2="9" stroke="url(#splash-lg)" strokeWidth="2" strokeLinecap="round" />
      <circle cx="40" cy="9" r="5" fill="#00D4FF" filter="url(#splash-glow)" />
      <circle cx="40" cy="9" r="2.5" fill="#ffffff" />
    </svg>
  </div>
);

export default function SplashScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {Platform.OS === "web" ? (
          <LogoInline />
        ) : (
          <Text style={styles.logoText}>ChampionTrack Pro</Text>
        )}
        <View style={styles.spinner} />
        <Text style={styles.text}>Loading...</Text>
      </View>
      {Platform.OS === "web" && (
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          .spinner-web {
            animation: spin 1s linear infinite;
          }
        `}</style>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0F1A",
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    alignItems: "center",
    gap: 20,
    backgroundColor: "transparent",
  },
  logoText: {
    fontSize: 22,
    fontWeight: "600",
    color: "#fff",
  },
  spinner: {
    width: 40,
    height: 40,
    borderWidth: 3,
    borderColor: "rgba(0, 224, 255, 0.3)",
    borderTopColor: "#00E0FF",
    borderRadius: 20,
    ...(Platform.OS === "web" && {
      className: "spinner-web",
    }),
  },
  text: {
    fontSize: 16,
    fontWeight: "500",
    color: "#00E0FF",
    fontFamily: Platform.OS === "web" ? "'Inter', sans-serif" : "System",
  },
});


