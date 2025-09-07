"use client";

// Material density mapping (kg/m³)
const materialDensities: Record<string, number> = {
  // Metallic/Iron-rich types
  'metallic': 5300,
  'm-type': 5300,
  'iron': 7800,

  // stone types
  'stone': 3000,
  's-type': 2700,
  's/q-type': 2700,
  'sq-type': 2700,
  'q-type': 2600,
  'basaltic': 3000,

  // Carbonaceous types
  'c-type': 1900,
  'carbonaceous': 1900,
  'd-type': 2200,
  'p-type': 2600,

  // Ice-rich types
  'ice': 900,
  'cometary': 600,
};

// Parse size string (take before first whitespace, value in km)
function parseSize(size: string): number {
  if (!size) return 0;
  const val = size.split(/\s+/)[0].replace('~', ''); // Remove approximate symbol if present
  return Number(val);
}

// Parse density string (g/cm³ to kg/m³)
function parseDensity(densityStr: string): number {
  if (!densityStr) return 0;
  const val = densityStr.split(/\s+/)[0].replace('~', ''); // Take number before first whitespace
  return Number(val) * 1000; // Convert g/cm³ to kg/m³
}

// Parse weight string (handle scientific notation: 2.72x10^19 or 2.72e19)
function parseWeight(weight: string): number {
  if (!weight || weight.toLowerCase().includes('unknown')) return 0;
  
  // Get the value before first whitespace
  const val = weight.split(/\s+/)[0].replace('~', ''); // Remove approximate symbol
  
  // Handle 2.72x10^19 format
  if (val.toLowerCase().includes('×10^')) {
    const [base, exp] = val.toLowerCase().split('×10^');
    return Number(base) * Math.pow(10, Number(exp));
  }
  
  // Handle 2.72*10^19 format
  if (val.includes('*10^')) {
    const [base, exp] = val.split('*10^');
    return Number(base) * Math.pow(10, Number(exp));
  }
  
  // Handle 2.72e19 format
  if (val.toLowerCase().includes('e')) {
    return Number(val);
  }
  
  // Plain number
  return Number(val);
}

// Get density for material type (kg/m³)
function getDensity(material: string, providedDensity?: string): number {
  // If actual density is provided, use it
  if (providedDensity && !providedDensity.toLowerCase().includes('unknown')) {
    const density = parseDensity(providedDensity);
    if (density > 0) return density;
  }

  const defaultDensity = 2700; // Average S-type asteroid density
  if (!material) return defaultDensity;
  
  const normalizedMaterial = material.toLowerCase().trim();
  
  // Try exact match first
  if (normalizedMaterial in materialDensities) {
    return materialDensities[normalizedMaterial];
  }
  
  // Try partial matches
  for (const [key, density] of Object.entries(materialDensities)) {
    if (normalizedMaterial.includes(key)) {
      return density;
    }
  }
  
  return defaultDensity;
}

// Estimate mass (kg) from diameter (km) and material

function estimateMassFromDiameter(diameter: number, material: string, density?: string): string {
  const actualDensity = getDensity(material, density);
  
  // Convert diameter from km to meters
  const dMeters = diameter * 1000;
  
  // Assume slightly oblate spheroid (typical for asteroids)
  // Use 0.9 factor to account for irregular shape and voids
  const volume = (4/3) * Math.PI * Math.pow(dMeters/2, 3) * 0.9;
  const mass = actualDensity * volume;
  
  return mass.toExponential(3); // return as string in scientific notation
}

