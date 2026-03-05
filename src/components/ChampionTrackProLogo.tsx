import React from "react";
import { Platform, Image } from "react-native";

// Logo: public/logo/logo_nobackground.png (web: /logo/logo_nobackground.png)
const nativeLogoSource = require("../../public/logo/logo_nobackground.png");

const webLogoStyle = {
  width: "420px",
  maxWidth: "90%",
  height: "auto",
  display: "block",
  margin: "0 auto",
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
        src="/logo/logo_nobackground.png"
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
