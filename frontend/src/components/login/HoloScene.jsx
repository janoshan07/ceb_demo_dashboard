import React, { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Stars, Line, Sphere, Box, Plane } from '@react-three/drei';
import * as THREE from 'three';
import { motion } from 'framer-motion';
import { Sun, Activity, Database, LineChart } from 'lucide-react';

/* ─────────────────────────────────────────────
   CONSTANTS — Sri Lanka grid topology
───────────────────────────────────────────── */
const NODES = [
  { id: 'jaffna',     pos: [-1.5,  3.5,  0.0], label: 'JFN' },
  { id: 'trinco',     pos: [ 2.5,  1.0,  0.5], label: 'TRN' },
  { id: 'colombo',    pos: [-2.5, -3.0,  0.2], label: 'CMB' },
  { id: 'kandy',      pos: [ 0.5, -2.0,  0.8], label: 'KND' },
  { id: 'batticaloa', pos: [ 3.5, -1.0,  0.3], label: 'BTI' },
  { id: 'galle',      pos: [-1.0, -5.0,  0.1], label: 'GAL' },
];

const CONNECTIONS = [
  { from: 'jaffna',     to: 'trinco'      },
  { from: 'jaffna',     to: 'colombo'     },
  { from: 'trinco',     to: 'batticaloa'  },
  { from: 'trinco',     to: 'kandy'       },
  { from: 'batticaloa', to: 'kandy'       },
  { from: 'colombo',    to: 'kandy'       },
  { from: 'colombo',    to: 'galle'       },
  { from: 'kandy',      to: 'galle'       },
];

const getNode = (id) => NODES.find(n => n.id === id);

/* ─────────────────────────────────────────────
   1. ENHANCED PARTICLE FIELD
───────────────────────────────────────────── */
const ParticleField = () => {
  const pointsRef = useRef();

  const [positions] = useMemo(() => {
    const count = 500;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3]     = (Math.random() - 0.5) * 22;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 22;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 12 - 2;
    }
    return [pos];
  }, []);

  useFrame((state) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y = state.clock.getElapsedTime() * 0.04;
      pointsRef.current.rotation.x = state.clock.getElapsedTime() * 0.015;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={positions.length / 3}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.06}
        color="#38bdf8"
        transparent
        opacity={0.55}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
};

/* ─────────────────────────────────────────────
   2. POWER NODE — pulsing sphere with radar ring
───────────────────────────────────────────── */
const PowerNode = ({ position }) => {
  const meshRef = useRef();
  const ringRef = useRef();

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (meshRef.current) {
      meshRef.current.scale.setScalar(1 + Math.sin(t * 2.2 + position[0]) * 0.18);
    }
    if (ringRef.current) {
      const s = (t * 1.6 + position[1]) % 3;
      ringRef.current.scale.setScalar(s);
      ringRef.current.material.opacity = Math.max(0, 1 - s / 3) * 0.45;
    }
  });

  return (
    <group position={position}>
      <Sphere ref={meshRef} args={[0.14, 20, 20]}>
        <meshBasicMaterial color="#60a5fa" toneMapped={false} />
      </Sphere>
      <Sphere ref={ringRef} args={[0.45, 32, 32]}>
        <meshBasicMaterial
          color="#93c5fd"
          transparent
          opacity={0.45}
          wireframe
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </Sphere>
    </group>
  );
};

/* ─────────────────────────────────────────────
   3. POWER GRID — glowing dashed connection lines
───────────────────────────────────────────── */
const PowerGrid = () => (
  <group>
    {CONNECTIONS.map((c, i) => {
      const from = getNode(c.from).pos;
      const to   = getNode(c.to).pos;
      return (
        <Line
          key={i}
          points={[from, to]}
          color="#1e40af"
          lineWidth={1.8}
          dashed
          dashScale={5}
          dashSize={0.5}
          dashOffset={0}
          transparent
          opacity={0.75}
          blending={THREE.AdditiveBlending}
        />
      );
    })}
    {NODES.map(node => (
      <PowerNode key={node.id} position={node.pos} />
    ))}
  </group>
);

