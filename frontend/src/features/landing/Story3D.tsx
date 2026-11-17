import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { LabOption } from "./lab";

/**
 * The hero's 3D story, driven by scroll progress (0–1):
 *
 *   0.00  a product exists only as a blueprint (line drawing on a grid)
 *   0.25  it becomes a physical product
 *   0.40  its footprint appears: one dot per 0.1 g CO2e, taken from the engine
 *   0.55+ the visitor changes the material and the cloud grows or shrinks
 *
 * The cloud is the data: the number of dots is the engine's estimate, and the
 * cloud's size grows with it. Everything animates on the GPU.
 */
export interface StoryProps {
  /** Scroll progress through the story, read every frame without re-rendering. */
  progress: MutableRefObject<number>;
  /** Dots to show once the footprint has appeared (engine value). */
  count: number;
  /** Largest count any option can reach; fixes the scale of the cloud. */
  maxCount: number;
  look: LabOption["look"];
  animate: boolean;
  compact: boolean;
}

const LOOKS: Record<LabOption["look"], { color: string; opacity: number; roughness: number; metalness: number; cap: string; band: string }> = {
  pet: { color: "#e3f4ff", opacity: 0.36, roughness: 0.06, metalness: 0, cap: "#7DD3FC", band: "#F8FAF7" },
  rpet: { color: "#c9e6d3", opacity: 0.44, roughness: 0.12, metalness: 0, cap: "#34D399", band: "#D9F99D" },
  glass: { color: "#9fd6b4", opacity: 0.58, roughness: 0.02, metalness: 0, cap: "#E5E7EB", band: "#F8FAF7" },
  aluminium: { color: "#e4e7ea", opacity: 1, roughness: 0.28, metalness: 1, cap: "#e4e7ea", band: "#10B981" },
};

const PROFILE: [number, number][] = [
  [0, 0], [0.36, 0], [0.42, 0.05], [0.43, 0.3], [0.41, 0.62], [0.43, 0.9], [0.43, 1.28],
  [0.4, 1.46], [0.31, 1.68], [0.2, 1.86], [0.16, 1.93], [0.16, 2.08],
];

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function Environment() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const texture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = texture;
    return () => {
      scene.environment = null;
      texture.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
  return null;
}

/** Blueprint drawing: rings and meridians of the product, a floor grid and a height dimension. */
function useBlueprint() {
  return useMemo(() => {
    const curve = new THREE.SplineCurve(PROFILE.map(([x, y]) => new THREE.Vector2(x, y)));
    const points = curve.getPoints(22);
    const verts: number[] = [];
    const ring = 56;
    points.forEach((p, j) => {
      if (j % 2 === 1 || p.x < 0.01) return;
      for (let i = 0; i < ring; i++) {
        const a = (i / ring) * Math.PI * 2;
        const b = ((i + 1) / ring) * Math.PI * 2;
        verts.push(Math.cos(a) * p.x, p.y, Math.sin(a) * p.x, Math.cos(b) * p.x, p.y, Math.sin(b) * p.x);
      }
    });
    for (let m = 0; m < 12; m++) {
      const a = (m / 12) * Math.PI * 2;
      for (let j = 0; j < points.length - 1; j++) {
        verts.push(Math.cos(a) * points[j].x, points[j].y, Math.sin(a) * points[j].x, Math.cos(a) * points[j + 1].x, points[j + 1].y, Math.sin(a) * points[j + 1].x);
      }
    }
    const body = new THREE.BufferGeometry();
    body.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));

    const extra: number[] = [];
    const half = 3.2;
    for (let i = -8; i <= 8; i++) {
      const k = (i / 8) * half;
      extra.push(-half, 0, k, half, 0, k, k, 0, -half, k, 0, half);
    }
    // height dimension with end ticks
    extra.push(-0.78, 0, 0, -0.78, 2.08, 0, -0.88, 0, 0, -0.68, 0, 0, -0.88, 2.08, 0, -0.68, 2.08, 0);
    const grid = new THREE.BufferGeometry();
    grid.setAttribute("position", new THREE.Float32BufferAttribute(extra, 3));

    const solid = new THREE.LatheGeometry(curve.getPoints(64), 64);
    return { body, grid, solid };
  }, []);
}

