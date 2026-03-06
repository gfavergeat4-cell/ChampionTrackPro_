// screens/StitchLandingScreen.js
import React from "react";
import { useNavigation } from "@react-navigation/native";
import { View, Platform } from "react-native";
import MobileViewport from "../src/components/MobileViewport";
import { SliderDivider } from "../src/components/SliderDivider";

export default function StitchLandingScreen() {
  const navigation = useNavigation();

  const handleCreateAccount = () => {
    console.log("Navigate to CreateAccount");
    navigation.navigate("CreateAccount");
  };
  const handleLogin = () => navigation.navigate("Login");

  if (Platform.OS === "web") {
    return (
      <MobileViewport>
        <>
          {/* Fonts */}
          <link
            href="https://fonts.googleapis.com"
            rel="preconnect"
          />
          <link
            href="https://fonts.gstatic.com"
            crossOrigin=""
            rel="preconnect"
          />
          <link
            href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700&family=Inter:wght@300;400;700&display=swap"
            rel="stylesheet"
          />

          {/* Styles dédiés (pas de Tailwind pour éviter la purge) */}
          <style>{`
            :root {
              --gradient-cyan: #00D4FF;
              --gradient-blue: #4A67FF;
              --matte-graphite: #1A1A1A;
              --graphite-border: #2B2E36;
            }
            .logo-font { font-family: 'Cinzel', serif; }
            .text-glow-white { text-shadow: 0 0 8px rgba(255,255,255,.5), 0 0 20px rgba(255,255,255,.3); }
            .text-glow-cyan { color: #00D4FF; text-shadow: 0 0 8px rgba(0,224,255,.7), 0 0 20px rgba(0,224,255,.5); }
            .cyan-halo {
              position: absolute;
              top: 25%; left: 50%; transform: translate(-50%, -50%);
              width: 70vw; height: 25vh;
              background: radial-gradient(circle, rgba(0,224,255,.15) 0%, rgba(0,224,255,0) 70%);
              filter: blur(60px); pointer-events: none;
            }
            @media (max-width: 768px) {
              .cyan-halo { width: 90vw; height: 30vh; filter: blur(40px); }
            }
            @media (min-width: 1024px) {
              .cyan-halo { width: 60vw; height: 20vh; filter: blur(80px); }
            }
            .button-glow { box-shadow: 0 0 15px rgba(0,224,255,.3), 0 0 25px rgba(74,103,255,.2); }
          `}</style>

          {/* Page container */}
          <div
            style={{
              color: "white",
              WebkitFontSmoothing: "antialiased",
              MozOsxFontSmoothing: "grayscale",
              background: "radial-gradient(ellipse at top, #0D1F3C 0%, #0A0F1E 60%)",
              minHeight: "100vh",
              overflow: "hidden",
              fontFamily: "'Inter','SF Pro Display',sans-serif",
              position: "relative",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "flex-start",
              padding: 24,
            }}
          >
            {/* Halo central */}
            <div className="cyan-halo" />

            {/* Logo centered at ~40% from top */}
            <div style={{
              position: "absolute",
              top: "40%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              textAlign: "center",
              zIndex: 1,
              width: "100%",
              paddingLeft: 24,
              paddingRight: 24,
            }}>
              <img
                src="/logo/logo_final.jpeg"
                alt=""
                style={{
                  width: 280,
                  maxWidth: "85%",
                  height: "auto",
                  display: "block",
                  margin: "0 auto",
                  mixBlendMode: "screen",
                }}
              />
              <SliderDivider />
              <p style={{
                margin: "0 auto",
                fontSize: 16,
                fontStyle: "italic",
                fontFamily: "'Palatino Linotype', Palatino, Georgia, serif",
                color: "rgba(255,255,255,0.6)",
                letterSpacing: "0.02em",
              }}>
                Elevate your team's performance
              </p>
            </div>

            {/* Buttons at bottom */}
            <footer
              style={{
                width: "100%",
                maxWidth: 360,
                paddingBottom: "env(safe-area-inset-bottom, 24px)",
                zIndex: 1,
                position: "absolute",
                bottom: "8%",
                left: "50%",
                transform: "translateX(-50%)",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                <button
                  onClick={handleCreateAccount}
                  className="button-glow"
                  style={{
                    width: "100%",
                    height: 56,
                    borderRadius: 12,
                    background: "linear-gradient(135deg, #00D4FF, #0066FF)",
                    color: "white",
                    fontWeight: 700,
                    fontSize: 14,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    border: "none",
                    cursor: "pointer",
                    transition: "opacity .2s",
                    boxShadow: "0 4px 20px rgba(0,180,255,0.4)",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                >
                  Create Account
                </button>

                <button
                  onClick={handleLogin}
                  style={{
                    width: "100%",
                    height: 56,
                    borderRadius: 12,
                    background: "transparent",
                    border: "1px solid rgba(255,255,255,0.2)",
                    color: "white",
                    fontWeight: 700,
                    fontSize: 14,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    cursor: "pointer",
                    transition: "border-color .2s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.5)")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)")}
                >
                  Log In
                </button>
              </div>
            </footer>
          </div>
        </>
      </MobileViewport>
    );
  }

  // Native fallback (simplifié)
  return (
    <MobileViewport>
      <View
        style={{
          flex: 1,
          backgroundColor: "#0E1528",
          justifyContent: "center",
          alignItems: "center",
          padding: 24,
        }}
      />
    </MobileViewport>
  );
}