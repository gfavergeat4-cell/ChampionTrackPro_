import React from "react";
import { Platform, Image } from "react-native";

// Official logo with transparent background: public/logo-transparent.png
const nativeLogoSource = require("../../public/logo-transparent.png");

const webLogoStyle = {
  width: "280px",
  maxWidth: "80%",
  height: "auto",
  display: "block",
  margin: "0 auto",
} as const;

const nativeLogoStyle = {
  width: 280,
  height: 80,
};

export default function ChampionTrackProLogo() {
  if (Platform.OS === "web") {
    return (
      <img
        src="/logo-transparent.png"
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
