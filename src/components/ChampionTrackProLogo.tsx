import React from "react";
import { Platform, Image } from "react-native";

// Logo: public/logo_transparent.png (web: /logo_transparent.png)
const nativeLogoSource = require("../../public/logo_transparent.png");

const webLogoStyle = {
  width: "280px",
  maxWidth: "85%",
  height: "auto",
  display: "block",
  margin: "0 auto",
  mixBlendMode: "screen",
  background: "transparent",
} as const;

const nativeLogoStyle = {
  width: 280,
  height: 80,
  backgroundColor: "transparent",
};

export default function ChampionTrackProLogo() {
  if (Platform.OS === "web") {
    return (
      <img
        src="/logo_transparent.png"
        alt="ChampionTrackPro"
        style={webLogoStyle}
      />
    );
  }

  return (
    <Image
      source={nativeLogoSource}
      style={nativeLogoStyle}
      resizeMode="contain"
      accessibilityLabel="ChampionTrackPro"
    />
  );
}
