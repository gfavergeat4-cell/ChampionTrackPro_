import React, { useState, useEffect, useLayoutEffect } from "react";
import { useNavigation, useRoute, CommonActions } from "@react-navigation/native";
import { View, Platform, Alert } from "react-native";
import MobileViewport from "../src/components/MobileViewport";
import { doc, getDoc } from "firebase/firestore";
import { db, auth } from "../src/lib/firebase";
import { DateTime } from "luxon";
import { computeQuestionnaireStatus, getQuestionnaireWindowFromEnd } from "../src/utils/questionnaire";

export default function StitchQuestionnaireScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { sessionId, eventTitle, eventDate } = route.params || {};

  const handleGoBack = () => {
    navigation.goBack();
  };

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const handleReturnHome = React.useCallback(() => {
    if (navigation?.goBack) {
      navigation.goBack();
    } else if (typeof window !== "undefined") {
      window.location.href = "/";
    }
  }, [navigation]);

  // Auto-redirect after 2 seconds when confirmation is shown
  useEffect(() => {
    if (showConfirmation && Platform.OS === 'web') {
      const timer = setTimeout(() => {
        handleReturnHome();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [showConfirmation, handleReturnHome]);

  // Vérifier si le questionnaire est accessible (fenêtre temporelle + déjà complété)
  const [isAccessible, setIsAccessible] = useState(false);
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);
  const [accessDeniedReason, setAccessDeniedReason] = useState(null);
  const [trainingInfoForMessage, setTrainingInfoForMessage] = useState(null);

  useEffect(() => {
    const checkAccess = async () => {
      try {
        if (!auth.currentUser || !sessionId) {
          setIsCheckingAccess(false);
          setAccessDeniedReason("Paramètres manquants");
          return;
        }

        // Récupérer l'ID de l'équipe de l'utilisateur
        const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
        if (!userDoc.exists()) {
          setIsCheckingAccess(false);
          setAccessDeniedReason("Profil utilisateur non trouvé");
          return;
        }

        const userData = userDoc.data();
        const teamId = userData.teamId;
        if (!teamId) {
          setIsCheckingAccess(false);
          setAccessDeniedReason("Aucune équipe associée");
          return;
        }

        // Récupérer les informations du training pour obtenir endUtc
        const trainingRef = doc(db, "teams", teamId, "trainings", sessionId);
        const trainingSnap = await getDoc(trainingRef);
        
        if (!trainingSnap.exists()) {
          setIsCheckingAccess(false);
          setAccessDeniedReason("Entraînement non trouvé");
          return;
        }

        const trainingData = trainingSnap.data();
        const endUtc = trainingData?.endUtc;
        const endMillis = endUtc?.toMillis?.() ?? null;
        const displayTz = trainingData?.displayTz || "Europe/Paris";

        // Stocker les informations du training pour l'affichage du message d'accès refusé
        setTrainingInfoForMessage({
          endMillis,
          displayTz,
          title: trainingData?.title || eventTitle || "Entraînement",
        });

        if (!endMillis) {
          setIsCheckingAccess(false);
          setAccessDeniedReason("L'entraînement n'a pas d'heure de fin définie");
          return;
        }

        // Vérifier si une réponse existe déjà
        const responseRef = doc(db, "teams", teamId, "trainings", sessionId, "responses", auth.currentUser.uid);
        let responseSnap;
        try {
          responseSnap = await getDoc(responseRef);
        } catch (e) {
          console.warn("Load response failed:", e);
        }

        const hasCompleted = responseSnap?.exists() && responseSnap.data()?.status === 'completed';
        
        // Calculer le statut du questionnaire
        const now = DateTime.utc();
        const status = computeQuestionnaireStatus(endMillis, hasCompleted, now);

        console.log("[QUESTIONNAIRE] Access check", {
          sessionId,
          endMillis,
          now: now.toMillis(),
          hasCompleted,
          status,
          displayTz,
        });

        // Vérifier si l'accès est autorisé
        if (status === 'completed') {
          setAccessDeniedReason("already_completed");
          setIsAccessible(false);
        } else if (status === 'not_open_yet') {
          setAccessDeniedReason("not_open_yet");
          setIsAccessible(false);
        } else if (status === 'closed') {
          setAccessDeniedReason("closed");
          setIsAccessible(false);
        } else if (status === 'open') {
          setIsAccessible(true);
          setAccessDeniedReason(null);
        } else {
          setAccessDeniedReason("unknown");
          setIsAccessible(false);
        }
      } catch (error) {
        console.error("❌ Erreur lors de la vérification:", error);
        setAccessDeniedReason("error");
        setIsAccessible(false);
      } finally {
        setIsCheckingAccess(false);
      }
    };

    checkAccess();
  }, [sessionId]);

  // Rediriger silencieusement vers la page précédente si l'accès est refusé
  // Utiliser useLayoutEffect pour rediriger avant le premier rendu
  useLayoutEffect(() => {
    if (!isCheckingAccess && !isAccessible) {
      // Rediriger immédiatement sans afficher d'écran d'erreur
      console.log("[QUESTIONNAIRE] Access denied, redirecting silently", { reason: accessDeniedReason });
      if (navigation?.goBack) {
        // Rediriger immédiatement sans délai
        navigation.goBack();
      }
    }
  }, [isCheckingAccess, isAccessible, accessDeniedReason, navigation]);
  
  const painToggle = false; // legacy flag disabled (pain module removed)
  const [sliderValues, setSliderValues] = useState({
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
    sleepQuality: 50,
  });

  const handleSubmit = async () => {
    if (isSubmitting) return;
      
    setSubmitError(null);
    setIsSubmitting(true);

    try {
      console.log("Questionnaire submitted:", { 
        sessionId, 
        sliderValues 
      });

      if (!auth.currentUser) {
        throw new Error("Utilisateur non connecté");
      }

      // Récupérer l'ID de l'équipe de l'utilisateur
      const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
      
      if (!userDoc.exists()) {
        throw new Error("Profil utilisateur non trouvé");
      }

      const userData = userDoc.data();
      console.log("🔍 Données utilisateur:", userData);
      const teamId = userData.teamId;
      console.log("🔍 Team ID:", teamId);

      if (!teamId) {
        throw new Error("Aucune équipe associée");
      }

      // Sauvegarder la réponse dans Firestore
      // Utiliser trainings/ au lieu de events/ (canonique)
      // Utiliser la fonction standardisée saveQuestionnaireResponse
      console.log("🔍 Sauvegarde questionnaire", {
        teamId,
        trainingId: sessionId,
        uid: auth.currentUser.uid,
        sliderValuesKeys: Object.keys(sliderValues),
      });
      console.log("🔍 Chemin Firestore: teams/", teamId, "/trainings/", sessionId, "/responses/", auth.currentUser.uid);

      const { saveQuestionnaireResponse } = await import("../src/lib/responses");
      await saveQuestionnaireResponse(
        teamId,
        sessionId, // trainingId (sessionId est l'ID du training)
        auth.currentUser.uid,
        {
          values: sliderValues, // Encapsuler les valeurs dans un objet values
          eventTitle: eventTitle || "Training Session",
          eventDate: eventDate || new Date().toISOString(),
        }
      );

      console.log("✅ Réponse sauvegardée dans Firestore");

      if (Platform.OS === 'web') {
        setShowConfirmation(true);
      } else {
        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: 'AthleteMain' }],
          })
        );
      }
    } catch (error) {
      console.error("❌ Erreur lors de la sauvegarde:", error);
      const errorMessage = error?.code === "permission-denied" 
        ? "Erreur de permissions. Vérifie que tu es bien membre de l'équipe et que le questionnaire est toujours disponible."
        : `Erreur lors de la sauvegarde du questionnaire: ${error?.message || error}`;
      if (Platform.OS === 'web') {
        setSubmitError(errorMessage);
      } else {
        Alert.alert("Erreur", errorMessage);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Debug: Log the route params
  console.log("🔍 Questionnaire route params:", route.params);
  console.log("🔍 Event title:", eventTitle);
  console.log("🔍 Event date:", eventDate);
  console.log("🔍 Session ID:", sessionId);

  const handleSliderChange = (key, value) => {
    setSliderValues(prev => ({ ...prev, [key]: value }));
  };


  if (Platform.OS === "web") {
    // Add CSS for the new design
    React.useEffect(() => {
      const style = document.createElement('style');
      style.textContent = `
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .slider {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 10px;
          background: #1E222D;
          outline: none;
          border-radius: 9999px;
          transition: background 200ms ease-out;
        }
        .slider::-webkit-slider-runnable-track {
          height: 10px;
          background: linear-gradient(90deg, #00E0FF, #4A67FF);
          border-radius: 9999px;
        }
        .slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 20px;
          height: 20px;
          background: #00E0FF;
          cursor: pointer;
          border-radius: 50%;
          margin-top: -5px;
          box-shadow: 0 0 10px 2px rgba(0, 224, 255, 0.5);
          transition: transform 200ms ease-out, box-shadow 150ms ease-in;
        }
        .slider:active::-webkit-slider-thumb {
          box-shadow: 0 0 15px 5px rgba(0, 224, 255, 0.7);
        }
        .slider::-moz-range-track {
          height: 10px;
          background: linear-gradient(90deg, #00E0FF, #4A67FF);
          border-radius: 9999px;
        }
        .slider::-moz-range-thumb {
          width: 20px;
          height: 20px;
          background: #00E0FF;
          cursor: pointer;
          border-radius: 50%;
          box-shadow: 0 0 10px 2px rgba(0, 224, 255, 0.5);
          border: none;
          transition: transform 200ms ease-out, box-shadow 150ms ease-in;
        }
        .slider:active::-moz-range-thumb {
          box-shadow: 0 0 15px 5px rgba(0, 224, 255, 0.7);
        }
        .card-animate {
            animation: fadeIn 150ms ease-out both;
        }
        @keyframes fadeIn {
            from {
                opacity: 0;
                transform: translateY(10px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        .pulse-glow {
            animation: pulse-glow 2s infinite ease-in-out;
        }
        @keyframes pulse-glow {
            0%, 100% { box-shadow: 0 0 10px 0 rgba(0, 224, 255, 0.2); }
            50% { box-shadow: 0 0 20px 5px rgba(0, 224, 255, 0.4); }
        }
        @keyframes slideUp {
            from {
                transform: translateY(100%);
                opacity: 0;
            }
            to {
                transform: translateY(0);
                opacity: 1;
            }
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        @keyframes ctpFadeIn {
            from { opacity: 0; transform: translateY(12px); }
            to { opacity: 1; transform: translateY(0); }
        }
      `;
      document.head.appendChild(style);
      return () => document.head.removeChild(style);
    }, []);

    // Initialize 3D Anatomy Model with simplified approach
    React.useEffect(() => {
      const initAnatomyModel = async () => {
        // Load Three.js from CDN
        if (!window.THREE) {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
          script.onload = () => {
            initThreeJS();
          };
          document.head.appendChild(script);
        } else {
          initThreeJS();
        }

        function initThreeJS() {
          console.log('🔧 Three.js loaded, initializing...');
          
          const container = document.getElementById('body-viewer');
          const canvas = document.getElementById('anatomyCanvas');
          const loadingIndicator = document.getElementById('loading-indicator');
          
          if (!container || !canvas) {
            console.error('❌ Container or canvas not found');
            return;
          }

          // Show loading indicator
          if (loadingIndicator) {
            loadingIndicator.style.display = 'block';
          }

          // Scene setup
          const scene = new THREE.Scene();
          const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
          const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
          renderer.setSize(container.clientWidth, container.clientHeight);
          renderer.setClearColor(0x000000, 0);
          renderer.shadowMap.enabled = true;
          renderer.shadowMap.type = THREE.PCFSoftShadowMap;

          // Enhanced Lighting
          const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
          scene.add(ambientLight);
          
          // Main directional light (cyan theme)
          const directionalLight = new THREE.DirectionalLight(0x00E0FF, 1.2);
          directionalLight.position.set(5, 5, 5);
          directionalLight.castShadow = true;
          directionalLight.shadow.mapSize.width = 2048;
          directionalLight.shadow.mapSize.height = 2048;
          directionalLight.shadow.camera.near = 0.5;
          directionalLight.shadow.camera.far = 50;
          scene.add(directionalLight);

          // Fill light (blue theme)
          const fillLight = new THREE.DirectionalLight(0x4A67FF, 0.6);
          fillLight.position.set(-3, 2, -2);
          scene.add(fillLight);

          // Rim light for better definition
          const rimLight = new THREE.DirectionalLight(0xFFFFFF, 0.8);
          rimLight.position.set(0, 0, -5);
          scene.add(rimLight);

          // Point light for warmth
          const pointLight = new THREE.PointLight(0xFFE0B0, 0.5, 10);
          pointLight.position.set(2, 3, 2);
          scene.add(pointLight);

          // Create anatomy model
          const createAnatomyModel = () => {
            const group = new THREE.Group();

            // Enhanced Materials
            const muscleMaterial = new THREE.MeshPhongMaterial({ 
              color: 0x8B4513,
              shininess: 30,
              transparent: true,
              opacity: 0.9
            });
            const skinMaterial = new THREE.MeshPhongMaterial({ 
              color: 0xFFDBB5,
              shininess: 50
            });
            const boneMaterial = new THREE.MeshPhongMaterial({ 
              color: 0xF5F5DC,
              shininess: 80
            });

            // Head with more detail
            const headGeometry = new THREE.SphereGeometry(0.6, 32, 32);
            const head = new THREE.Mesh(headGeometry, skinMaterial);
            head.position.y = 2.2;
            head.castShadow = true;
            head.receiveShadow = true;
            head.name = 'head';
            group.add(head);

            // Neck
            const neckGeometry = new THREE.CylinderGeometry(0.15, 0.2, 0.4, 16);
            const neck = new THREE.Mesh(neckGeometry, skinMaterial);
            neck.position.y = 1.6;
            neck.castShadow = true;
            neck.receiveShadow = true;
            neck.name = 'neck';
            group.add(neck);

            // Enhanced Torso with chest and back muscles
            const torsoGeometry = new THREE.CylinderGeometry(0.4, 0.6, 2.5, 32);
            const torso = new THREE.Mesh(torsoGeometry, muscleMaterial);
            torso.position.y = 0.5;
            torso.castShadow = true;
            torso.receiveShadow = true;
            torso.name = 'torso';
            group.add(torso);

            // Chest muscles (Pectorals)
            const chestGeometry = new THREE.BoxGeometry(0.8, 0.3, 0.1);
            const chest = new THREE.Mesh(chestGeometry, muscleMaterial);
            chest.position.set(0, 1.2, 0.4);
            chest.castShadow = true;
            chest.receiveShadow = true;
            chest.name = 'chest';
            group.add(chest);

            // Abdominal muscles
            const absGeometry = new THREE.BoxGeometry(0.6, 0.8, 0.1);
            const abs = new THREE.Mesh(absGeometry, muscleMaterial);
            abs.position.set(0, 0.2, 0.4);
            abs.castShadow = true;
            abs.receiveShadow = true;
            abs.name = 'abs';
            group.add(abs);

            // Shoulders
            const shoulderGeometry = new THREE.SphereGeometry(0.25, 16, 16);
            
            const leftShoulder = new THREE.Mesh(shoulderGeometry, muscleMaterial);
            leftShoulder.position.set(-0.6, 1.8, 0);
            leftShoulder.castShadow = true;
            leftShoulder.receiveShadow = true;
            leftShoulder.name = 'leftShoulder';
            group.add(leftShoulder);

            const rightShoulder = new THREE.Mesh(shoulderGeometry, muscleMaterial);
            rightShoulder.position.set(0.6, 1.8, 0);
            rightShoulder.castShadow = true;
            rightShoulder.receiveShadow = true;
            rightShoulder.name = 'rightShoulder';
            group.add(rightShoulder);

            // Enhanced Arms with biceps and triceps
            const upperArmGeometry = new THREE.CylinderGeometry(0.12, 0.15, 1.2, 16);
            const forearmGeometry = new THREE.CylinderGeometry(0.08, 0.12, 1.0, 16);
            
            // Left arm
            const leftUpperArm = new THREE.Mesh(upperArmGeometry, muscleMaterial);
            leftUpperArm.position.set(-0.7, 1.5, 0);
            leftUpperArm.rotation.z = Math.PI / 6;
            leftUpperArm.castShadow = true;
            leftUpperArm.receiveShadow = true;
            leftUpperArm.name = 'leftUpperArm';
            group.add(leftUpperArm);

            const leftForearm = new THREE.Mesh(forearmGeometry, muscleMaterial);
            leftForearm.position.set(-1.2, 0.8, 0);
            leftForearm.rotation.z = Math.PI / 4;
            leftForearm.castShadow = true;
            leftForearm.receiveShadow = true;
            leftForearm.name = 'leftForearm';
            group.add(leftForearm);

            // Right arm
            const rightUpperArm = new THREE.Mesh(upperArmGeometry, muscleMaterial);
            rightUpperArm.position.set(0.7, 1.5, 0);
            rightUpperArm.rotation.z = -Math.PI / 6;
            rightUpperArm.castShadow = true;
            rightUpperArm.receiveShadow = true;
            rightUpperArm.name = 'rightUpperArm';
            group.add(rightUpperArm);

            const rightForearm = new THREE.Mesh(forearmGeometry, muscleMaterial);
            rightForearm.position.set(1.2, 0.8, 0);
            rightForearm.rotation.z = -Math.PI / 4;
            rightForearm.castShadow = true;
            rightForearm.receiveShadow = true;
            rightForearm.name = 'rightForearm';
            group.add(rightForearm);

            // Enhanced Legs with thigh and calf muscles
            const thighGeometry = new THREE.CylinderGeometry(0.15, 0.2, 1.2, 16);
            const calfGeometry = new THREE.CylinderGeometry(0.12, 0.15, 1.0, 16);
            
            // Left leg
            const leftThigh = new THREE.Mesh(thighGeometry, muscleMaterial);
            leftThigh.position.set(-0.25, -0.3, 0);
            leftThigh.castShadow = true;
            leftThigh.receiveShadow = true;
            leftThigh.name = 'leftThigh';
            group.add(leftThigh);

            const leftCalf = new THREE.Mesh(calfGeometry, muscleMaterial);
            leftCalf.position.set(-0.25, -1.2, 0);
            leftCalf.castShadow = true;
            leftCalf.receiveShadow = true;
            leftCalf.name = 'leftCalf';
            group.add(leftCalf);

            // Right leg
            const rightThigh = new THREE.Mesh(thighGeometry, muscleMaterial);
            rightThigh.position.set(0.25, -0.3, 0);
            rightThigh.castShadow = true;
            rightThigh.receiveShadow = true;
            rightThigh.name = 'rightThigh';
            group.add(rightThigh);

            const rightCalf = new THREE.Mesh(calfGeometry, muscleMaterial);
            rightCalf.position.set(0.25, -1.2, 0);
            rightCalf.castShadow = true;
            rightCalf.receiveShadow = true;
            rightCalf.name = 'rightCalf';
            group.add(rightCalf);

            // Back muscles (Latissimus Dorsi)
            const backGeometry = new THREE.BoxGeometry(0.8, 1.5, 0.2);
            const back = new THREE.Mesh(backGeometry, muscleMaterial);
            back.position.set(0, 0.5, -0.4);
            back.castShadow = true;
            back.receiveShadow = true;
            back.name = 'back';
            group.add(back);

            // Hip muscles
            const hipGeometry = new THREE.SphereGeometry(0.3, 16, 16);
            const leftHip = new THREE.Mesh(hipGeometry, muscleMaterial);
            leftHip.position.set(-0.25, -0.8, 0);
            leftHip.castShadow = true;
            leftHip.receiveShadow = true;
            leftHip.name = 'leftHip';
            group.add(leftHip);

            const rightHip = new THREE.Mesh(hipGeometry, muscleMaterial);
            rightHip.position.set(0.25, -0.8, 0);
            rightHip.castShadow = true;
            rightHip.receiveShadow = true;
            rightHip.name = 'rightHip';
            group.add(rightHip);

            return group;
          };

          const anatomyModel = createAnatomyModel();
          scene.add(anatomyModel);

          // Camera position
          camera.position.z = 5;
          camera.position.y = 1.5;

          // Controls
          let isMouseDown = false;
          let mouseX = 0, mouseY = 0;
          let rotationX = 0, rotationY = 0;

          const handleMouseDown = (event) => {
            isMouseDown = true;
            mouseX = event.clientX;
            mouseY = event.clientY;
            canvas.style.cursor = 'grabbing';
          };

          const handleMouseMove = (event) => {
            if (!isMouseDown) return;
            
            const deltaX = event.clientX - mouseX;
            const deltaY = event.clientY - mouseY;
            
            rotationY += deltaX * 0.01;
            rotationX += deltaY * 0.01;
            
            anatomyModel.rotation.y = rotationY;
            anatomyModel.rotation.x = rotationX;
            
            mouseX = event.clientX;
            mouseY = event.clientY;
          };

          const handleMouseUp = () => {
            isMouseDown = false;
            canvas.style.cursor = 'grab';
          };

          const handleWheel = (event) => {
            camera.position.z += event.deltaY * 0.01;
            camera.position.z = Math.max(2, Math.min(10, camera.position.z));
          };

          // Event listeners
          canvas.addEventListener('mousedown', handleMouseDown);
          canvas.addEventListener('mousemove', handleMouseMove);
          canvas.addEventListener('mouseup', handleMouseUp);
          canvas.addEventListener('wheel', handleWheel);

          // Touch events
          canvas.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
              isMouseDown = true;
              mouseX = e.touches[0].clientX;
              mouseY = e.touches[0].clientY;
            }
          });

          canvas.addEventListener('touchmove', (e) => {
            if (!isMouseDown || e.touches.length !== 1) return;
            e.preventDefault();
            
            const deltaX = e.touches[0].clientX - mouseX;
            const deltaY = e.touches[0].clientY - mouseY;
            
            rotationY += deltaX * 0.01;
            rotationX += deltaY * 0.01;
            
            anatomyModel.rotation.y = rotationY;
            anatomyModel.rotation.x = rotationX;
            
            mouseX = e.touches[0].clientX;
            mouseY = e.touches[0].clientY;
          });

          canvas.addEventListener('touchend', () => {
            isMouseDown = false;
          });

          // Enhanced Pain Markers System
          const painMarkers = [];
          const raycaster = new THREE.Raycaster();
          const mouse = new THREE.Vector2();

          const addPainMarker = (position, bodyPart) => {
            const markerGeometry = new THREE.SphereGeometry(0.05, 16, 16);
            const markerMaterial = new THREE.MeshPhongMaterial({ 
              color: 0xFF0000,
              emissive: 0x440000,
              transparent: true,
              opacity: 0.8
            });
            const marker = new THREE.Mesh(markerGeometry, markerMaterial);
            marker.position.copy(position);
            marker.userData = { bodyPart, timestamp: Date.now() };
            marker.castShadow = true;
            scene.add(marker);
            painMarkers.push(marker);

            // Add pulsing effect
            const pulseAnimation = () => {
              const scale = 1 + 0.3 * Math.sin(Date.now() * 0.01);
              marker.scale.setScalar(scale);
              requestAnimationFrame(pulseAnimation);
            };
            pulseAnimation();

            console.log('📍 Pain marker added at:', position, 'on', bodyPart);
          };

          const getPainMarkers = () => {
            return painMarkers.map(marker => ({
              position: marker.position.toArray(),
              bodyPart: marker.userData.bodyPart,
              timestamp: marker.userData.timestamp
            }));
          };

          const clearPainMarkers = () => {
            painMarkers.forEach(marker => scene.remove(marker));
            painMarkers.length = 0;
            console.log('🗑️ All pain markers cleared');
          };

          // Enhanced click/touch interaction with raycasting
          const handleClick = (event) => {
            const rect = canvas.getBoundingClientRect();
            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

            raycaster.setFromCamera(mouse, camera);
            const intersects = raycaster.intersectObjects(anatomyModel.children, true);

            if (intersects.length > 0) {
              const clickedObject = intersects[0].object;
              const intersectionPoint = intersects[0].point;
              const bodyPart = clickedObject.name || 'unknown';
              
              // Add pain marker
              addPainMarker(intersectionPoint, bodyPart);
              
              // Highlight the clicked body part
              clickedObject.material.emissive.setHex(0x444444);
              setTimeout(() => {
                clickedObject.material.emissive.setHex(0x000000);
              }, 200);
            }
          };

          // Add click event listener
          canvas.addEventListener('click', handleClick);
          canvas.addEventListener('touchend', (e) => {
            if (e.touches.length === 0) {
              handleClick(e);
            }
          });

          // Enhanced reset function
          const resetView = () => {
            anatomyModel.rotation.set(0, 0, 0);
            camera.position.set(0, 1.5, 5);
            clearPainMarkers();
            console.log('🔄 View reset');
          };

          // Expose functions globally
          window.anatomyModel = {
            resetView,
            getPainMarkers,
            clearPainMarkers
          };

          // Animation loop with enhanced effects
          const animate = () => {
            requestAnimationFrame(animate);
            
            // Subtle breathing animation
            const time = Date.now() * 0.001;
            anatomyModel.children.forEach((child, index) => {
              if (child.name === 'torso' || child.name === 'chest') {
                const breathScale = 1 + 0.02 * Math.sin(time * 2 + index);
                child.scale.y = breathScale;
              }
            });

            renderer.render(scene, camera);
          };
          animate();

          // Hide loading indicator
          if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
          }

          console.log('🔧 Enhanced 3D Anatomy model initialized');
        }
      };

      // Initialize when pain toggle becomes true
      if (painToggle) {
        setTimeout(() => {
          initAnatomyModel();
        }, 200);
      }
    }, [painToggle]);

    // Afficher un écran de chargement pendant la vérification
    if (isCheckingAccess) {
      return (
        <MobileViewport>
          <div style={{
            width: "100%",
            height: "100vh",
            background: "linear-gradient(to bottom, #0B0F1A, #020409)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            gap: "20px"
          }}>
            <div style={{
              width: "40px",
              height: "40px",
              border: "3px solid rgba(0, 224, 255, 0.3)",
              borderTop: "3px solid #00E0FF",
              borderRadius: "50%",
              animation: "spin 1s linear infinite"
            }}></div>
            <div style={{
              color: "#00E0FF",
              fontSize: "16px",
              fontWeight: "600"
            }}>
              Vérification en cours...
            </div>
          </div>
        </MobileViewport>
      );
    }

    // Ne rien afficher si l'accès est refusé - la redirection se fait dans useEffect
    // Retourner null pour éviter tout rendu
    if (!isAccessible && !isCheckingAccess) {
      return null;
    }

    return (
      <MobileViewport>
        <div 
          style={{
            width: "100%",
            height: "100vh",
            background: "linear-gradient(to bottom, #0B0F1A, #020409)",
            fontFamily: "'Inter', sans-serif",
            color: "rgba(255, 255, 255, 0.9)",
            position: "relative",
            display: "flex",
            flexDirection: "column",
            maxWidth: "384px",
            margin: "0 auto",
            overflow: "hidden",
          }}
        >
          {/* Background Effect */}
          <div 
            style={{
              position: "absolute",
              top: 0,
              left: "50%",
              transform: "translateX(-50%)",
              width: "300px",
              height: "300px",
              background: "radial-gradient(circle, rgba(0, 224, 255, 0.1), transparent 70%)",
              pointerEvents: "none",
              zIndex: 0,
            }} 
          />

          {/* Header with Back Button */}
          <div style={{ 
            position: "relative", 
            zIndex: 20, 
            padding: "24px 24px 0 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-start"
          }}>
            <button 
              onClick={handleGoBack}
              style={{
                background: "rgba(0, 224, 255, 0.1)",
                border: "1px solid rgba(0, 224, 255, 0.3)",
                borderRadius: "12px",
                padding: "12px 16px",
                color: "#00E0FF",
                fontSize: "14px",
                fontWeight: "500",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                transition: "all 0.2s",
                backdropFilter: "blur(10px)",
              }}
              onMouseEnter={(e) => {
                e.target.style.background = "rgba(0, 224, 255, 0.2)";
                e.target.style.borderColor = "rgba(0, 224, 255, 0.5)";
              }}
              onMouseLeave={(e) => {
                e.target.style.background = "rgba(0, 224, 255, 0.1)";
                e.target.style.borderColor = "rgba(0, 224, 255, 0.3)";
              }}
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Back
            </button>
          </div>

          {/* Main Content */}
          <div 
            style={{ 
              flex: 1, 
              padding: "0 24px", 
              paddingTop: "24px", 
              paddingBottom: "140px", 
              zIndex: 10, 
              overflowY: "auto",
              overflowX: "hidden",
              scrollbarWidth: "none",
              msOverflowStyle: "none",
              WebkitOverflowScrolling: "touch",
            }}
          >
            {/* Header */}
            <header style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              paddingBottom: "24px",
              textAlign: "center",
            }}>
              <div style={{ position: "relative" }}>
                <h1 style={{ 
                  fontSize: "30px", 
                  fontWeight: "600", 
                  color: "rgba(255, 255, 255, 0.9)",
                  margin: 0,
                }}>
                  {eventTitle || "Practice"}
                </h1>
                <div style={{
                  position: "absolute",
                  inset: 0,
                  zIndex: -1,
                  filter: "blur(20px)",
                  background: "radial-gradient(circle, rgba(0, 224, 255, 0.2), transparent 70%)",
                }}></div>
              </div>
              <p style={{ 
                fontSize: "18px", 
                fontWeight: "500",
                color: "rgba(154, 163, 178, 0.7)",
                margin: "8px 0 0 0",
              }}>
                {eventDate || "2:00 PM – 3:30 PM"}
              </p>
            </header>

            {/* Questionnaire Sections */}
            <main style={{ 
              display: "flex", 
              flexDirection: "column", 
              gap: "16px", 
              paddingBottom: "48px"
            }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {/* Slider Sections */}
                {[
                  { key: "averageIntensity", label: "Average Intensity", description: "Average of all effort intensities." },
                  { key: "highIntensity", label: "High Intensity", description: "Average of the most intense effort phases." },
                  { key: "cardiacImpact", label: "Cardiac Impact", description: "Average of cardiovascular solicitations." },
                  { key: "muscularImpact", label: "Muscular Impact", description: "Average of muscular solicitations." },
                  { key: "fatigue", label: "Fatigue", description: "Decrease in available physical resources." },
                ].map((section, index) => (
                  <div 
                    key={section.key} 
                    style={{
                      background: "#141A24",
                      borderRadius: "16px",
                      padding: "16px",
                      border: "1px solid rgba(0, 224, 255, 0.1)",
                      boxShadow: "inset 0 0 0 1px rgba(0, 224, 255, 0.1)",
                      animationDelay: `${50 * (index + 1)}ms`,
                    }}
                    className="card-animate"
                  >
                    <div style={{ marginBottom: "12px" }}>
                      <label 
                        htmlFor={section.key} 
                        style={{
                          fontSize: "18px",
                          fontWeight: "600",
                          color: "white",
                          margin: 0,
                        }}
                      >
                        {section.label}
                      </label>
                      <p style={{
                        fontSize: "14px",
                        color: "rgba(154, 163, 178, 0.7)",
                        margin: "4px 0 0 0",
                      }}>
                        {section.description}
                      </p>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ color: "#9AA3B2" }}>
                        <path d="M18 12H6" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <input
                        type="range"
                        id={section.key}
                        min="0"
                        max="100"
                        value={sliderValues[section.key]}
                        onChange={(e) => handleSliderChange(section.key, parseInt(e.target.value))}
                        className="slider"
                      />
                      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ color: "#9AA3B2" }}>
                        <path d="M12 6v12M18 12H6" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  </div>
                ))}
              </div>


              {/* Additional Slider Sections */}
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {[
                  { key: "technique", label: "Technique", description: "Quality of technical execution." },
                  { key: "tactics", label: "Tactics", description: "Quality of tactical decisions." },
                  { key: "dynamism", label: "Dynamism", description: "Level of energy and enthusiasm." },
                  { key: "nervousness", label: "Nervousness", description: "Level of stress and anxiety." },
                  { key: "concentration", label: "Concentration", description: "Ability to maintain focus." },
                  { key: "confidence", label: "Confidence", description: "Level of self-assurance." },
                  { key: "wellBeing", label: "Well-being", description: "Overall feeling of wellness." },
                  { key: "sleepQuality", label: "Sleep Quality", description: "Quality of rest during the last 24 hours." },
                ].map((section, index) => (
                  <div 
                    key={section.key} 
                    style={{
                      background: "#141A24",
                      borderRadius: "16px",
                      padding: "16px",
                      border: "1px solid rgba(0, 224, 255, 0.1)",
                      boxShadow: "inset 0 0 0 1px rgba(0, 224, 255, 0.1)",
                      animationDelay: `${50 * (index + 7)}ms`,
                    }}
                    className="card-animate"
                  >
                    <div style={{ marginBottom: "12px" }}>
                      <label 
                        htmlFor={section.key} 
                        style={{
                          fontSize: "18px",
                          fontWeight: "600",
                          color: "white",
                          margin: 0,
                        }}
                      >
                        {section.label}
                      </label>
                      <p style={{
                        fontSize: "14px",
                        color: "rgba(154, 163, 178, 0.7)",
                        margin: "4px 0 0 0",
                      }}>
                        {section.description}
                      </p>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ color: "#9AA3B2" }}>
                        <path d="M18 12H6" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <input
                        type="range"
                        id={section.key}
                        min="0"
                        max="100"
                        value={sliderValues[section.key]}
                        onChange={(e) => handleSliderChange(section.key, parseInt(e.target.value))}
                        className="slider"
                      />
                      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ color: "#9AA3B2" }}>
                        <path d="M12 6v12M18 12H6" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  </div>
                ))}
              </div>
            </main>

            <div style={{ 
              marginTop: "-16px", 
              marginBottom: "20px",
              display: "flex",
              justifyContent: "center",
              alignItems: "center"
            }}>
              {submitError && (
                <div style={{
                  color: "#FF7A93",
                  fontSize: "12px",
                  fontWeight: 500,
                  textAlign: "center",
                  marginRight: "16px",
                  marginLeft: "16px",
                  marginBottom: "12px"
                }}>
                  {submitError}
                </div>
              )}
                  <button 
                    onClick={handleSubmit}
                disabled={isSubmitting}
                    style={{
                      width: "100%",
                      padding: "16px 0",
                      borderRadius: "12px",
                      fontSize: "16px",
                      fontWeight: "600",
                  cursor: isSubmitting ? "not-allowed" : "pointer",
                      background: "linear-gradient(90deg, #00E0FF, #4A67FF)",
                      color: "white",
                      border: "none",
                      boxShadow: "0 0 20px 5px rgba(0, 224, 255, 0.25)",
                      transition: "all 0.2s ease-out",
                      textTransform: "uppercase",
                      letterSpacing: "1px",
                  opacity: isSubmitting ? 0.65 : 1,
                    }}
                    onMouseEnter={(e) => {
                  if (isSubmitting) return;
                      e.target.style.filter = "brightness(1.25)";
                      e.target.style.transform = "translateY(-2px)";
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.filter = "brightness(1)";
                      e.target.style.transform = "translateY(0)";
                    }}
                    onMouseDown={(e) => {
                  if (isSubmitting) return;
                      e.target.style.transform = "translateY(2px)";
                      e.target.style.boxShadow = "0 0 10px 2px rgba(0, 224, 255, 0.15)";
                    }}
                    onMouseUp={(e) => {
                      e.target.style.transform = "translateY(0)";
                      e.target.style.boxShadow = "0 0 20px 5px rgba(0, 224, 255, 0.25)";
                    }}
                  >
                {isSubmitting ? "Sending..." : "Submit"}
                  </button>
                </div>
          </div>
          {showConfirmation && Platform.OS === 'web' && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "rgba(3, 7, 15, 0.92)",
                backdropFilter: "blur(18px)",
                WebkitBackdropFilter: "blur(18px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 999,
              }}
            >
              <div
                style={{
                  width: "90%",
                  maxWidth: "340px",
                  padding: "36px 32px",
                  borderRadius: "24px",
                  border: "1px solid rgba(0, 255, 194, 0.35)",
                  background: "rgba(12, 20, 40, 0.95)",
                  boxShadow: "0 25px 60px rgba(0, 0, 0, 0.65), 0 0 40px rgba(0, 255, 194, 0.2)",
                  textAlign: "center",
                  animation: "ctpFadeIn 0.4s ease forwards",
                }}
              >
                <div
                  style={{
                    width: "80px",
                    height: "80px",
                    borderRadius: "50%",
                    margin: "0 auto 24px",
                    background: "linear-gradient(135deg, #00FFC2, #00C16A)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 0 40px rgba(0, 255, 194, 0.55)",
                  }}
                >
                  <svg width="32" height="24" viewBox="0 0 24 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M3 9L8.5 14.5L21 2" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div style={{ fontSize: "18px", fontWeight: 700, color: "#FFFFFF", marginBottom: "8px" }}>
                  Your response has been successfully submitted.
                </div>
                <div style={{ fontSize: "14px", color: "rgba(255,255,255,0.7)" }}>
                  Redirecting to your dashboard...
                </div>
              </div>
            </div>
          )}
        </div>
      </MobileViewport>
    );
  }
}