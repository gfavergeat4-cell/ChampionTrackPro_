import React, { useState, useRef, useEffect } from "react";
import { View, Text, Pressable, StyleSheet, Platform, ScrollView, Alert, SafeAreaView } from "react-native";
import { LinearGradient } from 'expo-linear-gradient';
import { tokens } from "../theme/tokens";
import { DateTime } from "luxon";
import { EventWithResponse } from "../lib/scheduleQueries";
import { computeQuestionnaireStatus } from "../utils/questionnaire";

interface QuestionnaireScreenProps {
  eventData?: EventWithResponse | {
    id: string;
    title: string;
    time?: string;
    startDate?: Date;
    endDate?: Date;
    startMillis?: number;
    endMillis?: number;
    displayTz?: string;
    questionnaireStatus?: 'not_open_yet' | 'open' | 'closed' | 'completed';
  };
  onSubmit?: (responses: any) => void;
  onBack?: () => void;
}

interface SliderProps {
  title: string;
  description: string;
  value: number;
  onValueChange: (value: number) => void;
}

const Slider: React.FC<SliderProps> = ({ title, description, value, onValueChange }) => {
  return (
    <View style={styles.sliderContainer}>
      <Text style={styles.sliderTitle}>{title}</Text>
      <Text style={styles.sliderDescription}>{description}</Text>
      
      <View style={styles.sliderTrack}>
        <View style={[styles.sliderFill, { width: `${value}%` }]} />
        <View style={[styles.sliderThumb, { left: `${value}%` }]} />
      </View>
      
      <View style={styles.sliderControls}>
        <Pressable
          style={styles.sliderButton}
          onPress={() => onValueChange(Math.max(0, value - 10))}
        >
          <Text style={styles.sliderButtonText}>-</Text>
        </Pressable>
        <Pressable
          style={styles.sliderButton}
          onPress={() => onValueChange(Math.min(100, value + 10))}
        >
          <Text style={styles.sliderButtonText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
};

export default function QuestionnaireScreen({ 
  eventData, 
  onSubmit, 
  onBack 
}: QuestionnaireScreenProps) {
  const [responses, setResponses] = useState({
    averageIntensity: 50,
    highIntensity: 50,
    cardiacImpact: 50,
    muscularImpact: 50,
    fatigue: 50,
    technique: 50,
    tactics: 50,
    dynamism: 50,
    nervousness: 50,
    concentration: 50,
    confidence: 50,
    wellBeing: 50,
    sleepQuality: 50
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  // Vérifier l'accès au questionnaire
  const canAccess = (() => {
    if (!eventData) return false;
    
    // Si on a questionnaireStatus, l'utiliser directement
    if ('questionnaireStatus' in eventData) {
      return eventData.questionnaireStatus === 'open';
    }
    
    // Sinon, calculer depuis endMillis
    const endMillis = eventData.endMillis ?? (eventData.endDate?.getTime() ?? null);
    if (!endMillis) return false;
    
    const hasCompleted = false; // On suppose pas complété si on arrive ici
    const status = computeQuestionnaireStatus(endMillis, hasCompleted, DateTime.utc());
    return status === 'open';
  })();

  // Formater les horaires pour l'affichage
  const formatTimeRange = () => {
    if (!eventData) return '2:00 PM - 3:30 PM';
    
    const displayTz = eventData.displayTz || 'Europe/Paris';
    
    // Essayer d'utiliser startMillis/endMillis d'abord
    if (eventData.startMillis && eventData.endMillis) {
      const start = DateTime.fromMillis(eventData.startMillis, { zone: 'utc' }).setZone(displayTz);
      const end = DateTime.fromMillis(eventData.endMillis, { zone: 'utc' }).setZone(displayTz);
      return `${start.toFormat('HH:mm')} - ${end.toFormat('HH:mm')}`;
    }
    
    // Sinon utiliser startDate/endDate
    if (eventData.startDate && eventData.endDate) {
      const start = DateTime.fromJSDate(eventData.startDate, { zone: 'utc' }).setZone(displayTz);
      const end = DateTime.fromJSDate(eventData.endDate, { zone: 'utc' }).setZone(displayTz);
      return `${start.toFormat('HH:mm')} - ${end.toFormat('HH:mm')}`;
    }
    
    // Fallback sur time si présent
    if ('time' in eventData && eventData.time) {
      return eventData.time;
    }
    
    return '2:00 PM - 3:30 PM';
  };

  const handleSliderChange = (key: string, value: number) => {
    setResponses(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;

    // Vérifier à nouveau avant de soumettre
    if (!canAccess) {
      Alert.alert(
        "Questionnaire non disponible",
        "Le questionnaire n'est pas encore disponible ou a expiré. Il est accessible 30 minutes après la fin de l'entraînement, pendant 5 heures.",
        [{ text: "OK", onPress: onBack }]
      );
      return;
    }
    
    try {
      setIsSubmitting(true);
      await Promise.resolve(onSubmit?.(responses));
      setShowConfirmation(true);
    } catch (submitError) {
      console.error("[QUESTIONNAIRE][SUBMIT][ERROR]", submitError);
      Alert.alert(
        "Erreur",
        "Impossible d'enregistrer vos réponses. Veuillez réessayer."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Afficher un message si le questionnaire n'est pas accessible
  useEffect(() => {
    if (!canAccess && eventData) {
      const endMillis = 'endMillis' in eventData ? eventData.endMillis : (eventData.endDate?.getTime() ?? null);
      if (endMillis) {
        const hasCompleted = false;
        const status = computeQuestionnaireStatus(endMillis, hasCompleted, DateTime.utc());
        
        if (status === 'not_open_yet') {
          const openAt = DateTime.fromMillis(endMillis, { zone: 'utc' })
            .plus({ minutes: 30 })
            .setZone(eventData.displayTz || 'Europe/Paris');
          Alert.alert(
            "Questionnaire non disponible",
            `Le questionnaire sera disponible à ${openAt.toFormat('HH:mm')} (30 minutes après la fin de l'entraînement).`,
            [{ text: "OK", onPress: onBack }]
          );
        } else if (status === 'closed') {
          Alert.alert(
            "Questionnaire expiré",
            "Le délai pour répondre au questionnaire est dépassé. Il était disponible pendant 5 heures après la fin de l'entraînement.",
            [{ text: "OK", onPress: onBack }]
          );
        }
      }
    }
  }, [canAccess, eventData]);

  useEffect(() => {
    if (!showConfirmation) return;

    const timeout = setTimeout(() => {
      setShowConfirmation(false);
      onBack?.();
    }, 2000);

    return () => clearTimeout(timeout);
  }, [showConfirmation, onBack]);

  return (
    <SafeAreaView style={styles.screen}>
      <LinearGradient colors={[tokens.colors.bg, tokens.colors.bgSecondary]} style={styles.gradient}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={onBack}>
            <Text style={styles.backArrow}>←</Text>
          </Pressable>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>{eventData?.title || 'Practice'}</Text>
            <Text style={styles.headerTime}>{formatTimeRange()}</Text>
          </View>
        </View>

        {!canAccess ? (
          <View style={styles.disabledContainer}>
            <Text style={styles.disabledText}>
              Le questionnaire n'est pas encore disponible ou a expiré.
            </Text>
          </View>
        ) : (
          <ScrollView
            ref={scrollViewRef}
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={false}
          >
        {/* Intensity Sliders */}
        <Slider
          title="Average Intensity"
          description="Average of all effort intensities."
          value={responses.averageIntensity}
          onValueChange={(value) => handleSliderChange('averageIntensity', value)}
        />

        <Slider
          title="High Intensity"
          description="Peak effort during the session."
          value={responses.highIntensity}
          onValueChange={(value) => handleSliderChange('highIntensity', value)}
        />

        <Slider
          title="Cardiac Impact"
          description="Cardiovascular load and heart rate response."
          value={responses.cardiacImpact}
          onValueChange={(value) => handleSliderChange('cardiacImpact', value)}
        />

        <Slider
          title="Muscular Impact"
          description="Muscle fatigue and strength requirements."
          value={responses.muscularImpact}
          onValueChange={(value) => handleSliderChange('muscularImpact', value)}
        />

        <Slider
          title="Fatigue"
          description="Overall fatigue level after the session."
          value={responses.fatigue}
          onValueChange={(value) => handleSliderChange('fatigue', value)}
        />

        {/* Technical Aspects */}
        <Slider
          title="Technique"
          description="Technical execution quality."
          value={responses.technique}
          onValueChange={(value) => handleSliderChange('technique', value)}
        />

        <Slider
          title="Tactics"
          description="Strategic and tactical performance."
          value={responses.tactics}
          onValueChange={(value) => handleSliderChange('tactics', value)}
        />

        <Slider
          title="Dynamism"
          description="Energy and movement quality."
          value={responses.dynamism}
          onValueChange={(value) => handleSliderChange('dynamism', value)}
        />

        {/* Mental State */}
        <Slider
          title="Nervousness"
          description="Level of anxiety or nervousness."
          value={responses.nervousness}
          onValueChange={(value) => handleSliderChange('nervousness', value)}
        />

        <Slider
          title="Concentration"
          description="Focus and attention during the session."
          value={responses.concentration}
          onValueChange={(value) => handleSliderChange('concentration', value)}
        />

        <Slider
          title="Confidence"
          description="Self-confidence and belief in abilities."
          value={responses.confidence}
          onValueChange={(value) => handleSliderChange('confidence', value)}
        />

        {/* Well-being */}
        <Slider
          title="Well-being"
          description="Overall physical and mental well-being."
          value={responses.wellBeing}
          onValueChange={(value) => handleSliderChange('wellBeing', value)}
        />

        <Slider
          title="Sleep Quality"
          description="Quality of sleep before the session."
          value={responses.sleepQuality}
          onValueChange={(value) => handleSliderChange('sleepQuality', value)}
        />

            {/* Submit button as final block */}
            <View style={styles.submitContainer}>
              <Pressable
                style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
                onPress={handleSubmit}
                disabled={isSubmitting}
              >
                <LinearGradient
                  colors={tokens.gradients.primary}
                  style={styles.submitButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.submitButtonText}>
                    {isSubmitting ? "Sending..." : "Submit"}
                  </Text>
                </LinearGradient>
              </Pressable>
            </View>
          </ScrollView>
        )}

        {showConfirmation && (
          <View style={styles.confirmationOverlay}>
            <View style={styles.confirmationCard}>
              <View style={styles.confirmationIconContainer}>
                <LinearGradient
                  colors={['#00FFC2', '#00C16A']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.confirmationCheckmark}
                >
                  <Text style={styles.confirmationCheckmarkText}>✓</Text>
                </LinearGradient>
              </View>
              <Text style={styles.confirmationTitle}>Réponses validées</Text>
              <Text style={styles.confirmationSubtitle}>Redirection vers votre tableau de bord...</Text>
            </View>
          </View>
        )}
      </LinearGradient>
    </SafeAreaView>
  );
}

        <View style={styles.confirmationOverlay}>
          <View style={styles.confirmationCard}>
            <Text style={styles.confirmationTitle}>Réponses validées</Text>
            <Text style={styles.confirmationSubtitle}>Merci, ton feedback est enregistré.</Text>
          </View>
        </View>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: tokens.colors.bg,
  },
  gradient: {
    flex: 1,
    paddingTop: Platform.OS === 'web' ? 60 : 0,
  },
  
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.xl,
    paddingTop: tokens.spacing.xl,
    paddingBottom: tokens.spacing.lg,
  },
  
  backButton: {
    marginRight: tokens.spacing.lg,
    padding: tokens.spacing.sm,
  },
  
  backArrow: {
    fontSize: tokens.fontSizes.xl,
    color: tokens.colors.text,
    fontFamily: tokens.typography.ui,
  },
  
  headerContent: {
    flex: 1,
  },
  
  headerTitle: {
    fontSize: tokens.fontSizes.xxl,
    fontWeight: tokens.fontWeights.bold,
    color: tokens.colors.text,
    fontFamily: tokens.typography.ui,
    marginBottom: tokens.spacing.xs,
  },
  
  headerTime: {
    fontSize: tokens.fontSizes.md,
    color: tokens.colors.textSecondary,
    fontFamily: tokens.typography.ui,
  },
  
  scrollView: {
    flex: 1,
  },
  
  scrollContent: {
    paddingHorizontal: tokens.spacing.xl,
    paddingBottom: 140,
    paddingTop: tokens.spacing.xl,
    flexGrow: 1,
  },
  
  // Slider Styles
  sliderContainer: {
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radii.lg,
    padding: tokens.spacing.xl,
    marginBottom: tokens.spacing.lg,
    borderWidth: 1,
    borderColor: tokens.colors.surfaceHover,
    ...tokens.shadows.card,
  },
  
  sliderTitle: {
    fontSize: tokens.fontSizes.lg,
    fontWeight: tokens.fontWeights.semibold,
    color: tokens.colors.text,
    fontFamily: tokens.typography.ui,
    marginBottom: tokens.spacing.xs,
  },
  
  sliderDescription: {
    fontSize: tokens.fontSizes.sm,
    color: tokens.colors.textSecondary,
    fontFamily: tokens.typography.ui,
    marginBottom: tokens.spacing.lg,
  },
  
  sliderTrack: {
    height: 8,
    backgroundColor: tokens.colors.surfaceHover,
    borderRadius: tokens.radii.sm,
    position: 'relative',
    marginBottom: tokens.spacing.lg,
  },
  
  sliderFill: {
    height: '100%',
    backgroundColor: tokens.colors.accentCyan,
    borderRadius: tokens.radii.sm,
  },
  
  sliderThumb: {
    position: 'absolute',
    top: -6,
    width: 20,
    height: 20,
    backgroundColor: tokens.colors.accentCyan,
    borderRadius: tokens.radii.full,
    ...tokens.shadows.glow,
    transform: [{ translateX: -10 }],
  },
  
  sliderControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  
  sliderButton: {
    width: 32,
    height: 32,
    borderRadius: tokens.radii.full,
    backgroundColor: tokens.colors.surfaceHover,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  sliderButtonText: {
    fontSize: tokens.fontSizes.lg,
    color: tokens.colors.text,
    fontFamily: tokens.typography.ui,
    fontWeight: tokens.fontWeights.bold,
  },
  
  // Submit Button
  submitButton: {
    borderRadius: tokens.radii.lg,
    overflow: 'hidden',
    marginTop: tokens.spacing.xl,
    ...tokens.shadows.button,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  
  submitButtonGradient: {
    paddingVertical: tokens.spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  submitButtonText: {
    fontSize: tokens.fontSizes.lg,
    fontWeight: tokens.fontWeights.bold,
    color: tokens.colors.text,
    fontFamily: tokens.typography.ui,
    letterSpacing: 1,
  },
  
  submitContainer: {
    marginTop: -16,
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: tokens.spacing.xl,
  },
  disabledText: {
    fontSize: tokens.fontSizes.md,
    color: tokens.colors.textSecondary,
    textAlign: 'center',
    fontFamily: tokens.typography.ui,
  },
  confirmationOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(10, 15, 27, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: tokens.spacing.xl,
  },
  confirmationCard: {
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radii.xl,
    padding: tokens.spacing.xxl,
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 194, 0.35)',
    ...tokens.shadows.card,
  },
  confirmationIconContainer: {
    marginBottom: tokens.spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmationCheckmark: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00FFC2',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 40,
    elevation: 15,
    overflow: 'hidden',
  },
  confirmationCheckmarkText: {
    color: '#FFFFFF',
    fontSize: 40,
    fontWeight: '900',
    lineHeight: 48,
  },
  confirmationTitle: {
    fontSize: tokens.fontSizes.xxl,
    fontWeight: tokens.fontWeights.bold,
    color: tokens.colors.text,
    fontFamily: tokens.typography.ui,
    marginBottom: tokens.spacing.sm,
    textAlign: 'center',
  },
  confirmationSubtitle: {
    fontSize: tokens.fontSizes.md,
    color: tokens.colors.textSecondary,
    fontFamily: tokens.typography.ui,
    textAlign: 'center',
  },
});







