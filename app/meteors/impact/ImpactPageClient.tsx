'use client';

import { useSearchParams } from 'next/navigation';
import MeteorImpactPageOptimized from '@/components/meteors/MeteorImpactPageOptimized';
import * as THREE from 'three';
import { useGLTF } from '@react-three/drei';
import { useEffect } from 'react';

const GLBS = [
  'https://glb.asteroidstrike.earth/psyche.glb',
  'https://glb.asteroidstrike.earth/vesta.glb',
  'https://glb.asteroidstrike.earth/ryugu.glb',
  'https://glb.asteroidstrike.earth/borrelly.glb',
  'https://glb.asteroidstrike.earth/bennu.glb',
  'https://glb.asteroidstrike.earth/apophis.glb',
];

const TEX = [
  'https://glb.asteroidstrike.earth/textures/earthDay2.png',
  'https://glb.asteroidstrike.earth/textures/earthNormal.png',
  'https://glb.asteroidstrike.earth/textures/earthSpecular.png',
];

export default function ImpactPageClient() {

  useEffect(() => {
    for (const url of GLBS) useGLTF.preload(url)
    const preloadTexture = (url: string) => {
      const loader = new THREE.TextureLoader();
      loader.load(url, () => { }, () => { }, (error) => console.error('Texture preload failed:', url, error));
    };
    for (const url of TEX) preloadTexture(url)

  })
  const params = useSearchParams();

  const stringMass = params.get('mass') || '2.7e19';
  const num_exp = stringMass?.split('e ')
  const number_exponent = num_exp.map(x => Number(x));
  const mass = number_exponent.length > 1 ? number_exponent[0] * Math.pow(10, number_exponent[1]) : Number(stringMass);
  const diameter = Number(params.get('diameter')) || 226e3;    // meters
  const speed = Number(params.get('speed')) || 25e3;     // m/s
  const name = params.get('name') || '16_psyche';
  const angle = Number(params.get('angle')) || 90;
  const density = Number(params.get('density')) || 2700;
  const isCustom = params.get('isCustom') === 'true';

  const meteor = { name, mass, diameter, speed, angle, density, isCustom };

  return <MeteorImpactPageOptimized meteor={meteor} />;
}