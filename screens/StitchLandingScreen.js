// screens/StitchLandingScreen.js
import React from "react";
import { useNavigation } from "@react-navigation/native";
import { View, Platform } from "react-native";

export default function StitchLandingScreen() {
  const navigation = useNavigation();

  const handleCreateAccount = () => navigation.navigate("CreateAccount");
  const handleLogin = () => navigation.navigate("Login");

  if (Platform.OS === "web") {
    return (
      <div
        style={{
          width: "100%",
          height: "100vh",
          background: "radial-gradient(ellipse at 40% 30%, #0D2545 0%, #0A0F1E 65%)",
          position: "relative",
          overflow: "hidden",
          fontFamily: "'Inter', 'SF Pro Display', sans-serif",
          WebkitFontSmoothing: "antialiased",
        }}
      >
        {/* Logo centered at 38% */}
        <div
          style={{
            position: "absolute",
            top: "38%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "100%",
            padding: "0 24px",
            boxSizing: "border-box",
          }}
        >
          {/* Logo CSS - no image */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', animation: 'logoReveal 1.4s cubic-bezier(0.22, 1, 0.36, 1) forwards' }}>
            <div style={{ margin: '0 0 6px 0', fontFamily: "'Palatino Linotype', Palatino, Georgia, serif", fontSize: 'clamp(26px, 6vw, 42px)', letterSpacing: 3, lineHeight: 1, fontWeight: 400 }}>
              <span style={{ color: '#e8f4ff', textShadow: '0 0 20px rgba(180,220,255,0.4), 0 0 40px rgba(100,180,255,0.2)' }}>CHAMPIONTRACK</span>
              <span style={{ color: '#00c8ff', textShadow: '0 0 15px rgba(0,200,255,0.7), 0 0 30px rgba(0,150,255,0.4)' }}>PRO</span>
            </div>
            <div style={{ margin: '0 0 24px 0', fontFamily: "'Helvetica Neue', Arial, sans-serif", fontSize: 'clamp(8px, 1.6vw, 11px)', fontWeight: 300, textTransform: 'uppercase', letterSpacing: 6, color: 'rgba(200,230,255,0.6)' }}>
              THE TRAINING INTELLIGENCE
            </div>
            <div style={{ position: 'relative', width: 150, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ position: 'absolute', width: '100%', height: 3, borderRadius: 2, background: 'linear-gradient(to right, rgba(0,200,255,0.3), #00c8ff, rgba(0,80,255,0.5))', boxShadow: '0 0 6px rgba(0,200,255,0.5)' }} />
              <div style={{ position: 'absolute', width: 13, height: 13, borderRadius: '50%', backgroundColor: '#00d4ff', boxShadow: '0 0 8px #fff, 0 0 16px #00d4ff, 0 0 28px rgba(0,200,255,0.6)' }} />
            </div>
          </div>
        </div>

        {/* Buttons pinned to bottom */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: "50%",
            transform: "translateX(-50%)",
            width: "100%",
            maxWidth: 420,
            padding: "0 24px 40px",
            boxSizing: "border-box",
          }}
        >
          <button
            onClick={handleCreateAccount}
            style={{
              width: "100%",
              height: 56,
              borderRadius: 14,
              background: "linear-gradient(135deg, #00BFFF, #0055FF)",
              boxShadow: "0 0 30px rgba(0,180,255,0.4)",
              border: "none",
              color: "white",
              fontWeight: 700,
              fontSize: 14,
              letterSpacing: "2px",
              textTransform: "uppercase",
              cursor: "pointer",
              marginBottom: 12,
              transition: "opacity 0.2s",
              animation: "fadeUp 0.7s cubic-bezier(0.22, 1, 0.36, 1) 0.8s both",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.88")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
          >
            Create Account
          </button>

          <button
            onClick={handleLogin}
            style={{
              width: "100%",
              height: 56,
              borderRadius: 14,
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.2)",
              color: "white",
              fontWeight: 600,
              fontSize: 14,
              letterSpacing: "2px",
              textTransform: "uppercase",
              cursor: "pointer",
              transition: "border-color 0.2s",
              animation: "fadeUp 0.7s cubic-bezier(0.22, 1, 0.36, 1) 1s both",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.5)")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)")}
          >
            Log In
          </button>
        </div>
      </div>
    );
  }

  // Native fallback
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#0A0F1E",
        justifyContent: "center",
        alignItems: "center",
      }}
    />
  );
}
