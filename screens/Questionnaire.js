/**
 * screens/Questionnaire.js
 * Écran unique (scroll) avec curseurs EVA 0–100 + question douleur.
 * Sauvegarde dans: teams/{teamId}/trainings/{trainingId}/responses/{uid}
 *
 * Attendu via navigation:
 *   route.params = { 
 *     teamId?: string, 
 *     trainingId?: string, 
 *     eventId?: string, // deprecated, utiliser trainingId
 *     sessionId?: string, // deprecated, utiliser trainingId
 *     templateId?: string,
 *     eventData?: EventWithResponse
 *   }
 */
import React, { useEffect, useLayoutEffect, useMemo, useState } from "react";
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from "react-native";
import Slider from "@react-native-community/slider";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";
import { saveQuestionnaireResponse } from "../src/lib/responses";
import { computeQuestionnaireStatus, getQuestionnaireWindowFromEnd } from "../src/utils/questionnaire";
import { DateTime } from "luxon";

function SliderRow({ labelLeft, labelRight, value, onChange }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowHeader}>
        <Text style={styles.labelLeft}>{labelLeft}</Text>
        <Text style={styles.labelRight}>{labelRight}</Text>
      </View>
      <View style={styles.scaleRow}>
        <Text style={styles.scaleEdge}>-</Text>
        <Slider
          style={{ flex: 1, height: 40 }}
          minimumValue={0}
          maximumValue={100}
          step={1}
          value={value}
          onValueChange={onChange}
        />
        <Text style={styles.scaleEdge}>+</Text>
      </View>
      <Text style={styles.valueText}>{value}</Text>
    </View>
  );
}

