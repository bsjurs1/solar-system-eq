import * as THREE from "three";
import "./styles.css";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

const windowSize = {
  width: window.innerWidth,
  height: window.innerHeight,
};

const setupAudioContext = () => {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  audioContext.destination;
  return audioContext;
};

const setupAnalyser = (audioContext) => {
  const analyser = audioContext.createAnalyser();
  return analyser;
};

const audioContext = setupAudioContext();
const analyser = setupAnalyser(audioContext);

const trailColors = [
  0x909090, // Mercury: Grayish color
  0xdaa520, // Venus: Golden color
  0x1e90ff, // Earth: Blue color
  0xb22222, // Mars: Reddish color
  0xffd700, // Jupiter: Orangey color
  0xf4a460, // Saturn: Sandy brown color
  0x87cefa, // Uranus: Light blue color
  0x4682b4, // Neptune: Steel blue color
];

const planetDistances = [5.0, 15.0, 25.0, 30.0, 92, 295.8, 400, 1300.5]; // in our scaled units

const orbitSpeeds = [
  0.002, 0.0018, 0.0015, 0.0012, 0.0007, 0.0005, 0.0003, 0.0002,
];

const makeSun = () => {
  const texture = new THREE.TextureLoader().load("./2k_sun.jpg");
  const sunGeometry = new THREE.SphereGeometry(3, 64, 64); // Adjust the size as needed
  const sunMaterial = new THREE.MeshStandardMaterial({ map: texture });
  sunMaterial.emissive = new THREE.Color(0xffff00); // Yellowish glow, adjust as needed
  sunMaterial.emissiveIntensity = 2.0; // Intensity, adjust as needed
  const sun = new THREE.Mesh(sunGeometry, sunMaterial);
  return [sun, sunMaterial];
};

const makeStarField = () => {
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
  const starsMaterial = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.1,
  });
  const starField = new THREE.Points(starsGeometry, starsMaterial);
  return starField;
};

const makePointLight = () => {
  const pointLight = new THREE.PointLight(0xffffff, 1, 500);
  pointLight.position.set(0, 0, 0);
  return pointLight;
};

const makeCamera = () => {
  const camera = new THREE.PerspectiveCamera(
    45,
    windowSize.width / windowSize.height,
    0.1,
    10000
  );
  camera.position.z = 80;
  camera.position.y = 20;
  camera.lookAt(sun.position);
  return camera;
};

const makeComposer = (scene, camera, windowSize) => {
  const canvas = document.querySelector(".webgl");
  const renderer = new THREE.WebGLRenderer({ canvas });
  renderer.setSize(windowSize.width, windowSize.height);
  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(windowSize.width, windowSize.height),
    1.5,
    0.4,
    0.85
  );
  bloomPass.threshold = 0.1; // Controls the intensity threshold for bloom
  bloomPass.strength = 1.5; // Controls the overall strength of the bloom
  bloomPass.radius = 1; // Controls the glow size
  composer.addPass(bloomPass);
  return composer;
};

const makePlanets = () => {
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

  planetTextures.forEach((textureURL, index) => {
    const texture = new THREE.TextureLoader().load(textureURL);
    const planetGeometry = new THREE.SphereGeometry(1, 64, 64); // Adjust the size as needed
    const planetMaterial = new THREE.MeshStandardMaterial({ map: texture });
    const planetMesh = new THREE.Mesh(planetGeometry, planetMaterial);
    planetMesh.position.x = planetDistances[index]; // Use the adjusted distances
    planets.push(planetMesh);
  });

  return planets;
};

const makeTrails = (planets) => {
  const trailLength = 500;
  const trails = [];

  planets.forEach((planet, index) => {
    const trailGeometry = new THREE.BufferGeometry();
    const positions = [];
    const sizes = [];
    const alphas = [];
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
        color: { value: new THREE.Color(trailColors[index]) },
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
  });

  return trails;
};

const updateSunEmissive = (sunMaterial, frequencyIntensity) => {
  sunMaterial.emissiveIntensity = frequencyIntensity;
};

