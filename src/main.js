import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { gsap } from 'gsap';
import confetti from 'canvas-confetti';
import {
  getWishes,
  collectWish,
  plantWish,
  readWish,
  resetWishes
} from './memories.js';

// --- State Variables ---
let scene, camera, renderer, clock;
let planetGroup;
let waterMesh;
let starParticles;
let fireflies = [];
let trees = [];

// Game States
let playerPos = new THREE.Vector3(0, 10, 0); // starts on top grass next to pond
let playerVelocity = new THREE.Vector3();
let playerForward = new THREE.Vector3(0, 0, 1);
let playerUp = new THREE.Vector3(0, 1, 0);
let playerSpeed = 0;
const maxWalkSpeed = 4.2;
const maxSwimSpeed = 2.0;

let playerMesh = null;
let bodyMesh = null;
let headMesh = null;
let leftEar, rightEar, leftLeg, rightLeg; // References for procedural animations
let scrollMeshes = new Map(); // wishId -> Group
let lilyObjects = new Map();  // wishId -> Group
let plantingSpotRings = new Map(); // wishId -> RingMesh
let birthdayCakeGroup = null;

// Inventory & Quest tracking
let carriedWish = null; // currently carrying scroll object
let nearbyInteractable = null; // { type: 'scroll'|'plant'|'lily'|'cake', id: ... }

// Controls State
const keys = { w: false, a: false, s: false, d: false, ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false };
let joystickDir = { x: 0, y: 0 }; // touch input vector
let isTouchingJoystick = false;

// Camera Follow angles for Orbit Look
let camYawOffset = 0;
let camPitchOffset = 0.45; // default angle above player (approx 25 degrees)
let isDraggingCamera = false;
let previousMousePos = { x: 0, y: 0 };

// Audio State
let bgMusicElement = null;
let isMusicPlaying = false;
const LOFI_TRACKS = [
  { title: "Dreamy Pond", url: "public/music/bg music.mp3" },
  { title: "Cozy Planet Lofi", url: "public/music/bg music.mp3" }
];
let currentTrackIndex = 0;

// UI Elements
const loaderOverlay = document.getElementById('loader-overlay');
const loaderProgress = document.getElementById('loader-progress');
const loaderStatusText = document.getElementById('loader-status-text');
const btnEnterExperience = document.getElementById('btn-enter-experience');

const uiContainer = document.getElementById('ui-container');
const questIndicator = document.getElementById('quest-indicator');
const gardenStats = document.getElementById('garden-stats');
const btnResetGame = document.getElementById('btn-reset-game');
const btnToggleWishes = document.getElementById('btn-toggle-wishes');
const btnCloseWishes = document.getElementById('btn-close-wishes');
const wishesPanel = document.getElementById('wishes-panel');
const wishesList = document.getElementById('wishes-list');

const interactionPrompt = document.getElementById('interaction-prompt');
const promptKey = document.getElementById('prompt-action-key');
const promptText = document.getElementById('prompt-action-text');

const memoryModal = document.getElementById('memory-modal');
const btnCloseModal = document.getElementById('btn-close-modal');
const modalSender = document.getElementById('modal-sender');
const modalDate = document.getElementById('modal-date');
const modalDescription = document.getElementById('modal-description');
const modalSignatureSender = document.getElementById('modal-signature-sender');

const celebrationOverlay = document.getElementById('celebration-overlay');
const btnCelebrateMore = document.getElementById('btn-celebrate-more');
const btnBackToGarden = document.getElementById('btn-back-to-garden');
const uiCandle = document.getElementById('ui-candle-elem');

const soundWaveBars = document.getElementById('sound-wave-bars');
const audioTrackTitle = document.getElementById('audio-track-title');
const musicToggleBtn = document.getElementById('btn-music-toggle');
const fileUploadInput = document.getElementById('music-file-upload');

// Initialize the game
window.addEventListener('DOMContentLoaded', () => {
  initEngine();
  initGardenWorld();
  initUI();
  initControls();

  animate();
  simulateLoading();
});

// --- Asset loading simulation ---
function simulateLoading() {
  let progress = 0;
  const interval = setInterval(() => {
    progress += Math.floor(Math.random() * 12) + 6;
    if (progress >= 100) {
      progress = 100;
      clearInterval(interval);
      loaderProgress.style.width = '100%';
      loaderStatusText.innerText = 'Warm pastel world generated!';
      btnEnterExperience.classList.remove('disabled');
      btnEnterExperience.removeAttribute('disabled');
    } else {
      loaderProgress.style.width = `${progress}%`;
      loaderStatusText.innerText = `Assembling hills & round trees... ${progress}%`;
    }
  }, 120);
}

// --- Initialize Three.js Engine ---
function initEngine() {
  const canvas = document.getElementById('webgl-canvas');
  scene = new THREE.Scene();

  // Bright warm peach pastel sky color
  scene.background = new THREE.Color(0xffeedd);

  // Fog blends with sky color for low-poly atmospheric depth
  scene.fog = new THREE.FogExp2(0xffeedd, 0.015);

  // Camera Setup (lower FOV for clean isomorphic feel)
  camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 15, 25);

  // Renderer Setup
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  clock = new THREE.Clock();

  // Lights: Soft warm golden sunset lighting
  const ambientLight = new THREE.AmbientLight(0xfff5ea, 0.55);
  scene.add(ambientLight);

  const sunLight = new THREE.DirectionalLight(0xffedd5, 1.25);
  sunLight.position.set(20, 30, 15);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  sunLight.shadow.bias = -0.0005;
  scene.add(sunLight);

  // Soft pastel violet bounce light from below
  const groundBounceLight = new THREE.DirectionalLight(0xdec9e9, 0.5);
  groundBounceLight.position.set(-10, -20, -10);
  scene.add(groundBounceLight);

  // Group to rotate/contain everything on the planet
  planetGroup = new THREE.Group();
  scene.add(planetGroup);

  window.addEventListener('resize', onWindowResize);
}

