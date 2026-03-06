import React from "react";
import { Platform, Image } from "react-native";

// Logo: public/logo/logo_final.jpeg (web: /logo/logo_final.jpeg)
const nativeLogoSource = require("../../public/logo/logo_nobackground.png");

const webLogoStyle = {
  width: 280,
  maxWidth: "85%",
  height: "auto",
  display: "block",
  margin: "0 auto",
  mixBlendMode: "screen" as const,
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
        src="/logo/logo_final.jpeg"
        alt=""
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