const computeSunScaleAtAxis = (axisScale, frequencyIntensity) => {
  const origoCenteredFrequencyIntensity = frequencyIntensity - 0.7;
  const signalScalingFactor = 0.001;
  const recomputedAxisScale =
    axisScale + origoCenteredFrequencyIntensity * signalScalingFactor;
  const MAX_SUN_SCALE = 2;
  const MIN_SUN_SCALE = 0.3;
  const minValue = Math.min(MAX_SUN_SCALE, recomputedAxisScale);
  return Math.max(MIN_SUN_SCALE, minValue);
};

const scaleSun = (sun, frequencyIntensity) => {
  sun.scale.x = computeSunScaleAtAxis(sun.scale.x, frequencyIntensity);
  sun.scale.y = computeSunScaleAtAxis(sun.scale.y, frequencyIntensity);
  sun.scale.z = computeSunScaleAtAxis(sun.scale.z, frequencyIntensity);
};

const updateSunColor = (sunMaterial, frequencyIntensity) => {
  const origoCenteredFrequencyIntensity = frequencyIntensity - 0.7;
  const signalScalingFactor = 0.001;
  sunMaterial.emissive.r +=
    origoCenteredFrequencyIntensity * signalScalingFactor;
};

const renderSun = (sun, sunMaterial, frequencyIntensity) => {
  updateSunColor(sunMaterial, frequencyIntensity);
  updateSunEmissive(sunMaterial, frequencyIntensity);
  scaleSun(sun, frequencyIntensity);
};

const renderStarField = (starField) => {
  starField.rotation.y += 0.0001;
  starField.geometry.attributes.position.needsUpdate = true;
};

const renderTrails = (trails, planets, frequencyData) => {
  trails.forEach((trail, index) => {
    const normalizedPlanetFrequencyIntensity = frequencyData[index * 200] / 256;
    const planet = planets[index];
    const speed = orbitSpeeds[index] * 0.3;
    const positions = trail.geometry.attributes.position.array;

    const forwardDirection = new THREE.Vector3(
      -Math.sin(Date.now() * speed),
      0,
      -Math.cos(Date.now() * speed)
    );

    const sideDirection = new THREE.Vector3().crossVectors(
      forwardDirection,
      new THREE.Vector3(0, 1, 0)
    );

    // Shift positions and apply audio data for displacement
    for (let i = positions.length - 3; i > 0; i -= 3) {
      positions[i] = positions[i - 3];
      positions[i + 1] = positions[i - 2];
      positions[i + 2] = positions[i - 1];
    }

    const data = new Uint8Array(analyser.frequencyBinCount);
    // Displace the starting point of the trail based on the audio data
    const displacement = (data[index % data.length] - 128) * 0.01; // The factor of 0.01 is arbitrary; adjust for more/less displacement

    if (index % 2 === 0) {
      positions[0] = planet.position.x + sideDirection.x;
      positions[1] =
        planet.position.y +
        sideDirection.y +
        normalizedPlanetFrequencyIntensity +
        displacement;
      positions[2] =
        planet.position.z +
        sideDirection.z +
        normalizedPlanetFrequencyIntensity * 15 +
        displacement;
    } else {
      positions[0] = planet.position.x + sideDirection.x;
      positions[1] =
        planet.position.y +
        sideDirection.y +
        normalizedPlanetFrequencyIntensity * 3 +
        displacement;
      positions[2] =
        planet.position.z +
        sideDirection.z +
        normalizedPlanetFrequencyIntensity +
        displacement;
    }

    trail.geometry.attributes.position.needsUpdate = true;
  });
};

