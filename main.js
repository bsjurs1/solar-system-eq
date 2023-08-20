import * as THREE from "three";
import "./styles.css";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

// Scene
const scene = new THREE.Scene();

const texture = new THREE.TextureLoader().load("./2k_sun.jpg");
const sunGeometry = new THREE.SphereGeometry(3, 64, 64); // Adjust the size as needed
const sunMaterial = new THREE.MeshStandardMaterial({ map: texture });
sunMaterial.emissive = new THREE.Color(0xffff00); // Yellowish glow, adjust as needed
sunMaterial.emissiveIntensity = 2.0; // Intensity, adjust as needed
const mesh = new THREE.Mesh(sunGeometry, sunMaterial);
scene.add(mesh);

// Create stars
const starsGeometry = new THREE.BufferGeometry();

const starsVertices = [];
const numStars = 10000;

for (let i = 0; i < numStars; i++) {
  const x = (Math.random() - 0.5) * 2000; // Spread them out over a wide area
  const y = (Math.random() - 0.5) * 2000;
  const z = (Math.random() - 0.5) * 2000;
  starsVertices.push(x, y, z);
}

starsGeometry.setAttribute(
  "position",
  new THREE.Float32BufferAttribute(starsVertices, 3)
);

const starsMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 0.1 });

const starField = new THREE.Points(starsGeometry, starsMaterial);

scene.add(starField);

// Planets setup
const planets = [];
const planetTextures = [
  "./2k_mercury.jpg",
  "./2k_venus.jpg",
  "./2k_earth.jpg",
  "./2k_mars.jpg",
  "./2k_jupiter.jpg",
  "./2k_saturn.jpg",
  "./2k_uranus.jpg",
  "./2k_neptune.jpg",
];

const planetDistances = [3.9, 7.2, 10, 15.2, 52, 95.8, 192.2, 300.5]; // in our scaled units
const trailLength = 1000; // number of segments
const trails = [];

const planetColors = [
  0x909090, // Mercury: Grayish color
  0xdaa520, // Venus: Golden color
  0x1e90ff, // Earth: Blue color
  0xb22222, // Mars: Reddish color
  0xffd700, // Jupiter: Orangey color
  0xf4a460, // Saturn: Sandy brown color
  0x87cefa, // Uranus: Light blue color
  0x4682b4, // Neptune: Steel blue color
];

planetTextures.forEach((textureURL, index) => {
  const texture = new THREE.TextureLoader().load(textureURL);
  const planetGeometry = new THREE.SphereGeometry(1, 64, 64); // Adjust the size as needed
  const planetMaterial = new THREE.MeshStandardMaterial({ map: texture });
  const planetMesh = new THREE.Mesh(planetGeometry, planetMaterial);
  planetMesh.position.x = planetDistances[index]; // Use the adjusted distances
  planets.push(planetMesh);
  scene.add(planetMesh);
  const trailGeometry = new THREE.BufferGeometry();
  const positions = [];
  const sizes = [];
  const planet = planets[index];
  const alphas = [];
  const initialSize = index + 1;
  for (let i = 0; i < trailLength; i++) {
    positions.push(planet.position.x, planet.position.y, planet.position.z);
    sizes.push(2.0 - (i / trailLength) * 1.5);
    alphas.push(1.0 - i / trailLength); // This will interpolate the alpha from 1 to 0 along the trail
  }

  trailGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3)
  );
  trailGeometry.setAttribute(
    "size",
    new THREE.Float32BufferAttribute(sizes, 1)
  );
  trailGeometry.setAttribute(
    "alpha", // Set the alpha attribute for the trail geometry
    new THREE.Float32BufferAttribute(alphas, 1)
  );

  const trailMaterial = new THREE.ShaderMaterial({
    uniforms: {
      color: { value: new THREE.Color(planetColors[index]) },
    },
    depthTest: true,
    depthWrite: true,
    vertexShader: `
      attribute float size;
      attribute float alpha; // Declare alpha attribute
      uniform vec3 color;  
      varying vec3 vColor;
      varying float vAlpha; // Declare a varying for alpha
      void main() {
          vColor = color; 
          vAlpha = alpha; // Assign alpha attribute to the varying
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (300.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vAlpha; // Use the varying for alpha
      void main() {
        float distanceToCenter = length(gl_PointCoord - vec2(0.5, 0.5));
        float alpha = vAlpha - smoothstep(0.2, 0.3, distanceToCenter);  // Adjust these values to modify fade-out
        gl_FragColor = vec4(vColor, alpha);
      }
    `,
    transparent: true,
  });

  const trail = new THREE.Points(trailGeometry, trailMaterial);
  trails.push(trail);
  scene.add(trail);
});