// --- Initialize World & Landscape (Pastel Messenger Aesthetics) ---
function initGardenWorld() {
  // 1. Planet sphere geometry with indentation
  const planetGeom = new THREE.IcosahedronGeometry(10, 4);
  const posAttr = planetGeom.attributes.position;

  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const y = posAttr.getY(i);
    const z = posAttr.getZ(i);
    const r = Math.sqrt(x * x + y * y + z * z);

    // Smooth natural hills noise
    const noise = (Math.sin(x * 0.5) + Math.cos(y * 0.5) + Math.sin(z * 0.5)) * 0.12;

    // Polar angle to indent top polar cap for water pond
    const theta = Math.acos(y / r);

    let indentFactor = 1.0;
    if (theta < 0.38) {
      indentFactor = 0.94; // pond bottom
    } else if (theta < 0.50) {
      const t = (theta - 0.38) / (0.50 - 0.38);
      indentFactor = 0.94 + 0.06 * t; // slope
    }

    const finalR = r * indentFactor + noise;
    const rScale = finalR / r;
    posAttr.setXYZ(i, x * rScale, y * rScale, z * rScale);
  }
  planetGeom.computeVertexNormals();

  // Grass material: soft sage green with flat shading
  const grassMat = new THREE.MeshStandardMaterial({
    color: 0x8cb369, // warm sage green
    roughness: 0.95,
    metalness: 0.0,
    flatShading: true
  });
  const planetMesh = new THREE.Mesh(planetGeom, grassMat);
  planetMesh.receiveShadow = true;
  planetMesh.castShadow = true;
  planetGroup.add(planetMesh);

  // 2. The Pond Water Cap
  const waterGeom = new THREE.SphereGeometry(9.66, 32, 16, 0, Math.PI * 2, 0, 0.50);
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x70d6ff, // cozy pastel blue
    transparent: true,
    opacity: 0.8,
    roughness: 0.1,
    metalness: 0.1,
    flatShading: true
  });
  waterMesh = new THREE.Mesh(waterGeom, waterMat);
  planetGroup.add(waterMesh);

  // 3. Foliage: Round Low-Poly Trees
  spawnPastelTrees();

  // 4. Fireflies drifting
  spawnFireflies();

  // 5. Star Particles (twinkles in sunset)
  spawnStarfield();

  // 6. Build the Player Character
  spawnPlayerBunny();

  // 7. Load / Restart Game Level Entities
  loadGameEntities();
}

// --- Spawn Messenger-style Round Trees ---
function spawnPastelTrees() {
  const treeCount = 18;
  const colors = [0xffcad4, 0xb3e5fc, 0xd8f3dc, 0xffe5ec]; // pastel pink, blue, green, cream

  const trunkGeom = new THREE.CylinderGeometry(0.12, 0.2, 1.2, 5);
  trunkGeom.translate(0, 0.6, 0);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x9a7b56, roughness: 0.9, flatShading: true });

  for (let i = 0; i < treeCount; i++) {
    // Distribute trees on land (theta > 0.65 to keep away from pond)
    const theta = 0.65 + Math.random() * 1.8;
    const phi = Math.random() * Math.PI * 2;
    const r = 9.9;

    const x = r * Math.sin(theta) * Math.cos(phi);
    const y = r * Math.cos(theta);
    const z = r * Math.sin(theta) * Math.sin(phi);

    const treeGroup = new THREE.Group();
    treeGroup.position.set(x, y, z);

    // Align tree up with sphere normal
    const normal = new THREE.Vector3(x, y, z).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const quat = new THREE.Quaternion().setFromUnitVectors(up, normal);
    treeGroup.quaternion.copy(quat);

    // Trunk
    const trunk = new THREE.Mesh(trunkGeom, trunkMat);
    trunk.castShadow = true;
    treeGroup.add(trunk);

    // Round Low-Poly Foliage (Concentric Spheres)
    const folMat = new THREE.MeshStandardMaterial({
      color: colors[i % colors.length],
      roughness: 0.9,
      flatShading: true
    });

    // Main leaf cluster
    const mainFoliage = new THREE.Mesh(new THREE.DodecahedronGeometry(0.9, 1), folMat);
    mainFoliage.position.y = 1.6;
    mainFoliage.castShadow = true;
    treeGroup.add(mainFoliage);

    // Side puff cluster
    const puff = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55, 1), folMat);
    puff.position.set(0.4, 1.4, -0.2);
    puff.castShadow = true;
    treeGroup.add(puff);

    const puff2 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.45, 1), folMat);
    puff2.position.set(-0.35, 1.8, 0.25);
    puff2.castShadow = true;
    treeGroup.add(puff2);

    // Scale bounce on spawn
    treeGroup.scale.set(0.001, 0.001, 0.001);
    gsap.to(treeGroup.scale, { x: 1, y: 1, z: 1, duration: 1.2 + Math.random() * 0.5, ease: "elastic.out(1, 0.8)", delay: i * 0.03 });

    planetGroup.add(treeGroup);
    trees.push(treeGroup);
  }
}

// --- Spawn drifting fireflies ---
function spawnFireflies() {
  const count = 35;
  const ffGeom = new THREE.SphereGeometry(0.06, 4, 4);
  const ffMat = new THREE.MeshBasicMaterial({ color: 0xfde047 });

  for (let i = 0; i < count; i++) {
    const ff = new THREE.Mesh(ffGeom, ffMat);
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 2 - 1);
    const r = 10.2 + Math.random() * 1.5;

    ff.position.set(
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.cos(phi),
      r * Math.sin(phi) * Math.sin(theta)
    );

    ff.userData = {
      basePosition: ff.position.clone(),
      seed: Math.random() * 100,
      speed: 0.3 + Math.random() * 0.4
    };

    planetGroup.add(ff);
    fireflies.push(ff);
  }
}

// --- Spawn Starfield Points ---
function spawnStarfield() {
  const count = 800;
  const geom = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const radius = 160 + Math.random() * 40;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 2 - 1);

    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.cos(phi);
    positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
  }
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const starMat = new THREE.PointsMaterial({
    color: 0xffcad4,
    size: 0.6,
    transparent: true,
    opacity: 0.5,
    sizeAttenuation: true
  });
  starParticles = new THREE.Points(geom, starMat);
  scene.add(starParticles);
}