export default function QuestionnaireScreen({ route, navigation }) {
  const uid = auth?.currentUser?.uid;
  const params = route?.params || {};
  // Support ancien format (eventId, sessionId) et nouveau format (trainingId, eventData)
  const trainingId = params.trainingId || params.eventId || params.sessionId;
  const teamId = params.teamId;
  const eventData = params.eventData;
  const templateId = params.templateId || "sRPE";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pain, setPain] = useState(null); // true / false / null
  const [canAccess, setCanAccess] = useState(false);
  const [trainingInfo, setTrainingInfo] = useState(null);

  const [values, setValues] = useState({
    // PHYSIQUE
    intensiteMoyenne: 50,
    hautesIntensites: 50,
    impactCardiaque: 50,
    impactMusculaire: 50,
    fatigue: 50,
    // TECH/TACTIQUE/MENTAL
    technique: 50,
    tactique: 50,
    dynamisme: 50,
    nervosite: 50,
    concentration: 50,
    confiance: 50,
    bienEtre: 50,
    sommeil: 50,
  });

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!teamId || !trainingId || !uid) {
          if (mounted) {
            Alert.alert("Erreur", "Paramètres manquants (équipe/entraînement/utilisateur).");
            setLoading(false);
          }
          return;
        }

        // Vérifier et créer le membership si nécessaire
        try {
          const { resolveAthleteTeamAndMembership } = await import("../src/lib/resolveAthleteTeam");
          const { teamId: resolvedTeamId, membershipExists } = await resolveAthleteTeamAndMembership(
            uid,
            auth?.currentUser?.email || null,
            auth?.currentUser?.displayName || null,
            true // autoCreateMembership
          );
          console.log("[QUESTIONNAIRE] Membership check", {
            teamId: resolvedTeamId,
            membershipExists,
            requestedTeamId: teamId,
            match: resolvedTeamId === teamId,
          });
          
          // Vérifier que le teamId correspond
          if (resolvedTeamId && resolvedTeamId !== teamId) {
            console.warn("[QUESTIONNAIRE] TeamId mismatch", {
              resolvedTeamId,
              requestedTeamId: teamId,
            });
          }
        } catch (membershipError: any) {
          console.error("[QUESTIONNAIRE] Membership check failed", {
            error: membershipError,
            code: membershipError?.code,
            message: membershipError?.message,
          });
          // Ne pas bloquer si la vérification du membership échoue
        }

        // Récupérer les informations du training
        const trainingRef = doc(db, "teams", teamId, "trainings", trainingId);
        const trainingSnap = await getDoc(trainingRef);
        if (!trainingSnap.exists()) {
          if (mounted) {
            Alert.alert("Erreur", "Entraînement non trouvé.");
            setLoading(false);
          }
          return;
        }

        const trainingData = trainingSnap.data();
        const endUtc = trainingData?.endUtc;
        const endMillisFromFirestore = endUtc?.toMillis?.() ?? null;

        // Utiliser les données de eventData si disponibles (plus fiables)
        // eventData devrait contenir toutes les infos depuis EventWithResponse
        const title = eventData?.title || trainingData?.title || "Entraînement";
        const startUtc = eventData?.startUtc || trainingData?.startUtc;
        const endUtcFromEvent = eventData?.endUtc || endUtc;
        const displayTzFromEvent = eventData?.displayTz || trainingData?.displayTz || "Europe/Paris";
        // Utiliser endMillis depuis eventData en priorité
        const endMillisToCheck = eventData?.endMillis || 
                                 (eventData?.endUtc?.toMillis ? eventData.endUtc.toMillis() : null) ||
                                 endMillisFromFirestore;

        if (mounted) {
          setTrainingInfo({
            title,
            startUtc: startUtc || trainingData?.startUtc,
            endUtc: endUtcFromEvent || endUtc,
            displayTz: displayTzFromEvent,
            endMillis: endMillisToCheck || endMillisFromFirestore,
          });
        }

        console.log("[QUESTIONNAIRE] Training info loaded", {
          trainingId,
          title,
          eventDataTitle: eventData?.title,
          trainingDataTitle: trainingData?.title,
          eventDataEndMillis: eventData?.endMillis,
          endMillisFromFirestore,
          endMillisToCheck,
          displayTz: displayTzFromEvent,
          questionnaireStatus: eventData?.questionnaireStatus
        });

        // Vérifier l'accès au questionnaire
        if (endMillisToCheck) {
          const now = DateTime.utc();
          // Vérifier si déjà complété
          const responseRef = doc(db, "teams", teamId, "trainings", trainingId, "responses", uid);
          let responseSnap;
          try {
            responseSnap = await getDoc(responseRef);
          } catch (e) {
            console.warn("Load response failed:", e);
          }

          const hasCompleted = responseSnap?.exists() && responseSnap.data()?.status === 'completed';
          const status = computeQuestionnaireStatus(endMillisToCheck, hasCompleted, now);

          console.log("[QUESTIONNAIRE] Access check", {
            trainingId,
            title,
            endMillis: endMillisToCheck,
            endUtc: endUtcFromEvent?.toMillis?.(),
            now: now.toMillis(),
            hasCompleted,
            status,
            canAccess: status === 'open',
            questionnaireStatusFromEvent: eventData?.questionnaireStatus
          });

          if (mounted) {
            // Vérifier si l'entraînement est terminé
            const nowMillisCheck = now.toMillis();
            const isTrainingFinished = endMillisToCheck && endMillisToCheck <= nowMillisCheck;
            
            // Bloquer l'accès si le statut n'est pas 'open' ou si l'entraînement n'est pas terminé
            // Vérifier aussi le questionnaireStatus depuis eventData si disponible
            const questionnaireStatusFromEvent = eventData?.questionnaireStatus;
            const finalStatus = questionnaireStatusFromEvent || status;
            // L'accès n'est autorisé que si l'entraînement est terminé ET le statut est 'open'
            const canAccessFinal = isTrainingFinished && finalStatus === 'open' && status === 'open';
            
            setCanAccess(canAccessFinal);
            
            console.log("[QUESTIONNAIRE] Final access decision", {
              status,
              questionnaireStatusFromEvent,
              finalStatus,
              canAccessFinal,
              endMillis: endMillisToCheck,
              nowMillis: nowMillisCheck,
              isTrainingFinished
            });
            
            // Rediriger silencieusement si l'accès est refusé (sans afficher d'alerte)
            if (!canAccessFinal) {
              console.log("[QUESTIONNAIRE] Access denied, redirecting silently", {
                status,
                finalStatus,
                isTrainingFinished,
                endMillis: endMillisToCheck,
                nowMillis: nowMillisCheck,
              });
              // Mettre à jour l'état pour déclencher la redirection dans useLayoutEffect
              if (mounted) {
                setLoading(false);
                setCanAccess(false);
              }
              return;
            }

            // Charger la réponse existante si elle existe (seulement si on peut accéder)
            if (canAccessFinal && responseSnap?.exists() && mounted) {
              const data = responseSnap.data();
              if (data?.values) setValues((prev) => ({ ...prev, ...data.values }));
              if (typeof data?.pain === "boolean") setPain(data.pain);
              if (typeof data?.physicalPain === "boolean") setPain(data.physicalPain);
            }
          }
        } else {
          if (mounted) {
            setCanAccess(false);
            console.log("[QUESTIONNAIRE] No endMillis, redirecting silently", {
              trainingId,
              eventDataEndMillis: eventData?.endMillis,
              endUtcFromFirestore: endUtc?.toMillis?.(),
              eventDataEndUtc: eventData?.endUtc?.toMillis?.(),
              trainingData: trainingData
            });
            // Rediriger silencieusement sans afficher d'alerte
            if (navigation?.goBack) {
              setTimeout(() => {
                navigation.goBack();
              }, 100);
            }
            setLoading(false);
          }
          return;
        }
      } catch (e) {
        console.error("Load training failed:", e);
        if (mounted) {
          // Rediriger silencieusement en cas d'erreur
          console.log("[QUESTIONNAIRE] Error loading training, redirecting silently", e);
          if (navigation?.goBack) {
            setTimeout(() => {
              navigation.goBack();
            }, 100);
          }
          setLoading(false);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [teamId, trainingId, uid, navigation]);

  const sections = useMemo(() => ([
    {
      title: "PHYSIQUE",
      rows: [
        { key: "intensiteMoyenne", labelLeft: "INTENSITÉ MOYENNE", labelRight: "Moyenne des intensités de tous mes efforts" },
        { key: "hautesIntensites", labelLeft: "HAUTES INTENSITÉS", labelRight: "Moyenne des intensités les plus intenses" },
        { key: "impactCardiaque", labelLeft: "IMPACT CARDIAQUE", labelRight: "Moyenne des sollicitations cardiaques" },
        { key: "impactMusculaire", labelLeft: "IMPACT MUSCULAIRE", labelRight: "Moyenne des sollicitations musculaires" },
        { key: "fatigue", labelLeft: "FATIGUE", labelRight: "Diminution des ressources" },
      ],
    },
    {
      title: "TECHNIQUE / TACTIQUE",
      rows: [
        { key: "technique", labelLeft: "TECHNIQUE", labelRight: "Maîtrise des gestes, des mouvements…" },
        { key: "tactique", labelLeft: "TACTIQUE", labelRight: "Pertinence des décisions, des stratégies…" },
        { key: "dynamisme", labelLeft: "DYNAMISME", labelRight: "Rapidité de réaction, de mise en action" },
        { key: "nervosite", labelLeft: "NERVOSITÉ", labelRight: "Irritation, impatience, agacement…" },
      ],
    },
    {
      title: "MENTAL",
      rows: [
        { key: "concentration", labelLeft: "CONCENTRATION", labelRight: "Capacité à affronter les situations" },
        { key: "confiance", labelLeft: "CONFIANCE EN SOI", labelRight: "Croyances en mes capacités" },
        { key: "bienEtre", labelLeft: "BIEN-ÊTRE", labelRight: "Personnel, relationnel" },
        { key: "sommeil", labelLeft: "SOMMEIL", labelRight: "Qualité des dernières 24h" },
      ],
    },
  ]), []);

  const onChange = (k, v) => setValues((prev) => ({ ...prev, [k]: Math.round(v) }));

  const onSubmit = async () => {
    if (!uid || !teamId || !trainingId) {
      Alert.alert("Erreur", "Paramètres manquants (utilisateur/équipe/entraînement).");
      return;
    }

    // Vérifier à nouveau l'accès avant de soumettre
    const endMillisToCheck = eventData?.endMillis || 
                              eventData?.endUtc?.toMillis?.() || 
                              trainingInfo?.endMillis;
    
    if (!canAccess && endMillisToCheck) {
      const now = DateTime.utc();
      const responseRef = doc(db, "teams", teamId, "trainings", trainingId, "responses", uid);
      let responseSnap;
      try {
        responseSnap = await getDoc(responseRef);
      } catch (e) {
        console.warn("Check response failed:", e);
      }
      const hasCompleted = responseSnap?.exists() && responseSnap.data()?.status === 'completed';
      const status = computeQuestionnaireStatus(endMillisToCheck, hasCompleted, now);
      
      if (status !== 'open') {
        Alert.alert(
          "Questionnaire non disponible",
          "Le questionnaire n'est plus disponible. Veuillez rafraîchir la page."
        );
        return;
      }
      // Si le statut est maintenant 'open', autoriser la soumission
      setCanAccess(true);
    }

    try {
      setSaving(true);
      
      // Utiliser saveQuestionnaireResponse qui met à jour avec status: 'completed'
      await saveQuestionnaireResponse(
        teamId,
        trainingId,
        uid,
        {
          ...values,
          physicalPain: pain === true ? true : pain === false ? false : null,
          pain: pain === true ? true : pain === false ? false : null, // Compatibilité
          templateId,
        }
      );

      Alert.alert("Enregistré ✅", "Merci, ta réponse a bien été sauvegardée.");
      if (navigation?.goBack) navigation.goBack();
    } catch (e: any) {
      console.error("[QUESTIONNAIRE] Submit failed", {
        error: e,
        code: e?.code,
        message: e?.message,
        teamId,
        trainingId,
        uid,
      });
      
      // Message d'erreur plus détaillé
      let errorMessage = "Impossible d'enregistrer. Réessaie.";
      if (e?.code === "permission-denied") {
        errorMessage = "Erreur de permissions. Vérifie que tu es bien membre de l'équipe et que le questionnaire est toujours disponible.";
      } else if (e?.message) {
        errorMessage = `Erreur: ${e.message}`;
      }
      
      Alert.alert("Erreur", errorMessage);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator />
        <Text style={{ marginTop: 8 }}>Chargement…</Text>
      </SafeAreaView>
    );
  }

  // Formater les horaires pour l'affichage
  // Prioriser eventData car il vient directement de l'écran Home (plus fiable)
  const formatTimeRange = () => {
    const displayTz = eventData?.displayTz || trainingInfo?.displayTz || 'Europe/Paris';
    
    // Utiliser eventData en priorité (données depuis l'écran Home)
    if (eventData) {
      // Essayer d'utiliser startUtc/endUtc (Timestamp Firestore) en priorité
      if (eventData.startUtc && eventData.endUtc) {
        try {
          const startUtc = eventData.startUtc;
          const endUtc = eventData.endUtc;
          const startMillis = startUtc.toMillis ? startUtc.toMillis() : (typeof startUtc === 'number' ? startUtc : null);
          const endMillis = endUtc.toMillis ? endUtc.toMillis() : (typeof endUtc === 'number' ? endUtc : null);
          
          if (startMillis && endMillis) {
            const start = DateTime.fromMillis(startMillis, { zone: 'utc' }).setZone(displayTz);
            const end = DateTime.fromMillis(endMillis, { zone: 'utc' }).setZone(displayTz);
            return `${start.toFormat('HH:mm')} - ${end.toFormat('HH:mm')}`;
          }
        } catch (e) {
          console.error("[QUESTIONNAIRE] Error formatting time range from eventData.startUtc/endUtc", e);
        }
      }
      
      // Fallback sur startDate/endDate (JS Date)
      if (eventData.startDate && eventData.endDate) {
        try {
          const start = DateTime.fromJSDate(eventData.startDate, { zone: 'utc' })
            .setZone(displayTz);
          const end = DateTime.fromJSDate(eventData.endDate, { zone: 'utc' })
            .setZone(displayTz);
          return `${start.toFormat('HH:mm')} - ${end.toFormat('HH:mm')}`;
        } catch (e) {
          console.error("[QUESTIONNAIRE] Error formatting time range from eventData.startDate/endDate", e);
        }
      }
      
      // Fallback sur startMillis/endMillis
      if (eventData.startMillis && eventData.endMillis) {
        try {
          const start = DateTime.fromMillis(eventData.startMillis, { zone: 'utc' }).setZone(displayTz);
          const end = DateTime.fromMillis(eventData.endMillis, { zone: 'utc' }).setZone(displayTz);
          return `${start.toFormat('HH:mm')} - ${end.toFormat('HH:mm')}`;
        } catch (e) {
          console.error("[QUESTIONNAIRE] Error formatting time range from eventData.startMillis/endMillis", e);
        }
      }
    }
    
    // Fallback sur trainingInfo (données depuis Firestore)
    if (trainingInfo) {
      const startUtc = trainingInfo.startUtc;
      const endUtc = trainingInfo.endUtc;
      
      if (startUtc && endUtc) {
        try {
          const start = DateTime.fromMillis(startUtc.toMillis(), { zone: 'utc' }).setZone(displayTz);
          const end = DateTime.fromMillis(endUtc.toMillis(), { zone: 'utc' }).setZone(displayTz);
          return `${start.toFormat('HH:mm')} - ${end.toFormat('HH:mm')}`;
        } catch (e) {
          console.error("[QUESTIONNAIRE] Error formatting time range from trainingInfo", e);
        }
      }
    }
    
    return '';
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator />
        <Text style={{ marginTop: 8 }}>Chargement…</Text>
      </SafeAreaView>
    );
  }

  // Rediriger silencieusement si l'accès est refusé (sans afficher d'écran d'erreur)
  // Utiliser useLayoutEffect pour rediriger avant le premier rendu
  useLayoutEffect(() => {
    if (!loading && !canAccess) {
      console.log("[QUESTIONNAIRE] Access denied, redirecting silently", { canAccess, loading });
      if (navigation?.goBack) {
        // Rediriger immédiatement sans afficher d'écran d'erreur
        navigation.goBack();
      }
    }
  }, [loading, canAccess, navigation]);

  // Ne rien afficher si l'accès est refusé - la redirection se fait dans useEffect
  // Retourner null pour éviter tout rendu
  if (!canAccess) {
    return null;
  }

  // Utiliser eventData si disponible pour le titre (plus fiable)
  // Prioriser eventData car il vient directement de l'écran Home
  const displayTitle = eventData?.title || trainingInfo?.title || "QUESTIONNAIRE";
  const timeRange = formatTimeRange();

  console.log("[QUESTIONNAIRE] Display info", {
    displayTitle,
    timeRange,
    eventDataTitle: eventData?.title,
    trainingInfoTitle: trainingInfo?.title,
    eventDataStartDate: eventData?.startDate,
    eventDataEndDate: eventData?.endDate,
    eventDataStartUtc: eventData?.startUtc?.toMillis?.(),
    eventDataEndUtc: eventData?.endUtc?.toMillis?.(),
    canAccess
  });

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>
          {displayTitle}
        </Text>
        {timeRange ? (
          <>
            <Text style={styles.subtitle}>
              {timeRange}
            </Text>
            <Text style={[styles.subtitle, { marginTop: 4 }]}>
              EVA de 0 à 100 — fais glisser le curseur.
            </Text>
          </>
        ) : (
          <Text style={styles.subtitle}>
            EVA de 0 à 100 — fais glisser le curseur.
          </Text>
        )}

        {sections.map((sec) => (
          <View key={sec.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{sec.title}</Text>
            {sec.rows.map((r) => (
              <SliderRow
                key={r.key}
                labelLeft={r.labelLeft}
                labelRight={r.labelRight}
                value={values[r.key]}
                onChange={(v) => onChange(r.key, v)}
              />
            ))}
          </View>
        ))}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DOULEUR</Text>
          <Text style={styles.subtitle}>As-tu ressenti une douleur physique ?</Text>
          <View style={styles.painRow}>
            <TouchableOpacity
              onPress={() => setPain(true)}
              style={[styles.painBtn, pain === true && styles.painBtnActiveYes]}
            >
              <Text style={styles.painBtnText}>OUI</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setPain(false)}
              style={[styles.painBtn, pain === false && styles.painBtnActiveNo]}
            >
              <Text style={styles.painBtnText}>NON</Text>
            </TouchableOpacity>
          </View>
          {pain === true && (
            <Text style={styles.hint}>
              (Plus tard) Affichage d’un mannequin 3D pour cliquer sur la zone douloureuse.
            </Text>
          )}
        </View>

        <TouchableOpacity 
          onPress={onSubmit} 
          disabled={saving || !canAccess} 
          style={[styles.saveBtn, (!canAccess || saving) && styles.saveBtnDisabled]}
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Enregistrer</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" },
  content: { padding: 16, paddingBottom: 48 },
  title: { fontSize: 28, fontWeight: "800", marginBottom: 4 },
  subtitle: { fontSize: 14, opacity: 0.7, marginBottom: 12 },
  section: { marginTop: 18 },
  sectionTitle: { fontSize: 18, fontWeight: "700", marginBottom: 8 },
  row: { marginVertical: 12 },
  rowHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  labelLeft: { fontSize: 15, fontWeight: "700" },
  labelRight: { fontSize: 12, opacity: 0.7, textAlign: "right", maxWidth: "50%" },
  scaleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  scaleEdge: { width: 16, textAlign: "center", fontWeight: "700", opacity: 0.6 },
  valueText: { alignSelf: "flex-end", fontSize: 12, opacity: 0.6, marginTop: 4 },
  painRow: { flexDirection: "row", gap: 12, marginTop: 8 },
  painBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: "#ddd", alignItems: "center" },
  painBtnActiveYes: { backgroundColor: "#d9534f" },
  painBtnActiveNo: { backgroundColor: "#5cb85c" },
  painBtnText: { color: "#fff", fontWeight: "700" },
  saveBtn: { marginTop: 24, backgroundColor: "#4a67ff", paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  saveBtnDisabled: { backgroundColor: "#ccc", opacity: 0.6 },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  backBtn: { marginTop: 24, backgroundColor: "#666", paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  backBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  hint: { marginTop: 8, fontSize: 12, fontStyle: "italic", opacity: 0.7 },
});