const VERTEX = /* glsl */ `
  attribute float aIndex;
  attribute vec3 aSeed;
  uniform float uTime;
  uniform float uCount;
  uniform float uMax;
  uniform float uSize;
  varying float vAlpha;
  varying float vMix;
  void main() {
    float n = aIndex / uMax;
    // radius grows with the square root of the index, so dot density stays constant
    // and the area of the cloud is proportional to the footprint
    float r = 0.66 + 2.75 * sqrt(n) + (aSeed.z - 0.5) * 0.16;
    float visible = clamp((uCount - aIndex) / 50.0, 0.0, 1.0);
    float theta = aSeed.x * 6.2831853 + uTime * (0.22 / (0.4 + r));
    float y = 1.05 + (aSeed.y - 0.5) * (1.1 + 1.9 * sqrt(n)) + sin(uTime * 0.7 + aSeed.z * 6.2831853) * 0.07;
    float spread = mix(0.2, 1.0, visible);
    vec3 p = vec3(cos(theta) * r * spread, mix(1.05, y, visible), sin(theta) * r * spread);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * (0.55 + 0.9 * aSeed.z) / -mv.z;
    vAlpha = visible;
    vMix = aSeed.x;
  }
`;

const FRAGMENT = /* glsl */ `
  varying float vAlpha;
  varying float vMix;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float disc = smoothstep(0.5, 0.12, d);
    vec3 color = mix(vec3(0.745, 0.949, 0.392), vec3(0.063, 0.725, 0.506), vMix);
    gl_FragColor = vec4(color, disc * vAlpha * 0.9);
  }
`;

function Footprint({ progress, count, maxCount, animate, compact }: Pick<StoryProps, "progress" | "count" | "maxCount" | "animate" | "compact">) {
  const material = useRef<THREE.ShaderMaterial>(null);
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const shown = useRef(0);

  const geometry = useMemo(() => {
    const total = Math.ceil(maxCount);
    const index = new Float32Array(total);
    const seed = new Float32Array(total * 3);
    let state = 20261113; // fixed seed: the same cloud on every visit
    const random = () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 4294967296;
    };
    for (let i = 0; i < total; i++) {
      index[i] = i;
      seed[i * 3] = random();
      seed[i * 3 + 1] = random();
      seed[i * 3 + 2] = random();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(total * 3), 3));
    g.setAttribute("aIndex", new THREE.BufferAttribute(index, 1));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 3));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1, 0), 6);
    return g;
  }, [maxCount]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uCount: { value: 0 }, uMax: { value: Math.ceil(maxCount) }, uSize: { value: 30 } }), [maxCount]);

  useEffect(() => invalidate(), [count, invalidate]);

  useFrame((state, delta) => {
    if (!material.current) return;
    const p = animate ? progress.current : 1;
    const target = count * smooth(0.3, 0.46, p);
    shown.current = animate ? shown.current + (target - shown.current) * Math.min(1, delta * 2.6) : target;
    const u = material.current.uniforms;
    u.uCount.value = shown.current;
    u.uTime.value = animate ? state.clock.elapsedTime : 0;
    u.uSize.value = (compact ? 30 : 46) * (size.height / 700) * state.viewport.dpr;
  });

  return (
    <points geometry={geometry} frustumCulled={false}>
      <shaderMaterial ref={material} vertexShader={VERTEX} fragmentShader={FRAGMENT} uniforms={uniforms} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
}