// --- Procedural Generation of Bunny Player ---
function spawnPlayerBunny() {
  playerMesh = new THREE.Group();
  playerMesh.name = "player-bunny";

  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, flatShading: true });
  const pinkMat = new THREE.MeshStandardMaterial({ color: 0xffb5a7, roughness: 0.9, flatShading: true });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x47322b, roughness: 0.9, flatShading: true });

  // 1. Body (cylinder mesh, pivot at base, positioned at y = 0.35)
  const bodyGeom = new THREE.CylinderGeometry(0.3, 0.42, 0.7, 16);
  bodyMesh = new THREE.Mesh(bodyGeom, whiteMat);
  bodyMesh.position.y = 0.35;
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  playerMesh.add(bodyMesh);

  // 2. Bag (slung on side of body)
  const bagGeom = new THREE.BoxGeometry(0.18, 0.24, 0.3);
  const bagMat = new THREE.MeshStandardMaterial({ color: 0x8a5a36, roughness: 0.95, flatShading: true });
  const bag = new THREE.Mesh(bagGeom, bagMat);
  bag.position.set(-0.35, 0.1, -0.05); // relative to body center
  bag.castShadow = true;
  bodyMesh.add(bag);

  // 3. Strap (wrapped around body)
  const strapGeom = new THREE.CylinderGeometry(0.4, 0.4, 0.08, 16);
  strapGeom.scale(0.8, 1, 1);
  strapGeom.rotateZ(Math.PI / 4);
  const strapMat = new THREE.MeshBasicMaterial({ color: 0x613f26 });
  const strap = new THREE.Mesh(strapGeom, strapMat);
  strap.position.set(0, 0.1, 0.05);
  bodyMesh.add(strap);

  // 4. Head (child of body Mesh)
  const headGeom = new THREE.SphereGeometry(0.35, 16, 16);
  headMesh = new THREE.Mesh(headGeom, whiteMat);
  headMesh.position.set(0, 0.55, 0.05); // sits on top of body
  headMesh.castShadow = true;
  bodyMesh.add(headMesh);

  // 5. Floppy Ears (children of head Mesh)
  const earGeom = new THREE.CylinderGeometry(0.04, 0.06, 0.4, 12);
  earGeom.scale(1, 1, 0.5);
  earGeom.translate(0, 0.2, 0); // pivot from base

  const earInnerGeom = new THREE.CylinderGeometry(0.015, 0.03, 0.3, 12);
  earInnerGeom.scale(1, 1, 0.25);
  earInnerGeom.translate(0, 0.18, 0.02);

  // Left Ear
  leftEar = new THREE.Group();
  leftEar.position.set(-0.16, 0.3, 0.0); // relative to head center
  leftEar.rotation.z = 0.15;
  const lEarOuter = new THREE.Mesh(earGeom, whiteMat);
  const lEarInner = new THREE.Mesh(earInnerGeom, pinkMat);
  leftEar.add(lEarOuter);
  leftEar.add(lEarInner);
  headMesh.add(leftEar);

  // Right Ear
  rightEar = new THREE.Group();
  rightEar.position.set(0.16, 0.3, 0.0);
  rightEar.rotation.z = -0.15;
  const rEarOuter = new THREE.Mesh(earGeom, whiteMat);
  const rEarInner = new THREE.Mesh(earInnerGeom, pinkMat);
  rightEar.add(rEarOuter);
  rightEar.add(rEarInner);
  headMesh.add(rightEar);

  // 6. Eyes (children of head Mesh)
  const eyeGeom = new THREE.SphereGeometry(0.04, 8, 8);
  const lEye = new THREE.Mesh(eyeGeom, darkMat);
  lEye.position.set(-0.14, 0.08, 0.3); // relative to head center
  const rEye = new THREE.Mesh(eyeGeom, darkMat);
  rEye.position.set(0.14, 0.08, 0.3);
  headMesh.add(lEye);
  headMesh.add(rEye);

  // 7. Cheek Blush (children of head Mesh)
  const blushGeom = new THREE.SphereGeometry(0.05, 8, 8);
  blushGeom.scale(1, 0.5, 1);
  const lBlush = new THREE.Mesh(blushGeom, pinkMat);
  lBlush.position.set(-0.22, -0.04, 0.27);
  const rBlush = new THREE.Mesh(blushGeom, pinkMat);
  rBlush.position.set(0.22, -0.04, 0.27);
  headMesh.add(lBlush);
  headMesh.add(rBlush);

  // 8. Small legs (children of playerMesh directly, pivot at top)
  const legGeom = new THREE.CapsuleGeometry(0.07, 0.18, 8, 16);
  legGeom.translate(0, -0.09, 0); // pivot at top joint

  leftLeg = new THREE.Mesh(legGeom, whiteMat);
  leftLeg.position.set(-0.15, 0.1, 0.0);
  playerMesh.add(leftLeg);

  rightLeg = new THREE.Mesh(legGeom, whiteMat);
  rightLeg.position.set(0.15, 0.1, 0.0);
  playerMesh.add(rightLeg);

  // Set starting position and orientation
  playerMesh.position.copy(playerPos);
  planetGroup.add(playerMesh);
}

// --- Procedural Letter Scroll Mesh ---
function createLetterScrollMesh() {
  const scrollGroup = new THREE.Group();

  // Rolled paper cylinder (parchment)
  const paperGeom = new THREE.CylinderGeometry(0.1, 0.1, 0.48, 8);
  paperGeom.rotateZ(Math.PI / 2); // lie horizontal
  const paperMat = new THREE.MeshStandardMaterial({
    color: 0xfefae0, // clean cream paper
    roughness: 0.9,
    flatShading: true
  });
  const paper = new THREE.Mesh(paperGeom, paperMat);
  paper.castShadow = true;
  scrollGroup.add(paper);

  // Red ribbon wrap around middle
  const ribbonGeom = new THREE.CylinderGeometry(0.108, 0.108, 0.08, 8);
  ribbonGeom.rotateZ(Math.PI / 2);
  const ribbonMat = new THREE.MeshBasicMaterial({ color: 0xe63946 }); // red ribbon
  const ribbon = new THREE.Mesh(ribbonGeom, ribbonMat);
  scrollGroup.add(ribbon);

  return scrollGroup;
}

// --- Generate 3D Procedural Lily Pad ---
function createLilyPadMesh(radius = 0.55) {
  const padShape = new THREE.Shape();
  const wedgeAngle = 0.44;
  const startAngle = wedgeAngle / 2;
  const endAngle = Math.PI * 2 - wedgeAngle / 2;
  const segments = 20;

  padShape.moveTo(0, 0);
  for (let i = 0; i <= segments; i++) {
    const a = startAngle + (i / segments) * (endAngle - startAngle);
    padShape.lineTo(Math.cos(a) * radius, Math.sin(a) * radius);
  }
  padShape.closePath();

  const extrudeSettings = { depth: 0.02, bevelEnabled: true, bevelSegments: 1, steps: 1, bevelSize: 0.005, bevelThickness: 0.005 };
  const padGeom = new THREE.ExtrudeGeometry(padShape, extrudeSettings);
  padGeom.rotateX(-Math.PI / 2);

  const padMat = new THREE.MeshStandardMaterial({
    color: 0x38b000, // vibrant pastel-like leaf green
    roughness: 0.9,
    flatShading: true
  });
  const padMesh = new THREE.Mesh(padGeom, padMat);
  padMesh.receiveShadow = true;
  padMesh.castShadow = true;
  return padMesh;
}

// --- Generate 3D Procedural Lily Flower ---
function createLilyFlowerMesh(colorName = "pink") {
  const flowerGroup = new THREE.Group();

  let petalColorHex = 0xffb5a7;
  let emissiveColorHex = 0xff7096;

  if (colorName === "white") {
    petalColorHex = 0xf8fafc;
    emissiveColorHex = 0xe2e8f0;
  } else if (colorName === "purple") {
    petalColorHex = 0xe8c1ff;
    emissiveColorHex = 0xc084fc;
  } else if (colorName === "gold") {
    petalColorHex = 0xfde2e4;
    emissiveColorHex = 0xfbbf24;
  }

  const petalMat = new THREE.MeshStandardMaterial({
    color: petalColorHex,
    emissive: emissiveColorHex,
    emissiveIntensity: 0.35,
    roughness: 0.7,
    flatShading: true
  });

  const petalGeom = new THREE.ConeGeometry(0.08, 0.36, 4);
  petalGeom.scale(1, 1, 0.3);
  petalGeom.rotateX(Math.PI / 2);
  petalGeom.translate(0, 0, 0.16);

  const layers = [
    { count: 12, angle: 0.2, radius: 0.09 },
    { count: 8, angle: 0.6, radius: 0.05 },
    { count: 6, angle: 1.0, radius: 0.02 }
  ];

  layers.forEach((layer) => {
    for (let i = 0; i < layer.count; i++) {
      const angle = (i / layer.count) * Math.PI * 2;
      const petal = new THREE.Mesh(petalGeom, petalMat);
      petal.position.set(Math.cos(angle) * layer.radius, 0.01, Math.sin(angle) * layer.radius);
      petal.rotation.y = -angle + Math.PI / 2;
      petal.rotation.x = layer.angle;
      flowerGroup.add(petal);
    }
  });

  // center yellow stamen
  const stMat = new THREE.MeshBasicMaterial({ color: 0xfec89a });
  const stGeom = new THREE.CylinderGeometry(0.015, 0.015, 0.12, 4);
  stGeom.translate(0, 0.06, 0);

  for (let i = 0; i < 6; i++) {
    const st = new THREE.Mesh(stGeom, stMat);
    const angle = (i / 6) * Math.PI * 2;
    st.position.set(Math.cos(angle) * 0.025, 0.02, Math.sin(angle) * 0.025);
    st.rotation.x = 0.15;
    st.rotation.z = Math.sin(angle) * 0.15;
    flowerGroup.add(st);
  }

  return flowerGroup;
}