const renderPlanets = (planets, frequencyData) => {
  const translatePlanet = (planet, index) => {
    const orbitRadius = planetDistances[index];
    const speed = orbitSpeeds[index] * 0.3;
    planet.position.x = Math.sin(Date.now() * speed) * orbitRadius;
    planet.position.z = Math.cos(Date.now() * speed) * orbitRadius;
  };

  const rotatePlanet = (planet) => {
    const planetRotationFactor = 0.005;
    planet.rotation.y += planetRotationFactor;
  };

  const recomputeOrbitSpeed = (index, planetFrequencyIntensity) => {
    orbitSpeeds[index] += (planetFrequencyIntensity - 0.7) / 200000000000000.0;
  };

  const scalePlanet = (planet, planetFrequencyIntensity, index) => {
    const computePlanetScaleAtAxis = (axisScale, frequencyIntensity) => {
      const origoCenteredFrequencyIntensity = frequencyIntensity - 0.5;
      const signalScalingFactor = 0.0001;
      const recomputedAxisScale =
        axisScale +
        origoCenteredFrequencyIntensity * index ** 2 * signalScalingFactor;
      const MIN_PLANET_SCALE = 0.1;
      const MAX_PLANET_SCALE = 1 + index ** 3 / 10.0;
      const minValue = Math.min(MAX_PLANET_SCALE, recomputedAxisScale);
      return Math.max(MIN_PLANET_SCALE, minValue);
    };

    planet.scale.x = computePlanetScaleAtAxis(
      planet.scale.x,
      planetFrequencyIntensity
    );
    planet.scale.y = computePlanetScaleAtAxis(
      planet.scale.y,
      planetFrequencyIntensity
    );
    planet.scale.z = computePlanetScaleAtAxis(
      planet.scale.z,
      planetFrequencyIntensity
    );
  };

  planets.forEach((planet, index) => {
    rotatePlanet(planet);
    translatePlanet(planet, index);
    const normalizedPlanetFrequencyIntensity = frequencyData[index * 200] / 256;
    recomputeOrbitSpeed(index, normalizedPlanetFrequencyIntensity);
    scalePlanet(planet, normalizedPlanetFrequencyIntensity, index);
  });
};

let lastVolume = 0;
const BEAT_THRESHOLD = 20; // Adjust this value based on your specific track and desired sensitivity
const MIN_TIME_BETWEEN_BEATS = 0.15; // seconds, to avoid multiple detections for one beat
let lastBeatTime = 0;
const onBeat = (callback) => {
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  analyser.getByteTimeDomainData(dataArray);

  // Get the average volume (amplitude) value
  let volume = 0;
  for (let i = 0; i < bufferLength; i++) {
    volume += Math.abs(dataArray[i] - 128); // Since dataArray has values from 0-255, 128 is the center.
  }
  volume = volume / bufferLength;

  const currentTime = audioContext.currentTime;

  if (
    volume > BEAT_THRESHOLD &&
    lastVolume <= BEAT_THRESHOLD &&
    currentTime - lastBeatTime > MIN_TIME_BETWEEN_BEATS
  ) {
    callback();
    lastBeatTime = currentTime;
  }

  lastVolume = volume;
};

const playTrack = (trackURL, audioContext) => {
  fetch(trackURL)
    .then((response) => response.arrayBuffer())
    .then((data) => audioContext.decodeAudioData(data))
    .then((audioBuffer) => {
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      source.connect(analyser);
      source.start();
    })
    .catch((e) => {
      console.error("There was an error playing the audio:", e);
    });
};

const scene = new THREE.Scene();
let [sun, sunMaterial] = makeSun();
scene.add(sun);
const starField = makeStarField();
scene.add(starField);
const pointLight = makePointLight();
scene.add(pointLight);
const camera = makeCamera();
scene.add(camera);
const composer = makeComposer(scene, camera, windowSize);
const planets = makePlanets();
planets.forEach((planet) => {
  scene.add(planet);
});
const trails = makeTrails(planets);
trails.forEach((trail) => {
  scene.add(trail);
});

const startAudioVisualization = (trackURL, audioContext) => {

  const renderLoop = () => {

    const renderLoopContent = () => {
      const frequencyData = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(frequencyData);
      const normalizedFrequencyIntensity = frequencyData[5] / 256;
      renderSun(sun, sunMaterial, normalizedFrequencyIntensity);
      onBeat(() => {
        console.log("Beat!");
      });
      renderStarField(starField);
      renderPlanets(planets, frequencyData, normalizedFrequencyIntensity);
      renderTrails(trails, planets, frequencyData);
    };
  
    requestAnimationFrame(renderLoop);
    renderLoopContent();
    composer.render();
  };

  playTrack(trackURL, audioContext);
  renderLoop();
};

startAudioVisualization("./theprodigy.mp3", audioContext);