//Light
// const light = new THREE.DirectionalLight("#ffffff", 1, 100);
// light.position.set(0, 10, 10);
// scene.add(light);
const pointLight = new THREE.PointLight(0xffffff, 1, 500); // white color, intensity of 1, and a distance of 500
pointLight.position.set(0, 0, 0); // Position it at the center where the sun is
scene.add(pointLight);

//Sizes
const sizes = {
  width: window.innerWidth,
  height: window.innerHeight,
};

// Camera
const camera = new THREE.PerspectiveCamera(
  45,
  sizes.width / sizes.height,
  0.1,
  2000
);
camera.position.z = 60;
camera.position.y = 20;
camera.lookAt(mesh.position);
scene.add(camera);

// Renderer
const canvas = document.querySelector(".webgl");
const renderer = new THREE.WebGLRenderer({ canvas });
renderer.setSize(sizes.width, sizes.height);
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(sizes.width, sizes.height),
  1.5,
  0.4,
  0.85
);
bloomPass.threshold = 0.1; // Controls the intensity threshold for bloom
bloomPass.strength = 1.5; // Controls the overall strength of the bloom
bloomPass.radius = 1; // Controls the glow size
composer.addPass(bloomPass);

let audioContext, analyser, source, data;

let minusOrAdd = true;

let lastVolume = 0;
const BEAT_THRESHOLD = 40; // Adjust this value based on your specific track and desired sensitivity
const MIN_TIME_BETWEEN_BEATS = 0.15; // seconds, to avoid multiple detections for one beat
let lastBeatTime = 0;

const orbitSpeeds = [
  0.002, 0.0018, 0.0015, 0.0012, 0.0007, 0.0005, 0.0003, 0.0002,
];

function animate() {
  requestAnimationFrame(animate);

  data = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteTimeDomainData(data);

  starField.geometry.attributes.position.needsUpdate = true; // Inform three.js that the positions have been updated
  mesh.rotation.y += 0.005;
  // Get the average volume (amplitude) value
  let volume = 0;
  for (let i = 0; i < data.length; i++) {
    volume += Math.abs(data[i] - 128); // Centered around 128
  }
  volume = volume / data.length;

  const currentTime = audioContext.currentTime;

  if (
    volume > BEAT_THRESHOLD &&
    lastVolume <= BEAT_THRESHOLD &&
    currentTime - lastBeatTime > MIN_TIME_BETWEEN_BEATS
  ) {
    if (minusOrAdd) {
      sunMaterial.emissiveIntensity = 2.0;
      starsMaterial.size = 1.1;
    } else {
      sunMaterial.emissiveIntensity = 0.9;
      starsMaterial.size *= 0.95;
    }
    minusOrAdd = !minusOrAdd;
    lastBeatTime = currentTime;
  }

  lastVolume = volume;

  starField.rotation.y += 0.0001;

  // Rotate the planets
  planets.forEach((planet, index) => {
    planet.rotation.y += 0.005; // Planet self-rotation

    const orbitRadius = planetDistances[index];
    const speed = orbitSpeeds[index] * 0.3;

    planet.position.x = Math.sin(Date.now() * speed) * orbitRadius;
    planet.position.z = Math.cos(Date.now() * speed) * orbitRadius;

    const trail = trails[index];
    const positions = trail.geometry.attributes.position.array;

    // Shift positions
    for (let i = positions.length - 3; i > 0; i -= 3) {
      positions[i] = positions[i - 3];
      positions[i + 1] = positions[i - 2];
      positions[i + 2] = positions[i - 1];
    }

    // New position
    positions[0] = planet.position.x;
    positions[1] = planet.position.y;
    positions[2] = planet.position.z;

    trail.geometry.attributes.position.needsUpdate = true;
  });

  composer.render();
}

if (!audioContext) {
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  audioContext.destination;
  analyser = audioContext.createAnalyser();
}

fetch("./bicep.mov")
  .then((response) => response.arrayBuffer())
  .then((data) => audioContext.decodeAudioData(data))
  .then((audioBuffer) => {
    source = audioContext.createBufferSource();
    source.buffer = audioBuffer;

    // Connect the audio source node to the audio context's output
    source.connect(audioContext.destination);
    source.connect(analyser);
    // Start playing the audio
    source.start();
  })
  .catch((e) => {
    console.error("There was an error playing the audio:", e);
  });

// Call the animate function to start the loop
animate();