import React, { useState, useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import asteroidInfo from '../../data/asteroidInfo.json';
import { useRouter } from 'next/navigation'
import styles from "./AsteroidViewer.module.css";

const asteroids = [
  "16_psyche","67p_churyumov_gerasimenko","5535_annefrank",
  "99942_apophis","101955_bennu","19p_borrelly","9969_braille",
  "65803_didymos","dimorphos","152830_dinkinesh","52246_donaldjohanson",
  "433_eros","3548_eurybates","951_gaspra","103p_hartley","243_ida",
  "25143_itokawa","11351_leucus","21_lutetia","menoetius","21900_orus",
  "617_patroclus","15094_polymele","162173_ryugu","73p_schwassman_wachmann_3",
  "9p_tempel_1","4_vesta","81p_wild_2"
];

const specialMap: Record<string, string> = {
  "5535_annefrank": "3.glb",
  "9969_braille": "2.glb",
  "152830_dinkinesh": "3.glb",
  "52246_donaldjohanson": "2.glb",
  "3548_eurybates": "3.glb",
  "243_ida": "2.glb",
  "11351_leucus": "3.glb",
  "21_lutetia": "2.glb",
  "menoetius": "3.glb",
  "21900_orus": "2.glb",
  "617_patroclus": "1.glb",
  "15094_polymele": "1.glb",
  "73p_schwassman_wachmann_3": "3.glb",
  "81p_wild_2": "3.glb"
};

const formatName = (name: string) => name.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase());



export default function AsteroidViewer() {
  const [selected, setSelected] = useState<string>(asteroids[0]);
  const [lighting, setLighting] = useState<'flood' | 'shadow'>('flood');
  const mountRef = useRef<HTMLDivElement>(null);
  const router = useRouter()

  const [impactSpeed, setImpactSpeed] = useState(20); // Speed in km/s
  const [impactAngle_deg, setImpactAngle] = useState(45); // Angle in degrees

  // Custom asteroid state
  const [showCustom, setShowCustom] = useState(false);
  const [customSize, setCustomSize] = useState(1000); // Size in meters or km
  const [customSizeUnit, setCustomSizeUnit] = useState<'m' | 'km'>('m');
  const [customMaterial, setCustomMaterial] = useState<'iron' | 'stone' | 'ice'>('stone');
  const [customSpeed, setCustomSpeed] = useState(20);
  const [customAngle, setCustomAngle] = useState(45);


  const getGlbFile = (name: string) => {
    if (specialMap[name]) return `/meteors/${specialMap[name]}`;
    const b = name.substring(name.indexOf('_') + 1);    
    return `/meteors/${b}.glb`;
  };

  useEffect(() => {
    if (!mountRef.current) return;

    let stopped = false;
    let frameId: number;
    let loader: GLTFLoader | null = null;
    let model: THREE.Group | null = null;

    // Remove any previous renderer DOM node
    while (mountRef.current.firstChild) {
      mountRef.current.removeChild(mountRef.current.firstChild);
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x222222);

    const camera = new THREE.PerspectiveCamera(
      60,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      1e7
    );

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.shadowMap.enabled = lighting === 'shadow';
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mountRef.current.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    // Lighting setup
    let ambient: THREE.AmbientLight;
    let dirLight: THREE.DirectionalLight;
    if (lighting === 'flood') {
      // Aggressive, high-detail flood lighting
      ambient = new THREE.AmbientLight(0xffffff, 3.5);
      scene.add(ambient);
      dirLight = new THREE.DirectionalLight(0xffffff, 4.5);
      dirLight.position.set(120, 120, 120);
      scene.add(dirLight);
      // Add a second, slightly bluish fill light from the opposite side
      const fillLight = new THREE.DirectionalLight(0xe0eaff, 2.5);
      fillLight.position.set(-100, -80, 80);
      scene.add(fillLight);
    } else {
      ambient = new THREE.AmbientLight(0xffffff, 0.3);
      scene.add(ambient);
      dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
      dirLight.position.set(100, 100, 100);
      dirLight.castShadow = true;
      dirLight.shadow.mapSize.width = 1024;
      dirLight.shadow.mapSize.height = 1024;
      dirLight.shadow.camera.near = 0.5;
      dirLight.shadow.camera.far = 500;
      scene.add(dirLight);
    }

    loader = new GLTFLoader();
    let gltfController: { abort: () => void } | null = null;

    const loadModel = () => {
      if (model) scene.remove(model);
      if (gltfController) gltfController.abort();
      // Use AbortController for loader if available
      let controller: AbortController | null = null;
      if (typeof window !== 'undefined' && 'AbortController' in window) {
        controller = new AbortController();
      }
      gltfController = controller;

      loader!.load(
        getGlbFile(selected),
        (gltf) => {
          if (stopped) return;
          model = gltf.scene;
          model.traverse((child: any) => {
            if (child.isMesh) {
              child.castShadow = lighting === 'shadow';
              child.receiveShadow = lighting === 'shadow';
              // Add glossiness and contrast
              if (child.material && (child.material.isMeshStandardMaterial || child.material.isMeshPhysicalMaterial)) {
                child.material.metalness = 0.3;
                if ('envMapIntensity' in child.material) child.material.envMapIntensity = 1.2;
                child.material.needsUpdate = true;
              }
            }
          });
          model.scale.setScalar(5);
          scene.add(model);

          const box = new THREE.Box3().setFromObject(model);
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);

          camera.position.set(center.x, center.y, center.z + maxDim*1.2 );
          camera.lookAt(center);
        },
        undefined,
        (err) => {
          if (!stopped) console.error("GLB load error:", err);
        }
      );
    };

    loadModel();

    const animate = () => {
      if (stopped) return;
      controls.update();
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    };
    frameId = requestAnimationFrame(animate);

    const handleResize = () => {
      camera.aspect = mountRef.current!.clientWidth / mountRef.current!.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mountRef.current!.clientWidth, mountRef.current!.clientHeight);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      stopped = true;
      window.removeEventListener("resize", handleResize);
      if (frameId) cancelAnimationFrame(frameId);
      if (renderer) {
        renderer.dispose();
        if (renderer.domElement && renderer.domElement.parentNode) {
          renderer.domElement.parentNode.removeChild(renderer.domElement);
        }
      }
      if (gltfController && typeof gltfController.abort === 'function') gltfController.abort();
      model = null;
    };
  }, [selected, lighting]);