// --- Spawn 3D Birthday Cake ---
function spawnBirthdayCake() {
  if (birthdayCakeGroup) return;

  birthdayCakeGroup = new THREE.Group();
  birthdayCakeGroup.name = "birthday-cake";
  birthdayCakeGroup.position.set(0, 9.66, 0); // Spawns directly at the top pole (pond center)

  // Plate
  const plateGeom = new THREE.CylinderGeometry(0.8, 0.8, 0.05, 12);
  const plateMat = new THREE.MeshStandardMaterial({ color: 0xefdfbb, roughness: 0.5 });
  const plate = new THREE.Mesh(plateGeom, plateMat);
  birthdayCakeGroup.add(plate);

  // Cake Body
  const cakeGeom = new THREE.CylinderGeometry(0.65, 0.65, 0.45, 12);
  cakeGeom.translate(0, 0.225, 0);
  const cakeMat = new THREE.MeshStandardMaterial({ color: 0xffcad4, roughness: 0.9, flatShading: true }); // pink frosting
  const cake = new THREE.Mesh(cakeGeom, cakeMat);
  cake.castShadow = true;
  birthdayCakeGroup.add(cake);

  // Top frosting details
  const frostingGeom = new THREE.CylinderGeometry(0.66, 0.66, 0.08, 12);
  frostingGeom.translate(0, 0.42, 0);
  const frostingMat = new THREE.MeshStandardMaterial({ color: 0xf7aef8, roughness: 0.8, flatShading: true });
  const frosting = new THREE.Mesh(frostingGeom, frostingMat);
  birthdayCakeGroup.add(frosting);

  // Candle
  const candleGeom = new THREE.CylinderGeometry(0.04, 0.04, 0.22, 6);
  candleGeom.translate(0, 0.56, 0);
  const candleMat = new THREE.MeshStandardMaterial({
    color: 0xb3e5fc,
    roughness: 0.9
  });
  const candle = new THREE.Mesh(candleGeom, candleMat);
  birthdayCakeGroup.add(candle);

  // Candle Flame
  const flameGeom = new THREE.ConeGeometry(0.035, 0.12, 5);
  flameGeom.translate(0, 0.70, 0);
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xffd166 });
  const flame = new THREE.Mesh(flameGeom, flameMat);
  flame.name = "candle-flame";
  birthdayCakeGroup.add(flame);

  // Add a light to the cake
  const cakeLight = new THREE.PointLight(0xffb703, 1.2, 5);
  cakeLight.position.set(0, 0.8, 0);
  cakeLight.name = "cake-light";
  birthdayCakeGroup.add(cakeLight);

  // Scale grow animation
  birthdayCakeGroup.scale.set(0.001, 0.001, 0.001);
  planetGroup.add(birthdayCakeGroup);

  gsap.to(birthdayCakeGroup.scale, {
    x: 1.0,
    y: 1.0,
    z: 1.0,
    duration: 1.8,
    ease: "elastic.out(1, 0.75)"
  });

  // Confetti burst on spawn
  confetti({
    particleCount: 50,
    spread: 60,
    origin: { y: 0.7 },
    colors: ['#ffcad4', '#b3e5fc', '#ffd166']
  });
}

// --- Load / Reload Level Entities from memories.js ---
function loadGameEntities() {
  // Clear any existing entities
  scrollMeshes.forEach(mesh => planetGroup.remove(mesh));
  scrollMeshes.clear();

  lilyObjects.forEach(mesh => planetGroup.remove(mesh));
  lilyObjects.clear();

  plantingSpotRings.forEach(mesh => planetGroup.remove(mesh));
  plantingSpotRings.clear();

  if (birthdayCakeGroup) {
    planetGroup.remove(birthdayCakeGroup);
    birthdayCakeGroup = null;
  }

  carriedWish = null;
  nearbyInteractable = null;

  // Reset character position to top next to pond
  playerPos.set(0, 10, 0);
  playerVelocity.set(0, 0, 0);
  playerForward.set(0, 0, 1);
  playerSpeed = 0;

  if (playerMesh) {
    playerMesh.position.copy(playerPos);
    playerMesh.quaternion.set(0, 0, 0, 1);
  }

  // Deactivate controls state
  Object.keys(keys).forEach(k => keys[k] = false);

  const wishes = getWishes();

  wishes.forEach(wish => {
    // 1. Spawning Scrolls (if not collected and not planted)
    if (!wish.collected && !wish.planted) {
      const scroll = createLetterScrollMesh();
      const pos = wish.landPosition;
      scroll.position.set(pos.x, pos.y, pos.z);

      // Orient normal to surface
      const normal = new THREE.Vector3(pos.x, pos.y, pos.z).normalize();
      const up = new THREE.Vector3(0, 1, 0);
      const quat = new THREE.Quaternion().setFromUnitVectors(up, normal);
      scroll.quaternion.copy(quat);

      planetGroup.add(scroll);
      scrollMeshes.set(wish.id, scroll);
    }

    // 2. Spawning Lily Pads/Flowers (if planted)
    if (wish.planted) {
      const lilyGroup = new THREE.Group();
      const pos = wish.pondPosition;
      lilyGroup.position.set(pos.x, pos.y, pos.z);

      const normal = new THREE.Vector3(pos.x, pos.y, pos.z).normalize();
      const up = new THREE.Vector3(0, 1, 0);
      const quat = new THREE.Quaternion().setFromUnitVectors(up, normal);
      lilyGroup.quaternion.copy(quat);

      const pad = createLilyPadMesh();
      lilyGroup.add(pad);

      const flower = createLilyFlowerMesh(wish.color);
      flower.position.y = 0.03;
      lilyGroup.add(flower);

      planetGroup.add(lilyGroup);
      lilyObjects.set(wish.id, lilyGroup);
    }

    // 3. Spawning Planting Rings (if collected but not planted)
    if (wish.collected && !wish.planted) {
      createPlantingRing(wish);
    }
  });

  // 4. Spawn Birthday Cake (if all wishes are already planted and read)
  const allPlanted = wishes.every(w => w.planted);
  const allRead = wishes.every(w => w.read);
  if (allPlanted && allRead) {
    spawnBirthdayCake();
  }

  // Update Quest Indicator text
  updateQuestStatus();
}

