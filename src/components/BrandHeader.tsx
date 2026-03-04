import React from "react";

export default function BrandHeader() {
  return (
    <div style={{
      width: "100%",
      textAlign: "center",
      userSelect: "none",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      paddingLeft: "16px",
      paddingRight: "16px",
      paddingTop: "24px",
      position: "relative",
    }}>
      {/* Halo au milieu du logo */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "120px",
          height: "40px",
          background: "radial-gradient(ellipse, rgba(0,224,255,0.15) 0%, transparent 70%)",
          borderRadius: "50%",
          zIndex: 0,
          pointerEvents: "none",
        }}
      />
      <img
        src="/logo/logo.jpeg"
        alt="ChampionTrackPro"
        style={{
          maxWidth: 280,
          width: "100%",
          display: "block",
          margin: "0 auto",
          position: "relative",
          zIndex: 1,
        }}
      />
      <p
        style={{
          marginTop: "8px",
          fontSize: "clamp(0.45rem, 1.2vw, 0.6rem)",
          fontWeight: 300,
          letterSpacing: "0.3em",
          textTransform: "uppercase",
          color: "#FFFFFF",
          textShadow: "0 0 3px rgba(200,220,255,0.3), 0 0 6px rgba(180,200,255,0.2)",
          position: "relative",
          zIndex: 1,
        }}
      >
        THE TRAINING INTELLIGENCE
      </p>
      {/* Trait lumineux sous la tagline */}
      <div
        style={{
          marginTop: "8px",
          width: "45%",
          maxWidth: "150px",
          height: "1.5px",
          marginLeft: "auto",
          marginRight: "auto",
          background: "linear-gradient(90deg, transparent 0%, rgba(0, 224, 255, 0.5) 50%, transparent 100%)",
          borderRadius: "999px",
          position: "relative",
          zIndex: 1,
        }}
      />
    </div>
  );
}

