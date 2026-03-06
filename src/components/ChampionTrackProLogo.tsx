import React from "react";
import { Platform, Image } from "react-native";

const nativeLogoSource = require("../../public/logo/logo_nobackground.png");

const nativeLogoStyle = {
  width: 280,
  height: 80,
  backgroundColor: "transparent",
};

export const ChampionTrackProLogo = ({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) => {
  const fontSize = size === 'sm' ? 20 : size === 'lg' ? 48 : 32;
  const subSize = size === 'sm' ? 8 : size === 'lg' ? 12 : 10;
  const sliderW = size === 'sm' ? 100 : size === 'lg' ? 200 : 150;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
      <div style={{ margin: '0 0 6px 0', fontFamily: "'Palatino Linotype', Palatino, Georgia, serif", fontSize, letterSpacing: 3, lineHeight: 1, fontWeight: 400 }}>
        <span style={{ color: '#e8f4ff', textShadow: '0 0 20px rgba(180,220,255,0.4), 0 0 40px rgba(100,180,255,0.2)' }}>CHAMPIONTRACK</span>
        <span style={{ color: '#00c8ff', textShadow: '0 0 15px rgba(0,200,255,0.7), 0 0 30px rgba(0,150,255,0.4)' }}>PRO</span>
      </div>
      <div style={{ margin: '0 0 18px 0', fontFamily: "'Helvetica Neue', Arial, sans-serif", fontSize: subSize, fontWeight: 300, textTransform: 'uppercase', letterSpacing: 6, color: 'rgba(200,230,255,0.6)' }}>
        THE TRAINING INTELLIGENCE
      </div>
      <div style={{ position: 'relative', width: sliderW, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ position: 'absolute', width: '100%', height: 3, borderRadius: 2, background: 'linear-gradient(to right, rgba(0,200,255,0.3), #00c8ff, rgba(0,80,255,0.5))', boxShadow: '0 0 6px rgba(0,200,255,0.5)' }} />
        <div style={{ position: 'absolute', width: 13, height: 13, borderRadius: '50%', backgroundColor: '#00d4ff', boxShadow: '0 0 8px #fff, 0 0 16px #00d4ff, 0 0 28px rgba(0,200,255,0.6)' }} />
      </div>
    </div>
  );
};

export default function ChampionTrackProLogoDefault({ size }: { size?: 'sm' | 'md' | 'lg' } = {}) {
  if (Platform.OS === "web") {
    return <ChampionTrackProLogo size={size} />;
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
