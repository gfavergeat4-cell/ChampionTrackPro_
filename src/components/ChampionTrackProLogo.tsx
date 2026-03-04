import React, { useId } from "react";
import { Platform, View, Text } from "react-native";

export default function ChampionTrackProLogo() {
  const svgId = useId().replace(/:/g, "-");

  if (Platform.OS !== "web") {
    return (
      <View style={{ alignItems: "center" }}>
        <Text style={{ fontSize: 22, fontWeight: "600", color: "#fff" }}>
          ChampionTrack Pro
        </Text>
      </View>
    );
  }

  return (
    <div style={{ textAlign: "center" }}>
      <div
        style={{
          fontSize: 28,
          fontFamily: "'Palatino Linotype', Palatino, Georgia, serif",
          letterSpacing: 2,
          lineHeight: 1.2,
        }}
      >
        <span
          style={{
            color: "#ffffff",
            textShadow:
              "0 0 30px rgba(255,255,255,0.35), 0 0 60px rgba(255,255,255,0.15)",
            fontWeight: 600,
          }}
        >
          ChampionTrack
        </span>
        <span
          style={{
            color: "#00D4FF",
            textShadow:
              "0 0 25px rgba(0,212,255,0.9), 0 0 50px rgba(0,212,255,0.5)",
            fontWeight: 600,
          }}
        >
          Pro
        </span>
      </div>
      <div
        style={{
          fontSize: 10,
          letterSpacing: 7,
          color: "rgba(255,255,255,0.5)",
          marginTop: 6,
          fontFamily: "sans-serif",
          textTransform: "uppercase",
        }}
      >
        The Training Intelligence
      </div>
      <div style={{ marginTop: 12, display: "flex", justifyContent: "center" }}>
        <svg width="80" height="18" viewBox="0 0 80 18">
          <defs>
            <linearGradient id={`sliderGrad-${svgId}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#0044FF" stopOpacity="0.5" />
              <stop offset="50%" stopColor="#00D4FF" stopOpacity="1" />
              <stop offset="100%" stopColor="#0044FF" stopOpacity="0.5" />
            </linearGradient>
            <filter id={`glowFilter-${svgId}`}>
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <line
            x1="4"
            y1="9"
            x2="76"
            y2="9"
            stroke={`url(#sliderGrad-${svgId})`}
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="40" cy="9" r="5" fill="#00D4FF" filter={`url(#glowFilter-${svgId})`} />
          <circle cx="40" cy="9" r="3" fill="#ffffff" />
        </svg>
      </div>
    </div>
  );
}
