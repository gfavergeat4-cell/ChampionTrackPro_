import React from "react";
import { useNavigation } from "@react-navigation/native";
import { Platform, Alert } from "react-native";
import { AthleteHome as StitchAthleteHome } from "../src/stitch_components";
import AthleteHomeExact from "../src/stitch_components/AthleteHome";

export default function HomeTabs() {
  const navigation = useNavigation();

  const handleRespond = (sessionId, eventData) => {
    console.log("Respond clicked for session:", sessionId);
    console.log("Event data being passed:", eventData);
    console.log("Event title:", eventData?.title);
    console.log("Event time:", eventData?.time);
    console.log("Event full data:", JSON.stringify(eventData, null, 2));
    
    // Extraire teamId et trainingId depuis eventData
    // eventData peut être l'objet EventWithResponse complet ou un objet formaté
    const teamId = eventData?.teamId || eventData?.eventData?.teamId;
    const trainingId = sessionId;
    
    if (!teamId || !trainingId) {
      console.error("Missing teamId or trainingId", { teamId, trainingId, eventData });
      Alert.alert("Erreur", "Impossible de déterminer l'équipe ou l'entraînement.");
      return;
    }
    
    // Préparer eventData complet pour le questionnaire
    // Si eventData.eventData existe, c'est l'objet EventWithResponse complet
    const fullEventData = eventData?.eventData || eventData;
    
    console.log("Navigating to Questionnaire with:", {
      teamId,
      trainingId,
      title: fullEventData?.title,
      startDate: fullEventData?.startDate,
      endDate: fullEventData?.endDate,
      startUtc: fullEventData?.startUtc,
      endUtc: fullEventData?.endUtc,
      displayTz: fullEventData?.displayTz,
      questionnaireStatus: fullEventData?.questionnaireStatus
    });
    
    navigation.navigate("Questionnaire", { 
      teamId,
      trainingId,
      eventData: fullEventData, // Passer l'event complet pour avoir toutes les infos
      eventTitle: fullEventData?.title || eventData?.title || "Training Session",
      eventDate: fullEventData?.time || eventData?.time || new Date().toLocaleTimeString(),
      eventStartDate: fullEventData?.startDate || eventData?.startDate,
      eventEndDate: fullEventData?.endDate || eventData?.endDate,
      // Support ancien format (deprecated)
      sessionId,
      eventId: trainingId,
    });
  };

  const handleOpenSession = (sessionId) => {
    console.log("Session clicked:", sessionId);
    // Could navigate to session details if that screen exists
  };

  const handleNavigateToTab = (tabName) => {
    console.log("Navigate to tab:", tabName);
    navigation.navigate(tabName);
  };

  // Use the modified AthleteHome component that loads calendar events
  return (
    <AthleteHomeExact
      onRespond={handleRespond}
      onOpenSession={handleOpenSession}
    />
  );
}