const info = asteroidInfo[selected as keyof typeof asteroidInfo];

  // Calculate custom asteroid mass using sphere volume formula
  const calculateCustomMass = () => {
    const sizeInMeters = customSizeUnit === 'km' ? customSize * 1000 : customSize;
    const radius = sizeInMeters / 2;
    const volume = (4/3) * Math.PI * Math.pow(radius, 3);
    const density = materialDensities[customMaterial];
    return volume * density; // mass in kg
  };

  const launchCustomAsteroid = () => {
    const sizeInMeters = customSizeUnit === 'km' ? customSize * 1000 : customSize;
    const mass = calculateCustomMass();
    const speedMs = customSpeed * 1000; // Convert km/s to m/s
    const density = materialDensities[customMaterial];
    
    router.push(`/meteors/impact?mass=${mass}&diameter=${sizeInMeters}&speed=${speedMs}&name=custom_${customMaterial}&angle=${customAngle}&density=${density}&isCustom=true`);
  };

  return (
    <div className={styles.container}>
      {/* Custom Asteroid Button - Top Right */}
      <button
        className={styles.customButton}
        onClick={() => setShowCustom(!showCustom)
}
      >
        Launch a Custom Meteroid
      </button>

      {/* Custom Asteroid Panel */}
      {showCustom && (
        <div className={styles.customPanel}>
          <h3 style={{ color: '#ff6600', marginTop: 0 }}>Custom Asteroid Configuration</h3>
          
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', color: '#00ccff' }}>
              Material Type
            </label>
            <select
              value={customMaterial}
              onChange={(e) => setCustomMaterial(e.target.value as 'iron' | 'stone' | 'ice')}
              className={styles.select}
            >
              <option value="stone">Stone (3000 kg/m³)</option>
              <option value="iron">Iron (7800 kg/m³)</option>
              <option value="ice">Ice (900 kg/m³)</option>
            </select>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', color: '#00ccff' }}>
              Size: {customSize} {customSizeUnit}
            </label>
            <input
              type="range"
              min="1"
              max="6000"
              value={customSize}
              onChange={(e) => setCustomSize(Number(e.target.value))}
              style={{
                width: '100%',
                accentColor: '#ff6600',
                background: '#18191c',
                height: '8px',
                borderRadius: '4px',
                appearance: 'none',
                outline: 'none'
              }}
            />
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <button
                onClick={() => setCustomSizeUnit('m')}
                style={{
                  background: customSizeUnit === 'm' ? '#ff6600' : 'transparent',
                  color: customSizeUnit === 'm' ? '#000' : '#fff',
                  border: '1px solid #ff6600',
                  borderRadius: '4px',
                  padding: '4px 12px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                meters
              </button>
              <button
                onClick={() => setCustomSizeUnit('km')}
                style={{
                  background: customSizeUnit === 'km' ? '#ff6600' : 'transparent',
                  color: customSizeUnit === 'km' ? '#000' : '#fff',
                  border: '1px solid #ff6600',
                  borderRadius: '4px',
                  padding: '4px 12px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                kilometers
              </button>
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', color: '#00ccff' }}>
              Impact Speed: {customSpeed} km/s
            </label>
            <input
              type="range"
              min="11"
              max="73"
              value={customSpeed}
              onChange={(e) => setCustomSpeed(Number(e.target.value))}
              style={{
                width: '100%',
                accentColor: '#ff6600',
                background: '#18191c',
                height: '8px',
                borderRadius: '4px',
                appearance: 'none',
                outline: 'none'
              }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', color: '#00ccff' }}>
              Impact Angle: {customAngle}°
            </label>
            <input
              type="range"
              min="5"
              max="90"
              value={customAngle}
              onChange={(e) => setCustomAngle(Number(e.target.value))}
              style={{
                width: '100%',
                accentColor: '#ff6600',
                background: '#18191c',
                height: '8px',
                borderRadius: '4px',
                appearance: 'none',
                outline: 'none'
              }}
            />
          </div>

          <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(255,102,0,0.1)', borderRadius: '6px', border: '1px solid rgba(255,102,0,0.3)' }}>
            <p style={{ margin: '0 0 8px 0', color: '#ff6600', fontWeight: 'bold' }}>Calculated Properties:</p>
            <p style={{ margin: '4px 0', fontSize: '14px' }}>
              <strong>Mass:</strong> {(calculateCustomMass() / 1e12).toExponential(2)} trillion kg
            </p>
            <p style={{ margin: '4px 0', fontSize: '14px' }}>
              <strong>Diameter:</strong> {customSizeUnit === 'km' ? customSize : (customSize / 1000).toFixed(3)} km
            </p>
            <p style={{ margin: '4px 0', fontSize: '14px' }}>
              <strong>Density:</strong> {materialDensities[customMaterial].toLocaleString()} kg/m³
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className={styles.launchButton}
              onClick={launchCustomAsteroid}
              style={{ flex: 1, background: 'linear-gradient(90deg, #ff6600 0%, #ff4400 100%)' }}
            >
              Launch Custom
            </button>
            <button
              onClick={() => setShowCustom(false)}
              style={{
                padding: '10px 22px',
                background: 'transparent',
                border: '1px solid #666',
                color: '#fff',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className={styles.sidebar}>
        <select value={selected} onChange={(e) => setSelected(e.target.value)} className={styles.select}>
          {asteroids.map(a => (
            <option key={a} value={a}>{formatName(a)}</option>
          ))}
        </select>

        {info && (
          <div className={styles.infoPanel}>
            <h2>{formatName(selected)}</h2>
            <p><strong>Size:</strong> {info.size}</p>
            <p><strong>Weight:</strong> {info.weight}</p>
            <p><strong>Material:</strong> {info.material}</p>
            <p><strong>Density:</strong> {info.density}</p>


            <p>{info.blurb}</p>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#00ccff' }}>
                Impact Speed: {impactSpeed} km/s
              </label>
              <input
                type="range"
                min="11"
                max="73"
                value={impactSpeed}
                onChange={(e) => setImpactSpeed(Number(e.target.value))}
                style={{
                  width: '100%',
                  accentColor: '#00ccff',
                  background: '#18191c',
                  height: '8px',
                  borderRadius: '4px',
                  appearance: 'none',
                  outline: 'none'
                }}
              />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#00ccff' }}>
                Impact Angle: {impactAngle_deg}°
              </label>
              <input
                type="range"
                min="5"
                max="90"
                value={impactAngle_deg}
                onChange={(e) => setImpactAngle(Number(e.target.value))}
                style={{
                  width: '100%',
                  accentColor: '#00ccff',
                  background: '#18191c',
                  height: '8px',
                  borderRadius: '4px',
                  appearance: 'none',
                  outline: 'none'
                }}
              />
            </div>
            <button
              className={styles.launchButton}
              onClick={() => {
                // Parse size from km to meters
const sizeMeters = parseSize(info.size || '0') * 1000;
                // Parse weight
                let weight_kg = parseWeight(info.weight || '0');
                // If either is 0, try to estimate from the other
                const density_kg_m3 = getDensity(info.material || '', info.density);
                if (weight_kg === 0 && sizeMeters > 0) {
                  weight_kg = Number(parseWeight(estimateMassFromDiameter(sizeMeters/1000, info.material || 'stone', info.density)));
                }
                // Convert speed from km/s to m/s
                const speedMs = impactSpeed * 1000;
                router.push(`/meteors/impact?mass=${weight_kg}&diameter=${sizeMeters}&speed=${speedMs}&name=${selected}&angle=${impactAngle_deg}&density=${density_kg_m3}`);

              }}
            >
              Launch
            </button>
          </div>
        )}
      </div>

      <div ref={mountRef} className={styles.viewer} />

      {/* Lighting control at the bottom center */}
      <div style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 32,
        display: 'flex',
        justifyContent: 'center',
        zIndex: 20
      }}>
        <div style={{
          display: 'flex',
          gap: 16,
          background: 'rgba(20,20,20,0.85)',
          borderRadius: 12,
          boxShadow: '0 2px 12px #000a',
          padding: '8px 24px',
          alignItems: 'center',
          border: '1px solid #222'
        }}>
          <button
            onClick={() => setLighting('flood')}
            style={{
              background: lighting === 'flood' ? 'linear-gradient(90deg,#fff,#ccc)' : 'transparent',
              color: lighting === 'flood' ? '#111' : '#fff',
              border: 'none',
              borderRadius: 6,
              padding: '8px 18px',
              fontWeight: 600,
              fontSize: 16,
              cursor: 'pointer',
              boxShadow: lighting === 'flood' ? '0 4px 16px #fff8' : 'none',
              transition: 'all 0.15s'
            }}
          >
            Flood Light
          </button>
          <button
            onClick={() => setLighting('shadow')}
            style={{
              background: lighting === 'shadow' ? 'linear-gradient(90deg,#222,#444)' : 'transparent',
              color: lighting === 'shadow' ? '#fff' : '#aaa',
              border: 'none',
              borderRadius: 6,
              padding: '8px 18px',
              fontWeight: 600,
              fontSize: 16,
              cursor: 'pointer',
              boxShadow: lighting === 'shadow' ? '0 2px 8px #0008' : 'none',
              transition: 'all 0.15s'
            }}
          >
            Shadow Lighting
          </button>
        </div>
      </div>
    </div>
  );
}