function Product({ progress, look, animate }: Pick<StoryProps, "progress" | "look" | "animate">) {
  const { body, grid, solid } = useBlueprint();
  const spin = useRef<THREE.Group>(null);
  const lines = useRef<THREE.LineBasicMaterial>(null);
  const floor = useRef<THREE.LineBasicMaterial>(null);
  const skin = useRef<THREE.MeshPhysicalMaterial>(null);
  const cap = useRef<THREE.MeshStandardMaterial>(null);
  const band = useRef<THREE.MeshStandardMaterial>(null);
  const invalidate = useThree((s) => s.invalidate);
  const style = LOOKS[look];

  useEffect(() => () => [body, grid, solid].forEach((g) => g.dispose()), [body, grid, solid]);
  useEffect(() => invalidate(), [look, invalidate]);

  useFrame((_, delta) => {
    const p = animate ? progress.current : 1;
    const real = smooth(0.14, 0.32, p); // 0 = drawing, 1 = physical product
    if (spin.current && animate) spin.current.rotation.y += delta * 0.22;
    if (lines.current) lines.current.opacity = 0.9 * (1 - real) + 0.05;
    if (floor.current) floor.current.opacity = 0.3 * (1 - real) + 0.05;
    if (skin.current) {
      skin.current.opacity = style.opacity * real;
      skin.current.visible = real > 0.01;
    }
    // invisible parts must not write depth, or they would hide the drawing behind them
    if (cap.current) {
      cap.current.opacity = real;
      cap.current.visible = real > 0.01;
    }
    if (band.current) {
      band.current.opacity = real * (style.opacity < 1 ? 0.92 : 1);
      band.current.visible = real > 0.01;
    }
  });

  const clear = style.opacity < 1;
  return (
    <>
      <lineSegments geometry={grid}>
        <lineBasicMaterial ref={floor} color="#A7F3D0" transparent opacity={0.3} depthWrite={false} />
      </lineSegments>
      <group ref={spin}>
        <lineSegments geometry={body}>
          <lineBasicMaterial ref={lines} color="#D9F99D" transparent opacity={0.9} depthWrite={false} />
        </lineSegments>
        <mesh geometry={solid}>
          <meshPhysicalMaterial ref={skin} color={style.color} roughness={style.roughness} metalness={style.metalness} clearcoat={clear ? 1 : 0.25} transparent opacity={0} depthWrite={!clear} side={THREE.DoubleSide} envMapIntensity={1.4} />
        </mesh>
        <mesh position={[0, 0.76, 0]}>
          <cylinderGeometry args={[0.437, 0.437, 0.42, 64, 1, true]} />
          <meshStandardMaterial ref={band} color={style.band} roughness={0.7} transparent opacity={0} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 2.13, 0]}>
          <cylinderGeometry args={[0.18, 0.18, 0.15, 32]} />
          <meshStandardMaterial ref={cap} color={style.cap} roughness={0.45} metalness={style.metalness ? 0.9 : 0} transparent opacity={0} />
        </mesh>
      </group>
    </>
  );
}

function Rig({ children, animate, compact }: { children: React.ReactNode; animate: boolean; compact: boolean }) {
  const group = useRef<THREE.Group>(null);
  useFrame((state, delta) => {
    if (!group.current || !animate) return;
    const k = Math.min(1, delta * 2);
    group.current.rotation.y += (state.pointer.x * 0.1 - group.current.rotation.y) * k;
  });
  // Desktop: the product sits right of the copy. Phone: centred, above the copy.
  return (
    <group ref={group} position={compact ? [0, 0.95, 0] : [1.5, -1.02, 0]}>
      {children}
    </group>
  );
}

export default function Story3D(props: StoryProps) {
  const { animate, compact } = props;
  return (
    <Canvas
      frameloop={animate ? "always" : "demand"}
      dpr={[1, compact ? 1.5 : 1.75]}
      camera={{ position: [0, compact ? 1.9 : 0.9, compact ? 9.4 : 7.4], fov: 34 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      onCreated={({ camera }) => camera.lookAt(0, compact ? 0.35 : 0, 0)}
      aria-hidden
    >
      <Environment />
      <ambientLight intensity={0.5} />
      <directionalLight position={[3, 5, 4]} intensity={1.5} />
      <directionalLight position={[-4, 2, -3]} intensity={0.6} color="#10B981" />
      <Rig animate={animate} compact={compact}>
        <Product {...props} />
        <Footprint {...props} />
      </Rig>
    </Canvas>
  );
}
