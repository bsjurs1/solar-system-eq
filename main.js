import * as THREE from "three";
import "./styles.css";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import Chart from "chart.js/auto";
import TWEEN from '@tweenjs/tween.js';
import { FirstPersonControls } from 'three/examples/jsm/controls/FirstPersonControls.js';

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
  analyser.fftSize = 2048;
  return analyser;
};

const audioContext = setupAudioContext();
const analyser = setupAnalyser(audioContext);
let frequencyBinDataArray = new Uint8Array(analyser.frequencyBinCount);
let timeDomainDataArray = new Uint8Array(analyser.frequencyBinCount);

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

const planetDistances = [20.0, 25.0, 30, 35.4, 80.0, 120.0, 140.0, 200.0]; // in our scaled units
const planetSizes = [1, 1, 1, 1, 4, 3, 3, 2]; // in our scaled units

const orbitSpeeds = [
  0.002, 0.0018, 0.0015, 0.0012, 0.0007, 0.0005, 0.0003, 0.0002,
];

const clock = new THREE.Clock();

// Scene setup functions

// -- Scene generic setup

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
    2000
  );
  camera.position.z = 150;
  camera.position.y = 50;
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

const makeCameraControls = (camera) => {
  const camControls = new FirstPersonControls(camera);
  camControls.lookSpeed = 0.1;
  camControls.movementSpeed = 20;
  camControls.noFly = true;
  camControls.lookVertical = true;
  camControls.constrainVertical = false;
  camControls.enabled = false;
  camControls.lon = -150;
  camControls.lat = 120;
  return camControls;
};

// -- Scene generic setup

const makeSun = () => {
  const texture = new THREE.TextureLoader().load("./2k_sun.jpg");
  const sunGeometry = new THREE.SphereGeometry(10, 64, 64); // Adjust the size as needed
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
    const planetGeometry = new THREE.SphereGeometry(planetSizes[index], 64, 64); // Adjust the size as needed
    const planetMaterial = new THREE.MeshStandardMaterial({ map: texture });
    const planetMesh = new THREE.Mesh(planetGeometry, planetMaterial);
    planetMesh.position.x = planetDistances[index]; // Use the adjusted distances
    planets.push(planetMesh);
  });

  return planets;
};

let trailsPointSizes = [3.0, 3.0, 4.0, 3.0, 5.0, 4.0, 3.0, 3.0];
const trailLengths = [200, 200, 200, 200, 300, 400, 500, 700];

