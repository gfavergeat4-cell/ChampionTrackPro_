import React, { useEffect, useRef } from 'react';
import { View, Image, Animated, StyleSheet } from 'react-native';

interface AnimatedLogoProps {
  size?: number;
}

export default function AnimatedLogo({ size = 180 }: AnimatedLogoProps) {
  const glowAnim = useRef(new Animated.Value(0)).current;
  const haloAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 2800, useNativeDriver: false }),
        Animated.timing(glowAnim, { toValue: 0, duration: 2800, useNativeDriver: false }),
      ])
    ).start();

    setTimeout(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(haloAnim, { toValue: 1, duration: 2800, useNativeDriver: false }),
          Animated.timing(haloAnim, { toValue: 0, duration: 2800, useNativeDriver: false }),
        ])
      ).start();
    }, 700);
  }, []);

  const innerGlowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.85] });
  const innerGlowScale   = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.05] });
  const haloOpacity      = haloAnim.interpolate({ inputRange: [0, 1], outputRange: [0.08, 0.28] });
  const haloScale        = haloAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.18] });

  return (
    <View style={[styles.container, { width: size * 1.6, height: size * 1.6 }]}>

      <Animated.View
        style={[styles.halo, {
          width: size * 1.5, height: size * 1.5,
          borderRadius: size * 0.75,
          opacity: haloOpacity,
          transform: [{ scale: haloScale }],
        }]}
      />

      <Animated.View
        style={[styles.innerGlow, {
          width: size * 1.0, height: size * 1.0,
          borderRadius: size * 0.5,
          opacity: innerGlowOpacity,
          transform: [{ scale: innerGlowScale }],
        }]}
      />

      <Image
        source={{ uri: '/logo/logo_clean.png' }}
        style={{
          width: size,
          height: size,
          resizeMode: 'contain',
          // @ts-ignore
          mixBlendMode: 'screen',
        }}
      />

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  halo: {
    position: 'absolute',
    backgroundColor: '#00D4FF',
    // @ts-ignore
    filter: 'blur(40px)',
    shadowColor: '#00D4FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 40,
  },
  innerGlow: {
    position: 'absolute',
    backgroundColor: '#00BFFF',
    // @ts-ignore
    filter: 'blur(18px)',
    shadowColor: '#00BFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 20,
  },
});