// Create a glowing target ring for planting
function createPlantingRing(wish) {
  if (plantingSpotRings.has(wish.id)) return;

  const ringGeom = new THREE.RingGeometry(0.48, 0.55, 16);
  ringGeom.rotateX(-Math.PI / 2); // lay flat

  // Emissive warm gold glowing ring material
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xfbbf24,
    transparent: true,
    opacity: 0.8,
    side: THREE.DoubleSide
  });

  const ringMesh = new THREE.Mesh(ringGeom, ringMat);
  const pos = wish.pondPosition;
  ringMesh.position.set(pos.x, pos.y, pos.z);

  const normal = new THREE.Vector3(pos.x, pos.y, pos.z).normalize();
  const up = new THREE.Vector3(0, 1, 0);
  const quat = new THREE.Quaternion().setFromUnitVectors(up, normal);
  ringMesh.quaternion.copy(quat);

  planetGroup.add(ringMesh);
  plantingSpotRings.set(wish.id, ringMesh);
}

// --- Spores Particle Bloom Burst ---
function createPollenBurst(position, colorName) {
  let sporeColor = 0xfda4b8;
  if (colorName === "white") sporeColor = 0xffffff;
  if (colorName === "purple") sporeColor = 0xc084fc;
  if (colorName === "gold") sporeColor = 0xfbbf24;

  const count = 18;
  const pGeom = new THREE.BufferGeometry();
  const positions = [];
  const velocities = [];

  for (let i = 0; i < count; i++) {
    positions.push(position.x, position.y + 0.15, position.z);
    const speed = 0.03 + Math.random() * 0.03;
    const angle = Math.random() * Math.PI * 2;
    velocities.push(
      Math.cos(angle) * speed,
      0.04 + Math.random() * 0.05,
      Math.sin(angle) * speed
    );
  }

  pGeom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const pMat = new THREE.PointsMaterial({
    color: sporeColor,
    size: 0.2,
    transparent: true,
    opacity: 0.9,
    depthWrite: false
  });

  const pSystem = new THREE.Points(pGeom, pMat);
  planetGroup.add(pSystem);

  const pPos = pSystem.geometry.attributes.position;
  const anim = { progress: 0 };
  gsap.to(anim, {
    progress: 1,
    duration: 1.4,
    onUpdate: () => {
      for (let i = 0; i < count; i++) {
        const idx = i * 3;
        pPos.array[idx] += velocities[idx];
        pPos.array[idx + 1] += velocities[idx + 1];
        pPos.array[idx + 2] += velocities[idx + 2];
      }
      pPos.needsUpdate = true;
      pMat.opacity = 1.0 - anim.progress;
    },
    onComplete: () => {
      planetGroup.remove(pSystem);
      pGeom.dispose();
      pMat.dispose();
    }
  });
}

// --- Gameplay Quest State Handler & UI Sync ---
function updateQuestStatus() {
  const wishes = getWishes();
  const collectedCount = wishes.filter(w => w.collected).length;
  const plantedCount = wishes.filter(w => w.planted).length;
  const readCount = wishes.filter(w => w.read).length;

  gardenStats.innerText = `${plantedCount}/4 Lilies Bloomed`;

  // Determine active target scroll
  const carried = wishes.find(w => w.collected && !w.planted);

  if (carried) {
    carriedWish = carried;
    questIndicator.innerText = `Carrying ${carried.sender}'s letter. Take it to the pond!`;
  } else {
    carriedWish = null;
    const nextUncollected = wishes.find(w => !w.collected && !w.planted);

    if (nextUncollected) {
      questIndicator.innerText = `Find ${nextUncollected.sender}'s letter on the grass!`;
    } else if (plantedCount < 4) {
      questIndicator.innerText = `Carry collected wishes to the glowing spots at the pond!`;
    } else if (readCount < 4) {
      questIndicator.innerText = `Walk onto lily pads and read wishes from bloomed lilies!`;
    } else {
      questIndicator.innerText = `Birthday Cake spawned! Go to the center pond.`;
      spawnBirthdayCake();
    }
  }

  // Hide celebrate toolbar unless final cake is blown
  const allRead = wishes.every(w => w.read);
  const cakeBlown = document.getElementById('ui-candle-elem').classList.contains('blown-out');
  const celebrateBtn = document.getElementById('btn-trigger-celebrate');
  if (allRead && cakeBlown) {
    celebrateBtn.classList.remove('hidden');
  } else {
    celebrateBtn.classList.add('hidden');
  }
}

// --- Keyboard Controls listener ---
function initControls() {
  window.addEventListener('keydown', (e) => {
    if (e.key in keys) keys[e.key] = true;

    // Action key bindings
    if (e.key === 'e' || e.key === 'E') {
      handleInteractAction();
    }
    if (e.key === ' ') {
      e.preventDefault(); // prevent scroll page
      handlePlantAction();
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.key in keys) keys[e.key] = false;
  });

  // Mobile Joysticks Touch events binding
  const joyZone = document.getElementById('joystick-zone');
  const joyKnob = document.getElementById('joystick-knob');
  const maxLimit = 36; // boundary limits of joystick knob

  joyZone.addEventListener('touchstart', (e) => {
    isTouchingJoystick = true;
    updateJoystickPosition(e.targetTouches[0]);
  });

  joyZone.addEventListener('touchmove', (e) => {
    if (!isTouchingJoystick) return;
    updateJoystickPosition(e.targetTouches[0]);
  });

  joyZone.addEventListener('touchend', () => {
    isTouchingJoystick = false;
    joystickDir = { x: 0, y: 0 };
    joyKnob.style.transform = `translate(0px, 0px)`;
  });

  function updateJoystickPosition(touch) {
    const rect = joyZone.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dx = touch.clientX - centerX;
    const dy = touch.clientY - centerY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist === 0) {
      joystickDir = { x: 0, y: 0 };
      return;
    }

    const angle = Math.atan2(dy, dx);
    const limitDist = Math.min(dist, maxLimit);

    // Joystick vector values clamped -1 to 1
    joystickDir.x = Math.cos(angle) * (limitDist / maxLimit);
    joystickDir.y = Math.sin(angle) * (limitDist / maxLimit);

    // Move visual handle
    joyKnob.style.transform = `translate(${Math.cos(angle) * limitDist}px, ${Math.sin(angle) * limitDist}px)`;
  }

  // Mobile action buttons
  document.getElementById('btn-mobile-interact').addEventListener('click', handleInteractAction);
  document.getElementById('btn-mobile-plant').addEventListener('click', handlePlantAction);

  // Third person look mouse drag (Orbit Look when idle)
  const canvas = document.getElementById('webgl-canvas');
  canvas.addEventListener('mousedown', (e) => {
    isDraggingCamera = true;
    previousMousePos = { x: e.clientX, y: e.clientY };
  });

  canvas.addEventListener('mousemove', (e) => {
    if (!isDraggingCamera) return;
    const deltaX = e.clientX - previousMousePos.x;
    const deltaY = e.clientY - previousMousePos.y;

    camYawOffset -= deltaX * 0.005;
    // limit pitch angles to avoid going directly overhead or below ground
    camPitchOffset = Math.max(0.02, Math.min(1.2, camPitchOffset + deltaY * 0.005));

    previousMousePos = { x: e.clientX, y: e.clientY };
  });

  window.addEventListener('mouseup', () => { isDraggingCamera = false; });
}

