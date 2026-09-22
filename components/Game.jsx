"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { clone as cloneSkeletal } from "three/examples/jsm/utils/SkeletonUtils.js";
import { tryLoadModel } from "@/lib/assets";
import {
  buildProceduralGun,
  buildProceduralEnemy,
  makeFloorTexture,
  makeGlowTexture,
  makeCloudTexture,
  makeStarTexture,
} from "@/lib/proceduralAssets";
import { SoundBank } from "@/lib/sound";

const MAG_SIZE = 12;
const DAY_LENGTH = 120; // seconds per full day/night cycle

export default function Game() {
  const mountRef = useRef(null);
  const [screen, setScreen] = useState("start"); // start | playing | paused | gameover
  const [health, setHealth] = useState(100);
  const [ammoInMag, setAmmoInMag] = useState(MAG_SIZE);
  const [ammoReserve, setAmmoReserve] = useState(36);
  const [score, setScore] = useState(0);
  const [reloading, setReloading] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [hitFlashOn, setHitFlashOn] = useState(false);
  const [crosshairHit, setCrosshairHit] = useState(false);

  const stateRef = useRef(null); // mutable game state, avoids re-renders per frame

  useEffect(() => {
    const mount = mountRef.current;
    let disposed = false;

    const sound = new SoundBank();
    sound.load();

    const scene = new THREE.Scene();
    const skyDay = new THREE.Color(0x8fc7e8);
    const skyNight = new THREE.Color(0x040611);
    const skyCur = new THREE.Color();
    scene.background = skyDay.clone();
    scene.fog = new THREE.Fog(0x2c3b2c, 18, 60);

    const camera = new THREE.PerspectiveCamera(
      75,
      mount.clientWidth / mount.clientHeight,
      0.03,
      220
    );
    camera.position.set(0, 1.7, 8);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    const hemiLight = new THREE.HemisphereLight(0xcfe0c0, 0x11150f, 1.0);
    scene.add(hemiLight);
    const sunLight = new THREE.DirectionalLight(0xfff2d6, 0.9);
    scene.add(sunLight);
    const moonLight = new THREE.DirectionalLight(0x8fb3ff, 0);
    scene.add(moonLight);

    // ---- sky: sun, moon, stars, clouds ----
    const sunMat = new THREE.SpriteMaterial({
      map: makeGlowTexture("rgba(255,250,220,1)", "rgba(255,200,80,0)"),
      transparent: true, blending: THREE.AdditiveBlending, fog: false, depthWrite: false,
    });
    const sunSprite = new THREE.Sprite(sunMat);
    sunSprite.scale.set(18, 18, 18);
    scene.add(sunSprite);

    const moonMat = new THREE.SpriteMaterial({
      map: makeGlowTexture("rgba(235,240,255,1)", "rgba(160,180,220,0)"),
      transparent: true, blending: THREE.AdditiveBlending, fog: false, depthWrite: false,
    });
    const moonSprite = new THREE.Sprite(moonMat);
    moonSprite.scale.set(11, 11, 11);
    scene.add(moonSprite);

    const starCount = 500;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * 0.5;
      const r = 150;
      starPos[i * 3] = r * Math.cos(theta) * Math.cos(phi);
      starPos[i * 3 + 1] = r * Math.sin(phi) + 20;
      starPos[i * 3 + 2] = r * Math.sin(theta) * Math.cos(phi);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({
      size: 1.4, map: makeStarTexture(), transparent: true, opacity: 0,
      depthWrite: false, sizeAttenuation: false, fog: false,
    });
    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    const cloudTex = makeCloudTexture();
    const clouds = [];
    for (let c = 0; c < 8; c++) {
      const cm = new THREE.SpriteMaterial({ map: cloudTex, transparent: true, opacity: 0.8, depthWrite: false, fog: false });
      const sp = new THREE.Sprite(cm);
      const scale = 18 + Math.random() * 14;
      sp.scale.set(scale * 2, scale, 1);
      sp.position.set((Math.random() - 0.5) * 140, 26 + Math.random() * 14, (Math.random() - 0.5) * 140);
      scene.add(sp);
      clouds.push({ sprite: sp, speed: 0.4 + Math.random() * 0.6 });
    }

    // ---- floor + walls ----
    const floorGeo = new THREE.PlaneGeometry(80, 80);
    const floorMat = new THREE.MeshStandardMaterial({ map: makeFloorTexture(), roughness: 0.95 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    const walls = [];
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x3a3a30 });
    const wallDefs = [
      [0, 1.5, -30, 60, 3, 1], [0, 1.5, 30, 60, 3, 1],
      [-30, 1.5, 0, 1, 3, 60], [30, 1.5, 0, 1, 3, 60],
      [8, 1, -4, 3, 2, 3], [-9, 1, 3, 3, 2, 3], [3, 1, 10, 2, 2, 6],
    ];
    wallDefs.forEach((w) => {
      const geo = new THREE.BoxGeometry(w[3], w[4], w[5]);
      const mesh = new THREE.Mesh(geo, wallMat);
      mesh.position.set(w[0], w[1], w[2]);
      scene.add(mesh);
      walls.push(mesh);
    });

    // ---- gun (real model if present, else procedural) ----
    let gunGroup = new THREE.Group();
    let gunBaseX = 0.16, gunBaseY = -0.16, gunBaseZ = -0.35;
    let muzzleFlash;
    let usingRealGun = false;

    function attachMuzzleFlash(target, offset) {
      const flashMat = new THREE.SpriteMaterial({ color: 0xffdd66, transparent: true, opacity: 0, depthTest: false });
      muzzleFlash = new THREE.Sprite(flashMat);
      muzzleFlash.scale.set(0.16, 0.16, 0.16);
      muzzleFlash.position.copy(offset);
      target.add(muzzleFlash);
    }

    function setupProceduralGun() {
      const mesh = buildProceduralGun();
      gunGroup.add(mesh);
      attachMuzzleFlash(gunGroup, new THREE.Vector3(0, 0.03, -0.44));
    }

    // gunGroup is a neutral rig: only ever gets the viewmodel position and
    // bob/recoil animation, so that logic is identical whether we end up
    // with the procedural placeholder or a real loaded model.
    gunGroup.position.set(gunBaseX, gunBaseY, gunBaseZ);
    camera.add(gunGroup);

    tryLoadModel("/models/gun.glb").then((gltf) => {
      if (disposed) return;
      if (gltf) {
        usingRealGun = true;
        const gunMesh = gltf.scene;
        // This model's long axis (stock-to-muzzle) runs along local +Y, so
        // rotating -90° about X swings it to point along -Z (forward) —
        // the fix-up lives on gunMesh, not on gunGroup, so gunGroup stays a
        // clean rig for positioning/recoil regardless of the asset. If a
        // different model comes in backwards or upside down, adjust this
        // rotation (try +Math.PI/2, or add a rotation.z of Math.PI) rather
        // than touching gunGroup.
        gunMesh.scale.set(0.9, 0.9, 0.9);
        gunMesh.rotation.x = -Math.PI / 2;
        gunMesh.updateMatrixWorld(true);

        const box = new THREE.Box3().setFromObject(gunMesh);
        const muzzleOffset = new THREE.Vector3(
          (box.min.x + box.max.x) / 2,
          (box.min.y + box.max.y) / 2,
          box.min.z - 0.04
        );

        gunMesh.traverse((child) => {
          if (child.isMesh) { child.castShadow = false; child.frustumCulled = false; }
        });
        gunGroup.add(gunMesh);
        gunGroup.position.set(0.22, -0.32, -0.55);
        gunBaseX = gunGroup.position.x; gunBaseY = gunGroup.position.y; gunBaseZ = gunGroup.position.z;
        attachMuzzleFlash(gunGroup, muzzleOffset);
      } else {
        setupProceduralGun();
      }
    });

    scene.add(camera);

    // ---- enemies ----
    let enemyTemplate = null; // { scene, animations } if a real model loaded
    tryLoadModel("/models/enemy.glb").then((gltf) => {
      if (disposed) return;
      if (gltf) {
        // This character (a Mixamo export) is authored in centimeters and
        // stands with its feet at local y=0, so scaling by 0.01 brings it to
        // meters matching the rest of the scene, with no extra y-offset
        // needed to plant its feet on the floor. A model from a different
        // source may need a different scale factor here.
        gltf.scene.scale.set(0.01, 0.01, 0.01);
        enemyTemplate = gltf;
      }
    });

    function spawnEnemyMesh() {
      if (enemyTemplate) {
        // Plain Object3D.clone() does not correctly duplicate skinned-mesh
        // bindings, so every clone would share (and fight over) the same
        // skeleton. SkeletonUtils.clone() clones the skeleton correctly so
        // each enemy can animate independently.
        const mesh = cloneSkeletal(enemyTemplate.scene);
        let mixer = null;
        if (enemyTemplate.animations && enemyTemplate.animations.length) {
          mixer = new THREE.AnimationMixer(mesh);
          const action = mixer.clipAction(enemyTemplate.animations[0]);
          action.play();
        }
        return { mesh, mixer, groundY: 0 };
      }
      // The procedural capsule is centered on its own origin, so it needs
      // to sit at y=1 for its bottom to touch the floor.
      return { mesh: buildProceduralEnemy(), mixer: null, groundY: 1 };
    }

    // ---- runtime state (kept in a ref-mirrored object to avoid re-renders per frame) ----
    const S = {
      moveState: { forward: false, back: false, left: false, right: false },
      yaw: 0, pitch: 0,
      isLocked: false,
      enemies: [],
      health: 100,
      ammoInMag: MAG_SIZE, ammoReserve: 36,
      score: 0,
      isReloading: false,
      gameOver: false,
      lastShot: 0,
      spawnTimer: 0, spawnInterval: 3.0,
      difficultyTimer: 0,
      recoil: 0, bobPhase: 0,
      dayTime: 0.18,
      raf: null,
    };
    stateRef.current = S;

    const clock = new THREE.Clock();

    function onResize() {
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    }

    function onKeyDown(e) {
      if (e.code === "KeyW") S.moveState.forward = true;
      if (e.code === "KeyS") S.moveState.back = true;
      if (e.code === "KeyA") S.moveState.left = true;
      if (e.code === "KeyD") S.moveState.right = true;
      if (e.code === "KeyR") reload();
    }
    function onKeyUp(e) {
      if (e.code === "KeyW") S.moveState.forward = false;
      if (e.code === "KeyS") S.moveState.back = false;
      if (e.code === "KeyA") S.moveState.left = false;
      if (e.code === "KeyD") S.moveState.right = false;
    }
    function onMouseMove(e) {
      if (!S.isLocked) return;
      const sensitivity = 0.0022;
      S.yaw -= e.movementX * sensitivity;
      S.pitch -= e.movementY * sensitivity;
      S.pitch = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, S.pitch));
    }
    function onMouseDown(e) {
      if (!S.isLocked || S.gameOver) return;
      if (e.button === 0) shoot();
    }
    function onLockChange() {
      S.isLocked = document.pointerLockElement === renderer.domElement;
      if (S.isLocked) {
        if (S.gameOver) resetGame();
        setScreen("playing");
      } else if (!S.gameOver) {
        setScreen("paused");
      }
    }

    function showHitMarker() {
      setCrosshairHit(true);
      setTimeout(() => setCrosshairHit(false), 100);
    }

    function flashEnemy(enemy) {
      const meshes = [];
      enemy.mesh.traverse((child) => {
        if (child.isMesh && child.material && child.material.emissive) {
          if (child.userData.baseEmissive == null) {
            child.userData.baseEmissive = child.material.emissive.getHex();
          }
          meshes.push(child);
        }
      });
      meshes.forEach((child) => child.material.emissive.setHex(0xff3333));
      setTimeout(() => {
        meshes.forEach((child) => child.material.emissive.setHex(child.userData.baseEmissive));
      }, 90);
    }

    function killEnemy(enemy) {
      scene.remove(enemy.mesh);
      S.enemies = S.enemies.filter((en) => en !== enemy);
      S.score += 10;
      sound.kill();
      setScore(S.score);
    }

    function shoot() {
      const now = performance.now();
      if (S.isReloading) return;
      if (now - S.lastShot < 130) return;
      if (S.ammoInMag <= 0) { sound.empty(); reload(); return; }
      S.lastShot = now;
      S.ammoInMag--;
      setAmmoInMag(S.ammoInMag);
      sound.shot();
      if (muzzleFlash) {
        muzzleFlash.material.opacity = 1;
        setTimeout(() => { if (muzzleFlash) muzzleFlash.material.opacity = 0; }, 45);
      }
      S.recoil = 1;

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera({ x: 0, y: 0 }, camera);
      const targets = S.enemies.map((en) => en.mesh);
      const hits = raycaster.intersectObjects(targets.concat(walls), true);
      if (hits.length) {
        const hitObj = hits[0].object;
        const enemy = S.enemies.find(
          (en) => en.mesh === hitObj || (en.mesh.children && en.mesh.children.includes(hitObj)) || isDescendant(en.mesh, hitObj)
        );
        if (enemy) {
          enemy.health = (enemy.health == null ? 100 : enemy.health) - 34;
          flashEnemy(enemy);
          showHitMarker();
          if (enemy.health <= 0) killEnemy(enemy);
          else sound.hit();
        }
      }
    }

    function isDescendant(root, node) {
      let found = false;
      root.traverse((child) => { if (child === node) found = true; });
      return found;
    }

    function reload() {
      if (S.isReloading || S.ammoInMag === MAG_SIZE || S.ammoReserve <= 0) return;
      S.isReloading = true;
      setReloading(true);
      sound.reload();
      setTimeout(() => {
        const needed = MAG_SIZE - S.ammoInMag;
        const take = Math.min(needed, S.ammoReserve);
        S.ammoInMag += take;
        S.ammoReserve -= take;
        S.isReloading = false;
        setReloading(false);
        setAmmoInMag(S.ammoInMag);
        setAmmoReserve(S.ammoReserve);
      }, 900);
    }

    function takeDamage(amount) {
      S.health -= amount;
      sound.damage();
      setHitFlashOn(true);
      setTimeout(() => setHitFlashOn(false), 120);
      setHealth(Math.max(0, S.health));
      if (S.health <= 0 && !S.gameOver) endGame();
    }

    function endGame() {
      S.gameOver = true;
      document.exitPointerLock();
      setFinalScore(S.score);
      setScreen("gameover");
    }

    function resetGame() {
      S.enemies.forEach((en) => scene.remove(en.mesh));
      S.enemies = [];
      S.health = 100; S.ammoInMag = MAG_SIZE; S.ammoReserve = 36; S.score = 0;
      S.spawnTimer = 0; S.spawnInterval = 3.0; S.difficultyTimer = 0;
      S.gameOver = false;
      camera.position.set(0, 1.7, 8);
      S.yaw = 0; S.pitch = 0;
      setHealth(100); setAmmoInMag(MAG_SIZE); setAmmoReserve(36); setScore(0);
    }

    function spawnEnemy() {
      const { mesh, mixer, groundY } = spawnEnemyMesh();
      const angle = Math.random() * Math.PI * 2;
      const dist = 22 + Math.random() * 6;
      mesh.position.set(Math.cos(angle) * dist, groundY, Math.sin(angle) * dist);
      scene.add(mesh);
      S.enemies.push({ mesh, mixer, health: 100, speed: 1.4 + Math.random() * 0.8, lastAttack: 0 });
    }

    function updateEnemies(dt) {
      S.enemies.forEach((en) => {
        const dir = new THREE.Vector3().subVectors(camera.position, en.mesh.position);
        dir.y = 0;
        const dist = dir.length();
        dir.normalize();
        if (dist > 1.6) {
          en.mesh.position.addScaledVector(dir, en.speed * dt);
        } else {
          const now = performance.now();
          if (now - en.lastAttack > 800) {
            en.lastAttack = now;
            takeDamage(8);
          }
        }
        en.mesh.lookAt(camera.position.x, en.mesh.position.y, camera.position.z);
        if (en.mixer) en.mixer.update(dt);
      });
    }

    function updateSky(dt) {
      S.dayTime += dt / DAY_LENGTH;
      if (S.dayTime > 1) S.dayTime -= 1;
      const theta = S.dayTime * Math.PI * 2;
      const sunHeight = Math.sin(theta);
      const sunDir = new THREE.Vector3(Math.cos(theta), sunHeight, 0.35).normalize();
      const moonDir = sunDir.clone().negate();

      sunSprite.position.copy(camera.position).addScaledVector(sunDir, 170);
      moonSprite.position.copy(camera.position).addScaledVector(moonDir, 170);
      sunSprite.visible = sunHeight > -0.08;
      moonSprite.visible = sunHeight < 0.08;

      const dayFactor = THREE.MathUtils.clamp((sunHeight + 0.15) / 0.35, 0, 1);
      const horizonWarm = 1 - Math.abs(sunHeight);

      skyCur.copy(skyNight).lerp(skyDay, dayFactor);
      const warm = new THREE.Color(0xff9a4d);
      skyCur.lerp(warm, Math.max(0, horizonWarm - 0.4) * 0.5 * (sunHeight > -0.2 ? 1 : 0));
      scene.background.copy(skyCur);
      scene.fog.color.copy(skyCur);

      sunLight.position.copy(sunDir).multiplyScalar(50);
      sunLight.intensity = Math.max(0, sunHeight) * 0.95;
      sunLight.color.setHSL(0.11 - 0.03 * Math.max(0, sunHeight), 0.7, 0.6 + 0.2 * Math.max(0, sunHeight));
      moonLight.position.copy(moonDir).multiplyScalar(50);
      moonLight.intensity = Math.max(0, -sunHeight) * 0.28;
      hemiLight.intensity = 0.25 + dayFactor * 0.75;

      stars.material.opacity = THREE.MathUtils.clamp(1 - dayFactor * 1.4, 0, 0.9);

      clouds.forEach((cl) => {
        cl.sprite.position.x += cl.speed * dt;
        if (cl.sprite.position.x > 90) cl.sprite.position.x = -90;
        cl.sprite.material.opacity = 0.15 + dayFactor * 0.65;
      });
    }

    function updateMovement(dt) {
      const speed = 5.2;
      const forward = new THREE.Vector3(Math.sin(S.yaw), 0, Math.cos(S.yaw)).negate();
      const right = new THREE.Vector3(forward.z, 0, -forward.x);
      const move = new THREE.Vector3();
      if (S.moveState.forward) move.add(forward);
      if (S.moveState.back) move.sub(forward);
      if (S.moveState.right) move.add(right);
      if (S.moveState.left) move.sub(right);
      if (move.lengthSq() > 0) {
        move.normalize().multiplyScalar(speed * dt);
        const next = camera.position.clone().add(move);
        next.x = Math.max(-28, Math.min(28, next.x));
        next.z = Math.max(-28, Math.min(28, next.z));
        camera.position.x = next.x;
        camera.position.z = next.z;
      }
      camera.rotation.order = "YXZ";
      camera.rotation.y = S.yaw;
      camera.rotation.x = S.pitch;

      const moving = S.moveState.forward || S.moveState.back || S.moveState.left || S.moveState.right;
      if (moving) {
        S.bobPhase += dt * 9;
      } else {
        const wrapped = S.bobPhase % (Math.PI * 2);
        const centered = wrapped > Math.PI ? wrapped - Math.PI * 2 : wrapped;
        S.bobPhase += (0 - centered) * Math.min(1, dt * 6);
      }
      if (gunGroup) {
        const bobY = moving ? Math.sin(S.bobPhase) * 0.012 : 0;
        const bobX = moving ? Math.cos(S.bobPhase * 0.5) * 0.006 : 0;
        S.recoil = Math.max(0, S.recoil - dt * 6);
        gunGroup.position.set(gunBaseX + bobX, gunBaseY + bobY + S.recoil * 0.05, gunBaseZ + S.recoil * 0.06);
        gunGroup.rotation.x = -S.recoil * 0.25;
      }
    }

    function animate() {
      S.raf = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);

      updateSky(dt);

      try {
        if (S.isLocked && !S.gameOver) {
          updateMovement(dt);
          updateEnemies(dt);

          S.spawnTimer += dt;
          S.difficultyTimer += dt;
          if (S.difficultyTimer > 15 && S.spawnInterval > 1.1) {
            S.spawnInterval -= 0.15;
            S.difficultyTimer = 0;
          }
          if (S.spawnTimer > S.spawnInterval && S.enemies.length < 12) {
            S.spawnTimer = 0;
            spawnEnemy();
          }
        }
      } catch (err) {
        console.error("Frame update error:", err);
      }

      renderer.render(scene, camera);
    }

    window.addEventListener("resize", onResize);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("pointerlockchange", onLockChange);

    animate();

    // expose a way for the React UI to request pointer lock
    stateRef.current.requestLock = () => renderer.domElement.requestPointerLock();

    return () => {
      disposed = true;
      cancelAnimationFrame(S.raf);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("pointerlockchange", onLockChange);
      mount.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, []);

  function handleStartClick() {
    stateRef.current && stateRef.current.requestLock && stateRef.current.requestLock();
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black">
      <div ref={mountRef} className="absolute inset-0" />

      {/* hit flash */}
      <div
        className="pointer-events-none fixed inset-0 z-40 bg-red-500 transition-opacity duration-100"
        style={{ opacity: hitFlashOn ? 0.35 : 0 }}
      />

      {/* crosshair */}
      {screen === "playing" && (
        <div className="pointer-events-none fixed left-1/2 top-1/2 z-50 h-5 w-5 -translate-x-1/2 -translate-y-1/2">
          <div className={`absolute left-0 top-[9px] h-[2px] w-5 ${crosshairHit ? "bg-red-400" : "bg-white/85"}`} />
          <div className={`absolute left-[9px] top-0 h-5 w-[2px] ${crosshairHit ? "bg-red-400" : "bg-white/85"}`} />
        </div>
      )}

      {/* HUD */}
      {screen === "playing" && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex items-end justify-between p-6 text-white">
          <div className="rounded-xl bg-black/50 px-4 py-2">
            <div className="text-xs uppercase tracking-wide opacity-75">Health</div>
            <div className="text-2xl font-bold text-green-400">{Math.round(health)}</div>
          </div>
          <div className="rounded-xl bg-black/50 px-4 py-2 text-center">
            <div className="text-xs opacity-75">Score</div>
            <div className="text-xl font-bold">{score}</div>
          </div>
          <div className="rounded-xl bg-black/50 px-4 py-2 text-right">
            <div className="text-xs uppercase tracking-wide opacity-75">Ammo</div>
            <div className="text-2xl font-bold">
              {reloading ? "reloading..." : `${ammoInMag} / ${ammoReserve}`}
            </div>
          </div>
        </div>
      )}

      {/* center overlay */}
      {screen !== "playing" && (
        <div className="fixed left-1/2 top-1/2 z-50 w-[90%] max-w-md -translate-x-1/2 -translate-y-1/2 text-center text-white">
          {screen === "start" && (
            <>
              <h1 className="mb-2 text-2xl font-bold">Shooter prototype</h1>
              <p className="mb-5 text-sm leading-relaxed opacity-80">
                WASD to move, mouse to look, click to shoot, R to reload.
                <br />
                Waves of enemies will close in as day turns to night — survive as long as you can.
              </p>
              <button
                onClick={handleStartClick}
                className="rounded-lg bg-green-400 px-7 py-3 font-bold text-black"
              >
                Click to start
              </button>
            </>
          )}
          {screen === "paused" && (
            <>
              <h1 className="mb-2 text-2xl font-bold">Paused</h1>
              <p className="mb-5 text-sm opacity-80">Click to resume.</p>
              <button
                onClick={handleStartClick}
                className="rounded-lg bg-green-400 px-7 py-3 font-bold text-black"
              >
                Click to resume
              </button>
            </>
          )}
          {screen === "gameover" && (
            <>
              <h1 className="mb-2 text-2xl font-bold text-red-400">You went down</h1>
              <p className="mb-5 text-sm opacity-80">
                Score: {finalScore}
                <br />
                Click to try again.
              </p>
              <button
                onClick={handleStartClick}
                className="rounded-lg bg-green-400 px-7 py-3 font-bold text-black"
              >
                Restart
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