const makeTrails = (planets) => {
  const trails = [];

  planets.forEach((planet, index) => {
    const trailLength = trailLengths[index];
    const trailGeometry = new THREE.BufferGeometry();
    const positions = [];
    const sizes = [];
    const alphas = [];
    for (let i = 0; i < trailLength; i++) {
      positions.push(planet.position.x, planet.position.y, planet.position.z);
      sizes.push(trailsPointSizes[index]);
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

// Render functions

const renderSun = (sun, sunMaterial, frequencyIntensity) => {
  const updateSunColor = (sunMaterial, frequencyIntensity) => {
    const origoCenteredFrequencyIntensity = frequencyIntensity - 0.7;
    const signalScalingFactor = 0.001;
    sunMaterial.emissive.r +=
      origoCenteredFrequencyIntensity * signalScalingFactor;
  };

  const updateSunEmissive = (sunMaterial, frequencyIntensity) => {
    sunMaterial.emissiveIntensity = frequencyIntensity;
  };

  let oldSunRadius = 10.0;
  let newSunRadius = 10.0;
  
  const scaleSun = (sun, frequencyIntensity) => {
    const computeSunScaleAtAxis = (radius, frequencyIntensity) => {
      const origoCenteredFrequencyIntensity = frequencyIntensity - 0.7;
      const signalScalingFactor = 10.0;
      const recomputedRadius = radius + origoCenteredFrequencyIntensity * signalScalingFactor;
      const MAX_SUN_RADIUS = 25.0;
      const MIN_SUN_RADIUS = 5.0;
  
      if (recomputedRadius > MAX_SUN_RADIUS) {
        newSunRadius = MAX_SUN_RADIUS;
      } else if (recomputedRadius < MIN_SUN_RADIUS) {
        newSunRadius = MIN_SUN_RADIUS;
      } else {
        newSunRadius = recomputedRadius;
      }
  
      return newSunRadius / oldSunRadius;
    };
    
    const scalingFactor = computeSunScaleAtAxis(oldSunRadius, frequencyIntensity);
    console.log(scalingFactor);
    oldSunRadius = newSunRadius; // Update the oldSunRadius for next call
    sun.scale.set(scalingFactor, scalingFactor, scalingFactor);
  };

  updateSunColor(sunMaterial, frequencyIntensity);
  updateSunEmissive(sunMaterial, frequencyIntensity);
  scaleSun(sun, frequencyIntensity);
};

const renderStarField = (starField) => {
  starField.rotation.y += 0.0001;
  starField.geometry.attributes.position.needsUpdate = true;
};

let normalizedFrequencySubtractors = [0.6, 0.6, 0.5, 0.5, 0.4, 0.4, 0.1225, 0.11];
const trailPointDisplacementFactors = [20,30,40,40,50,50,40,30].map(a => a*0.3);
const frequencyIndeces = [50,100,150,200,250,300,350,400];

const renderTrails = (trails, planets, frequencyData) => {
  trails.forEach((trail, index) => {
    const planet = planets[index];
    const positions = trail.geometry.attributes.position.array;

    // Shift positions and apply audio data for displacement
    for (let i = positions.length - 3; i > 0; i -= 3) {
      positions[i] = positions[i - 3];
      positions[i + 1] = positions[i - 2];
      positions[i + 2] = positions[i - 1];
    }

    const normalizedFrequency = frequencyData[frequencyIndeces[index]] / 256 - normalizedFrequencySubtractors[index];
    const displacement = normalizedFrequency * trailPointDisplacementFactors[index];
    trailsPointSizes[index] = (normalizedFrequency*2);
    positions[0] = planet.position.x;
    positions[1] = planet.position.y + displacement;
    positions[2] = planet.position.z;
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
    //recomputeOrbitSpeed(index, normalizedPlanetFrequencyIntensity);
    //scalePlanet(planet, normalizedPlanetFrequencyIntensity, index);
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

// -- Chart setup

const makeTimeDomainLineChart = () => {
  const ctx2 = document.getElementById("timeChart");
  const timeDomainLineChart = new Chart(ctx2, {
    type: "line",
    data: {
      labels: Array.from({ length: analyser.frequencyBinCount }, (_, i) => i),
      datasets: [
        {
          label: "Audio Amplitude",
          data: Array.from(timeDomainDataArray),
          pointRadius: 0,
          // Colors, border, etc. for your bars
        },
      ],
    },
    options: {
      scale: {
        y: {
          beginAtZero: true,
          min: 0,
          max: 256,
        }
      }
      // Your chart options go here
    },
  });
  timeDomainLineChart.update('none');
  return timeDomainLineChart;
};

const makeFrequencyDomainLineChart = () => {
  const ctx = document.getElementById("frequencyChart");
  const frequencyLineChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: Array.from({ length: analyser.frequencyBinCount }, (_, i) => i),
      datasets: [
        {
          label: "Frequency Amplitude",
          data: Array.from(frequencyBinDataArray),
          pointRadius: 0,
        },
      ],
    },
    options: {
      scale: {
        y: {
          beginAtZero: true,
          min: 0,
          max: 256,
        }
      }
    },
  });
  frequencyLineChart.update('none');
  return frequencyLineChart;
};

const updateCharts = () => {
  frequencyLineChart.data.datasets[0].data = Array.from(frequencyBinDataArray)
  timeDomainLineChart.data.datasets[0].data = Array.from(timeDomainDataArray)
  frequencyLineChart.update();
  timeDomainLineChart.update();
};

const frequencyLineChart = makeFrequencyDomainLineChart();
const timeDomainLineChart = makeTimeDomainLineChart();


// -- Setup scene

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

const camControls = makeCameraControls(camera);

const startAudioVisualization = (trackURL, audioContext) => {
  const renderLoop = () => {
    const renderLoopContent = () => {
      analyser.getByteFrequencyData(frequencyBinDataArray);
      analyser.getByteTimeDomainData(timeDomainDataArray);
      const normalizedFrequencyIntensity = frequencyBinDataArray[5] / 256;
      renderSun(sun, sunMaterial, normalizedFrequencyIntensity);
      onBeat(() => {
        console.log("Beat!");
      });
      renderStarField(starField);
      renderPlanets(planets, frequencyBinDataArray, normalizedFrequencyIntensity);
      renderTrails(trails, planets, frequencyBinDataArray);
      updateCharts();
      const delta = clock.getDelta()
      camControls.update(delta);
    };

    requestAnimationFrame(renderLoop);
    renderLoopContent();
    composer.render();
    TWEEN.update();
  };

  playTrack(trackURL, audioContext);
  renderLoop();
};

startAudioVisualization("./tiesto.mov", audioContext);

// Browser interaction

window.addEventListener('resize', () => {
  windowSize.width = window.innerWidth;
  windowSize.height = window.innerHeight;
  
  camera.aspect = windowSize.width / windowSize.height;
  camera.updateProjectionMatrix();
  
  composer.renderer.setSize(windowSize.width, windowSize.height);
});

document.addEventListener('click', () => {
  camControls.enabled = !camControls.enabled;
});