// --- Walk Physics & Loop Tick ---
function animate() {
  requestAnimationFrame(animate);

  const delta = Math.min(clock.getDelta(), 0.1); // prevent extreme jumps when tab unfocused
  const elapsed = clock.getElapsedTime();

  // 1. Fireflies drifting
  fireflies.forEach(ff => {
    const ud = ff.userData;
    const time = elapsed * ud.speed + ud.seed;
    ff.position.x = ud.basePosition.x + Math.sin(time) * 0.5;
    ff.position.y = ud.basePosition.y + Math.cos(time * 0.7) * 0.4;
    ff.position.z = ud.basePosition.z + Math.sin(time * 1.2) * 0.5;
  });

  // 2. Twinkle star rotations
  if (starParticles) {
    starParticles.rotation.y = elapsed * 0.002;
  }

  // 3. Water surface breathing glow
  if (waterMesh) {
    waterMesh.material.opacity = 0.72 + Math.sin(elapsed * 1.5) * 0.06;
  }

  // 4. Update Game Character Movement physics
  if (playerMesh) {
    updatePlayerPhysics(delta, elapsed);
  }

  // 5. Check gameplay bounds / prompt triggers
  checkInteractionDistances();

  // 6. Camera Follow Controller
  updateThirdPersonCamera(delta);

  renderer.render(scene, camera);
}

// --- Player Movement Spherical Gravity & Tangent Space walk ---
function updatePlayerPhysics(delta, elapsed) {
  // Determine movement input vector
  let moveX = 0;
  let moveZ = 0;

  if (keys.w || keys.ArrowUp) moveZ = 1;
  if (keys.s || keys.ArrowDown) moveZ = -1;
  if (keys.a || keys.ArrowLeft) moveX = -1;
  if (keys.d || keys.ArrowRight) moveX = 1;

  // Joystick overrides keyboard
  if (isTouchingJoystick) {
    moveX = joystickDir.x;
    moveZ = -joystickDir.y; // Invert touch coordinate Y so dragging up moves forward
  }

  const hasInput = (Math.abs(moveX) > 0.05 || Math.abs(moveZ) > 0.05);

  // Normal at player's current position (local gravity vector direction)
  playerUp.copy(playerPos).normalize();

  // Swimming vs Walking checks (near the top polar pond cap)
  const polarTheta = Math.acos(playerUp.y); // angle from North Pole
  let onSolidLilyPad = false;
  let standingWishId = null;

  // check if player is standing on any planted lily pad
  const wishes = getWishes();
  for (let i = 0; i < wishes.length; i++) {
    const w = wishes[i];
    if (w.planted) {
      const padPos = new THREE.Vector3(w.pondPosition.x, w.pondPosition.y, w.pondPosition.z);
      // distance on the sphere surface
      const dist = playerPos.distanceTo(padPos);
      if (dist < 0.75) {
        onSolidLilyPad = true;
        standingWishId = w.id;
        break;
      }
    }
  }

  let speedCap = maxWalkSpeed;
  let terrainRadius = 10.0; // standard land grass radius

  if (polarTheta < 0.50) { // Inside the pond crater cap
    if (onSolidLilyPad) {
      terrainRadius = 9.72; // stands on top of lily pad (which is at 9.68)
      speedCap = maxWalkSpeed * 0.9;
    } else {
      terrainRadius = 9.66; // sinks in water
      speedCap = maxSwimSpeed; // swimming speed penalty
    }
  }

  // Calculate direction tangent to sphere relative to camera heading
  let inputDirection = new THREE.Vector3();

  if (hasInput) {
    // Project camera axes onto the tangent plane at the player's position
    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);

    // Camera Right: Camera forward cross Up
    const camRight = new THREE.Vector3().crossVectors(camDir, camera.up).normalize();

    // Project vectors onto the tangent plane (orthogonal to playerUp normal)
    const forwardProj = camDir.clone().projectOnPlane(playerUp).normalize();
    const rightProj = camRight.clone().projectOnPlane(playerUp).normalize();

    // Combined input direction
    inputDirection.addScaledVector(rightProj, moveX);
    inputDirection.addScaledVector(forwardProj, moveZ);
    if (inputDirection.lengthSq() > 0.01) {
      inputDirection.normalize();
    }
  }

  // Acceleration & Deceleration physics
  if (hasInput) {
    playerSpeed = THREE.MathUtils.lerp(playerSpeed, speedCap, 0.12);
    playerForward.lerp(inputDirection, 0.15).normalize(); // smoothly pivot forward vector
  } else {
    playerSpeed = THREE.MathUtils.lerp(playerSpeed, 0, 0.15);
  }

  // Apply tangent velocity step
  if (playerSpeed > 0.01) {
    playerPos.addScaledVector(playerForward, playerSpeed * delta);
  }

  // Clamp player position to spherical terrain surface
  playerPos.normalize().multiplyScalar(terrainRadius);
  playerMesh.position.copy(playerPos);

  // Align player orientation basis (Y = sphere normal, Z = player forward direction)
  // Using a right-handed basis to avoid coordinate system reflections (which cause deformed geometry):
  // X axis (tangentRight) = playerUp x playerForward
  // Z axis (orthoForward) = tangentRight x playerUp (this aligns with playerForward)
  const tangentRight = new THREE.Vector3().crossVectors(playerUp, playerForward).normalize();
  const orthoForward = new THREE.Vector3().crossVectors(tangentRight, playerUp).normalize();

  // Recalculate forward to ensure strict orthogonality
  playerForward.copy(orthoForward);

  // Create rotation matrix from coordinates (bunny faces orthoForward along Z-axis)
  const orientMatrix = new THREE.Matrix4().makeBasis(tangentRight, playerUp, orthoForward);
  const targetRotation = new THREE.Quaternion().setFromRotationMatrix(orientMatrix);
  playerMesh.quaternion.slerp(targetRotation, 0.2);

  // Procedural Waddling bunny animations (wobbles, ears bounce, legs rotate)
  if (playerSpeed > 0.1) {
    const isSwimming = (polarTheta < 0.50 && !onSolidLilyPad);
    const waveFreq = isSwimming ? 6 : 14;
    const waveAmp = isSwimming ? 0.05 : 0.08;
    const cycle = elapsed * waveFreq;

    // Body bob and sway (relative to base height 0.35)
    bodyMesh.position.y = 0.35 + Math.sin(cycle) * waveAmp;
    bodyMesh.rotation.z = Math.cos(cycle) * 0.08;
    headMesh.position.y = 0.55 + Math.sin(cycle + 0.5) * (waveAmp * 0.4); // secondary waddle bob

    // Bouncing ears
    leftEar.rotation.z = 0.15 + Math.sin(cycle) * 0.12;
    rightEar.rotation.z = -0.15 - Math.sin(cycle + 0.3) * 0.12;

    // Leg walking cycle
    leftLeg.rotation.x = Math.sin(cycle) * 0.5;
    rightLeg.rotation.x = -Math.sin(cycle) * 0.5;

    // Float ears back if swimming
    if (isSwimming) {
      leftEar.rotation.x = 0.3;
      rightEar.rotation.x = 0.3;
      leftLeg.rotation.x = Math.sin(cycle * 0.5) * 0.15;
      rightLeg.rotation.x = -Math.sin(cycle * 0.5) * 0.15;
    } else {
      leftEar.rotation.x = 0;
      rightEar.rotation.x = 0;
    }
  } else {
    // Idle stance
    bodyMesh.position.y = 0.35;
    bodyMesh.rotation.z = 0;
    headMesh.position.y = 0.55;
    leftEar.rotation.z = 0.15 + Math.sin(elapsed * 1.5) * 0.03;
    rightEar.rotation.z = -0.15 - Math.cos(elapsed * 1.4) * 0.03;
    leftEar.rotation.x = 0;
    rightEar.rotation.x = 0;
    leftLeg.rotation.x = 0;
    rightLeg.rotation.x = 0;
  }
}

