import React, { useState, useEffect } from "react";
import { useNavigation } from "@react-navigation/native";
import { Platform } from "react-native";
import MobileViewport from "../src/components/MobileViewport";
import { collection, getDocs, deleteDoc, doc, query, orderBy, where, updateDoc, serverTimestamp, addDoc } from "firebase/firestore";
import { importICSToFirestore } from "../src/lib/icsImporterReal";
import { auth, db } from "../services/firebaseConfig";

export default function StitchAdminDashboard() {
  const navigation = useNavigation();
  const [teams, setTeams] = useState([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [newCoachCode, setNewCoachCode] = useState("");
  const [newAthleteCode, setNewAthleteCode] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [showCalendarImport, setShowCalendarImport] = useState(false);
  const [calendarUrl, setCalendarUrl] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  // Charger les équipes depuis Firestore
  const loadTeams = async () => {
    try {
      setLoading(true);
      const teamsRef = collection(db, "teams");
      const q = query(teamsRef, orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      
      const teamsData = [];
      querySnapshot.forEach((doc) => {
        teamsData.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      setTeams(teamsData);
      console.log("✅ Équipes chargées depuis Firestore:", teamsData.length);
    } catch (error) {
      console.error("❌ Erreur lors du chargement des équipes:", error);
    } finally {
      setLoading(false);
    }
  };

  // Charger les membres d'une équipe
  const loadTeamMembers = async (teamId) => {
    try {
      console.log("🔍 Recherche des membres pour l'équipe:", teamId);
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("teamId", "==", teamId));
      const querySnapshot = await getDocs(q);
      
      console.log("🔍 Nombre d'utilisateurs trouvés:", querySnapshot.size);
      
      const members = [];
      querySnapshot.forEach((doc) => {
        const userData = doc.data();
        console.log("👤 Utilisateur trouvé:", userData);
        members.push({
          id: doc.id,
          ...userData
        });
      });
      
      console.log("✅ Membres chargés:", members);
      return members;
    } catch (error) {
      console.error("❌ Erreur lors du chargement des membres:", error);
      return [];
    }
  };

  // Importer un calendrier ICS pour une équipe
  const handleImportCalendar = async (teamId, calendarUrl) => {
    try {
      setIsImporting(true);
      console.log("📅 Import du calendrier pour l'équipe:", teamId);
      console.log("📅 URL du calendrier:", calendarUrl);

      const teamInfo = teams.find((team) => team.id === teamId);
      const defaultTimeZone =
        teamInfo?.timeZone ||
        teamInfo?.tzid ||
        (teamInfo?.settings && teamInfo.settings.timeZone) ||
        "Europe/Paris";

      const icsText = await fetchCalendarIcs(calendarUrl);
      console.log("📅 Fichier ICS récupéré (taille):", icsText.length);

      // Reset existing trainings for a clean import
      const trainingsCollection = collection(db, "teams", teamId, "trainings");
      const existingTrainings = await getDocs(trainingsCollection);
      if (!existingTrainings.empty) {
        await Promise.all(existingTrainings.docs.map((docSnap) => deleteDoc(docSnap.ref)));
        console.log("🧹 Anciennes séances supprimées:", existingTrainings.size);
      }

      const importResult = await importICSToFirestore({
        teamId,
        icsText,
        source: "google",
        defaultTimeZone,
      });

      console.log("📅 Résultat import:", importResult);

      // Sauvegarder l'URL et marquer que le calendrier est importé
      await updateDoc(doc(db, "teams", teamId), {
        calendarUrl: calendarUrl,
        calendarImported: true,
        calendarImportedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastCalendarImport: {
          at: serverTimestamp(),
          imported: importResult.importedCount,
          updated: importResult.updatedCount,
          removed: importResult.removedCount,
          source: "google",
        },
      });

      // Recharger les équipes pour afficher les changements
      await loadTeams();

      // Fermer le modal
      setShowCalendarImport(false);
      setCalendarUrl("");
      setSelectedTeam(null);

      alert(
        `Calendrier importé avec succès !\nCréés: ${importResult.importedCount}\nMis à jour: ${importResult.updatedCount}\nNettoyés: ${importResult.removedCount}`
      );

    } catch (error) {
      console.error("❌ Erreur lors de l'import du calendrier:", error);
      alert("Erreur lors de l'import du calendrier: " + error.message);
    } finally {
      setIsImporting(false);
    }
  };

  const fetchCalendarIcs = async (calendarUrl) => {
    try {
      console.log("📅 Téléchargement du fichier ICS...");
      const proxyCandidates = [];
      const encodedUrl = encodeURIComponent(calendarUrl);
      const localProxy = `http://localhost:3001/proxy-ics?url=${encodedUrl}`;
      proxyCandidates.push(localProxy);
      
      if (Platform.OS === 'web') {
        proxyCandidates.unshift(`https://cors.isomorphic-git.org/${calendarUrl}`);
        proxyCandidates.push(`https://corsproxy.io/?${encodedUrl}`);
      }
      
      proxyCandidates.push(calendarUrl);
      
      let lastError = null;

      for (const candidate of proxyCandidates) {
        try {
          console.log("📅 Tentative de récupération ICS via:", candidate);
          const response = await fetch(candidate);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status} ${response.statusText}`);
          }
          const text = await response.text();
          if (!text || text.length === 0) {
            throw new Error('Réponse vide');
          }
          console.log("📅 Fichier ICS téléchargé via", candidate);
          return text;
        } catch (candidateError) {
          console.warn("⚠️ Échec du téléchargement ICS via", candidate, candidateError);
          lastError = candidateError;
        }
      }
      
      throw new Error(
        lastError?.message || "Impossible de récupérer le fichier ICS."
      );
    } catch (error) {
      console.error("❌ Erreur lors du téléchargement ICS:", error);
      throw error;
    }
  };

  // Charger les équipes au montage du composant
  useEffect(() => {
    loadTeams();
  }, []);

  const generateTeamCode = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "";
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) {
      alert("Veuillez entrer un nom d'équipe");
      return;
    }

    setIsGenerating(true);
    
    try {
      // Générer des codes uniques
      const coachCode = newCoachCode || generateTeamCode();
      const athleteCode = newAthleteCode || generateTeamCode();
      
      const newTeamData = {
        name: newTeamName.trim(),
        coachCode: coachCode,
        athleteCode: athleteCode,
        codes: {
          coach: coachCode,
          athlete: athleteCode
        },
        members: 0,
        coaches: 0,
        createdAt: new Date(),
        status: "active"
      };

      // Sauvegarder dans Firestore
      const docRef = await addDoc(collection(db, "teams"), newTeamData);
      
      const newTeam = {
        id: docRef.id,
        ...newTeamData
      };

      // Mettre à jour l'état local
      setTeams(prev => [newTeam, ...prev]);
      setNewTeamName("");
      setNewCoachCode("");
      setNewAthleteCode("");
      setShowCreateForm(false);
      
      console.log("✅ Nouvelle équipe créée dans Firestore:", newTeam);
      alert(`Équipe "${newTeam.name}" créée avec succès!\n\nCode Coach: ${newTeam.coachCode}\nCode Athlète: ${newTeam.athleteCode}`);
      
    } catch (error) {
      console.error("❌ Erreur lors de la création:", error);
      alert("Erreur lors de la création de l'équipe");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleViewTeam = async (teamId) => {
    console.log("Viewing team:", teamId);
    try {
      const team = teams.find(t => t.id === teamId);
      if (team) {
        navigation.navigate('TeamDetails', { 
          teamId: teamId,
          teamName: team.name,
          teamData: team
        });
      }
    } catch (error) {
      console.error("Erreur lors de la navigation vers TeamDetails:", error);
    }
  };

  const handleImportCalendarForTeam = (team) => {
    setSelectedTeam(team);
    setShowCalendarImport(true);
  };


  // Supprimé : génération de nouveaux codes (un seul code par rôle)

  const handleDeleteTeam = async (teamId, teamName) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer l'équipe "${teamName}" ?\n\nCette action supprimera définitivement l'équipe et toutes ses données.`)) {
      return;
    }

    try {
      // Supprimer de Firestore
      await deleteDoc(doc(db, "teams", teamId));
      
      // Mettre à jour l'état local
      setTeams(prev => prev.filter(team => team.id !== teamId));
      
      console.log("✅ Équipe supprimée:", teamName);
      alert(`Équipe "${teamName}" supprimée avec succès.`);
      
    } catch (error) {
      console.error("❌ Erreur lors de la suppression:", error);
      alert("Erreur lors de la suppression de l'équipe");
    }
  };

  const handleLogout = async () => {
    try {
      const { signOut } = await import("firebase/auth");
      const { auth } = await import("../services/firebaseConfig");
      await signOut(auth);
      navigation.reset({
        index: 0,
        routes: [{ name: 'Auth', params: { screen: 'Landing' } }],
      });
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <MobileViewport>
      <div style={{
        width: "100%",
        maxWidth: "375px",
        height: "100%",
        background: "linear-gradient(to bottom, #0B0F1A, #020409)",
        display: "flex",
        flexDirection: "column",
        color: "white",
        fontFamily: Platform.OS === "web" ? "'Inter', sans-serif" : "System",
        overflow: "hidden",
        margin: "0 auto"
      }}>
        {/* Header */}
        <header style={{
          padding: "16px 20px",
          borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
          background: "rgba(0, 0, 0, 0.3)"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ flex: 1 }}>
              <h1 style={{
                fontSize: "20px",
                fontWeight: "bold",
                margin: "0 0 4px 0",
                background: "linear-gradient(135deg, #00E0FF, #4A67FF)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent"
              }}>
                Admin Dashboard
              </h1>
              <p style={{ fontSize: "12px", color: "#9AA3B2", margin: 0 }}>
                Gestion des équipes
              </p>
            </div>
            <button
              onClick={handleLogout}
              style={{
                padding: "6px 12px",
                borderRadius: "6px",
                background: "rgba(239, 68, 68, 0.2)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                color: "#EF4444",
                fontSize: "12px",
                fontWeight: "500",
                cursor: "pointer"
              }}
            >
              Logout
            </button>
          </div>
        </header>

        {/* Main Content */}
        <main style={{
          flex: 1,
          padding: "16px 20px",
          overflow: "auto",
          paddingBottom: "100px"
        }}>
          {/* Create Team Section */}
          <div style={{
            background: "rgba(0, 224, 255, 0.1)",
            border: "1px solid rgba(0, 224, 255, 0.2)",
            borderRadius: "12px",
            padding: "16px",
            marginBottom: "20px"
          }}>
            <h2 style={{
              fontSize: "16px",
              fontWeight: "600",
              margin: "0 0 12px 0",
              color: "#00E0FF"
            }}>
              Créer une nouvelle équipe
            </h2>
            
            {!showCreateForm ? (
              <button
                onClick={() => setShowCreateForm(true)}
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: "8px",
                  background: "linear-gradient(135deg, #00E0FF, #4A67FF)",
                  color: "white",
                  fontSize: "14px",
                  fontWeight: "600",
                  border: "none",
                  cursor: "pointer",
                  transition: "opacity 0.2s"
                }}
              >
                + Créer une nouvelle équipe
              </button>
            ) : (
              <div>
                <div style={{ marginBottom: "16px" }}>
                  <label style={{
                    display: "block",
                    fontSize: "14px",
                    fontWeight: "500",
                    marginBottom: "8px",
                    color: "#E5E7EB"
                  }}>
                    Nom de l'équipe
                  </label>
                  <input
                    type="text"
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    placeholder="Ex: Équipe de natation olympique"
                    style={{
                      width: "100%",
                      padding: "12px",
                      borderRadius: "8px",
                      border: "1px solid rgba(255, 255, 255, 0.2)",
                      background: "rgba(255, 255, 255, 0.1)",
                      color: "white",
                      fontSize: "14px",
                      outline: "none"
                    }}
                  />
                </div>
                
                <div style={{ marginBottom: "16px" }}>
                  <label style={{
                    display: "block",
                    fontSize: "14px",
                    fontWeight: "500",
                    marginBottom: "8px",
                    color: "#E5E7EB"
                  }}>
                    Code d'accès Coach (optionnel)
                  </label>
                  <input
                    type="text"
                    value={newCoachCode}
                    onChange={(e) => setNewCoachCode(e.target.value.toUpperCase())}
                    placeholder="Laissez vide pour générer automatiquement"
                    style={{
                      width: "100%",
                      padding: "12px",
                      borderRadius: "8px",
                      border: "1px solid rgba(0, 224, 255, 0.3)",
                      background: "rgba(0, 224, 255, 0.1)",
                      color: "white",
                      fontSize: "14px",
                      outline: "none"
                    }}
                  />
                </div>

                <div style={{ marginBottom: "20px" }}>
                  <label style={{
                    display: "block",
                    fontSize: "14px",
                    fontWeight: "500",
                    marginBottom: "8px",
                    color: "#E5E7EB"
                  }}>
                    Code d'accès Athlète (optionnel)
                  </label>
                  <input
                    type="text"
                    value={newAthleteCode}
                    onChange={(e) => setNewAthleteCode(e.target.value.toUpperCase())}
                    placeholder="Laissez vide pour générer automatiquement"
                    style={{
                      width: "100%",
                      padding: "12px",
                      borderRadius: "8px",
                      border: "1px solid rgba(74, 103, 255, 0.3)",
                      background: "rgba(74, 103, 255, 0.1)",
                      color: "white",
                      fontSize: "14px",
                      outline: "none"
                    }}
                  />
                </div>

                <div style={{ display: "flex", gap: "12px" }}>
                  <button
                    onClick={handleCreateTeam}
                    disabled={isGenerating}
                    style={{
                      flex: 1,
                      padding: "12px",
                      borderRadius: "8px",
                      background: isGenerating ? "rgba(0, 224, 255, 0.5)" : "linear-gradient(135deg, #00E0FF, #4A67FF)",
                      color: "white",
                      fontSize: "14px",
                      fontWeight: "600",
                      border: "none",
                      cursor: isGenerating ? "not-allowed" : "pointer"
                    }}
                  >
                    {isGenerating ? "Création..." : "Créer l'équipe"}
                  </button>
                  
                  <button
                    onClick={() => {
                      setShowCreateForm(false);
                      setNewTeamName("");
                      setNewCoachCode("");
                      setNewAthleteCode("");
                    }}
                    style={{
                      padding: "12px 20px",
                      borderRadius: "8px",
                      background: "rgba(255, 255, 255, 0.1)",
                      border: "1px solid rgba(255, 255, 255, 0.2)",
                      color: "white",
                      fontSize: "14px",
                      fontWeight: "500",
                      cursor: "pointer"
                    }}
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Teams List */}
          <div>
            <h2 style={{
              fontSize: "16px",
              fontWeight: "600",
              margin: "0 0 16px 0",
              color: "#E5E7EB"
            }}>
              Équipes existantes ({teams.length})
            </h2>

            {loading ? (
              <div style={{
                textAlign: "center",
                padding: "40px 20px",
                color: "#9AA3B2"
              }}>
                <div style={{
                  fontSize: "24px",
                  marginBottom: "16px",
                  opacity: 0.5
                }}>
                  ⏳
                </div>
                <p style={{ fontSize: "16px", margin: 0 }}>
                  Chargement des équipes...
                </p>
              </div>
            ) : teams.length === 0 ? (
              <div style={{
                textAlign: "center",
                padding: "40px 20px",
                color: "#9AA3B2"
              }}>
                <div style={{
                  fontSize: "48px",
                  marginBottom: "16px",
                  opacity: 0.5
                }}>
                  🏆
                </div>
                <p style={{ fontSize: "16px", margin: "0 0 8px 0" }}>
                  Aucune équipe créée
                </p>
                <p style={{ fontSize: "14px", margin: 0 }}>
                  Créez votre première équipe pour commencer
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {teams.map((team) => (
                  <div
                    key={team.id}
                    style={{
                      background: "rgba(255, 255, 255, 0.05)",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      borderRadius: "8px",
                      padding: "16px",
                      marginBottom: "12px",
                      transition: "all 0.2s"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ flex: 1 }}>
                        <h3 style={{
                          fontSize: "14px",
                          fontWeight: "600",
                          margin: "0 0 8px 0",
                          color: "#E5E7EB"
                        }}>
                          {team.name}
                        </h3>
                        
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "12px" }}>
                          <div>
                            <span style={{ fontSize: "11px", color: "#9AA3B2" }}>Code Coach:</span>
                            <div style={{
                              fontSize: "12px",
                              fontWeight: "600",
                              color: "#00E0FF",
                              fontFamily: "monospace",
                              background: "rgba(0, 224, 255, 0.1)",
                              padding: "4px 8px",
                              borderRadius: "4px",
                              display: "inline-block",
                              marginLeft: "8px"
                            }}>
                              {team.coachCode}
                            </div>
                          </div>
                          <div>
                            <span style={{ fontSize: "11px", color: "#9AA3B2" }}>Code Athlète:</span>
                            <div style={{
                              fontSize: "12px",
                              fontWeight: "600",
                              color: "#4A67FF",
                              fontFamily: "monospace",
                              background: "rgba(74, 103, 255, 0.1)",
                              padding: "4px 8px",
                              borderRadius: "4px",
                              display: "inline-block",
                              marginLeft: "8px"
                            }}>
                              {team.athleteCode}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: "flex", gap: "16px", fontSize: "12px", color: "#9AA3B2" }}>
                          <span style={{ fontSize: "11px" }}>Membres: {team.members}</span>
                          <span style={{ fontSize: "11px" }}>Entraîneurs: {team.coaches}</span>
                          <span style={{ fontSize: "11px" }}>Créé: {new Date(team.createdAt).toLocaleDateString()}</span>
                          <span style={{ color: team.calendarImported ? "#00E0FF" : "#6B7280", fontSize: "11px" }}>
                            📅 Calendrier: {team.calendarImported ? "Importé" : "Non importé"}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        <button
                          onClick={() => handleViewTeam(team.id)}
                          style={{
                            padding: "4px 8px",
                            borderRadius: "4px",
                            background: "rgba(255, 255, 255, 0.1)",
                            border: "1px solid rgba(255, 255, 255, 0.2)",
                            color: "white",
                            fontSize: "10px",
                            fontWeight: "500",
                            cursor: "pointer"
                          }}
                        >
                          Voir détails
                        </button>
                        
                        <button
                          onClick={() => handleImportCalendarForTeam(team)}
                          style={{
                            padding: "4px 8px",
                            borderRadius: "4px",
                            background: "rgba(0, 224, 255, 0.1)",
                            border: "1px solid rgba(0, 224, 255, 0.3)",
                            color: "#00E0FF",
                            fontSize: "10px",
                            fontWeight: "500",
                            cursor: "pointer"
                          }}
                        >
                          📅 Calendrier
                        </button>

                        
                        <button
                          onClick={() => handleDeleteTeam(team.id, team.name)}
                          style={{
                            padding: "4px 8px",
                            borderRadius: "4px",
                            background: "rgba(239, 68, 68, 0.1)",
                            border: "1px solid rgba(239, 68, 68, 0.3)",
                            color: "#EF4444",
                            fontSize: "10px",
                            fontWeight: "500",
                            cursor: "pointer"
                          }}
                        >
                          Supprimer
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>

        {/* Bottom Navigation */}
        <footer style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: "rgba(10, 10, 10, 0.9)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderTop: "1px solid rgba(255, 255, 255, 0.1)",
          padding: "16px 24px",
          zIndex: 1000
        }}>
          <nav style={{ display: "flex", justifyContent: "space-around", alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", color: "#00E0FF" }}>
              <svg style={{ width: "24px", height: "24px" }} fill="currentColor" viewBox="0 0 24 24">
                <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/>
              </svg>
              <span style={{ fontSize: "12px", fontWeight: "500" }}>Dashboard</span>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", color: "#9AA3B2" }}>
              <svg style={{ width: "24px", height: "24px" }} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span style={{ fontSize: "12px", fontWeight: "500" }}>Équipes</span>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", color: "#9AA3B2" }}>
              <svg style={{ width: "24px", height: "24px" }} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span style={{ fontSize: "12px", fontWeight: "500" }}>Analytics</span>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", color: "#9AA3B2" }}>
              <svg style={{ width: "24px", height: "24px" }} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span style={{ fontSize: "12px", fontWeight: "500" }}>Profil</span>
            </div>
          </nav>
        </footer>

        {/* Modal d'import de calendrier */}
        {showCalendarImport && selectedTeam && (
          <div style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2000
          }}>
            <div style={{
              background: "#1A1F2E",
              borderRadius: "16px",
              padding: "24px",
              width: "90%",
              maxWidth: "500px",
              border: "1px solid rgba(255, 255, 255, 0.1)"
            }}>
              <h3 style={{
                color: "white",
                marginBottom: "16px",
                fontSize: "18px",
                fontWeight: "600"
              }}>
                📅 Importer un calendrier pour {selectedTeam.name}
              </h3>
              
              <div style={{ marginBottom: "16px" }}>
                <label style={{
                  color: "#9CA3AF",
                  fontSize: "14px",
                  marginBottom: "8px",
                  display: "block"
                }}>
                  URL du calendrier ICS
                </label>
                <input
                  type="url"
                  value={calendarUrl}
                  onChange={(e) => setCalendarUrl(e.target.value)}
                  placeholder="https://example.com/calendar.ics"
                  style={{
                    width: "100%",
                    padding: "12px",
                    borderRadius: "8px",
                    background: "rgba(26, 32, 44, 0.5)",
                    border: "1px solid rgba(74, 103, 255, 0.3)",
                    color: "white",
                    fontSize: "14px",
                    outline: "none"
                  }}
                />
              </div>

              <div style={{ marginBottom: "16px" }}>
                <p style={{
                  color: "#6B7280",
                  fontSize: "12px",
                  lineHeight: "1.4"
                }}>
                  Collez l'URL de votre calendrier ICS (Google Calendar, Outlook, etc.). 
                  Les événements seront importés et associés aux questionnaires pour les athlètes.
                </p>
              </div>

              <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                <button
                  onClick={() => {
                    setShowCalendarImport(false);
                    setCalendarUrl("");
                    setSelectedTeam(null);
                  }}
                  style={{
                    padding: "10px 20px",
                    borderRadius: "8px",
                    background: "rgba(255, 255, 255, 0.1)",
                    border: "1px solid rgba(255, 255, 255, 0.2)",
                    color: "white",
                    fontSize: "14px",
                    fontWeight: "500",
                    cursor: "pointer"
                  }}
                >
                  Annuler
                </button>
                
                <button
                  onClick={() => handleImportCalendar(selectedTeam.id, calendarUrl)}
                  disabled={!calendarUrl.trim() || isImporting}
                  style={{
                    padding: "10px 20px",
                    borderRadius: "8px",
                    background: !calendarUrl.trim() || isImporting 
                      ? "rgba(74, 103, 255, 0.3)" 
                      : "linear-gradient(135deg, #00E0FF, #4A67FF)",
                    border: "none",
                    color: "white",
                    fontSize: "14px",
                    fontWeight: "500",
                    cursor: !calendarUrl.trim() || isImporting ? "not-allowed" : "pointer",
                    opacity: !calendarUrl.trim() || isImporting ? 0.6 : 1
                  }}
                >
                  {isImporting ? "Import en cours..." : "Importer"}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </MobileViewport>
  );
}