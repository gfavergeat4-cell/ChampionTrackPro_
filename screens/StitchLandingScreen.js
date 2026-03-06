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
            <h1 style={{
              margin: '0 0 8px 0',
              fontFamily: "'Times New Roman', serif",
              fontSize: 'clamp(28px, 6vw, 52px)',
              textTransform: 'uppercase',
              letterSpacing: 2,
              lineHeight: 1,
            }}>
              <span style={{
                color: '#fff',
                textShadow: '0 0 5px #fff, 0 0 10px #0ff, 0 0 20px #0ff, 0 0 30px #0ff',
              }}>CHAMPIONTRACK</span>
              <span style={{
                color: '#fff',
                textShadow: '0 0 5px #fff, 0 0 10px #00f, 0 0 20px #00f, 0 0 30px #00f',
              }}>PRO</span>
            </h1>
            <h2 style={{
              margin: '0 0 24px 0',
              fontFamily: "'Helvetica Neue', Arial, sans-serif",
              fontSize: 'clamp(10px, 1.8vw, 14px)',
              fontWeight: 300,
              textTransform: 'uppercase',
              letterSpacing: 4,
              color: '#fff',
              textShadow: '0 0 3px #fff, 0 0 6px #0ff',
            }}>THE TRAINING INTELLIGENCE</h2>
            <div style={{ position: 'relative', width: 200, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{
                position: 'absolute', width: '100%', height: 6, borderRadius: 3,
                background: 'linear-gradient(to right, #0ff, #00f)',
                boxShadow: '0 0 5px #0ff, 0 0 10px #00f',
              }} />
              <div style={{
                position: 'absolute', zIndex: 2, width: 18, height: 18, borderRadius: '50%',
                backgroundColor: '#0ff',
                boxShadow: '0 0 10px #fff, 0 0 20px #0ff, 0 0 35px #0ff',
              }} />
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