// --- Third-Person Camera Follow spring arm ---
function updateThirdPersonCamera(delta) {
  // If moving, we drag camera yaw back directly behind player
  if (playerSpeed > 0.5) {
    // Calculate yaw heading of player relative to global axes
    // We smoothly slerp the camera yaw offset back towards 0
    camYawOffset = THREE.MathUtils.lerp(camYawOffset, 0, 0.04);
  }

  // Camera up matches player spherical up
  const camUp = playerUp;

  // Derive target direction relative to player forward
  // We apply the yaw offset angle to rotate around player normal
  const lookDir = playerForward.clone().negate().normalize();
  lookDir.applyAxisAngle(playerUp, camYawOffset);

  // Compute target position: offset behind player, raised along player normal
  const D = 9.75;
  const distance = D * Math.cos(camPitchOffset);
  const height = D * Math.sin(camPitchOffset);

  const targetCamPos = playerPos.clone()
    .addScaledVector(lookDir, distance)
    .addScaledVector(playerUp, height);

  // Spherically interpolate the camera's position to prevent Z-clipping through the planet's core
  const targetCamDist = targetCamPos.length();
  const currentCamDist = camera.position.length();
  const newCamDist = THREE.MathUtils.lerp(currentCamDist, targetCamDist, 0.07);

  const targetCamDir = targetCamPos.clone().normalize();
  const currentCamDir = camera.position.clone().normalize();

  const newCamDir = new THREE.Vector3().copy(currentCamDir).lerp(targetCamDir, 0.07).normalize();

  camera.position.copy(newCamDir).multiplyScalar(newCamDist);

  // Set camera Up direction
  camera.up.lerp(camUp, 0.1);

  // Look at player center (slightly offset vertically)
  const lookTarget = playerPos.clone().addScaledVector(playerUp, 0.6);
  camera.lookAt(lookTarget);
}

// --- Distance checks for Interactions ---
function checkInteractionDistances() {
  nearbyInteractable = null;
  let minDistance = 1.35;
  const wishes = getWishes();

  // 1. Check scrolls on land
  scrollMeshes.forEach((mesh, wishId) => {
    const w = wishes.find(x => x.id === wishId);
    if (!w) return;

    const dist = playerPos.distanceTo(mesh.position);
    if (dist < minDistance) {
      minDistance = dist;
      nearbyInteractable = { type: 'scroll', id: wishId, data: w };
    }
  });

  // 2. Check planting spots (if carrying scroll)
  if (carriedWish) {
    const ring = plantingSpotRings.get(carriedWish.id);
    if (ring) {
      const dist = playerPos.distanceTo(ring.position);
      if (dist < minDistance) {
        minDistance = dist;
        nearbyInteractable = { type: 'plant', id: carriedWish.id, data: carriedWish };
      }
    }
  }

  // 3. Check bloomed lilies (to read them)
  lilyObjects.forEach((mesh, wishId) => {
    const w = wishes.find(x => x.id === wishId);
    if (!w || !w.planted || w.read) return;

    const dist = playerPos.distanceTo(mesh.position);
    if (dist < 1.0) { // tighter reading bound
      nearbyInteractable = { type: 'lily', id: wishId, data: w };
    }
  });

  // 4. Check birthday cake (finale)
  if (birthdayCakeGroup) {
    const dist = playerPos.distanceTo(birthdayCakeGroup.position);
    const cakeBlown = document.getElementById('ui-candle-elem').classList.contains('blown-out');
    if (dist < 1.4 && !cakeBlown) {
      nearbyInteractable = { type: 'cake', id: 'final-cake' };
    }
  }

  // Update UI prompt panel
  if (nearbyInteractable) {
    interactionPrompt.classList.remove('hidden');

    if (nearbyInteractable.type === 'scroll') {
      promptKey.innerText = 'E';
      promptText.innerText = `Pick up ${nearbyInteractable.data.sender}'s letter`;
    } else if (nearbyInteractable.type === 'plant') {
      promptKey.innerText = 'Space';
      promptText.innerText = `Plant ${nearbyInteractable.data.sender}'s wish lily`;
    } else if (nearbyInteractable.type === 'lily') {
      promptKey.innerText = 'E';
      promptText.innerText = `Read wish from ${nearbyInteractable.data.sender}`;
    } else if (nearbyInteractable.type === 'cake') {
      promptKey.innerText = 'Space';
      promptText.innerText = `Blow out candle! 🎂`;
    }
  } else {
    interactionPrompt.classList.add('hidden');
  }
}

// --- Action trigger handlers ---
function handleInteractAction() {
  if (!nearbyInteractable) return;

  if (nearbyInteractable.type === 'scroll') {
    const wishId = nearbyInteractable.id;
    // Update data state
    collectWish(wishId);

    // Remove mesh from world
    const mesh = scrollMeshes.get(wishId);
    if (mesh) planetGroup.remove(mesh);
    scrollMeshes.delete(wishId);

    // Add planting ring target
    const wish = nearbyInteractable.data;
    createPlantingRing(wish);

    // Trigger visual float effects
    confetti({ particleCount: 15, spread: 30, origin: { y: 0.8 } });

    updateQuestStatus();
  }
  else if (nearbyInteractable.type === 'lily') {
    const wishId = nearbyInteractable.id;
    // Mark as read
    readWish(wishId);

    // Open Polaroid Modal
    openWishModal(nearbyInteractable.data);

    updateQuestStatus();
  }
}