/* ─────────────────────────────────────────────
   4. SOLAR PANEL — floating & rotating
───────────────────────────────────────────── */
const SolarPanel = () => {
  const groupRef = useRef();

  useFrame((state) => {
    if (groupRef.current) {
      const t = state.clock.getElapsedTime();
      groupRef.current.rotation.y = t * 0.18;
      groupRef.current.rotation.z = Math.sin(t * 0.45) * 0.12;
      groupRef.current.position.y = -2 + Math.sin(t * 0.6) * 0.18;
    }
  });

  return (
    <group ref={groupRef} position={[4, -2, 2]} rotation={[0.4, 0, 0]}>
      {/* Panel body */}
      <Box args={[3, 1.5, 0.05]}>
        <meshStandardMaterial
          color="#0f172a"
          metalness={0.95}
          roughness={0.08}
          emissive="#0c2a4a"
          emissiveIntensity={0.4}
        />
      </Box>
      {/* PV grid wireframe */}
      <Plane args={[2.9, 1.4, 7, 4]} position={[0, 0, 0.032]}>
        <meshBasicMaterial color="#38bdf8" wireframe transparent opacity={0.35} />
      </Plane>
      {/* Glow plane overlay */}
      <Plane args={[3.2, 1.7]} position={[0, 0, -0.04]}>
        <meshBasicMaterial
          color="#0ea5e9"
          transparent
          opacity={0.06}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </Plane>
      {/* Mount stand */}
      <Box args={[0.1, 1.1, 0.1]} position={[0, -0.8, -0.2]} rotation={[0.5, 0, 0]}>
        <meshStandardMaterial color="#1e293b" metalness={0.85} roughness={0.35} />
      </Box>
    </group>
  );
};

/* ─────────────────────────────────────────────
   5. LIGHTNING FLASH
───────────────────────────────────────────── */
const Lightning = () => {
  const [intensity, setIntensity] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIntensity(1);
      setTimeout(() => setIntensity(0),   120);
      setTimeout(() => setIntensity(0.6), 180);
      setTimeout(() => setIntensity(0),   280);
    }, 7000);
    return () => clearInterval(interval);
  }, []);

  return (
    <pointLight
      position={[0, 5, 2]}
      intensity={intensity * 60}
      color="#7dd3fc"
      distance={22}
    />
  );
};

/* ─────────────────────────────────────────────
   6. CAMERA PARALLAX RIG
───────────────────────────────────────────── */
const CameraRig = () => {
  useFrame((state) => {
    state.camera.position.x = THREE.MathUtils.lerp(state.camera.position.x, state.mouse.x * 2,     0.05);
    state.camera.position.y = THREE.MathUtils.lerp(state.camera.position.y, state.mouse.y * 2 + 1, 0.05);
    state.camera.lookAt(0, 0, 0);
  });
  return null;
};