function handlePlantAction() {
  if (!nearbyInteractable) return;

  if (nearbyInteractable.type === 'plant') {
    const wishId = nearbyInteractable.id;
    const wish = nearbyInteractable.data;

    // Update state
    plantWish(wishId);

    // Remove planting ring mesh
    const ring = plantingSpotRings.get(wishId);
    if (ring) planetGroup.remove(ring);
    plantingSpotRings.delete(wishId);

    // Spawn 3D bloomed lily
    const lilyGroup = new THREE.Group();
    const pos = wish.pondPosition;
    lilyGroup.position.set(pos.x, pos.y, pos.z);

    const normal = new THREE.Vector3(pos.x, pos.y, pos.z).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const quat = new THREE.Quaternion().setFromUnitVectors(up, normal);
    lilyGroup.quaternion.copy(quat);

    const pad = createLilyPadMesh();
    lilyGroup.add(pad);

    const flower = createLilyFlowerMesh(wish.color);
    flower.position.y = 0.03;
    lilyGroup.add(flower);

    // Scale grow spring animation
    lilyGroup.scale.set(0.001, 0.001, 0.001);
    planetGroup.add(lilyGroup);
    lilyObjects.set(wishId, lilyGroup);

    gsap.to(lilyGroup.scale, {
      x: 1.0,
      y: 1.0,
      z: 1.0,
      duration: 1.6,
      ease: "elastic.out(1, 0.75)"
    });

    createPollenBurst(pos, wish.color);

    // Spark confetti
    confetti({ particleCount: 30, spread: 50, origin: { y: 0.8 }, colors: ['#f472b6', '#fbbf24'] });

    updateQuestStatus();
  }
  else if (nearbyInteractable.type === 'cake') {
    blowCandle();
  }
}

// --- UI Layouts initializations ---
function initUI() {
  // Enter game click handler
  btnEnterExperience.addEventListener('click', () => {
    loaderOverlay.style.opacity = 0;
    setTimeout(() => {
      loaderOverlay.classList.add('hidden');
      uiContainer.classList.remove('hidden');

      setupAudio();
      toggleMusic();

      // Pivot camera zoom-in transition
      gsap.from(camera.position, {
        x: 0,
        y: 35,
        z: 45,
        duration: 2.2,
        ease: "power2.out"
      });
    }, 800);
  });

  // Music Toggle
  musicToggleBtn.addEventListener('click', toggleMusic);

  // Reset Game level button
  btnResetGame.addEventListener('click', () => {
    if (confirm("Reset the game to play again?")) {
      resetWishes();
      document.getElementById('ui-candle-elem').classList.remove('blown-out');
      loadGameEntities();
    }
  });

  // Wishes sidebar board toggles
  btnToggleWishes.addEventListener('click', () => {
    wishesPanel.classList.add('open');
    populateWishesPanel();
  });

  btnCloseWishes.addEventListener('click', () => {
    wishesPanel.classList.remove('open');
  });

  // Polaroid letter modal close binds
  btnCloseModal.addEventListener('click', closeWishModal);
  memoryModal.addEventListener('click', (e) => {
    if (e.target === memoryModal) closeWishModal();
  });

  // Cake blowout event
  uiCandle.addEventListener('click', blowCandle);

  btnCelebrateMore.addEventListener('click', () => {
    triggerBirthdayConfetti();
  });

  btnBackToGarden.addEventListener('click', () => {
    celebrationOverlay.classList.add('hidden');
    uiContainer.classList.remove('hidden');
    updateQuestStatus();
  });

  // Keyboard shortcut celebrate button
  const celebrateBtn = document.getElementById('btn-trigger-celebrate');
  celebrateBtn.addEventListener('click', () => {
    openCelebrationScreen();
  });
}

// Render wish card items in drawer
function populateWishesPanel() {
  wishesList.innerHTML = '';
  const wishes = getWishes();

  wishes.forEach(w => {
    const card = document.createElement('div');

    let statusClass = 'unplanted';
    let statusText = 'Lying on grass';
    if (w.planted) {
      statusClass = 'planted';
      statusText = w.read ? 'Wish bloomed & read' : 'Wish bloomed!';
    } else if (w.collected) {
      statusClass = 'collected';
      statusText = 'Carried in bag';
    }

    card.className = `wish-item-card ${statusClass}`;
    card.innerHTML = `
      <div class="wish-item-header">
        <span class="wish-item-sender">${w.sender}</span>
        <span class="wish-item-tag ${w.color}">${statusText}</span>
      </div>
      <div class="wish-item-snippet">${w.planted ? w.message : '???'}</div>
    `;

    wishesList.appendChild(card);
  });
}

// --- Letter Modal ---
function openWishModal(wish) {
  modalSender.innerText = `From ${wish.sender}`;
  modalDate.innerText = wish.date || "June 24, 2026";
  modalDescription.innerText = wish.message;
  modalSignatureSender.innerText = wish.sender;

  memoryModal.classList.add('open');
}

function closeWishModal() {
  memoryModal.classList.remove('open');
  updateQuestStatus();
}

// --- Celebration Blow out candle ---
function openCelebrationScreen() {
  uiContainer.classList.add('hidden');
  celebrationOverlay.classList.remove('hidden');
  triggerBirthdayConfetti();
}

function blowCandle() {
  if (uiCandle.classList.contains('blown-out')) return;

  uiCandle.classList.add('blown-out');

  // Turn off 3D flame and light
  if (birthdayCakeGroup) {
    const flame = birthdayCakeGroup.getObjectByName('candle-flame');
    const light = birthdayCakeGroup.getObjectByName('cake-light');
    if (flame) flame.visible = false;
    if (light) light.intensity = 0;
  }

  triggerBirthdayConfetti();

  const hint = document.getElementById('cake-blow-hint');
  hint.innerText = "Happy Birthday! Make all your dreams come true! 🌸";

  confetti({ particleCount: 150, spread: 80, origin: { y: 0.65 } });
}

function triggerBirthdayConfetti() {
  const duration = 3 * 1000;
  const end = Date.now() + duration;

  (function frame() {
    confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#f472b6', '#a78bfa', '#fbbf24'] });
    confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#f472b6', '#a78bfa', '#fbbf24'] });

    if (Date.now() < end) requestAnimationFrame(frame);
  }());
}

// --- Audio Player Manager ---
function setupAudio() {
  if (bgMusicElement) return;

  bgMusicElement = document.getElementById('bg-music');
  bgMusicElement.src = LOFI_TRACKS[currentTrackIndex].url;
  audioTrackTitle.innerText = LOFI_TRACKS[currentTrackIndex].title;

  fileUploadInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      bgMusicElement.src = url;
      audioTrackTitle.innerText = file.name.substring(0, 18) + (file.name.length > 18 ? "..." : "");
      if (isMusicPlaying) {
        bgMusicElement.play().catch(err => console.log("Audio blocked: ", err));
      }
    }
  });
}

function toggleMusic() {
  setupAudio();
  if (isMusicPlaying) {
    bgMusicElement.pause();
    soundWaveBars.classList.remove('active');
    isMusicPlaying = false;
  } else {
    bgMusicElement.play().then(() => {
      soundWaveBars.classList.add('active');
      isMusicPlaying = true;
    }).catch(err => console.warn("Audio blocked: ", err));
  }
}

// --- Canvas Resize handler ---
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