/* ─────────────────────────────────────────────
   7. DASHBOARD MOCKUP (HTML overlay with parallax)
───────────────────────────────────────────── */
const DashboardMockup = ({ cardTransform }) => (
  <div
    className="absolute z-10 pointer-events-none"
    style={{
      top: '50%',
      left: '50%',
      transform: `translate(-50%, -50%) ${cardTransform}`,
      transition: 'transform 0.15s ease-out',
      width: '580px',
      maxWidth: '90%',
    }}
  >
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: 'rgba(10,16,32,0.88)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.07)',
        boxShadow: '0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(34,211,238,0.06)',
      }}
    >
      {/* Window chrome */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'rgba(239,68,68,0.5)' }} />
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'rgba(245,158,11,0.5)' }} />
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'rgba(16,185,129,0.5)' }} />
        </div>
        <div className="text-[9px] font-mono tracking-[0.2em] uppercase" style={{ color: 'rgba(100,116,139,0.8)' }}>
          EDL Intelligence Terminal  v4.10
        </div>
        <div
          className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[8px] font-mono uppercase tracking-wider"
          style={{
            background: 'rgba(16,185,129,0.1)',
            border: '1px solid rgba(16,185,129,0.25)',
            color: '#34d399',
          }}
        >
          <motion.span
            className="w-1.5 h-1.5 rounded-full bg-emerald-400"
            animate={{ opacity: [1, 0.2, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
          Core Online
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2.5 p-4 pb-3">
        {[
          { icon: Sun,      label: 'Generation',  value: '248.5 kW',   sub: 'Active yield: optimal',    subColor: '#34d399', iconColor: '#fbbf24' },
          { icon: Activity, label: 'Net Flow',     value: '1,842 kWh',  sub: 'Grid load: balanced',      subColor: '#60a5fa', iconColor: '#60a5fa' },
          { icon: Database, label: 'Revenue',      value: 'LKR 42.6M', sub: 'Statement acc: 99.8%',     subColor: '#94a3b8', iconColor: '#a78bfa', valueColor: '#34d399' },
        ].map(stat => (
          <div
            key={stat.label}
            className="p-3 rounded-xl"
            style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.05)' }}
          >
            <div className="flex items-center gap-1 text-[7.5px] font-mono uppercase tracking-widest mb-1.5"
              style={{ color: 'rgba(100,116,139,0.8)' }}>
              <stat.icon size={9} style={{ color: stat.iconColor }} />
              {stat.label}
            </div>
            <div className="text-[13px] font-bold mb-1" style={{ color: stat.valueColor || '#e2e8f0' }}>
              {stat.value}
            </div>
            <div className="flex items-center gap-1 text-[7px] font-mono" style={{ color: stat.subColor }}>
              <span className="w-1 h-1 rounded-full" style={{ background: stat.subColor }} />
              {stat.sub}
            </div>
          </div>
        ))}
      </div>

      {/* Chart section */}
      <div className="px-4 pb-4">
        <div
          className="p-3 rounded-xl"
          style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.05)' }}
        >
          <div className="flex items-center gap-1.5 text-[8px] font-mono uppercase tracking-widest mb-3"
            style={{ color: 'rgba(100,116,139,0.8)' }}>
            <LineChart size={10} style={{ color: '#22d3ee' }} />
            National Grid Capacity Flow Trend
          </div>

          {/* SVG chart */}
          <div style={{ height: '90px' }}>
            <svg viewBox="0 0 500 90" className="w-full h-full overflow-visible">
              <defs>
                <linearGradient id="hcChartGlow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#22d3ee" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
                </linearGradient>
              </defs>
              <line x1="0" y1="20" x2="500" y2="20" stroke="rgba(255,255,255,0.04)" strokeWidth="1" strokeDasharray="3 4" />
              <line x1="0" y1="50" x2="500" y2="50" stroke="rgba(255,255,255,0.04)" strokeWidth="1" strokeDasharray="3 4" />
              <line x1="0" y1="80" x2="500" y2="80" stroke="rgba(255,255,255,0.04)" strokeWidth="1" strokeDasharray="3 4" />
              <path
                d="M0,80 L50,65 L100,70 L150,52 L200,44 L250,62 L300,36 L350,28 L400,40 L450,18 L500,10 L500,85 Z"
                fill="url(#hcChartGlow)"
              />
              <path
                d="M0,80 L50,65 L100,70 L150,52 L200,44 L250,62 L300,36 L350,28 L400,40 L450,18 L500,10"
                fill="none"
                stroke="#22d3ee"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {[[150, 52], [350, 28], [500, 10]].map(([cx, cy]) => (
                <circle key={cx} cx={cx} cy={cy} r="3" fill="#fff" stroke="#22d3ee" strokeWidth="1.5" />
              ))}
            </svg>
          </div>

          <div
            className="flex justify-between font-mono text-[7px] mt-1.5"
            style={{ color: 'rgba(100,116,139,0.6)' }}
          >
            {['JAN','MAR','MAY','JUL','SEP','NOV'].map(m => <span key={m}>{m}</span>)}
          </div>
        </div>
      </div>
    </div>
  </div>
);

/* ─────────────────────────────────────────────
   MAIN EXPORT — HoloScene
───────────────────────────────────────────── */
const HoloScene = ({ mousePos = { x: 0, y: 0 }, cardTransform = '' }) => (
  <div className="absolute inset-0 z-0 overflow-hidden" style={{ background: '#060c1a' }}>

    {/* ── Aurora background ── */}
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        background: `
          radial-gradient(ellipse 80% 60% at 60% 40%, rgba(29,78,216,0.12) 0%, transparent 70%),
          radial-gradient(ellipse 50% 50% at 80% 70%, rgba(139,92,246,0.08) 0%, transparent 60%),
          radial-gradient(ellipse 60% 40% at 30% 20%, rgba(6,182,212,0.06) 0%, transparent 60%)
        `,
      }}
    />

    {/* ── Subtle grid overlay ── */}
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        backgroundImage: `
          linear-gradient(rgba(34,211,238,0.025) 1px, transparent 1px),
          linear-gradient(90deg, rgba(34,211,238,0.025) 1px, transparent 1px)
        `,
        backgroundSize: '48px 48px',
      }}
    />

    {/* ── Animated energy lines (SVG) ── */}
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none z-0 overflow-visible"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="hcEnergyGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#22d3ee" stopOpacity="0.0" />
          <stop offset="50%"  stopColor="#22d3ee" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
        </linearGradient>
        <linearGradient id="hcEnergyGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#8b5cf6" stopOpacity="0.0" />
          <stop offset="50%"  stopColor="#8b5cf6" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
        </linearGradient>
        <style>{`
          @keyframes hcEnergyFlow1 { 0% { stroke-dashoffset: 0; } 100% { stroke-dashoffset: -1400; } }
          @keyframes hcEnergyFlow2 { 0% { stroke-dashoffset: 0; } 100% { stroke-dashoffset: -1600; } }
          @keyframes hcEnergyFlow3 { 0% { stroke-dashoffset: 0; } 100% { stroke-dashoffset: -1200; } }
          .hc-line1 { animation: hcEnergyFlow1 9s linear infinite; }
          .hc-line2 { animation: hcEnergyFlow2 12s linear infinite reverse; }
          .hc-line3 { animation: hcEnergyFlow3 7s linear infinite; }
        `}</style>
      </defs>

      {/* Track path 1 */}
      <path d="M-50,180 C250,40 500,580 1100,280" fill="none" stroke="rgba(34,211,238,0.06)" strokeWidth="1" />
      <path d="M-50,180 C250,40 500,580 1100,280" fill="none" stroke="url(#hcEnergyGrad1)"
        strokeWidth="1.5" strokeDasharray="20,180" className="hc-line1" />

      {/* Track path 2 */}
      <path d="M80,-60 C280,400 600,80 920,880" fill="none" stroke="rgba(139,92,246,0.06)" strokeWidth="1" />
      <path d="M80,-60 C280,400 600,80 920,880" fill="none" stroke="url(#hcEnergyGrad2)"
        strokeWidth="1.5" strokeDasharray="24,200" className="hc-line2" />

      {/* Track path 3 */}
      <path d="M600,-40 C750,300 400,500 1100,700" fill="none" stroke="rgba(59,130,246,0.05)" strokeWidth="1" />
      <path d="M600,-40 C750,300 400,500 1100,700" fill="none" stroke="rgba(59,130,246,0.5)"
        strokeWidth="1.5" strokeDasharray="16,150" className="hc-line3" />
    </svg>

    {/* ── Floating ambient orbs ── */}
    {[
      { w: 300, h: 300, top: '5%',  left: '15%', color: 'rgba(59,130,246,0.07)',  dur: 10, delay: 0 },
      { w: 220, h: 220, top: '55%', left: '60%', color: 'rgba(139,92,246,0.06)', dur: 14, delay: 3 },
      { w: 180, h: 180, top: '75%', left: '20%', color: 'rgba(34,211,238,0.05)', dur: 11, delay: 1.5 },
    ].map((orb, i) => (
      <motion.div
        key={i}
        className="absolute rounded-full pointer-events-none"
        style={{
          width: orb.w, height: orb.h,
          top: orb.top, left: orb.left,
          background: `radial-gradient(circle, ${orb.color}, transparent 70%)`,
        }}
        animate={{ x: [0, 30, -20, 0], y: [0, -25, 30, 0] }}
        transition={{ duration: orb.dur, delay: orb.delay, repeat: Infinity, ease: 'easeInOut' }}
      />
    ))}

    {/* ── Three.js 3D Canvas ── */}
    <Canvas camera={{ position: [0, 1, 8], fov: 60 }} style={{ position: 'absolute', inset: 0 }}>
      <color attach="background" args={['#060c1a']} />
      <fog attach="fog" args={['#060c1a', 8, 22]} />

      <ambientLight intensity={0.6} color="#1e3a8a" />
      <pointLight position={[0, 0, 5]} intensity={2.5} color="#3b82f6" />
      <pointLight position={[-4, 4, 2]} intensity={1.2} color="#22d3ee" />
      <Lightning />

      <ParticleField />
      <PowerGrid />
      <SolarPanel />

      <Stars radius={120} depth={60} count={3500} factor={4} saturation={0} fade speed={0.8} />

      <CameraRig />
    </Canvas>

    {/* ── Dashboard mockup (HTML, parallax) ── */}
    {/* <DashboardMockup cardTransform={cardTransform} /> */}
  </div>
);

export default HoloScene;
